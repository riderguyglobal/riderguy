import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    cancellationAppeal: { findMany: vi.fn() },
  },
  tx: {
    cancellationAppeal: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    cancellationRecord: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    riderProfile: { findUnique: vi.fn(), update: vi.fn() },
  },
  creditWallet: vi.fn(),
  debitWallet: vi.fn(),
  createOrderNotification: vi.fn(),
  acquireTransactionAdvisoryLock: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({ prisma: mocks.prisma }));
vi.mock('./wallet.service', () => ({
  creditWallet: mocks.creditWallet,
  debitWallet: mocks.debitWallet,
}));
vi.mock('./notification.service', () => ({
  createOrderNotification: mocks.createOrderNotification,
}));
vi.mock('../lib/postgres-advisory-lock', () => ({
  acquireTransactionAdvisoryLock: mocks.acquireTransactionAdvisoryLock,
}));
vi.mock('./admin-audit.service', () => ({
  AdminAuditService: { record: mocks.recordAudit },
}));

import {
  closeCancellationInvestigation,
  getPendingAppeals,
  processCancellationConsequences,
  reviewAppeal,
} from './cancellation.service';
import { ApiError } from '../lib/api-error';

const audit = {
  actorUserId: 'admin-user-1',
  ipAddress: '127.0.0.1',
  userAgent: 'cancellation-test',
};

function pendingAppeal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appeal-1',
    cancellationId: 'cancellation-1',
    riderId: 'rider-profile-1',
    status: 'PENDING',
    penaltyRefunded: false,
    suspensionLifted: false,
    cancellation: {
      penaltyAmount: 15,
      penaltyApplied: true,
      suspensionApplied: true,
      rider: {
        id: 'rider-profile-1',
        userId: 'rider-user-1',
        suspendedUntil: new Date('2099-01-01T00:00:00.000Z'),
      },
    },
    ...overrides,
  };
}

interface ConsequenceRecordState {
  id: string;
  riderId: string;
  orderId: string;
  category: string;
  reason: string;
  orderStatusAtCancel: string;
  severity: string;
  penaltyAmount: number;
  penaltyApplied: boolean;
  suspensionHours: number;
  suspensionApplied: boolean;
  requiresInvestigation: boolean;
  cancellationsInWindow: number;
}

interface ConsequenceState {
  record: ConsequenceRecordState | null;
  walletBalance: number;
  riderCancellationCount: number;
  availability: string;
  suspendedUntil: Date | null;
}

describe('rider cancellation consequence transaction', () => {
  let state: ConsequenceState;
  let recentCount: number;
  let transactionActive: boolean;
  let notificationBeforeCommit: boolean;
  let failStatsUpdate: boolean;
  let debitFailure: Error | null;

  function snapshot(): ConsequenceState {
    return {
      ...state,
      record: state.record ? { ...state.record } : null,
      suspendedUntil: state.suspendedUntil ? new Date(state.suspendedUntil) : null,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      record: null,
      walletBalance: 100,
      riderCancellationCount: 0,
      availability: 'ONLINE',
      suspendedUntil: null,
    };
    recentCount = 3;
    transactionActive = false;
    notificationBeforeCommit = false;
    failStatsUpdate = false;
    debitFailure = null;

    mocks.prisma.$transaction.mockImplementation(async (callback) => {
      const before = snapshot();
      transactionActive = true;
      try {
        const result = await callback(mocks.tx);
        transactionActive = false;
        return result;
      } catch (error) {
        state = before;
        transactionActive = false;
        throw error;
      }
    });
    mocks.tx.cancellationRecord.findUnique.mockImplementation(async () => state.record);
    mocks.tx.cancellationRecord.count.mockImplementation(async () => recentCount);
    mocks.tx.riderProfile.findUnique.mockResolvedValue({ suspendedUntil: null });
    mocks.tx.cancellationRecord.create.mockImplementation(async ({ data }) => {
      state.record = {
        id: 'cancellation-1',
        ...data,
        penaltyApplied: false,
      } as ConsequenceRecordState;
      return state.record;
    });
    mocks.tx.cancellationRecord.update.mockImplementation(async ({ data }) => {
      if (!state.record) throw new Error('missing cancellation record');
      state.record = { ...state.record, ...data };
      return state.record;
    });
    mocks.tx.cancellationRecord.findUniqueOrThrow.mockImplementation(async () => {
      if (!state.record) throw new Error('missing cancellation record');
      return state.record;
    });
    mocks.tx.riderProfile.update.mockImplementation(async ({ data }) => {
      if (data.cancellationCount) {
        if (failStatsUpdate) throw new Error('rider stats unavailable');
        state.riderCancellationCount += Number(data.cancellationCount.increment);
      }
      if (data.availability) state.availability = data.availability;
      if (data.suspendedUntil) state.suspendedUntil = data.suspendedUntil;
      return { id: 'rider-profile-1' };
    });
    mocks.debitWallet.mockImplementation(async (...args) => {
      if (debitFailure) throw debitFailure;
      state.walletBalance -= Number(args[1]);
      return { transaction: { id: 'penalty-transaction-1' } };
    });
    mocks.createOrderNotification.mockImplementation(async () => {
      if (transactionActive) notificationBeforeCommit = true;
      return { id: 'notification-1' };
    });
  });

  async function process() {
    return processCancellationConsequences(
      'rider-profile-1',
      'rider-user-1',
      'order-1',
      'RG-1001',
      'ASSIGNED',
      'Changed my mind',
      'client-user-1',
    );
  }

  it('commits the record, penalty, suspension, and rider counter as one consequence', async () => {
    const record = await process();

    expect(record).toMatchObject({
      id: 'cancellation-1',
      severity: 'SEVERE',
      penaltyAmount: 20,
      penaltyApplied: true,
      suspensionApplied: true,
      cancellationsInWindow: 4,
    });
    expect(state.walletBalance).toBe(80);
    expect(state.riderCancellationCount).toBe(1);
    expect(state.availability).toBe('OFFLINE');
    expect(state.suspendedUntil).toBeInstanceOf(Date);
    expect(mocks.acquireTransactionAdvisoryLock).toHaveBeenCalledWith(
      mocks.tx,
      'cancellation-rider',
      'rider-profile-1',
    );
    expect(mocks.acquireTransactionAdvisoryLock).toHaveBeenCalledWith(
      mocks.tx,
      'cancellation-order',
      'order-1',
    );
    expect(mocks.debitWallet).toHaveBeenCalledWith(
      'rider-user-1',
      20,
      'PENALTY',
      expect.stringContaining('RG-1001'),
      'cancellation-1',
      'cancellation_penalty',
      mocks.tx,
    );
    expect(mocks.createOrderNotification).toHaveBeenCalledTimes(2);
    expect(notificationBeforeCommit).toBe(false);
  });

  it('treats a retry as a no-op without a second charge, counter increment, or notification', async () => {
    const first = await process();
    const retry = await process();

    expect(retry).toEqual(first);
    expect(state.walletBalance).toBe(80);
    expect(state.riderCancellationCount).toBe(1);
    expect(mocks.tx.cancellationRecord.create).toHaveBeenCalledTimes(1);
    expect(mocks.debitWallet).toHaveBeenCalledTimes(1);
    expect(mocks.createOrderNotification).toHaveBeenCalledTimes(2);
  });

  it('applies one consequence when two retries arrive concurrently', async () => {
    let transactionTail: Promise<unknown> = Promise.resolve();
    mocks.prisma.$transaction.mockImplementation((callback) => {
      const current = transactionTail.then(() => callback(mocks.tx));
      transactionTail = current.then(
        () => undefined,
        () => undefined,
      );
      return current;
    });
    mocks.createOrderNotification.mockResolvedValue({ id: 'notification-1' });

    const [first, second] = await Promise.all([process(), process()]);

    expect(second).toEqual(first);
    expect(state.walletBalance).toBe(80);
    expect(state.riderCancellationCount).toBe(1);
    expect(mocks.tx.cancellationRecord.create).toHaveBeenCalledTimes(1);
    expect(mocks.debitWallet).toHaveBeenCalledTimes(1);
  });

  it('does not shorten a longer suspension that is already active', async () => {
    const existingSuspensionEnd = new Date('2099-01-01T00:00:00.000Z');
    mocks.tx.riderProfile.findUnique.mockResolvedValue({
      suspendedUntil: existingSuspensionEnd,
    });

    await process();

    expect(state.suspendedUntil).toEqual(existingSuspensionEnd);
    expect(mocks.tx.riderProfile.update).toHaveBeenCalledWith({
      where: { id: 'rider-profile-1' },
      data: expect.objectContaining({
        suspendedUntil: existingSuspensionEnd,
        availability: 'OFFLINE',
        cancellationCount: { increment: 1 },
      }),
    });
  });

  it('rolls every database effect back and can be retried safely after a late failure', async () => {
    failStatsUpdate = true;

    await expect(process()).rejects.toThrow('rider stats unavailable');
    expect(state).toEqual({
      record: null,
      walletBalance: 100,
      riderCancellationCount: 0,
      availability: 'ONLINE',
      suspendedUntil: null,
    });
    expect(mocks.createOrderNotification).not.toHaveBeenCalled();

    failStatsUpdate = false;
    await expect(process()).resolves.toMatchObject({ penaltyApplied: true });
    expect(state.walletBalance).toBe(80);
    expect(state.riderCancellationCount).toBe(1);
    expect(mocks.createOrderNotification).toHaveBeenCalledTimes(2);
  });

  it('does not swallow an unexpected wallet persistence error', async () => {
    debitFailure = new Error('wallet database unavailable');

    await expect(process()).rejects.toThrow('wallet database unavailable');
    expect(state.record).toBeNull();
    expect(state.walletBalance).toBe(100);
    expect(state.riderCancellationCount).toBe(0);
    expect(mocks.createOrderNotification).not.toHaveBeenCalled();
  });

  it('records but does not falsely mark an uncollectable penalty as debited', async () => {
    recentCount = 1;
    debitFailure = ApiError.badRequest('Insufficient wallet balance');

    const record = await process();

    expect(record).toMatchObject({
      severity: 'MINOR',
      penaltyAmount: 5,
      penaltyApplied: false,
      suspensionApplied: false,
      cancellationsInWindow: 2,
    });
    expect(state.walletBalance).toBe(100);
    expect(state.riderCancellationCount).toBe(1);
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      'rider-user-1',
      'Cancellation Consequence Recorded ⚠️',
      expect.stringContaining('no wallet debit was made'),
      'order-1',
    );
  });
});

describe('cancellation appeal decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.cancellationAppeal.findUnique.mockResolvedValue(pendingAppeal());
    mocks.tx.cancellationAppeal.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.cancellationAppeal.findUniqueOrThrow.mockResolvedValue({
      ...pendingAppeal(),
      status: 'APPROVED',
      reviewedBy: audit.actorUserId,
    });
    mocks.creditWallet.mockResolvedValue({ transaction: { id: 'refund-transaction-1' } });
    mocks.recordAudit.mockResolvedValue({ id: 'audit-1' });
  });

  it('atomically claims, refunds, lifts, and audits an approved appeal', async () => {
    const result = await reviewAppeal(
      'appeal-1',
      'APPROVED',
      '  The submitted evidence verifies the breakdown.  ',
      true,
      true,
      audit,
    );

    expect(result).toMatchObject({ status: 'APPROVED', reviewedBy: audit.actorUserId });
    expect(mocks.acquireTransactionAdvisoryLock).toHaveBeenCalledWith(
      mocks.tx,
      'cancellation-appeal',
      'appeal-1',
    );
    expect(mocks.tx.cancellationAppeal.updateMany).toHaveBeenCalledWith({
      where: { id: 'appeal-1', status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      data: expect.objectContaining({
        status: 'APPROVED',
        reviewedBy: audit.actorUserId,
        reviewNotes: 'The submitted evidence verifies the breakdown.',
        penaltyRefunded: true,
        suspensionLifted: true,
      }),
    });
    expect(mocks.creditWallet).toHaveBeenCalledWith(
      'rider-user-1',
      15,
      'REFUND',
      expect.stringContaining('approved'),
      'cancellation-1',
      'appeal_refund',
      mocks.tx,
    );
    expect(mocks.tx.riderProfile.update).toHaveBeenCalledWith({
      where: { id: 'rider-profile-1' },
      data: { suspendedUntil: null },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: audit.actorUserId,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
        action: 'CANCELLATION_APPEAL_DECIDED',
        entityId: 'appeal-1',
      }),
      mocks.tx,
    );
    expect(mocks.tx.cancellationAppeal.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.creditWallet.mock.invocationCallOrder[0],
    );
  });

  it('rejects a denied appeal that attempts to reverse a consequence', async () => {
    await expect(
      reviewAppeal(
        'appeal-1',
        'DENIED',
        'The supplied evidence does not support the claim.',
        true,
        false,
        audit,
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.creditWallet).not.toHaveBeenCalled();
  });

  it('does not refund a penalty that was never charged', async () => {
    mocks.tx.cancellationAppeal.findUnique.mockResolvedValue(
      pendingAppeal({
        cancellation: {
          ...pendingAppeal().cancellation,
          penaltyApplied: false,
        },
      }),
    );

    await expect(
      reviewAppeal(
        'appeal-1',
        'APPROVED',
        'The appeal should be accepted after review.',
        true,
        false,
        audit,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('no applied penalty'),
    });

    expect(mocks.tx.cancellationAppeal.updateMany).not.toHaveBeenCalled();
    expect(mocks.creditWallet).not.toHaveBeenCalled();
  });

  it('rejects a repeated decision without duplicating money or audit side effects', async () => {
    mocks.tx.cancellationAppeal.findUnique.mockResolvedValue(pendingAppeal({ status: 'APPROVED' }));

    await expect(
      reviewAppeal(
        'appeal-1',
        'APPROVED',
        'The evidence has already been reviewed.',
        true,
        true,
        audit,
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });

    expect(mocks.tx.cancellationAppeal.updateMany).not.toHaveBeenCalled();
    expect(mocks.creditWallet).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('stops before refunding if the decision compare-and-set loses a race', async () => {
    mocks.tx.cancellationAppeal.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      reviewAppeal(
        'appeal-1',
        'APPROVED',
        'A concurrent administrator decision was submitted.',
        true,
        true,
        audit,
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });

    expect(mocks.creditWallet).not.toHaveBeenCalled();
    expect(mocks.tx.riderProfile.update).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('propagates an audit failure from the same transaction', async () => {
    mocks.recordAudit.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      reviewAppeal(
        'appeal-1',
        'APPROVED',
        'The evidence confirms that the rider was not at fault.',
        true,
        true,
        audit,
      ),
    ).rejects.toThrow('audit unavailable');

    expect(mocks.creditWallet).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      mocks.tx,
    );
  });
});

describe('cancellation investigations', () => {
  const openInvestigation = {
    id: 'cancellation-1',
    requiresInvestigation: true,
    investigationNotes: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.cancellationRecord.findUnique.mockResolvedValue(openInvestigation);
    mocks.tx.cancellationRecord.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.cancellationRecord.findUniqueOrThrow.mockResolvedValue({
      ...openInvestigation,
      investigationNotes: 'Evidence reviewed; no further action is required.',
    });
    mocks.recordAudit.mockResolvedValue({ id: 'audit-1' });
  });

  it('closes a flagged investigation once with the administrator attribution', async () => {
    await closeCancellationInvestigation(
      'cancellation-1',
      '  Evidence reviewed; no further action is required.  ',
      audit,
    );

    expect(mocks.acquireTransactionAdvisoryLock).toHaveBeenCalledWith(
      mocks.tx,
      'cancellation-investigation',
      'cancellation-1',
    );
    expect(mocks.tx.cancellationRecord.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'cancellation-1',
        requiresInvestigation: true,
        investigationNotes: null,
      },
      data: { investigationNotes: 'Evidence reviewed; no further action is required.' },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: audit.actorUserId,
        action: 'CANCELLATION_INVESTIGATION_CLOSED',
        entityId: 'cancellation-1',
      }),
      mocks.tx,
    );
  });

  it('rejects a concurrent second close before writing another audit record', async () => {
    mocks.tx.cancellationRecord.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      closeCancellationInvestigation(
        'cancellation-1',
        'Evidence was reviewed by a second administrator.',
        audit,
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });

    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('does not allow the investigation endpoint to annotate an unflagged cancellation', async () => {
    mocks.tx.cancellationRecord.findUnique.mockResolvedValue({
      ...openInvestigation,
      requiresInvestigation: false,
    });

    await expect(
      closeCancellationInvestigation(
        'cancellation-1',
        'There is no flagged case to investigate.',
        audit,
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });

    expect(mocks.tx.cancellationRecord.updateMany).not.toHaveBeenCalled();
  });
});

describe('pending cancellation appeal queue', () => {
  it('keeps pending and already-under-review appeals visible to administrators', async () => {
    mocks.prisma.cancellationAppeal.findMany.mockResolvedValue([]);

    await getPendingAppeals();

    expect(mocks.prisma.cancellationAppeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      }),
    );
  });

  it('tells the administrator which appeal remedies are currently applicable', async () => {
    mocks.prisma.cancellationAppeal.findMany.mockResolvedValue([
      pendingAppeal(),
      pendingAppeal({
        id: 'appeal-2',
        cancellation: {
          penaltyAmount: 0,
          penaltyApplied: false,
          suspensionApplied: true,
          rider: {
            userId: 'rider-user-2',
            suspendedUntil: new Date('2020-01-01T00:00:00.000Z'),
          },
        },
      }),
    ]);

    const result = await getPendingAppeals();

    expect(result[0]).toMatchObject({ canRefundPenalty: true, canLiftSuspension: true });
    expect(result[1]).toMatchObject({ canRefundPenalty: false, canLiftSuspension: false });
  });
});
