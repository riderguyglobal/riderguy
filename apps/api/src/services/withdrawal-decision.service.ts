import type { Prisma } from '@prisma/client';
import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

type WithdrawalRecord = Awaited<ReturnType<Prisma.TransactionClient['withdrawal']['findUnique']>>;

export interface WithdrawalRefundResult {
  outcome: 'REFUNDED' | 'ALREADY_FINAL';
  withdrawalId: string;
  status: 'FAILED' | 'CANCELLED';
}

type ExistingWithdrawal = NonNullable<WithdrawalRecord>;

export interface WithdrawalApprovalResult {
  outcome: 'CLAIMED' | 'READY_TO_QUEUE' | 'ALREADY_SUBMITTED';
  withdrawal: ExistingWithdrawal;
}

export interface WithdrawalCompletionResult {
  outcome: 'COMPLETED' | 'ALREADY_FINAL' | 'IGNORED_TERMINAL' | 'AMOUNT_MISMATCH';
  withdrawalId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

function normalizeFailureReason(reason: unknown, fallback: string): string {
  if (typeof reason !== 'string') return fallback;
  const normalized = reason.replace(/\s+/g, ' ').trim();
  return (normalized || fallback).slice(0, 500);
}

function refundFailureReason(reason: unknown, fallback: string): string {
  const detail = normalizeFailureReason(reason, fallback);
  if (/\b(returned|refunded)\b/i.test(detail)) return detail;
  return `${detail.replace(/[.!?]+$/, '')}. Reserved funds were returned to your wallet.`.slice(
    0,
    500,
  );
}

/** Atomically move a reserved withdrawal into the administrator-approved queue state. */
export async function approveWithdrawalForPayout(
  withdrawalId: string,
  auditContext: AdminAuditContext,
): Promise<WithdrawalApprovalResult> {
  return prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'withdrawal-approval', withdrawalId);
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw ApiError.notFound('Withdrawal not found');

    if (withdrawal.status === 'PROCESSING') {
      return {
        outcome: withdrawal.paymentReference ? 'ALREADY_SUBMITTED' : 'READY_TO_QUEUE',
        withdrawal,
      };
    }
    if (withdrawal.status !== 'PENDING') {
      throw ApiError.badRequest(
        `Cannot approve a ${withdrawal.status} withdrawal`,
        'INVALID_STATUS',
      );
    }

    const changed = await tx.withdrawal.updateMany({
      where: { id: withdrawalId, status: 'PENDING' },
      data: { status: 'PROCESSING', failureReason: null },
    });
    if (changed.count !== 1) {
      const latest = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (latest?.status === 'PROCESSING') {
        return {
          outcome: latest.paymentReference ? 'ALREADY_SUBMITTED' : 'READY_TO_QUEUE',
          withdrawal: latest,
        };
      }
      throw ApiError.conflict(
        'Withdrawal changed while it was being approved',
        'WITHDRAWAL_DECISION_CONFLICT',
      );
    }

    const approved = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!approved) throw ApiError.notFound('Withdrawal not found after approval');

    await AdminAuditService.record(
      {
        ...auditContext,
        action: 'withdrawal.approved',
        entityType: 'Withdrawal',
        entityId: withdrawalId,
        oldData: { status: withdrawal.status },
        newData: { status: 'PROCESSING', amount: withdrawal.amount, walletId: withdrawal.walletId },
      },
      tx,
    );

    return { outcome: 'CLAIMED', withdrawal: approved };
  });
}

async function refundWallet(
  tx: Prisma.TransactionClient,
  withdrawal: NonNullable<WithdrawalRecord>,
  description: string,
) {
  const updatedWallet = await tx.wallet.update({
    where: { id: withdrawal.walletId },
    data: { balance: { increment: withdrawal.amount } },
  });

  await tx.transaction.create({
    data: {
      walletId: updatedWallet.id,
      type: 'REFUND',
      amount: withdrawal.amount,
      balanceAfter: updatedWallet.balance,
      description,
      referenceId: withdrawal.id,
      referenceType: 'withdrawal',
    },
  });
}

export async function reserveWithdrawalProviderSubmission(
  withdrawalId: string,
  paymentReference: string,
  recipientCode: string,
): Promise<{
  outcome: 'RESERVED' | 'ALREADY_RESERVED' | 'SKIPPED';
  withdrawal: ExistingWithdrawal;
}> {
  return prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'withdrawal-submission', withdrawalId);
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw ApiError.notFound('Withdrawal not found');

    if (withdrawal.status !== 'PROCESSING') {
      return { outcome: 'SKIPPED', withdrawal };
    }
    if (withdrawal.paymentReference) {
      if (withdrawal.paymentReference !== paymentReference) {
        throw ApiError.conflict(
          'Withdrawal already has a different provider reference',
          'WITHDRAWAL_REFERENCE_CONFLICT',
        );
      }
      return { outcome: 'ALREADY_RESERVED', withdrawal };
    }

    const changed = await tx.withdrawal.updateMany({
      where: { id: withdrawalId, status: 'PROCESSING', paymentReference: null },
      data: {
        paymentReference,
        paystackRecipientCode: recipientCode,
        failureReason: 'Payout submission is awaiting provider confirmation.',
      },
    });
    const latest = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!latest) throw ApiError.notFound('Withdrawal not found after submission reservation');

    if (changed.count !== 1) {
      if (latest.status === 'PROCESSING' && latest.paymentReference === paymentReference) {
        return { outcome: 'ALREADY_RESERVED', withdrawal: latest };
      }
      return { outcome: 'SKIPPED', withdrawal: latest };
    }

    return { outcome: 'RESERVED', withdrawal: latest };
  });
}

export async function markWithdrawalAwaitingConfirmation(
  withdrawalId: string,
  paymentReference: string,
  message = 'Payout submission is awaiting provider confirmation.',
) {
  return prisma.withdrawal.updateMany({
    where: { id: withdrawalId, status: 'PROCESSING', paymentReference },
    data: { failureReason: normalizeFailureReason(message, 'Payout confirmation is pending.') },
  });
}

export async function markWithdrawalSubmissionAccepted(
  withdrawalId: string,
  paymentReference: string,
) {
  return prisma.withdrawal.updateMany({
    where: { id: withdrawalId, status: 'PROCESSING', paymentReference },
    data: { failureReason: null },
  });
}

export async function markWithdrawalQueueUnavailable(withdrawalId: string) {
  return prisma.withdrawal.updateMany({
    where: { id: withdrawalId, status: 'PROCESSING', paymentReference: null },
    data: {
      failureReason: 'Payout approval is saved, but queueing is delayed. No funds were lost.',
    },
  });
}

/** Fail and refund only while no transfer reference has been reserved or submitted. */
export async function failUnsubmittedWithdrawal(
  withdrawalId: string,
  failureReason: string,
): Promise<WithdrawalRefundResult> {
  const riderReason = refundFailureReason(
    failureReason,
    'Payout could not be submitted. Reserved funds were returned to your wallet.',
  );

  return prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'withdrawal-submission', withdrawalId);
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw ApiError.notFound('Withdrawal not found');

    if (withdrawal.status === 'FAILED') {
      return { outcome: 'ALREADY_FINAL', withdrawalId, status: 'FAILED' };
    }
    if (withdrawal.status !== 'PROCESSING' || withdrawal.paymentReference) {
      throw ApiError.conflict(
        'A submitted or final withdrawal cannot be refunded as an unsubmitted payout',
        'WITHDRAWAL_SUBMISSION_AMBIGUOUS',
      );
    }

    const changed = await tx.withdrawal.updateMany({
      where: { id: withdrawalId, status: 'PROCESSING', paymentReference: null },
      data: { status: 'FAILED', failureReason: riderReason, processedAt: new Date() },
    });
    if (changed.count !== 1) {
      throw ApiError.conflict(
        'Withdrawal changed while the failed payout was being refunded',
        'WITHDRAWAL_DECISION_CONFLICT',
      );
    }

    await refundWallet(tx, withdrawal, riderReason);
    return { outcome: 'REFUNDED', withdrawalId, status: 'FAILED' };
  });
}

/** Apply a provider success exactly once with the wallet aggregate in the same transaction. */
export async function completeWithdrawalByReference(
  paymentReference: string,
  providerAmountMinor?: unknown,
): Promise<WithdrawalCompletionResult | null> {
  return prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'withdrawal-provider-reference', paymentReference);
    const withdrawal = await tx.withdrawal.findFirst({ where: { paymentReference } });
    if (!withdrawal) return null;

    if (withdrawal.status === 'COMPLETED') {
      return { outcome: 'ALREADY_FINAL', withdrawalId: withdrawal.id, status: 'COMPLETED' };
    }
    if (withdrawal.status !== 'PROCESSING') {
      return {
        outcome: 'IGNORED_TERMINAL',
        withdrawalId: withdrawal.id,
        status: withdrawal.status,
      };
    }

    if (providerAmountMinor !== undefined) {
      const receivedAmountMinor = Number(providerAmountMinor);
      const expectedAmountMinor = Math.round(Number(withdrawal.amount) * 100);
      if (
        !Number.isSafeInteger(receivedAmountMinor) ||
        receivedAmountMinor !== expectedAmountMinor
      ) {
        await tx.withdrawal.updateMany({
          where: { id: withdrawal.id, status: 'PROCESSING', paymentReference },
          data: {
            failureReason:
              'Provider payout amount does not match this withdrawal. Manual confirmation is required; funds remain reserved.',
          },
        });
        return {
          outcome: 'AMOUNT_MISMATCH',
          withdrawalId: withdrawal.id,
          status: 'PROCESSING',
        };
      }
    }

    const changed = await tx.withdrawal.updateMany({
      where: { id: withdrawal.id, status: 'PROCESSING', paymentReference },
      data: { status: 'COMPLETED', processedAt: new Date(), failureReason: null },
    });
    if (changed.count !== 1) {
      const latest = await tx.withdrawal.findUnique({ where: { id: withdrawal.id } });
      return {
        outcome: latest?.status === 'COMPLETED' ? 'ALREADY_FINAL' : 'IGNORED_TERMINAL',
        withdrawalId: withdrawal.id,
        status: latest?.status ?? withdrawal.status,
      };
    }

    await tx.wallet.update({
      where: { id: withdrawal.walletId },
      data: { totalWithdrawn: { increment: withdrawal.amount } },
    });

    return { outcome: 'COMPLETED', withdrawalId: withdrawal.id, status: 'COMPLETED' };
  });
}

/**
 * Reject a pending withdrawal and return its reserved amount to the wallet.
 *
 * The status CAS, wallet credit, ledger row, and audit record share one
 * transaction. A repeated request after a successful commit is idempotent;
 * concurrent requests can only pass the PENDING CAS once.
 */
export async function rejectWithdrawalByAdmin(
  withdrawalId: string,
  reason: string,
  auditContext: AdminAuditContext,
): Promise<WithdrawalRefundResult> {
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw ApiError.notFound('Withdrawal not found');

    if (withdrawal.status === 'CANCELLED') {
      return { outcome: 'ALREADY_FINAL', withdrawalId, status: 'CANCELLED' };
    }
    if (withdrawal.status !== 'PENDING') {
      throw ApiError.badRequest(
        `Cannot reject a ${withdrawal.status} withdrawal`,
        'INVALID_STATUS',
      );
    }

    const changed = await tx.withdrawal.updateMany({
      where: { id: withdrawalId, status: 'PENDING' },
      data: { status: 'CANCELLED', failureReason: reason },
    });

    if (changed.count !== 1) {
      const latest = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (latest?.status === 'CANCELLED') {
        return { outcome: 'ALREADY_FINAL', withdrawalId, status: 'CANCELLED' };
      }
      throw ApiError.conflict(
        'Withdrawal changed while it was being rejected',
        'WITHDRAWAL_DECISION_CONFLICT',
      );
    }

    await refundWallet(tx, withdrawal, `Refund for rejected withdrawal: ${reason}`);

    await AdminAuditService.record(
      {
        ...auditContext,
        action: 'withdrawal.rejected',
        entityType: 'Withdrawal',
        entityId: withdrawalId,
        oldData: { status: withdrawal.status },
        newData: {
          status: 'CANCELLED',
          reason,
          amountRefunded: withdrawal.amount,
          walletId: withdrawal.walletId,
        },
      },
      tx,
    );

    return { outcome: 'REFUNDED', withdrawalId, status: 'CANCELLED' };
  });
}

/**
 * Apply a Paystack transfer.failed/transfer.reversed event.
 *
 * Terminal withdrawals are intentionally ignored. The compare-and-set and
 * refund ledger are atomic, so retries and concurrent webhook deliveries
 * cannot return the same reserved funds more than once.
 */
export async function refundFailedWithdrawalByReference(
  paymentReference: string,
  failureReason: unknown,
  eventKind: 'FAILED' | 'REVERSED' = 'FAILED',
): Promise<WithdrawalRefundResult | null> {
  const riderReason = refundFailureReason(
    failureReason,
    eventKind === 'REVERSED'
      ? 'Payout was reversed by the provider. Reserved funds were returned to your wallet.'
      : 'Payout failed at the provider. Reserved funds were returned to your wallet.',
  );

  return prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'withdrawal-provider-reference', paymentReference);
    const withdrawal = await tx.withdrawal.findFirst({
      where: { paymentReference },
    });
    if (!withdrawal) return null;

    if (withdrawal.status === 'FAILED') {
      return {
        outcome: 'ALREADY_FINAL',
        withdrawalId: withdrawal.id,
        status: 'FAILED',
      };
    }
    if (withdrawal.status === 'CANCELLED') {
      return null;
    }
    if (withdrawal.status === 'COMPLETED' && eventKind !== 'REVERSED') return null;

    const allowedStatuses =
      eventKind === 'REVERSED'
        ? (['PENDING', 'PROCESSING', 'COMPLETED'] as const)
        : (['PENDING', 'PROCESSING'] as const);
    if (!allowedStatuses.includes(withdrawal.status as never)) return null;

    const changed = await tx.withdrawal.updateMany({
      where: {
        id: withdrawal.id,
        status: { in: [...allowedStatuses] },
        paymentReference,
      },
      data: { status: 'FAILED', failureReason: riderReason, processedAt: new Date() },
    });

    if (changed.count !== 1) {
      const latest = await tx.withdrawal.findUnique({ where: { id: withdrawal.id } });
      if (latest?.status === 'FAILED') {
        return {
          outcome: 'ALREADY_FINAL',
          withdrawalId: withdrawal.id,
          status: 'FAILED',
        };
      }
      return null;
    }

    if (withdrawal.status === 'COMPLETED') {
      await tx.wallet.updateMany({
        where: { id: withdrawal.walletId, totalWithdrawn: { gte: withdrawal.amount } },
        data: { totalWithdrawn: { decrement: withdrawal.amount } },
      });
    }

    await refundWallet(tx, withdrawal, riderReason);

    return {
      outcome: 'REFUNDED',
      withdrawalId: withdrawal.id,
      status: 'FAILED',
    };
  });
}
