import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    withdrawal: {
      findUnique: vi.fn(),
    },
  },
  paystackService: {
    createTransferRecipient: vi.fn(),
    initiateTransfer: vi.fn(),
    verifyTransfer: vi.fn(),
  },
  reserveWithdrawalProviderSubmission: vi.fn(),
  markWithdrawalAwaitingConfirmation: vi.fn(),
  markWithdrawalSubmissionAccepted: vi.fn(),
  completeWithdrawalByReference: vi.fn(),
  failUnsubmittedWithdrawal: vi.fn(),
  refundFailedWithdrawalByReference: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({ prisma: mocks.prisma }));
vi.mock('../config', () => ({
  config: { paystack: { secretKey: 'test-secret' } },
}));
vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('./paystack.service', () => ({ paystackService: mocks.paystackService }));
vi.mock('./withdrawal-decision.service', () => ({
  reserveWithdrawalProviderSubmission: mocks.reserveWithdrawalProviderSubmission,
  markWithdrawalAwaitingConfirmation: mocks.markWithdrawalAwaitingConfirmation,
  markWithdrawalSubmissionAccepted: mocks.markWithdrawalSubmissionAccepted,
  completeWithdrawalByReference: mocks.completeWithdrawalByReference,
  failUnsubmittedWithdrawal: mocks.failUnsubmittedWithdrawal,
  refundFailedWithdrawalByReference: mocks.refundFailedWithdrawalByReference,
}));

import { processWithdrawalPayout } from './withdrawal-payout.service';

const withdrawal = {
  id: 'withdrawal-1',
  walletId: 'wallet-1',
  userId: 'rider-user-1',
  amount: 25.5,
  currency: 'GHS',
  method: 'MOBILE_MONEY',
  destination: '0240000000',
  destinationName: 'Test Rider',
  bankCode: 'MTN',
  status: 'PROCESSING',
  processedAt: null,
  failureReason: null,
  paymentReference: null,
  paystackRecipientCode: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
};

describe('withdrawal payout processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.withdrawal.findUnique.mockResolvedValue({ ...withdrawal });
    mocks.paystackService.createTransferRecipient.mockResolvedValue({
      recipientCode: 'RCP_test',
    });
    mocks.reserveWithdrawalProviderSubmission.mockResolvedValue({
      outcome: 'RESERVED',
      withdrawal: { ...withdrawal, paymentReference: 'WD_withdrawal-1' },
    });
    mocks.paystackService.initiateTransfer.mockResolvedValue({
      transferCode: 'TRF_test',
      reference: 'WD_withdrawal-1',
      status: 'pending',
    });
    mocks.paystackService.verifyTransfer.mockResolvedValue({
      status: 'pending',
      amount: 2550,
      reason: '',
      recipientCode: 'RCP_test',
    });
    mocks.completeWithdrawalByReference.mockResolvedValue({
      outcome: 'COMPLETED',
      withdrawalId: withdrawal.id,
      status: 'COMPLETED',
    });
  });

  it('submits an approved withdrawal once using authoritative database values', async () => {
    const result = await processWithdrawalPayout(
      { withdrawalId: withdrawal.id },
      mocks.paystackService,
      true,
    );

    expect(result).toEqual({ status: 'initiated', reference: 'WD_withdrawal-1' });
    expect(mocks.paystackService.createTransferRecipient).toHaveBeenCalledWith({
      type: 'mobile_money',
      name: withdrawal.destinationName,
      accountNumber: withdrawal.destination,
      bankCode: withdrawal.bankCode,
    });
    expect(mocks.reserveWithdrawalProviderSubmission).toHaveBeenCalledWith(
      withdrawal.id,
      'WD_withdrawal-1',
      'RCP_test',
    );
    expect(mocks.paystackService.initiateTransfer).toHaveBeenCalledOnce();
    expect(mocks.paystackService.initiateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2550, reference: 'WD_withdrawal-1' }),
    );
    expect(mocks.markWithdrawalSubmissionAccepted).toHaveBeenCalledWith(
      withdrawal.id,
      'WD_withdrawal-1',
    );
    expect(mocks.failUnsubmittedWithdrawal).not.toHaveBeenCalled();
  });

  it('does not call the provider for a pending or final withdrawal', async () => {
    mocks.prisma.withdrawal.findUnique.mockResolvedValue({
      ...withdrawal,
      status: 'PENDING',
    });

    const result = await processWithdrawalPayout(
      { withdrawalId: withdrawal.id },
      mocks.paystackService,
      true,
    );

    expect(result.status).toBe('skipped');
    expect(mocks.paystackService.createTransferRecipient).not.toHaveBeenCalled();
    expect(mocks.paystackService.initiateTransfer).not.toHaveBeenCalled();
    expect(mocks.paystackService.verifyTransfer).not.toHaveBeenCalled();
  });

  it('refunds before submission when payout configuration is unavailable', async () => {
    const result = await processWithdrawalPayout(
      { withdrawalId: withdrawal.id },
      mocks.paystackService,
      false,
    );

    expect(result).toEqual({ status: 'failed', reason: 'provider_not_configured' });
    expect(mocks.failUnsubmittedWithdrawal).toHaveBeenCalledWith(
      withdrawal.id,
      expect.stringContaining('returned to your wallet'),
    );
    expect(mocks.paystackService.createTransferRecipient).not.toHaveBeenCalled();
    expect(mocks.paystackService.initiateTransfer).not.toHaveBeenCalled();
  });

  it('never submits twice when another worker has already reserved the reference', async () => {
    mocks.reserveWithdrawalProviderSubmission.mockResolvedValue({
      outcome: 'ALREADY_RESERVED',
      withdrawal: { ...withdrawal, paymentReference: 'WD_withdrawal-1' },
    });

    const result = await processWithdrawalPayout(
      { withdrawalId: withdrawal.id },
      mocks.paystackService,
      true,
    );

    expect(result).toEqual({
      status: 'awaiting_confirmation',
      reference: 'WD_withdrawal-1',
    });
    expect(mocks.paystackService.initiateTransfer).not.toHaveBeenCalled();
    expect(mocks.paystackService.verifyTransfer).toHaveBeenCalledWith('WD_withdrawal-1');
    expect(mocks.markWithdrawalAwaitingConfirmation).toHaveBeenCalledWith(
      withdrawal.id,
      'WD_withdrawal-1',
      expect.stringContaining('Funds remain reserved'),
    );
  });

  it('only verifies an existing provider reference and completes a confirmed transfer', async () => {
    mocks.prisma.withdrawal.findUnique.mockResolvedValue({
      ...withdrawal,
      paymentReference: 'WD_withdrawal-1',
      paystackRecipientCode: 'RCP_test',
    });
    mocks.paystackService.verifyTransfer.mockResolvedValue({
      status: 'success',
      amount: 2550,
      reason: 'Transfer successful',
      recipientCode: 'RCP_test',
    });

    const result = await processWithdrawalPayout(
      { withdrawalId: withdrawal.id },
      mocks.paystackService,
      true,
    );

    expect(result).toEqual({ status: 'completed', reference: 'WD_withdrawal-1' });
    expect(mocks.completeWithdrawalByReference).toHaveBeenCalledWith('WD_withdrawal-1', 2550);
    expect(mocks.paystackService.createTransferRecipient).not.toHaveBeenCalled();
    expect(mocks.paystackService.initiateTransfer).not.toHaveBeenCalled();
  });

  it('keeps funds reserved when transfer initiation has an ambiguous outcome', async () => {
    mocks.paystackService.initiateTransfer.mockRejectedValue(new Error('network timeout'));
    mocks.paystackService.verifyTransfer.mockRejectedValue(new Error('verification unavailable'));

    const result = await processWithdrawalPayout(
      { withdrawalId: withdrawal.id },
      mocks.paystackService,
      true,
    );

    expect(result).toEqual({
      status: 'awaiting_confirmation',
      reference: 'WD_withdrawal-1',
    });
    expect(mocks.paystackService.initiateTransfer).toHaveBeenCalledOnce();
    expect(mocks.failUnsubmittedWithdrawal).not.toHaveBeenCalled();
    expect(mocks.refundFailedWithdrawalByReference).not.toHaveBeenCalled();
    expect(mocks.markWithdrawalAwaitingConfirmation).toHaveBeenCalledWith(
      withdrawal.id,
      'WD_withdrawal-1',
      expect.stringContaining('no duplicate payout was submitted'),
    );
  });

  it('refunds once a reserved transfer is definitively reported as failed', async () => {
    mocks.prisma.withdrawal.findUnique.mockResolvedValue({
      ...withdrawal,
      paymentReference: 'WD_withdrawal-1',
      paystackRecipientCode: 'RCP_test',
    });
    mocks.paystackService.verifyTransfer.mockResolvedValue({
      status: 'failed',
      amount: 2550,
      reason: 'Destination rejected the payout',
      recipientCode: 'RCP_test',
    });

    const result = await processWithdrawalPayout(
      { withdrawalId: withdrawal.id },
      mocks.paystackService,
      true,
    );

    expect(result).toEqual({
      status: 'failed',
      reference: 'WD_withdrawal-1',
      reason: 'Destination rejected the payout',
    });
    expect(mocks.refundFailedWithdrawalByReference).toHaveBeenCalledWith(
      'WD_withdrawal-1',
      'Destination rejected the payout',
      'FAILED',
    );
    expect(mocks.paystackService.initiateTransfer).not.toHaveBeenCalled();
  });

  it('does not complete a provider success whose amount is inconsistent', async () => {
    mocks.prisma.withdrawal.findUnique.mockResolvedValue({
      ...withdrawal,
      paymentReference: 'WD_withdrawal-1',
      paystackRecipientCode: 'RCP_test',
    });
    mocks.paystackService.verifyTransfer.mockResolvedValue({
      status: 'success',
      amount: 2_600,
      reason: 'Transfer successful',
      recipientCode: 'RCP_test',
    });
    mocks.completeWithdrawalByReference.mockResolvedValue({
      outcome: 'AMOUNT_MISMATCH',
      withdrawalId: withdrawal.id,
      status: 'PROCESSING',
    });

    const result = await processWithdrawalPayout(
      { withdrawalId: withdrawal.id },
      mocks.paystackService,
      true,
    );

    expect(result).toEqual({
      status: 'awaiting_confirmation',
      reference: 'WD_withdrawal-1',
      reason: 'provider_amount_mismatch',
    });
    expect(mocks.completeWithdrawalByReference).toHaveBeenCalledWith('WD_withdrawal-1', 2_600);
    expect(mocks.paystackService.initiateTransfer).not.toHaveBeenCalled();
  });
});
