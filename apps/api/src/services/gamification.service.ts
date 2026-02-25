// ============================================================
// Gamification Service — XP, Levels, Badges
// Sprint 9: Gamification Engine
// ============================================================

import { prisma } from '@riderguy/database';
import {
  RiderLevel,
  RIDER_LEVEL_THRESHOLDS,
  RIDER_LEVEL_NAMES,
  XpAction,
  XP_VALUES,
  LEVEL_COMMISSION_RATES,
  LEVEL_PERKS,
  DEFAULT_BADGES,
} from '@riderguy/types';
import type {
  GamificationProfile,
  XpAwardResult,
  LeaderboardEntry,
  Badge,
  BadgeCriteria,
  LeaderboardCategory,
  LeaderboardTimeRange,
} from '@riderguy/types';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';
import type { Prisma } from '@prisma/client';
import * as BonusXpService from './bonus-xp.service';

// ────── Level Calculation ──────

/** Determine the rider level for a given XP total */
export function calculateLevel(totalXp: number): RiderLevel {
  const levels = [
    RiderLevel.LEGEND,
    RiderLevel.CAPTAIN,
    RiderLevel.ACE,
    RiderLevel.PRO,
    RiderLevel.STREAKER,
    RiderLevel.RUNNER,
    RiderLevel.ROOKIE,
  ];
  for (const level of levels) {
    if (totalXp >= RIDER_LEVEL_THRESHOLDS[level]) return level;
  }
  return RiderLevel.ROOKIE;
}

/** Get XP progress within current level */
export function getLevelProgress(totalXp: number) {
  const currentLevel = calculateLevel(totalXp);
  const currentThreshold = RIDER_LEVEL_THRESHOLDS[currentLevel];
  const isMaxLevel = currentLevel === RiderLevel.LEGEND;

  const levels = Object.values(RiderLevel).filter((v) => typeof v === 'number') as RiderLevel[];
  const nextLevel = levels.find((l) => l === currentLevel + 1) ?? null;
  const nextThreshold = nextLevel ? RIDER_LEVEL_THRESHOLDS[nextLevel] : currentThreshold;

  const xpInLevel = totalXp - currentThreshold;
  const xpForLevel = isMaxLevel ? 1 : nextThreshold - currentThreshold;
  const progressPercent = isMaxLevel ? 100 : Math.min(100, Math.round((xpInLevel / xpForLevel) * 100));

  return {
    currentLevel,
    levelName: RIDER_LEVEL_NAMES[currentLevel],
    totalXp,
    currentLevelXp: xpInLevel,
    nextLevelXp: xpForLevel,
    progressPercent,
    isMaxLevel,
  };
}

// ────── XP Awarding ──────

/**
 * Award XP to a rider and process level-ups + badge checks.
 */
export async function awardXp(
  riderId: string,
  action: XpAction | string,
  points?: number,
  metadata?: Record<string, unknown>,
): Promise<XpAwardResult> {
  let xpAmount = points ?? XP_VALUES[action as XpAction] ?? 0;
  if (xpAmount <= 0 && action !== XpAction.BONUS) {
    return {
      action,
      pointsAwarded: 0,
      totalXp: 0,
      previousLevel: RiderLevel.ROOKIE,
      currentLevel: RiderLevel.ROOKIE,
      leveledUp: false,
      newBadges: [],
    };
  }

  const rider = await prisma.riderProfile.findUnique({
    where: { id: riderId },
    select: { id: true, totalXp: true, currentLevel: true, userId: true, currentZoneId: true },
  });
  if (!rider) throw ApiError.notFound('Rider profile not found');

  // Apply bonus XP multiplier if any active events
  const multiplier = await BonusXpService.getXpMultiplier(action, rider.currentZoneId);
  if (multiplier > 1) {
    xpAmount = Math.round(xpAmount * multiplier);
  }

  const previousLevel = rider.currentLevel as RiderLevel;
  const newTotalXp = rider.totalXp + xpAmount;
  const newLevel = calculateLevel(newTotalXp);
  const leveledUp = newLevel > previousLevel;

  // Update rider XP + level, create XP event (sequential — no interactive tx for PgBouncer)
  await prisma.riderProfile.update({
    where: { id: riderId },
    data: {
      totalXp: newTotalXp,
      currentLevel: newLevel,
    },
  });

  await prisma.xpEvent.create({
    data: {
      riderId,
      action,
      points: xpAmount,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  // Check for new badges
  const newBadges = await checkAndAwardBadges(riderId, action);

  // If leveled up, create a notification
  if (leveledUp) {
    try {
      await prisma.notification.create({
        data: {
          userId: rider.userId,
          title: '🎉 Level Up!',
          body: `Congratulations! You've reached ${RIDER_LEVEL_NAMES[newLevel]} (Level ${newLevel})!`,
          type: 'GAMIFICATION',
          data: { type: 'level_up', level: newLevel, levelName: RIDER_LEVEL_NAMES[newLevel] },
        },
      });
    } catch (e) {
      logger.warn({ error: e }, 'Failed to create level-up notification');
    }
  }

  logger.info(
    { riderId, action, points: xpAmount, totalXp: newTotalXp, level: newLevel, leveledUp },
    'XP awarded',
  );

  return {
    action,
    pointsAwarded: xpAmount,
    totalXp: newTotalXp,
    previousLevel,
    currentLevel: newLevel,
    leveledUp,
    newBadges: newBadges.map((rb) => rb.badge),
  };
}

// ────── Badge Evaluation ──────

/**
 * Check all badge criteria and award any newly qualified badges.
 */
async function checkAndAwardBadges(
  riderId: string,
  triggerAction: string,
): Promise<Array<{ badge: Badge }>> {
  // Get rider's existing badges
  const existingBadges = await prisma.riderBadge.findMany({
    where: { riderId },
    select: { badgeId: true },
  });
  const existingBadgeIds = new Set(existingBadges.map((b) => b.badgeId));

  // Get all active badges the rider doesn't have yet
  const candidateBadges = await prisma.badge.findMany({
    where: {
      isActive: true,
      id: { notIn: Array.from(existingBadgeIds) },
    },
  });

  if (candidateBadges.length === 0) return [];

  // Get counts for criteria evaluation
  const actionCounts = await getActionCounts(riderId);

  const newlyAwarded: Array<{ badge: Badge }> = [];

  for (const badge of candidateBadges) {
    const criteria = badge.criteria as BadgeCriteria | null;
    if (!criteria) continue;

    const count = actionCounts[criteria.action] ?? 0;
    if (count >= criteria.threshold) {
      try {
        // Sequential writes — no interactive tx for PgBouncer
        await prisma.riderBadge.create({
          data: { riderId, badgeId: badge.id },
        });

        // Award badge XP bonus
        if (badge.xpReward > 0) {
          await prisma.riderProfile.update({
            where: { id: riderId },
            data: { totalXp: { increment: badge.xpReward } },
          });

          await prisma.xpEvent.create({
            data: {
              riderId,
              action: 'badge_xp_bonus',
              points: badge.xpReward,
              metadata: { badgeSlug: badge.slug, badgeName: badge.name },
            },
          });
        }

        newlyAwarded.push({
          badge: badge as unknown as Badge,
        });

        // Create badge notification
        const rider = await prisma.riderProfile.findUnique({
          where: { id: riderId },
          select: { userId: true },
        });
        if (rider) {
          await prisma.notification.create({
            data: {
              userId: rider.userId,
              title: `${badge.icon} New Badge!`,
              body: `You earned "${badge.name}" — ${badge.description}`,
              type: 'GAMIFICATION',
              data: { type: 'badge_earned', badgeId: badge.id, badgeSlug: badge.slug },
            },
          }).catch(() => {});
        }
      } catch (e) {
        // Unique constraint violation = already awarded (race condition)
        logger.debug({ riderId, badgeSlug: badge.slug, error: e }, 'Badge award skipped');
      }
    }
  }

  return newlyAwarded;
}

/**
 * Count how many times each action has occurred for a rider.
 * Used for badge criteria evaluation.
 */
async function getActionCounts(riderId: string): Promise<Record<string, number>> {
  const counts = await prisma.xpEvent.groupBy({
    by: ['action'],
    where: { riderId },
    _count: { action: true },
  });

  const result: Record<string, number> = {};
  for (const row of counts) {
    result[row.action] = row._count.action;
  }

  // Also add total deliveries from the profile for milestone badges
  const rider = await prisma.riderProfile.findUnique({
    where: { id: riderId },
    select: { totalDeliveries: true },
  });
  if (rider) {
    result['delivery_complete'] = Math.max(
      result['delivery_complete'] ?? 0,
      rider.totalDeliveries,
    );
  }

  return result;
}

// ────── Profile & Queries ──────

/**
 * Get full gamification profile for a rider.
 */
export async function getGamificationProfile(riderId: string): Promise<GamificationProfile> {
  const rider = await prisma.riderProfile.findUnique({
    where: { id: riderId },
    select: {
      totalXp: true,
      currentLevel: true,
      badges: {
        include: { badge: true },
        orderBy: { awardedAt: 'desc' },
      },
      xpEvents: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!rider) throw ApiError.notFound('Rider profile not found');

  const progress = getLevelProgress(rider.totalXp);
  const unseenBadges = rider.badges.filter((rb) => !rb.seenAt);

  return {
    ...progress,
    badges: rider.badges as unknown as GamificationProfile['badges'],
    unseenBadges: unseenBadges as unknown as GamificationProfile['unseenBadges'],
    recentXp: rider.xpEvents as unknown as GamificationProfile['recentXp'],
  };
}

/**
 * Mark badges as seen (dismiss celebration).
 */
export async function markBadgesSeen(riderId: string, badgeIds: string[]): Promise<void> {
  await prisma.riderBadge.updateMany({
    where: {
      riderId,
      badgeId: { in: badgeIds },
      seenAt: null,
    },
    data: { seenAt: new Date() },
  });
}

/**
 * Get XP history for a rider (paginated).
 */
export async function getXpHistory(
  riderId: string,
  page: number = 1,
  limit: number = 20,
) {
  const skip = (page - 1) * limit;
  const [events, total] = await Promise.all([
    prisma.xpEvent.findMany({
      where: { riderId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.xpEvent.count({ where: { riderId } }),
  ]);

  return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Get leaderboard (top riders by XP, deliveries, rating, or streak).
 * Supports time-range filtering and category selection.
 */
export async function getLeaderboard(
  options: {
    zoneId?: string;
    limit?: number;
    currentUserId?: string;
    category?: LeaderboardCategory;
    timeRange?: LeaderboardTimeRange;
  } = {},
): Promise<LeaderboardEntry[]> {
  const { zoneId, limit = 20, currentUserId, category = 'xp', timeRange = 'alltime' } = options;

  // For time-based XP leaderboard, we aggregate xpEvents within the time range
  if (category === 'xp' && timeRange !== 'alltime') {
    return getTimeRangeXpLeaderboard({ zoneId, limit, currentUserId, timeRange });
  }

  // Determine sort field based on category
  const orderBy: Record<string, string> =
    category === 'deliveries'
      ? { totalDeliveries: 'desc' }
      : category === 'rating'
        ? { averageRating: 'desc' }
        : { totalXp: 'desc' };

  const riders = await prisma.riderProfile.findMany({
    where: {
      onboardingStatus: 'ACTIVATED',
      ...(zoneId ? { currentZoneId: zoneId } : {}),
    },
    orderBy: orderBy as any,
    take: limit,
    select: {
      id: true,
      userId: true,
      currentLevel: true,
      totalXp: true,
      totalDeliveries: true,
      averageRating: true,
      user: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
      streak: { select: { currentStreak: true } },
    },
  });

  // For streak category sort manually since it's a relation
  let sorted = riders;
  if (category === 'streak') {
    sorted = [...riders].sort(
      (a, b) => (b.streak?.currentStreak ?? 0) - (a.streak?.currentStreak ?? 0),
    );
  }

  return sorted.map((r, i) => ({
    rank: i + 1,
    riderId: r.id,
    riderName: `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || 'Rider',
    avatarUrl: r.user.avatarUrl,
    level: r.currentLevel as RiderLevel,
    totalXp: r.totalXp,
    totalDeliveries: r.totalDeliveries,
    isCurrentUser: r.userId === currentUserId,
  }));
}

/** Time-range XP leaderboard using xpEvent aggregation */
async function getTimeRangeXpLeaderboard(options: {
  zoneId?: string;
  limit: number;
  currentUserId?: string;
  timeRange: LeaderboardTimeRange;
}): Promise<LeaderboardEntry[]> {
  const { zoneId, limit, currentUserId, timeRange } = options;
  const since = getTimeRangeStart(timeRange);

  // Aggregate XP events within time range
  const topRiders = await prisma.xpEvent.groupBy({
    by: ['riderId'],
    where: {
      createdAt: { gte: since },
      ...(zoneId
        ? { rider: { currentZoneId: zoneId } }
        : {}),
    },
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: limit,
  });

  if (topRiders.length === 0) return [];

  const riderIds = topRiders.map((r) => r.riderId);
  const riders = await prisma.riderProfile.findMany({
    where: { id: { in: riderIds } },
    select: {
      id: true,
      userId: true,
      currentLevel: true,
      totalXp: true,
      totalDeliveries: true,
      user: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });

  const riderMap = new Map(riders.map((r) => [r.id, r]));

  return topRiders
    .map((tr, i) => {
      const r = riderMap.get(tr.riderId);
      if (!r) return null;
      return {
        rank: i + 1,
        riderId: r.id,
        riderName: `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || 'Rider',
        avatarUrl: r.user.avatarUrl,
        level: r.currentLevel as RiderLevel,
        totalXp: tr._sum.points ?? 0,
        totalDeliveries: r.totalDeliveries,
        isCurrentUser: r.userId === currentUserId,
      };
    })
    .filter(Boolean) as LeaderboardEntry[];
}

function getTimeRangeStart(timeRange: LeaderboardTimeRange): Date {
  const now = new Date();
  switch (timeRange) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay()); // start of week (Sunday)
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return new Date(0);
  }
}

// ────── Admin Operations ──────

/**
 * Manually award XP (admin).
 */
export async function adminAwardXp(
  riderId: string,
  points: number,
  reason: string,
): Promise<XpAwardResult> {
  return awardXp(riderId, XpAction.BONUS, points, { reason, manual: true });
}

/**
 * Manually adjust XP (admin) — can be negative for corrections.
 */
export async function adminAdjustXp(
  riderId: string,
  points: number,
  reason: string,
): Promise<{ totalXp: number; currentLevel: RiderLevel }> {
  const rider = await prisma.riderProfile.findUnique({
    where: { id: riderId },
    select: { totalXp: true },
  });
  if (!rider) throw ApiError.notFound('Rider profile not found');

  const newTotalXp = Math.max(0, rider.totalXp + points);
  const newLevel = calculateLevel(newTotalXp);

  // Sequential writes — no interactive tx for PgBouncer
  await prisma.riderProfile.update({
    where: { id: riderId },
    data: { totalXp: newTotalXp, currentLevel: newLevel },
  });

  await prisma.xpEvent.create({
    data: {
      riderId,
      action: 'admin_adjustment',
      points,
      metadata: { reason, adjustedBy: 'admin' },
    },
  });

  return { totalXp: newTotalXp, currentLevel: newLevel };
}

/**
 * Admin: manually award a badge.
 */
export async function adminAwardBadge(riderId: string, badgeId: string): Promise<void> {
  const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
  if (!badge) throw ApiError.notFound('Badge not found');

  const existing = await prisma.riderBadge.findUnique({
    where: { riderId_badgeId: { riderId, badgeId } },
  });
  if (existing) throw ApiError.badRequest('Rider already has this badge');

  // Sequential writes — no interactive tx for PgBouncer
  await prisma.riderBadge.create({ data: { riderId, badgeId } });

  if (badge.xpReward > 0) {
    await prisma.riderProfile.update({
      where: { id: riderId },
      data: { totalXp: { increment: badge.xpReward } },
    });
    await prisma.xpEvent.create({
      data: {
        riderId,
        action: 'badge_xp_bonus',
        points: badge.xpReward,
        metadata: { badgeSlug: badge.slug, manual: true },
      },
    });
  }
}

/**
 * Admin: CRUD for badge definitions.
 */
export async function listBadges() {
  return prisma.badge.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    include: {
      _count: { select: { riders: true } },
    },
  });
}

export async function createBadge(data: {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  criteria?: BadgeCriteria;
  xpReward?: number;
  sortOrder?: number;
}) {
  return prisma.badge.create({
    data: {
      slug: data.slug,
      name: data.name,
      description: data.description,
      icon: data.icon,
      category: data.category,
      criteria: (data.criteria ?? undefined) as Prisma.InputJsonValue | undefined,
      xpReward: data.xpReward ?? 0,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateBadge(
  badgeId: string,
  data: Partial<{
    name: string;
    description: string;
    icon: string;
    category: string;
    criteria: BadgeCriteria;
    xpReward: number;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  return prisma.badge.update({
    where: { id: badgeId },
    data: {
      ...data,
      criteria: data.criteria ? (data.criteria as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function deleteBadge(badgeId: string) {
  return prisma.badge.delete({ where: { id: badgeId } });
}

/**
 * Seed default badges if they don't exist.
 */
export async function seedDefaultBadges(): Promise<number> {
  let created = 0;
  for (const def of DEFAULT_BADGES) {
    const exists = await prisma.badge.findUnique({ where: { slug: def.slug } });
    if (!exists) {
      await prisma.badge.create({
        data: {
          slug: def.slug,
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          criteria: def.criteria as unknown as Prisma.InputJsonValue,
          xpReward: def.xpReward,
          sortOrder: def.sortOrder,
        },
      });
      created++;
    }
  }
  logger.info({ created }, 'Default badges seeded');
  return created;
}

/**
 * Get commission rate for a rider based on their level.
 */
export function getCommissionRate(level: RiderLevel): number {
  return LEVEL_COMMISSION_RATES[level] ?? 15;
}

/**
 * Get perks for a rider's current level.
 */
export function getLevelPerksForLevel(level: RiderLevel) {
  return {
    level,
    name: RIDER_LEVEL_NAMES[level],
    commissionRate: LEVEL_COMMISSION_RATES[level],
    perks: LEVEL_PERKS[level],
  };
}
