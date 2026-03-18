// ============================================================
// Rewards Store Service — Sprint 10
// Browse rewards, redeem with points, manage inventory
// ============================================================

import { prisma } from '@riderguy/database';
import type { RedemptionStatus } from '@riderguy/types';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';

// ────── Admin: CRUD Store Items ──────

export async function createItem(data: {
  name: string;
  description: string;
  icon?: string;
  imageUrl?: string;
  category?: string;
  pointsCost: number;
  inventory?: number;
  isFeatured?: boolean;
  sortOrder?: number;
}) {
  return prisma.rewardStoreItem.create({
    data: {
      name: data.name,
      description: data.description,
      icon: data.icon ?? '🎁',
      imageUrl: data.imageUrl ?? null,
      category: data.category ?? 'general',
      pointsCost: data.pointsCost,
      inventory: data.inventory ?? -1,
      isFeatured: data.isFeatured ?? false,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateItem(
  itemId: string,
  data: Partial<{
    name: string;
    description: string;
    icon: string;
    imageUrl: string | null;
    category: string;
    pointsCost: number;
    inventory: number;
    isFeatured: boolean;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  return prisma.rewardStoreItem.update({
    where: { id: itemId },
    data: data as any,
  });
}

export async function deleteItem(itemId: string) {
  return prisma.rewardStoreItem.delete({ where: { id: itemId } });
}

/** List all items (admin view) with redemption counts */
export async function listItemsAdmin() {
  return prisma.rewardStoreItem.findMany({
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { redemptions: true } },
    },
  });
}

// ────── Rider: Browse Store ──────

/** Get available store items (active only) */
export async function getStoreItems(filters?: {
  category?: string;
  featured?: boolean;
}) {
  const where: Record<string, unknown> = { isActive: true };
  if (filters?.category) where.category = filters.category;
  if (filters?.featured) where.isFeatured = true;

  return prisma.rewardStoreItem.findMany({
    where: where as any,
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
}

/** Redeem a reward item */
export async function redeemItem(riderId: string, itemId: string) {
  const [rider, item] = await Promise.all([
    prisma.riderProfile.findUnique({
      where: { id: riderId },
      select: { id: true, rewardPoints: true, userId: true },
    }),
    prisma.rewardStoreItem.findUnique({ where: { id: itemId } }),
  ]);

  if (!rider) throw ApiError.notFound('Rider profile not found');
  if (!item) throw ApiError.notFound('Reward item not found');
  if (!item.isActive) throw ApiError.badRequest('This item is no longer available');
  if (item.inventory === 0) throw ApiError.badRequest('Item is out of stock');
  if (rider.rewardPoints < item.pointsCost) {
    throw ApiError.badRequest(
      `Not enough points. You need ${item.pointsCost} but have ${rider.rewardPoints}.`,
    );
  }

  // Atomic transaction: deduct points + decrement inventory + create redemption
  const redemption = await prisma.$transaction(async (tx) => {
    const deducted = await tx.riderProfile.updateMany({
      where: { id: riderId, rewardPoints: { gte: item.pointsCost } },
      data: { rewardPoints: { decrement: item.pointsCost } },
    });

    if (deducted.count === 0) {
      throw ApiError.badRequest(
        `Not enough points. You need ${item.pointsCost} but have insufficient balance.`,
      );
    }

    // Decrement inventory (if not unlimited)
    if (item.inventory > 0) {
      await tx.rewardStoreItem.update({
        where: { id: itemId },
        data: { inventory: { decrement: 1 } },
      });
    }

    // Create redemption record
    return tx.rewardRedemption.create({
      data: {
        riderId,
        itemId,
        pointsSpent: item.pointsCost,
        status: 'PENDING',
      },
      include: { item: true },
    });
  });

  // Notify rider
  await prisma.notification.create({
    data: {
      userId: rider.userId,
      title: `${item.icon} Reward Redeemed!`,
      body: `You redeemed "${item.name}" for ${item.pointsCost} points. We'll process it shortly!`,
      type: 'GAMIFICATION',
      data: { type: 'reward_redeemed', redemptionId: redemption.id, itemId },
    },
  }).catch(() => {});

  logger.info(
    { riderId, itemId, itemName: item.name, pointsSpent: item.pointsCost },
    'Reward redeemed',
  );

  return redemption;
}

/** Get a rider's redemption history */
export async function getRedemptionHistory(riderId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;
  const [redemptions, total] = await Promise.all([
    prisma.rewardRedemption.findMany({
      where: { riderId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { item: true },
    }),
    prisma.rewardRedemption.count({ where: { riderId } }),
  ]);

  return { redemptions, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Get rider's current reward points */
export async function getPointsBalance(riderId: string): Promise<number> {
  const rider = await prisma.riderProfile.findUnique({
    where: { id: riderId },
    select: { rewardPoints: true },
  });
  return rider?.rewardPoints ?? 0;
}

// ────── Admin: Manage Redemptions ──────

/** List all redemptions (admin view) */
export async function listRedemptionsAdmin(filters?: {
  status?: RedemptionStatus;
  riderId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.riderId) where.riderId = filters.riderId;

  return prisma.rewardRedemption.findMany({
    where: where as any,
    orderBy: { createdAt: 'desc' },
    include: {
      item: true,
      rider: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });
}

/** Update redemption status (admin) */
export async function updateRedemptionStatus(
  redemptionId: string,
  status: RedemptionStatus,
  notes?: string,
) {
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id: redemptionId } });
  if (!redemption) throw ApiError.notFound('Redemption not found');

  const data: Record<string, unknown> = { status, notes: notes ?? undefined };
  if (status === 'FULFILLED') data.fulfilledAt = new Date();

  // If rejecting, refund points — only if still PENDING to prevent double-refund
  if ((status === 'REJECTED' || status === 'CANCELLED') && redemption.status === 'PENDING') {
    await prisma.riderProfile.update({
      where: { id: redemption.riderId },
      data: { rewardPoints: { increment: redemption.pointsSpent } },
    });
  }

  return prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: data as any,
    include: { item: true },
  });
}
