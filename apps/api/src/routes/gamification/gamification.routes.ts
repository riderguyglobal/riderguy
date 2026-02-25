// ============================================================
// Gamification Routes — Sprint 9
// XP, Levels, Badges, Leaderboard
// ============================================================

import { Router, Request, Response } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import {
  adminAwardXpSchema,
  adminAdjustXpSchema,
  createBadgeSchema,
  updateBadgeSchema,
  markBadgesSeenSchema,
  adminAwardBadgeSchema,
} from '@riderguy/validators';
import * as GamificationService from '../../services/gamification.service';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../lib/api-error';

const router = Router();

router.use(authenticate);

// ============================================================
// Rider endpoints (own gamification data)
// ============================================================

/**
 * GET /gamification/profile
 * Get the current rider's gamification profile (XP, level, badges).
 */
router.get(
  '/profile',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const profile = await GamificationService.getGamificationProfile(rider.id);

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  }),
);

/**
 * GET /gamification/xp-history
 * Get paginated XP event history.
 */
router.get(
  '/xp-history',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const history = await GamificationService.getXpHistory(rider.id, page, limit);

    res.status(StatusCodes.OK).json({ success: true, data: history });
  }),
);

/**
 * POST /gamification/badges/seen
 * Mark badges as seen (dismiss celebration).
 */
router.post(
  '/badges/seen',
  requireRole(UserRole.RIDER),
  validate(markBadgesSeenSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    await GamificationService.markBadgesSeen(rider.id, req.body.badgeIds);

    res.status(StatusCodes.OK).json({ success: true });
  }),
);

/**
 * GET /gamification/leaderboard
 * Get XP leaderboard (optionally filtered by zone).
 */
router.get(
  '/leaderboard',
  asyncHandler(async (req: Request, res: Response) => {
    const zoneId = req.query.zoneId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const leaderboard = await GamificationService.getLeaderboard({
      zoneId,
      limit,
      currentUserId: req.user!.userId,
    });

    res.status(StatusCodes.OK).json({ success: true, data: leaderboard });
  }),
);

/**
 * GET /gamification/level-perks
 * Get all level perks information.
 */
router.get(
  '/level-perks',
  asyncHandler(async (_req: Request, res: Response) => {
    const levels = [1, 2, 3, 4, 5, 6, 7] as const;
    const perks = levels.map((l) => GamificationService.getLevelPerksForLevel(l));

    res.status(StatusCodes.OK).json({ success: true, data: perks });
  }),
);

/**
 * GET /gamification/badges
 * Get all available badges.
 */
router.get(
  '/badges',
  asyncHandler(async (_req: Request, res: Response) => {
    const badges = await prisma.badge.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    res.status(StatusCodes.OK).json({ success: true, data: badges });
  }),
);

// ============================================================
// Admin endpoints
// ============================================================

/**
 * POST /gamification/admin/award-xp/:riderId
 * Manually award XP to a rider.
 */
router.post(
  '/admin/award-xp/:riderId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(adminAwardXpSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const riderId = req.params.riderId as string;
    const { points, reason } = req.body;

    const result = await GamificationService.adminAwardXp(riderId, points, reason);

    res.status(StatusCodes.OK).json({ success: true, data: result });
  }),
);

/**
 * POST /gamification/admin/adjust-xp/:riderId
 * Adjust XP for a rider (can be negative).
 */
router.post(
  '/admin/adjust-xp/:riderId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(adminAdjustXpSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const riderId = req.params.riderId as string;
    const { points, reason } = req.body;

    const result = await GamificationService.adminAdjustXp(riderId, points, reason);

    res.status(StatusCodes.OK).json({ success: true, data: result });
  }),
);

/**
 * POST /gamification/admin/award-badge/:riderId
 * Manually award a badge to a rider.
 */
router.post(
  '/admin/award-badge/:riderId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(adminAwardBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const riderId = req.params.riderId as string;
    const { badgeId } = req.body;

    await GamificationService.adminAwardBadge(riderId, badgeId);

    res.status(StatusCodes.OK).json({ success: true });
  }),
);

/**
 * GET /gamification/admin/badges
 * List all badges (including count of riders who have them).
 */
router.get(
  '/admin/badges',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (_req: Request, res: Response) => {
    const badges = await GamificationService.listBadges();

    res.status(StatusCodes.OK).json({ success: true, data: badges });
  }),
);

/**
 * POST /gamification/admin/badges
 * Create a new badge definition.
 */
router.post(
  '/admin/badges',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const badge = await GamificationService.createBadge(req.body);

    res.status(StatusCodes.CREATED).json({ success: true, data: badge });
  }),
);

/**
 * PUT /gamification/admin/badges/:badgeId
 * Update a badge definition.
 */
router.put(
  '/admin/badges/:badgeId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(updateBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const badge = await GamificationService.updateBadge(req.params.badgeId as string, req.body);

    res.status(StatusCodes.OK).json({ success: true, data: badge });
  }),
);

/**
 * DELETE /gamification/admin/badges/:badgeId
 * Delete a badge definition.
 */
router.delete(
  '/admin/badges/:badgeId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    await GamificationService.deleteBadge(req.params.badgeId as string);

    res.status(StatusCodes.OK).json({ success: true });
  }),
);

/**
 * POST /gamification/admin/seed-badges
 * Seed default badge definitions.
 */
router.post(
  '/admin/seed-badges',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (_req: Request, res: Response) => {
    const created = await GamificationService.seedDefaultBadges();

    res.status(StatusCodes.OK).json({ success: true, data: { created } });
  }),
);

/**
 * GET /gamification/admin/rider/:riderId
 * Get a rider's full gamification profile (admin view).
 */
router.get(
  '/admin/rider/:riderId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await GamificationService.getGamificationProfile(req.params.riderId as string);

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  }),
);

export { router as gamificationRouter };
