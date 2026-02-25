import { z } from 'zod';

// ============================================================
// Gamification Validators — Sprint 9
// ============================================================

/** Admin: award XP to a rider */
export const adminAwardXpSchema = z.object({
  points: z.number().int().min(1).max(10000),
  reason: z.string().min(1).max(500),
});

/** Admin: adjust XP (can be negative) */
export const adminAdjustXpSchema = z.object({
  points: z.number().int().min(-50000).max(50000),
  reason: z.string().min(1).max(500),
});

/** Admin: create a badge */
export const createBadgeSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Slug must be lowercase alphanumeric with underscores'),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  icon: z.string().min(1).max(10),
  category: z.enum(['achievement', 'milestone', 'special']),
  criteria: z.object({
    action: z.string(),
    threshold: z.number().int().min(0),
  }).optional(),
  xpReward: z.number().int().min(0).max(10000).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** Admin: update a badge */
export const updateBadgeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  icon: z.string().min(1).max(10).optional(),
  category: z.enum(['achievement', 'milestone', 'special']).optional(),
  criteria: z.object({
    action: z.string(),
    threshold: z.number().int().min(0),
  }).optional(),
  xpReward: z.number().int().min(0).max(10000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/** Mark badges as seen */
export const markBadgesSeenSchema = z.object({
  badgeIds: z.array(z.string()).min(1).max(100),
});

/** Admin: manually award a badge */
export const adminAwardBadgeSchema = z.object({
  badgeId: z.string().min(1),
});

// ============================================================
// Sprint 10 — Challenges, Rewards Store, Bonus XP Events
// ============================================================

/** Admin: create a challenge */
export const createChallengeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
  icon: z.string().min(1).max(10).optional(),
  criteriaAction: z.string().min(1),
  criteriaCount: z.number().int().min(1),
  xpReward: z.number().int().min(0).max(50000).optional(),
  pointsReward: z.number().int().min(0).max(50000).optional(),
  badgeRewardId: z.string().optional(),
  zoneId: z.string().optional(),
  minLevel: z.number().int().min(1).max(7).optional(),
  maxLevel: z.number().int().min(1).max(7).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

/** Admin: update a challenge */
export const updateChallengeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
  icon: z.string().min(1).max(10).optional(),
  criteriaAction: z.string().min(1).optional(),
  criteriaCount: z.number().int().min(1).optional(),
  xpReward: z.number().int().min(0).max(50000).optional(),
  pointsReward: z.number().int().min(0).max(50000).optional(),
  badgeRewardId: z.string().nullable().optional(),
  zoneId: z.string().nullable().optional(),
  minLevel: z.number().int().min(1).max(7).nullable().optional(),
  maxLevel: z.number().int().min(1).max(7).nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED']).optional(),
});

/** Rider: join a challenge */
export const joinChallengeSchema = z.object({
  challengeId: z.string().min(1),
});

/** Admin: create a reward store item */
export const createRewardItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  icon: z.string().min(1).max(10).optional(),
  imageUrl: z.string().url().optional(),
  category: z.string().min(1).max(50).optional(),
  pointsCost: z.number().int().min(1),
  inventory: z.number().int().min(-1).optional(), // -1 = unlimited
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** Admin: update a reward store item */
export const updateRewardItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  icon: z.string().min(1).max(10).optional(),
  imageUrl: z.string().url().nullable().optional(),
  category: z.string().min(1).max(50).optional(),
  pointsCost: z.number().int().min(1).optional(),
  inventory: z.number().int().min(-1).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** Rider: redeem a reward */
export const redeemRewardSchema = z.object({
  itemId: z.string().min(1),
});

/** Admin: update a redemption status */
export const updateRedemptionSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED']),
  notes: z.string().max(500).optional(),
});

/** Admin: create a bonus XP event */
export const createBonusXpEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  multiplier: z.number().min(1.1).max(10),
  targetActions: z.array(z.string()).optional(),
  zoneId: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

/** Admin: update a bonus XP event */
export const updateBonusXpEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  multiplier: z.number().min(1.1).max(10).optional(),
  targetActions: z.array(z.string()).optional(),
  zoneId: z.string().nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});
