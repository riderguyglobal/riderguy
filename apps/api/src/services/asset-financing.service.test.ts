import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const riderProfileFindUnique = vi.fn();
  const interestCreate = vi.fn();
  const interestFindUnique = vi.fn();
  const interestUpdate = vi.fn();
  const interestUpdateMany = vi.fn();
  const executeRaw = vi.fn().mockResolvedValue(1);
  const notificationCreate = vi.fn().mockResolvedValue({ id: 'notification-1' });
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({
      riderProfile: { findUnique: riderProfileFindUnique },
      assetFinancingInterest: {
        create: interestCreate,
        findUnique: interestFindUnique,
        update: interestUpdate,
        updateMany: interestUpdateMany,
      },
      auditLog: { create: vi.fn() },
      $executeRaw: executeRaw,
    }),
  );

  return {
    executeRaw,
    interestCreate,
    interestFindUnique,
    interestUpdate,
    interestUpdateMany,
    notificationCreate,
    riderProfileFindUnique,
    transaction,
  };
});

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: mocks.transaction,
    riderProfile: { findUnique: mocks.riderProfileFindUnique },
    assetFinancingInterest: {
      create: mocks.interestCreate,
      findUnique: mocks.interestFindUnique,
      update: mocks.interestUpdate,
      updateMany: mocks.interestUpdateMany,
    },
  },
}));

vi.mock('./notification.service', () => ({
  NotificationService: { create: mocks.notificationCreate },
}));

vi.mock('../lib/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { AssetFinancingService } from './asset-financing.service';

const verifiedTraining = [
  { moduleKey: 'SAFETY_BASICS', verifiedAt: new Date() },
  { moduleKey: 'SERVICE_STANDARDS', verifiedAt: new Date() },
  { moduleKey: 'DELIVERY_OPERATIONS', verifiedAt: new Date() },
];

const baseInterest = {
  id: 'interest-1',
  assetType: 'MOTORBIKE',
  status: 'SUBMITTED',
  contactEmail: 'account@example.com',
  notes: null,
  reviewNotes: null,
  submittedAt: new Date('2026-09-01T08:00:00.000Z'),
  reviewedAt: null,
  createdAt: new Date('2026-09-01T08:00:00.000Z'),
  updatedAt: new Date('2026-09-01T08:00:00.000Z'),
};

const rider = {
  id: 'rider-profile-1',
  riderChannel: 'IN_HOUSE',
  user: {
    email: 'Account@Example.com',
    emailVerified: true,
  },
  trainingCompletions: verifiedTraining,
  assetFinancingInterest: null,
};

describe('AssetFinancingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeRaw.mockResolvedValue(1);
    mocks.notificationCreate.mockResolvedValue({ id: 'notification-1' });
    mocks.riderProfileFindUnique.mockResolvedValue(rider);
    mocks.interestCreate.mockResolvedValue(baseInterest);
    mocks.interestUpdate.mockResolvedValue(baseInterest);
    mocks.interestUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('rejects Guest Riders even when a client claims eligibility', async () => {
    mocks.riderProfileFindUnique.mockResolvedValue({ ...rider, riderChannel: 'GUEST' });

    await expect(
      AssetFinancingService.registerInterest('user-1', {
        assetType: 'MOTORBIKE',
      }),
    ).rejects.toThrow('only to RiderGuy In-House Riders');

    expect(mocks.interestCreate).not.toHaveBeenCalled();
  });

  it('rejects an In-House Rider until every required module is verified', async () => {
    mocks.riderProfileFindUnique.mockResolvedValue({
      ...rider,
      trainingCompletions: verifiedTraining.slice(0, 2),
    });

    await expect(
      AssetFinancingService.registerInterest('user-1', {
        assetType: 'ELECTRIC_VEHICLE',
      }),
    ).rejects.toThrow('must be completed and verified');

    expect(mocks.interestCreate).not.toHaveBeenCalled();
  });

  it('requires and stores only the verified account email', async () => {
    mocks.riderProfileFindUnique.mockResolvedValue({
      ...rider,
      user: { email: 'unverified@example.com', emailVerified: false },
    });

    await expect(
      AssetFinancingService.registerInterest('user-1', {
        assetType: 'MOTORBIKE',
      }),
    ).rejects.toThrow('Verify your RiderGuy account email');

    expect(mocks.interestCreate).not.toHaveBeenCalled();

    mocks.riderProfileFindUnique.mockResolvedValue(rider);
    await AssetFinancingService.registerInterest('user-1', {
      assetType: 'ELECTRIC_VEHICLE',
      notes: ' Central Accra routes. ',
    });

    expect(mocks.interestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          riderId: 'rider-profile-1',
          assetType: 'ELECTRIC_VEHICLE',
          contactEmail: 'account@example.com',
          notes: 'Central Accra routes.',
        },
      }),
    );
  });

  it('returns an identical submitted interest without creating or updating a duplicate', async () => {
    mocks.riderProfileFindUnique.mockResolvedValue({
      ...rider,
      assetFinancingInterest: baseInterest,
    });

    const result = await AssetFinancingService.registerInterest('user-1', {
      assetType: 'MOTORBIKE',
    });

    expect(result).toEqual({ interest: baseInterest, outcome: 'UNCHANGED' });
    expect(mocks.interestCreate).not.toHaveBeenCalled();
    expect(mocks.interestUpdate).not.toHaveBeenCalled();
  });

  it('does not mutate a request after review has started', async () => {
    const underReview = { ...baseInterest, status: 'UNDER_REVIEW' };
    mocks.riderProfileFindUnique.mockResolvedValue({
      ...rider,
      assetFinancingInterest: underReview,
    });

    const result = await AssetFinancingService.registerInterest('user-1', {
      assetType: 'ELECTRIC_VEHICLE',
      notes: 'Changed details',
    });

    expect(result).toEqual({ interest: underReview, outcome: 'UNCHANGED' });
    expect(mocks.interestUpdate).not.toHaveBeenCalled();
  });

  it('reuses the single row when a closed interest is submitted again', async () => {
    mocks.riderProfileFindUnique.mockResolvedValue({
      ...rider,
      assetFinancingInterest: { ...baseInterest, status: 'DECLINED' },
    });

    await AssetFinancingService.registerInterest('user-1', {
      assetType: 'ELECTRIC_VEHICLE',
    });

    expect(mocks.interestCreate).not.toHaveBeenCalled();
    expect(mocks.interestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'interest-1' },
        data: expect.objectContaining({
          assetType: 'ELECTRIC_VEHICLE',
          status: 'SUBMITTED',
          reviewNotes: null,
          reviewedAt: null,
          reviewedById: null,
        }),
      }),
    );
  });

  it('returns the current record and only exposes an email after server verification', async () => {
    const reviewedInterest = {
      ...baseInterest,
      status: 'DECLINED',
      reviewNotes: 'Complete the missing ownership documents, then submit again.',
      reviewedAt: new Date('2026-09-01T10:00:00.000Z'),
    };
    mocks.riderProfileFindUnique.mockResolvedValue({
      user: { email: 'account@example.com', emailVerified: true },
      assetFinancingInterest: reviewedInterest,
    });

    await expect(AssetFinancingService.getCurrentState('user-1')).resolves.toEqual({
      interest: reviewedInterest,
      verifiedContactEmail: 'account@example.com',
    });
    expect(mocks.riderProfileFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          assetFinancingInterest: {
            select: expect.objectContaining({ reviewNotes: true }),
          },
        }),
      }),
    );
  });

  it('lets an admin update a manageable status and records the reviewer', async () => {
    const reviewed = { ...baseInterest, status: 'APPROVED' };
    mocks.interestFindUnique
      .mockResolvedValueOnce({ rider: { userId: 'user-1' } })
      .mockResolvedValueOnce({
        id: 'interest-1',
        status: 'SUBMITTED',
        updatedAt: baseInterest.updatedAt,
      })
      .mockResolvedValueOnce(reviewed);

    await expect(
      AssetFinancingService.updateStatus('interest-1', 'admin-1', {
        status: 'APPROVED',
        reviewNotes: 'Eligibility confirmed',
        expectedUpdatedAt: baseInterest.updatedAt.toISOString(),
      }),
    ).resolves.toEqual(reviewed);

    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.interestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'interest-1',
          status: 'SUBMITTED',
          updatedAt: baseInterest.updatedAt,
        },
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewNotes: 'Eligibility confirmed',
          reviewedById: 'admin-1',
          reviewedAt: expect.any(Date),
        }),
      }),
    );
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SYSTEM',
        data: {
          context: 'ASSET_FINANCING',
          assetFinancingInterestId: 'interest-1',
          status: 'APPROVED',
        },
      }),
    );
  });

  it('rejects a stale admin decision after a concurrent resubmission', async () => {
    const resubmittedAt = new Date('2026-09-01T09:00:00.000Z');
    mocks.interestFindUnique
      .mockResolvedValueOnce({ rider: { userId: 'user-1' } })
      .mockResolvedValueOnce({
        id: 'interest-1',
        status: 'SUBMITTED',
        updatedAt: resubmittedAt,
      });

    await expect(
      AssetFinancingService.updateStatus('interest-1', 'admin-1', {
        status: 'APPROVED',
        expectedUpdatedAt: baseInterest.updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'ASSET_FINANCING_STALE_REVIEW' });

    expect(mocks.interestUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid closed-request status transition under the lock', async () => {
    mocks.interestFindUnique
      .mockResolvedValueOnce({ rider: { userId: 'user-1' } })
      .mockResolvedValueOnce({
        id: 'interest-1',
        status: 'WITHDRAWN',
        updatedAt: baseInterest.updatedAt,
      });

    await expect(
      AssetFinancingService.updateStatus('interest-1', 'admin-1', {
        status: 'APPROVED',
        expectedUpdatedAt: baseInterest.updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'ASSET_FINANCING_INVALID_TRANSITION' });

    expect(mocks.interestUpdateMany).not.toHaveBeenCalled();
  });

  it('requires a server-side reason before declining an interest', async () => {
    await expect(
      AssetFinancingService.updateStatus('interest-1', 'admin-1', {
        status: 'DECLINED',
        expectedUpdatedAt: baseInterest.updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'ASSET_FINANCING_DECLINE_REASON_REQUIRED' });

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.interestUpdateMany).not.toHaveBeenCalled();
  });
});
