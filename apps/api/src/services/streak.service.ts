// ============================================================
// Streak Service — Sprint 10
// Tracks consecutive active days for riders
// ============================================================

import { prisma } from '@riderguy/database';
import { XpAction, XP_VALUES } from '@riderguy/types';
import { logger } from '../lib/logger';
import * as GamificationService from './gamification.service';

/**
 * Record rider activity for today and update their streak.
 * Called when a rider completes a delivery.
 */
export async function recordActivity(riderId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  streakBroken: boolean;
  newMilestone: number | null;
}> {
  const today = getDateKey(new Date());

  const streak = await prisma.riderStreak.upsert({
    where: { riderId },
    create: {
      riderId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: new Date(today),
      streakStartDate: new Date(today),
    },
    update: {}, // Read first, then decide
  });

  const lastDate = streak.lastActiveDate ? getDateKey(streak.lastActiveDate) : null;

  // Already recorded today
  if (lastDate === today) {
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      streakBroken: false,
      newMilestone: null,
    };
  }

  const yesterday = getDateKey(new Date(Date.now() - 86_400_000));
  let newCurrentStreak: number;
  let streakBroken = false;

  if (lastDate === yesterday) {
    // Continuing the streak
    newCurrentStreak = streak.currentStreak + 1;
  } else {
    // Streak broken (or first ever activity)
    streakBroken = lastDate !== null;
    newCurrentStreak = 1;
  }

  const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

  await prisma.riderStreak.update({
    where: { riderId },
    data: {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastActiveDate: new Date(today),
      streakStartDate: streakBroken || lastDate === null ? new Date(today) : streak.streakStartDate,
    },
  });

  // Check streak milestones and award XP/badges
  const newMilestone = await checkStreakMilestones(riderId, newCurrentStreak);

  logger.info(
    { riderId, currentStreak: newCurrentStreak, longestStreak: newLongestStreak, streakBroken },
    'Streak updated',
  );

  return {
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    streakBroken,
    newMilestone,
  };
}

/** Check streak milestones and award XP */
async function checkStreakMilestones(riderId: string, streak: number): Promise<number | null> {
  const milestones = [
    { days: 3, action: XpAction.STREAK_3 },
    { days: 7, action: XpAction.STREAK_7 },
    { days: 14, action: XpAction.STREAK_14 },
    { days: 30, action: XpAction.STREAK_30 },
  ];

  for (const { days, action } of milestones) {
    if (streak === days) {
      await GamificationService.awardXp(riderId, action, undefined, {
        streakDays: days,
      });
      return days;
    }
  }

  return null;
}

/** Get a rider's current streak info */
export async function getStreak(riderId: string) {
  const streak = await prisma.riderStreak.findUnique({
    where: { riderId },
  });

  if (!streak) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      streakStartDate: null,
      isActiveToday: false,
    };
  }

  const today = getDateKey(new Date());
  const isActiveToday = streak.lastActiveDate
    ? getDateKey(streak.lastActiveDate) === today
    : false;

  // Check if streak is still valid (last activity was today or yesterday)
  const yesterday = getDateKey(new Date(Date.now() - 86_400_000));
  const lastDate = streak.lastActiveDate ? getDateKey(streak.lastActiveDate) : null;
  const isStreakAlive = lastDate === today || lastDate === yesterday;

  return {
    currentStreak: isStreakAlive ? streak.currentStreak : 0,
    longestStreak: streak.longestStreak,
    lastActiveDate: streak.lastActiveDate,
    streakStartDate: streak.streakStartDate,
    isActiveToday,
  };
}

/** Normalize a Date to YYYY-MM-DD string (UTC) */
function getDateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}
