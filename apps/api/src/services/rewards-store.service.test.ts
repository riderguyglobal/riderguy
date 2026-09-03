import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RedemptionStatus } from '@riderguy/types';
import { updateRedemptionSchema } from '@riderguy/validators';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    notification: { create: vi.fn() },
  },
  tx: {
    rewardRedemption: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    riderProfile: { update: vi.fn() },
    rewardStoreItem: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('@riderguy/database', () => ({ prisma: mocks.prisma }));

import { updateRedemptionStatus } from './rewards-store.service';

describe('reward redemption decision validation', () => {
  it('requires a meaningful reason when rejecting a redemption', () => {
    expect(updateRedemptionSchema.safeParse({ status: 'REJECTED' }).success).toBe(false);
    expect(
      updateRedemptionSchema.safeParse({ status: 'REJECTED', reason: 'Too short' }).success,
    ).toBe(false);
  });

  it('normalizes a valid rejection reason', () => {
    expect(
      updateRedemptionSchema.parse({
        status: 'REJECTED',
        reason: '  The requested helmet is unavailable.  ',
      }),
    ).toMatchObject({
      status: 'REJECTED',
      reason: 'The requested helmet is unavailable.',
    });
  });
});

interface TestState {
  status: RedemptionStatus;
  rewardPoints: number;
  inventory: number;
  auditRows: number;
}

let state: TestState;
let failInventory = false;

function redemptionRecord() {
  return {
    id: 'redemption-1',
    riderId: 'rider-1',
    itemId: 'item-1',
    pointsSpent: 300,
    status: state.status,
    notes: null,
    fulfilledAt: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    item: {
      id: 'item-1',
      name: 'Helmet voucher',
      inventory: state.inventory,
    },
    rider: { userId: 'rider-user-1' },
  };
}

function installStatefulTransaction() {
  mocks.tx.rewardRedemption.findUnique.mockImplementation(async () => redemptionRecord());
  mocks.tx.rewardRedemption.findUniqueOrThrow.mockImplementation(async () => redemptionRecord());
  mocks.tx.rewardRedemption.updateMany.mockImplementation(async ({ where, data }) => {
    if (state.status !== where.status) return { count: 0 };
    state.status = data.status;
    return { count: 1 };
  });
  mocks.tx.riderProfile.update.mockImplementation(async ({ data }) => {
    state.rewardPoints += Number(data.rewardPoints.increment);
    return { id: 'rider-1', rewardPoints: state.rewardPoints };
  });
  mocks.tx.rewardStoreItem.update.mockImplementation(async ({ data }) => {
    if (failInventory) throw new Error('inventory unavailable');
    state.inventory += Number(data.inventory.increment);
    return { id: 'item-1', inventory: state.inventory };
  });
  mocks.tx.auditLog.create.mockImplementation(async () => {
    state.auditRows += 1;
    return { id: `audit-${state.auditRows}` };
  });
  mocks.prisma.$transaction.mockImplementation(async (callback) => {
    const snapshot = { ...state };
    try {
      return await callback(mocks.tx);
    } catch (error) {
      state = snapshot;
      throw error;
    }
  });
}

describe('reward redemption decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      status: 'PENDING',
      rewardPoints: 200,
      inventory: 0,
      auditRows: 0,
    };
    failInventory = false;
    mocks.prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
    installStatefulTransaction();
  });

  it('rejects atomically and restores both points and finite inventory', async () => {
    const result = await updateRedemptionStatus(
      'redemption-1',
      'REJECTED',
      'Request could not be fulfilled',
      { actorUserId: 'admin-1', ipAddress: '127.0.0.1' },
    );

    expect(result.status).toBe('REJECTED');
    expect(state).toEqual({
      status: 'REJECTED',
      rewardPoints: 500,
      inventory: 1,
      auditRows: 1,
    });
    expect(mocks.tx.rewardRedemption.updateMany).toHaveBeenCalledWith({
      where: { id: 'redemption-1', status: 'PENDING' },
      data: {
        status: 'REJECTED',
        notes: 'Request could not be fulfilled',
      },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'reward_redemption.status_rejected',
        entityType: 'RewardRedemption',
        entityId: 'redemption-1',
      }),
    });
  });

  it('does not restore points or inventory twice on a repeated decision', async () => {
    const context = { actorUserId: 'admin-1' };
    await updateRedemptionStatus('redemption-1', 'REJECTED', 'Reward cannot be supplied', context);
    await updateRedemptionStatus('redemption-1', 'REJECTED', 'Reward cannot be supplied', context);

    expect(state.rewardPoints).toBe(500);
    expect(state.inventory).toBe(1);
    expect(state.auditRows).toBe(1);
    expect(mocks.tx.rewardRedemption.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.riderProfile.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.rewardStoreItem.update).toHaveBeenCalledTimes(1);
  });

  it('does not restore a reservation twice when its status CAS loses a race', async () => {
    mocks.tx.rewardRedemption.updateMany.mockImplementationOnce(async () => {
      // Simulate a concurrent reviewer committing the same decision first.
      state = {
        status: 'REJECTED',
        rewardPoints: 500,
        inventory: 1,
        auditRows: 1,
      };
      return { count: 0 };
    });

    const result = await updateRedemptionStatus(
      'redemption-1',
      'REJECTED',
      'Reward cannot be supplied',
      {
        actorUserId: 'admin-2',
      },
    );

    expect(result.status).toBe('REJECTED');
    expect(mocks.tx.riderProfile.update).not.toHaveBeenCalled();
    expect(mocks.tx.rewardStoreItem.update).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('restores an approved reservation when it is cancelled before fulfilment', async () => {
    state.status = 'APPROVED';

    await updateRedemptionStatus('redemption-1', 'CANCELLED', 'Supplier unavailable', {
      actorUserId: 'admin-1',
    });

    expect(state.status).toBe('CANCELLED');
    expect(state.rewardPoints).toBe(500);
    expect(state.inventory).toBe(1);
  });

  it('does not change unlimited inventory when refunding points', async () => {
    state.inventory = -1;

    await updateRedemptionStatus('redemption-1', 'REJECTED', 'Reward cannot be supplied', {
      actorUserId: 'admin-1',
    });

    expect(state.rewardPoints).toBe(500);
    expect(state.inventory).toBe(-1);
    expect(mocks.tx.rewardStoreItem.update).not.toHaveBeenCalled();
  });

  it('rolls the status and points back if inventory restoration fails', async () => {
    failInventory = true;

    await expect(
      updateRedemptionStatus('redemption-1', 'REJECTED', 'Reward cannot be supplied', {
        actorUserId: 'admin-1',
      }),
    ).rejects.toThrow('inventory unavailable');

    expect(state).toEqual({
      status: 'PENDING',
      rewardPoints: 200,
      inventory: 0,
      auditRows: 0,
    });
  });

  it('rejects invalid terminal-state transitions without side effects', async () => {
    state.status = 'FULFILLED';

    await expect(
      updateRedemptionStatus('redemption-1', 'REJECTED', 'Reward cannot be supplied', {
        actorUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REDEMPTION_TRANSITION' });

    expect(state.rewardPoints).toBe(200);
    expect(state.inventory).toBe(0);
    expect(state.auditRows).toBe(0);
    expect(mocks.tx.rewardRedemption.updateMany).not.toHaveBeenCalled();
  });

  it('requires a meaningful rejection reason before opening a transaction', async () => {
    await expect(
      updateRedemptionStatus('redemption-1', 'REJECTED', 'Too short', {
        actorUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.notification.create).not.toHaveBeenCalled();
  });

  it('notifies the rider after the decision and audit commit', async () => {
    await updateRedemptionStatus('redemption-1', 'REJECTED', 'Requested item is unavailable', {
      actorUserId: 'admin-1',
    });

    expect(mocks.prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'rider-user-1',
        title: 'Reward request refunded',
        body: expect.stringContaining('300 points have been returned'),
        data: expect.objectContaining({
          type: 'reward_redemption_rejected',
          redemptionId: 'redemption-1',
          status: 'REJECTED',
        }),
      }),
    });
    expect(mocks.tx.auditLog.create.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.prisma.notification.create.mock.invocationCallOrder[0]!,
    );
  });

  it('keeps a committed decision when post-commit notification delivery fails', async () => {
    state.status = 'APPROVED';
    mocks.prisma.notification.create.mockRejectedValueOnce(new Error('notifications unavailable'));

    const result = await updateRedemptionStatus('redemption-1', 'FULFILLED', undefined, {
      actorUserId: 'admin-1',
    });

    expect(result.status).toBe('FULFILLED');
    expect(state.status).toBe('FULFILLED');
    expect(state.auditRows).toBe(1);
  });
});
