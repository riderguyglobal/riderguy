import { prisma } from '@riderguy/database';
import { config } from '../config';
import { logger } from '../lib/logger';
import { paystackService } from './paystack.service';
import {
  completeWithdrawalByReference,
  failUnsubmittedWithdrawal,
  markWithdrawalAwaitingConfirmation,
  markWithdrawalSubmissionAccepted,
  refundFailedWithdrawalByReference,
  reserveWithdrawalProviderSubmission,
} from './withdrawal-decision.service';

export interface WithdrawalPayoutProvider {
  createTransferRecipient(params: {
    type: 'ghipss' | 'mobile_money';
    name: string;
    accountNumber: string;
    bankCode: string;
  }): Promise<{ recipientCode: string }>;
  initiateTransfer(params: {
    amount: number;
    recipientCode: string;
    reason: string;
    reference: string;
  }): Promise<{ transferCode: string; reference: string; status: string }>;
  verifyTransfer(reference: string): Promise<{
    status: string;
    amount: number;
    reason: string;
    recipientCode: string;
  }>;
}

export interface WithdrawalPayoutJobInput {
  withdrawalId: string;
}

type PayoutProcessingResult = {
  status: 'skipped' | 'failed' | 'initiated' | 'awaiting_confirmation' | 'completed';
  reference?: string;
  reason?: string;
};

async function reconcileReservedTransfer(
  withdrawalId: string,
  reference: string,
  provider: WithdrawalPayoutProvider,
): Promise<PayoutProcessingResult> {
  try {
    const verification = await provider.verifyTransfer(reference);
    const status = String(verification.status).toLowerCase();

    if (status === 'success' || status === 'completed') {
      const completion = await completeWithdrawalByReference(reference, verification.amount);
      if (completion?.status === 'COMPLETED') {
        return { status: 'completed', reference };
      }
      if (completion?.outcome === 'AMOUNT_MISMATCH') {
        return { status: 'awaiting_confirmation', reference, reason: 'provider_amount_mismatch' };
      }
      return { status: 'skipped', reference, reason: 'withdrawal_changed_before_completion' };
    }
    if (status === 'failed') {
      await refundFailedWithdrawalByReference(
        reference,
        verification.reason || 'Payout failed at the provider. Reserved funds were returned.',
        'FAILED',
      );
      return { status: 'failed', reference, reason: verification.reason };
    }
    if (status === 'reversed') {
      await refundFailedWithdrawalByReference(
        reference,
        verification.reason || 'Payout was reversed by the provider. Reserved funds were returned.',
        'REVERSED',
      );
      return { status: 'failed', reference, reason: verification.reason };
    }

    await markWithdrawalAwaitingConfirmation(
      withdrawalId,
      reference,
      `Payout is ${status || 'pending'} at the provider. Funds remain reserved.`,
    );
    return { status: 'awaiting_confirmation', reference };
  } catch (error) {
    logger.warn({ err: error, withdrawalId, reference }, 'Unable to reconcile reserved payout');
    await markWithdrawalAwaitingConfirmation(
      withdrawalId,
      reference,
      'Payout confirmation is pending. Funds remain reserved; no duplicate payout was submitted.',
    );
    return { status: 'awaiting_confirmation', reference };
  }
}

/**
 * Submit one approved withdrawal to Paystack without ever treating an
 * uncertain provider response as a definitive failure. Database values are
 * authoritative; stale or tampered queue payload fields are ignored.
 */
export async function processWithdrawalPayout(
  input: WithdrawalPayoutJobInput,
  provider: WithdrawalPayoutProvider = paystackService,
  paystackConfigured = Boolean(config.paystack.secretKey),
): Promise<PayoutProcessingResult> {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: input.withdrawalId },
  });

  if (!withdrawal || withdrawal.status !== 'PROCESSING') {
    return { status: 'skipped', reason: 'withdrawal_not_approved_or_already_final' };
  }

  if (withdrawal.paymentReference) {
    return reconcileReservedTransfer(withdrawal.id, withdrawal.paymentReference, provider);
  }

  if (!paystackConfigured) {
    await failUnsubmittedWithdrawal(
      withdrawal.id,
      'Payout processing is temporarily unavailable. Reserved funds were returned to your wallet.',
    );
    return { status: 'failed', reason: 'provider_not_configured' };
  }

  if (!withdrawal.bankCode) {
    await failUnsubmittedWithdrawal(
      withdrawal.id,
      'The payout destination is incomplete. Reserved funds were returned to your wallet.',
    );
    return { status: 'failed', reason: 'missing_provider_code' };
  }

  let recipientCode = withdrawal.paystackRecipientCode;
  if (!recipientCode) {
    try {
      const recipient = await provider.createTransferRecipient({
        type: withdrawal.method === 'MOBILE_MONEY' ? 'mobile_money' : 'ghipss',
        name: withdrawal.destinationName,
        accountNumber: withdrawal.destination,
        bankCode: withdrawal.bankCode,
      });
      recipientCode = recipient.recipientCode;
    } catch (error) {
      logger.error({ err: error, withdrawalId: withdrawal.id }, 'Payout recipient creation failed');
      await failUnsubmittedWithdrawal(
        withdrawal.id,
        'The payout destination could not be prepared. Reserved funds were returned to your wallet.',
      );
      return { status: 'failed', reason: 'recipient_creation_failed' };
    }
  }

  const reference = `WD_${withdrawal.id}`;
  const reservation = await reserveWithdrawalProviderSubmission(
    withdrawal.id,
    reference,
    recipientCode,
  );
  if (reservation.outcome === 'SKIPPED') {
    return { status: 'skipped', reason: 'withdrawal_changed_before_submission' };
  }
  if (reservation.outcome === 'ALREADY_RESERVED') {
    return reconcileReservedTransfer(withdrawal.id, reference, provider);
  }

  try {
    const amountMinor = Math.round(Number(withdrawal.amount) * 100);
    const transfer = await provider.initiateTransfer({
      amount: amountMinor,
      recipientCode,
      reason: `RiderGuy withdrawal #${withdrawal.id.slice(0, 8)}`,
      reference,
    });

    if (transfer.reference !== reference) {
      await markWithdrawalAwaitingConfirmation(
        withdrawal.id,
        reference,
        'Provider returned an unexpected payout reference. Manual confirmation is in progress.',
      );
      return { status: 'awaiting_confirmation', reference };
    }

    const providerStatus = String(transfer.status).toLowerCase();
    if (providerStatus === 'success' || providerStatus === 'completed') {
      const completion = await completeWithdrawalByReference(reference, amountMinor);
      if (completion?.status === 'COMPLETED') {
        return { status: 'completed', reference };
      }
      return { status: 'skipped', reference, reason: 'withdrawal_changed_before_completion' };
    }
    if (providerStatus === 'failed' || providerStatus === 'reversed') {
      await refundFailedWithdrawalByReference(
        reference,
        providerStatus === 'reversed'
          ? 'Payout was reversed by the provider. Reserved funds were returned to your wallet.'
          : 'Payout failed at the provider. Reserved funds were returned to your wallet.',
        providerStatus === 'reversed' ? 'REVERSED' : 'FAILED',
      );
      return { status: 'failed', reference };
    }

    await markWithdrawalSubmissionAccepted(withdrawal.id, reference);
    return { status: 'initiated', reference };
  } catch (error) {
    // A timeout/error after submission is ambiguous: Paystack may have accepted
    // the transfer. Verify once and never refund or submit a second transfer
    // unless a definitive provider event says it failed.
    logger.warn(
      { err: error, withdrawalId: withdrawal.id, reference },
      'Payout outcome is uncertain',
    );
    return reconcileReservedTransfer(withdrawal.id, reference, provider);
  }
}
