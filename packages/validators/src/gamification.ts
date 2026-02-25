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
