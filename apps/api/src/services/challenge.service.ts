// ============================================================
// Challenge Service — Sprint 10
// Daily/weekly/monthly challenges for riders
// ============================================================

import { prisma } from '@riderguy/database';
import type { ChallengeType, ChallengeStatus, ChallengeWithProgress } from '@riderguy/types';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';
import * as GamificationService from './gamification.service';

// ────── Admin: CRUD ──────

export async function createChallenge(data: {
  title: string;
  description: string;
  type: ChallengeType;
  icon?: string;
  criteriaAction: string;
  criteriaCount: number;
  xpReward?: number;
  pointsReward?: number;
  badgeRewardId?: string;
  zoneId?: string;
  minLevel?: number;
  maxLevel?: number;
  startsAt: string;
  endsAt: string;
  createdBy?: string;
}) {
  return prisma.challenge.create({
    data: {
      title: data.title,
      description: data.description,
      type: data.type as any,
      icon: data.icon ?? '🎯',
      criteriaAction: data.criteriaAction,
      criteriaCount: data.criteriaCount,
      xpReward: data.xpReward ?? 0,
      pointsReward: data.pointsReward ?? 0,
      badgeRewardId: data.badgeRewardId ?? null,
      zoneId: data.zoneId ?? null,
      minLevel: data.minLevel ?? null,
      maxLevel: data.maxLevel ?? null,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      createdBy: data.createdBy ?? null,
      status: 'ACTIVE',
    },
  });
}

export async function updateChallenge(
  challengeId: string,
  data: Partial<{
    title: string;
    description: string;
    type: ChallengeType;
    icon: string;
    criteriaAction: string;
    criteriaCount: number;
    xpReward: number;
    pointsReward: number;
    badgeRewardId: string | null;
    zoneId: string | null;
    minLevel: number | null;
    maxLevel: number | null;
    startsAt: string;
    endsAt: string;
    status: ChallengeStatus;
  }>,
) {
  const updateData: Record<string, unknown> = { ...data };
  if (data.startsAt) updateData.startsAt = new Date(data.startsAt);
  if (data.endsAt) updateData.endsAt = new Date(data.endsAt);

  return prisma.challenge.update({
    where: { id: challengeId },
    data: updateData as any,
  });
}

export async function deleteChallenge(challengeId: string) {
  return prisma.challenge.delete({ where: { id: challengeId } });
}

/** List challenges with participant/completion counts (admin view) */
export async function listChallengesAdmin(filters?: {
  status?: ChallengeStatus;
  type?: ChallengeType;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;

  return prisma.challenge.findMany({
    where: where as any,
    orderBy: { startsAt: 'desc' },
    include: {
      _count: {
        select: { participants: true },
      },
    },
  });
}

// ────── Rider: Browse & Join ──────

/** Get active challenges visible to this rider (with their progress) */
export async function getActiveChallenges(
  riderId: string,
  riderLevel: number,
  riderZoneId?: string | null,
): Promise<ChallengeWithProgress[]> {
  const now = new Date();

  const challenges = await prisma.challenge.findMany({
    where: {
      status: 'ACTIVE',
      startsAt: { lte: now },
      endsAt: { gte: now },
      // Level targeting
      OR: [
        { minLevel: null },
        { minLevel: { lte: riderLevel } },
      ],
    },
    orderBy: { endsAt: 'asc' },
    include: {
      participants: {
        where: { riderId },
        take: 1,
      },
    },
  });

  // Filter by zone (null = all zones, or matches rider's zone)
  const filtered = challenges.filter(
    (c) => !c.zoneId || c.zoneId === riderZoneId,
  );

  // Also filter by maxLevel
  const levelFiltered = filtered.filter(
    (c) => c.maxLevel === null || (c.maxLevel !== null && riderLevel <= c.maxLevel),
  );

  return levelFiltered.map((c) => {
    const participation = c.participants[0] ?? null;
    const progress = participation?.progress ?? 0;
    const progressPercent = Math.min(100, Math.round((progress / c.criteriaCount) * 100));
    const timeMs = new Date(c.endsAt).getTime() - now.getTime();

    return {
      id: c.id,
      title: c.title,
      description: c.description,
      type: c.type as ChallengeType,
      status: c.status as ChallengeStatus,
      icon: c.icon,
      criteriaAction: c.criteriaAction,
      criteriaCount: c.criteriaCount,
      xpReward: c.xpReward,
      pointsReward: c.pointsReward,
      badgeRewardId: c.badgeRewardId,
      zoneId: c.zoneId,
      minLevel: c.minLevel,
      maxLevel: c.maxLevel,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      participation,
      progressPercent,
      timeRemaining: formatTimeRemaining(timeMs),
      isJoined: !!participation,
      isCompleted: !!participation?.completedAt,
    };
  });
}

/** Join a challenge */
export async function joinChallenge(riderId: string, challengeId: string) {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw ApiError.notFound('Challenge not found');
  if (challenge.status !== 'ACTIVE') throw ApiError.badRequest('Challenge is not active');
  if (new Date() > challenge.endsAt) throw ApiError.badRequest('Challenge has ended');

  const existing = await prisma.challengeParticipant.findUnique({
    where: { challengeId_riderId: { challengeId, riderId } },
  });
  if (existing) throw ApiError.badRequest('Already joined this challenge');

  return prisma.challengeParticipant.create({
    data: { challengeId, riderId, progress: 0 },
  });
}

/**
 * Increment progress on all active challenges matching a given action.
 * Called when a rider completes an action (delivery, etc.).
 */
export async function incrementChallengeProgress(
  riderId: string,
  action: string,
): Promise<Array<{ challengeId: string; completed: boolean }>> {
  const now = new Date();

  // Find all active participations where the challenge matches the action
  const participations = await prisma.challengeParticipant.findMany({
    where: {
      riderId,
      completedAt: null,
      challenge: {
        status: 'ACTIVE',
        criteriaAction: action,
        endsAt: { gte: now },
      },
    },
    include: { challenge: true },
  });

  const results: Array<{ challengeId: string; completed: boolean }> = [];

  for (const p of participations) {
    const newProgress = p.progress + 1;
    const isComplete = newProgress >= p.challenge.criteriaCount;

    await prisma.challengeParticipant.update({
      where: { id: p.id },
      data: {
        progress: newProgress,
        completedAt: isComplete ? new Date() : undefined,
      },
    });

    if (isComplete) {
      // Award XP reward
      if (p.challenge.xpReward > 0) {
        await GamificationService.awardXp(riderId, 'challenge_complete', p.challenge.xpReward, {
          challengeId: p.challengeId,
          challengeTitle: p.challenge.title,
        });
      }

      // Award reward points
      if (p.challenge.pointsReward > 0) {
        await prisma.riderProfile.update({
          where: { id: riderId },
          data: { rewardPoints: { increment: p.challenge.pointsReward } },
        });
      }

      // Create notification
      const rider = await prisma.riderProfile.findUnique({
        where: { id: riderId },
        select: { userId: true },
      });
      if (rider) {
        await prisma.notification.create({
          data: {
            userId: rider.userId,
            title: `${p.challenge.icon} Challenge Complete!`,
            body: `You completed "${p.challenge.title}"! +${p.challenge.xpReward} XP${p.challenge.pointsReward > 0 ? `, +${p.challenge.pointsReward} points` : ''}`,
            type: 'GAMIFICATION',
            data: { type: 'challenge_complete', challengeId: p.challengeId },
          },
        }).catch(() => {});
      }

      logger.info(
        { riderId, challengeId: p.challengeId, challengeTitle: p.challenge.title },
        'Challenge completed',
      );
    }

    results.push({ challengeId: p.challengeId, completed: isComplete });
  }

  return results;
}

/** Get a rider's completed challenges */
export async function getCompletedChallenges(riderId: string, limit: number = 20) {
  return prisma.challengeParticipant.findMany({
    where: { riderId, completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: limit,
    include: {
      challenge: true,
    },
  });
}

// ────── Utilities ──────

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}
