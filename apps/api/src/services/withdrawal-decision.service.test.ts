import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
  tx: {
    withdrawal: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    wallet: { update: vi.fn(), updateMany: vi.fn() },
    transaction: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('@riderguy/database', () => ({ prisma: mocks.prisma }));
vi.mock('../lib/postgres-advisory-lock', () => ({
  acquireTransactionAdvisoryLock: vi.fn(),
}));

import {
  approveWithdrawalForPayout,
  completeWithdrawalByReference,
  refundFailedWithdrawalByReference,
  rejectWithdrawalByAdmin,
} from './withdrawal-decision.service';

interface TestState {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  balance: number;
  ledgerRows: number;
  auditRows: number;
}

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
  processedAt: null,
  failureReason: null,
  paymentReference: 'TRF_test_1',
  paystackRecipientCode: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
};

let state: TestState;
let failAudit = false;
let failLedger = false;
let paymentReference: string | null;
let failureReason: string | null;
let totalWithdrawn: number;

function record() {
  return { ...withdrawal, status: state.status, paymentReference, failureReason };
}

function installStatefulTransaction() {
  mocks.tx.withdrawal.findUnique.mockImplementation(async () => record());
  mocks.tx.withdrawal.findFirst.mockImplementation(async ({ where }) =>
    where.paymentReference === withdrawal.paymentReference ? record() : null,
  );
  mocks.tx.withdrawal.updateMany.mockImplementation(async ({ where, data }) => {
    const statusAllowed =
      typeof where.status === 'string'
        ? state.status === where.status
        : where.status?.in
          ? where.status.in.includes(state.status)
          : !where.status?.notIn || !where.status.notIn.includes(state.status);
    const referenceAllowed =
      where.paymentReference === undefined || where.paymentReference === paymentReference;
    const allowed = statusAllowed && referenceAllowed;
    if (!allowed) return { count: 0 };
    if ('status' in data) state.status = data.status;
    if ('paymentReference' in data) paymentReference = data.paymentReference;
    if ('failureReason' in data) failureReason = data.failureReason;
    return { count: 1 };
  });
  mocks.tx.wallet.update.mockImplementation(async ({ data }) => {
    if (data.balance?.increment) state.balance += Number(data.balance.increment);
    if (data.totalWithdrawn?.increment) totalWithdrawn += Number(data.totalWithdrawn.increment);
    return { id: withdrawal.walletId, balance: state.balance, totalWithdrawn };
  });
  mocks.tx.wallet.updateMany.mockImplementation(async ({ data }) => {
    if (data.totalWithdrawn?.decrement) totalWithdrawn -= Number(data.totalWithdrawn.decrement);
    return { count: 1 };
  });
  mocks.tx.transaction.create.mockImplementation(async () => {
    if (failLedger) throw new Error('ledger unavailable');
    state.ledgerRows += 1;
    return { id: `ledger-${state.ledgerRows}` };
  });
  mocks.tx.auditLog.create.mockImplementation(async () => {
    if (failAudit) throw new Error('audit unavailable');
    state.auditRows += 1;
    return { id: `audit-${state.auditRows}` };
  });
  mocks.prisma.$transaction.mockImplementation(async (callback) => {
    const snapshot = { ...state };
    const referenceSnapshot = paymentReference;
    const reasonSnapshot = failureReason;
    const totalWithdrawnSnapshot = totalWithdrawn;
    try {
      return await callback(mocks.tx);
    } catch (error) {
      state = snapshot;
      paymentReference = referenceSnapshot;
      failureReason = reasonSnapshot;
      totalWithdrawn = totalWithdrawnSnapshot;
      throw error;
    }
  });
}

describe('withdrawal decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state = { status: 'PENDING', balance: 100, ledgerRows: 0, auditRows: 0 };
    failAudit = false;
    failLedger = false;
    paymentReference = withdrawal.paymentReference;
    failureReason = null;
    totalWithdrawn = 0;
    installStatefulTransaction();
  });

  it('claims an admin-approved withdrawal once and attributes the audit', async () => {
    paymentReference = null;

    const first = await approveWithdrawalForPayout(withdrawal.id, {
      actorUserId: 'admin-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    });
    const retry = await approveWithdrawalForPayout(withdrawal.id, {
      actorUserId: 'admin-2',
    });

    expect(first.outcome).toBe('CLAIMED');
    expect(retry.outcome).toBe('READY_TO_QUEUE');
    expect(state.status).toBe('PROCESSING');
    expect(state.auditRows).toBe(1);
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'withdrawal.approved',
        entityType: 'Withdrawal',
        entityId: withdrawal.id,
      }),
    });
  });

  it('rolls approval back when the approval audit cannot be persisted', async () => {
    paymentReference = null;
    failAudit = true;

    await expect(
      approveWithdrawalForPayout(withdrawal.id, { actorUserId: 'admin-1' }),
    ).rejects.toThrow('audit unavailable');

    expect(state.status).toBe('PENDING');
    expect(state.auditRows).toBe(0);
  });

  it('does not requeue an approval once a provider reference exists', async () => {
    state.status = 'PROCESSING';

    const result = await approveWithdrawalForPayout(withdrawal.id, {
      actorUserId: 'admin-1',
    });

    expect(result.outcome).toBe('ALREADY_SUBMITTED');
    expect(mocks.tx.withdrawal.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('atomically rejects, refunds, records a ledger row, and audits once', async () => {
    const result = await rejectWithdrawalByAdmin(
      withdrawal.id,
      'Destination could not be verified',
      { actorUserId: 'admin-1', ipAddress: '127.0.0.1', userAgent: 'test' },
    );

    expect(result.outcome).toBe('REFUNDED');
    expect(state).toEqual({
      status: 'CANCELLED',
      balance: 125.5,
      ledgerRows: 1,
      auditRows: 1,
    });
    expect(mocks.tx.withdrawal.updateMany).toHaveBeenCalledWith({
      where: { id: withdrawal.id, status: 'PENDING' },
      data: {
        status: 'CANCELLED',
        failureReason: 'Destination could not be verified',
      },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'withdrawal.rejected',
        entityType: 'Withdrawal',
        entityId: withdrawal.id,
      }),
    });
  });

  it('treats a repeated admin rejection as an idempotent no-op', async () => {
    const context = { actorUserId: 'admin-1' };
    await rejectWithdrawalByAdmin(withdrawal.id, 'Invalid destination', context);
    const repeated = await rejectWithdrawalByAdmin(withdrawal.id, 'Invalid destination', context);

    expect(repeated.outcome).toBe('ALREADY_FINAL');
    expect(state.balance).toBe(125.5);
    expect(state.ledgerRows).toBe(1);
    expect(state.auditRows).toBe(1);
    expect(mocks.tx.withdrawal.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not issue a second refund when the pending CAS loses a race', async () => {
    mocks.tx.withdrawal.updateMany.mockImplementationOnce(async () => {
      // Simulate the other transaction committing while this request waited
      // on the row lock. Its refund and audit already exist.
      state = {
        status: 'CANCELLED',
        balance: 125.5,
        ledgerRows: 1,
        auditRows: 1,
      };
      return { count: 0 };
    });

    const result = await rejectWithdrawalByAdmin(withdrawal.id, 'Invalid destination', {
      actorUserId: 'admin-2',
    });

    expect(result.outcome).toBe('ALREADY_FINAL');
    expect(mocks.tx.wallet.update).not.toHaveBeenCalled();
    expect(mocks.tx.transaction.create).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rolls the rejection and wallet refund back if audit persistence fails', async () => {
    failAudit = true;

    await expect(
      rejectWithdrawalByAdmin(withdrawal.id, 'Invalid destination', { actorUserId: 'admin-1' }),
    ).rejects.toThrow('audit unavailable');

    expect(state).toEqual({
      status: 'PENDING',
      balance: 100,
      ledgerRows: 0,
      auditRows: 0,
    });
  });

  it('refunds a failed transfer exactly once across webhook retries', async () => {
    state.status = 'PROCESSING';

    const first = await refundFailedWithdrawalByReference(
      withdrawal.paymentReference,
      'Transfer failed',
    );
    const retry = await refundFailedWithdrawalByReference(
      withdrawal.paymentReference,
      'Transfer failed',
    );

    expect(first?.outcome).toBe('REFUNDED');
    expect(retry?.outcome).toBe('ALREADY_FINAL');
    expect(state).toEqual({
      status: 'FAILED',
      balance: 125.5,
      ledgerRows: 1,
      auditRows: 0,
    });
    expect(mocks.tx.withdrawal.updateMany).toHaveBeenCalledTimes(1);
    expect(failureReason).toContain('Reserved funds were returned to your wallet');
  });

  it('completes a processing transfer and increments total withdrawn exactly once', async () => {
    state.status = 'PROCESSING';

    const first = await completeWithdrawalByReference(withdrawal.paymentReference);
    const retry = await completeWithdrawalByReference(withdrawal.paymentReference);

    expect(first?.outcome).toBe('COMPLETED');
    expect(retry?.outcome).toBe('ALREADY_FINAL');
    expect(state.status).toBe('COMPLETED');
    expect(totalWithdrawn).toBe(25.5);
    expect(mocks.tx.wallet.update).toHaveBeenCalledTimes(1);
  });

  it('rolls completion back if the wallet aggregate cannot be updated', async () => {
    state.status = 'PROCESSING';
    mocks.tx.wallet.update.mockRejectedValueOnce(new Error('wallet aggregate unavailable'));

    await expect(completeWithdrawalByReference(withdrawal.paymentReference)).rejects.toThrow(
      'wallet aggregate unavailable',
    );

    expect(state.status).toBe('PROCESSING');
    expect(totalWithdrawn).toBe(0);
  });

  it('holds a provider success for review when its amount does not match', async () => {
    state.status = 'PROCESSING';

    const result = await completeWithdrawalByReference(withdrawal.paymentReference, 2_600);

    expect(result?.outcome).toBe('AMOUNT_MISMATCH');
    expect(state.status).toBe('PROCESSING');
    expect(totalWithdrawn).toBe(0);
    expect(failureReason).toContain('amount does not match');
  });

  it('never resurrects an already-refunded failure when a late success arrives', async () => {
    state.status = 'PROCESSING';
    await refundFailedWithdrawalByReference(
      withdrawal.paymentReference,
      'Provider rejected transfer',
    );

    const lateSuccess = await completeWithdrawalByReference(withdrawal.paymentReference);

    expect(lateSuccess?.outcome).toBe('IGNORED_TERMINAL');
    expect(state.status).toBe('FAILED');
    expect(state.balance).toBe(125.5);
    expect(totalWithdrawn).toBe(0);
  });

  it('refunds a provider reversal after completion and reverses the aggregate once', async () => {
    state.status = 'PROCESSING';
    await completeWithdrawalByReference(withdrawal.paymentReference);

    const reversal = await refundFailedWithdrawalByReference(
      withdrawal.paymentReference,
      'Receiving bank reversed the transfer',
      'REVERSED',
    );
    const duplicate = await refundFailedWithdrawalByReference(
      withdrawal.paymentReference,
      'Receiving bank reversed the transfer',
      'REVERSED',
    );

    expect(reversal?.outcome).toBe('REFUNDED');
    expect(duplicate?.outcome).toBe('ALREADY_FINAL');
    expect(state.status).toBe('FAILED');
    expect(state.balance).toBe(125.5);
    expect(totalWithdrawn).toBe(0);
    expect(state.ledgerRows).toBe(1);
    expect(failureReason).toContain('Reserved funds were returned to your wallet');
  });

  it('rolls a failed-transfer refund back when the ledger write fails', async () => {
    state.status = 'PROCESSING';
    failLedger = true;

    await expect(
      refundFailedWithdrawalByReference(withdrawal.paymentReference, 'Transfer failed'),
    ).rejects.toThrow('ledger unavailable');

    expect(state).toEqual({
      status: 'PROCESSING',
      balance: 100,
      ledgerRows: 0,
      auditRows: 0,
    });
  });
});
