// ============================================================
// Gamification Routes — Sprint 9 + Sprint 10
// XP, Levels, Badges, Leaderboard, Streaks, Challenges,
// Rewards Store, Bonus XP Events
// ============================================================

import { Router, Request, Response } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import type { LeaderboardCategory, LeaderboardTimeRange } from '@riderguy/types';
import {
  adminAwardXpSchema,
  adminAdjustXpSchema,
  createBadgeSchema,
  updateBadgeSchema,
  markBadgesSeenSchema,
  adminAwardBadgeSchema,
  createChallengeSchema,
  updateChallengeSchema,
  joinChallengeSchema,
  createRewardItemSchema,
  updateRewardItemSchema,
  redeemRewardSchema,
  updateRedemptionSchema,
  createBonusXpEventSchema,
  updateBonusXpEventSchema,
} from '@riderguy/validators';
import * as GamificationService from '../../services/gamification.service';
import * as StreakService from '../../services/streak.service';
import * as ChallengeService from '../../services/challenge.service';
import * as RewardsStoreService from '../../services/rewards-store.service';
import * as BonusXpService from '../../services/bonus-xp.service';
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
 * Enhanced leaderboard: zone, category, time range.
 */
router.get(
  '/leaderboard',
  asyncHandler(async (req: Request, res: Response) => {
    const zoneId = req.query.zoneId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const category = (req.query.category as LeaderboardCategory) || 'xp';
    const timeRange = (req.query.timeRange as LeaderboardTimeRange) || 'alltime';

    const leaderboard = await GamificationService.getLeaderboard({
      zoneId,
      limit,
      currentUserId: req.user!.userId,
      category,
      timeRange,
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

// ============================================================
// Sprint 10 — Streak endpoints
// ============================================================

/**
 * GET /gamification/streak
 * Get the current rider's streak info.
 */
router.get(
  '/streak',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const streak = await StreakService.getStreak(rider.id);

    res.status(StatusCodes.OK).json({ success: true, data: streak });
  }),
);

// ============================================================
// Sprint 10 — Challenge endpoints
// ============================================================

/**
 * GET /gamification/challenges
 * Get active challenges for the current rider.
 */
router.get(
  '/challenges',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true, currentLevel: true, currentZoneId: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const challenges = await ChallengeService.getActiveChallenges(
      rider.id,
      rider.currentLevel,
      rider.currentZoneId,
    );

    res.status(StatusCodes.OK).json({ success: true, data: challenges });
  }),
);

/**
 * POST /gamification/challenges/join
 * Join a challenge.
 */
router.post(
  '/challenges/join',
  requireRole(UserRole.RIDER),
  validate(joinChallengeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const participation = await ChallengeService.joinChallenge(rider.id, req.body.challengeId);

    res.status(StatusCodes.CREATED).json({ success: true, data: participation });
  }),
);

/**
 * GET /gamification/challenges/completed
 * Get completed challenges for the current rider.
 */
router.get(
  '/challenges/completed',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const completed = await ChallengeService.getCompletedChallenges(rider.id);

    res.status(StatusCodes.OK).json({ success: true, data: completed });
  }),
);

/**
 * Admin: CRUD challenges
 */
router.get(
  '/admin/challenges',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const challenges = await ChallengeService.listChallengesAdmin({
      status: status as any,
      type: type as any,
    });

    res.status(StatusCodes.OK).json({ success: true, data: challenges });
  }),
);

router.post(
  '/admin/challenges',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createChallengeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const challenge = await ChallengeService.createChallenge({
      ...req.body,
      createdBy: req.user!.userId,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: challenge });
  }),
);

router.put(
  '/admin/challenges/:challengeId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(updateChallengeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const challenge = await ChallengeService.updateChallenge(
      req.params.challengeId as string,
      req.body,
    );

    res.status(StatusCodes.OK).json({ success: true, data: challenge });
  }),
);

router.delete(
  '/admin/challenges/:challengeId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    await ChallengeService.deleteChallenge(req.params.challengeId as string);

    res.status(StatusCodes.OK).json({ success: true });
  }),
);

// ============================================================
// Sprint 10 — Rewards Store endpoints
// ============================================================

/**
 * GET /gamification/rewards
 * Browse the rewards store (rider).
 */
router.get(
  '/rewards',
  asyncHandler(async (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;
    const featured = req.query.featured === 'true';
    const items = await RewardsStoreService.getStoreItems({
      category,
      featured: featured || undefined,
    });

    res.status(StatusCodes.OK).json({ success: true, data: items });
  }),
);

/**
 * GET /gamification/rewards/balance
 * Get the rider's reward points balance.
 */
router.get(
  '/rewards/balance',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const balance = await RewardsStoreService.getPointsBalance(rider.id);

    res.status(StatusCodes.OK).json({ success: true, data: { balance } });
  }),
);

/**
 * POST /gamification/rewards/redeem
 * Redeem a reward item.
 */
router.post(
  '/rewards/redeem',
  requireRole(UserRole.RIDER),
  validate(redeemRewardSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const redemption = await RewardsStoreService.redeemItem(rider.id, req.body.itemId);

    res.status(StatusCodes.CREATED).json({ success: true, data: redemption });
  }),
);

/**
 * GET /gamification/rewards/history
 * Get the rider's redemption history.
 */
router.get(
  '/rewards/history',
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
    const history = await RewardsStoreService.getRedemptionHistory(rider.id, page, limit);

    res.status(StatusCodes.OK).json({ success: true, data: history });
  }),
);

/**
 * Admin: Rewards CRUD
 */
router.get(
  '/admin/rewards',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (_req: Request, res: Response) => {
    const items = await RewardsStoreService.listItemsAdmin();

    res.status(StatusCodes.OK).json({ success: true, data: items });
  }),
);

router.post(
  '/admin/rewards',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createRewardItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const item = await RewardsStoreService.createItem(req.body);

    res.status(StatusCodes.CREATED).json({ success: true, data: item });
  }),
);

router.put(
  '/admin/rewards/:itemId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(updateRewardItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const item = await RewardsStoreService.updateItem(req.params.itemId as string, req.body);

    res.status(StatusCodes.OK).json({ success: true, data: item });
  }),
);

router.delete(
  '/admin/rewards/:itemId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    await RewardsStoreService.deleteItem(req.params.itemId as string);

    res.status(StatusCodes.OK).json({ success: true });
  }),
);

/**
 * Admin: Redemption management
 */
router.get(
  '/admin/redemptions',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const riderId = req.query.riderId as string | undefined;
    const redemptions = await RewardsStoreService.listRedemptionsAdmin({
      status: status as any,
      riderId,
    });

    res.status(StatusCodes.OK).json({ success: true, data: redemptions });
  }),
);

router.put(
  '/admin/redemptions/:redemptionId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(updateRedemptionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await RewardsStoreService.updateRedemptionStatus(
      req.params.redemptionId as string,
      req.body.status,
      req.body.notes,
    );

    res.status(StatusCodes.OK).json({ success: true, data: result });
  }),
);

// ============================================================
// Sprint 10 — Bonus XP Events endpoints
// ============================================================

/**
 * GET /gamification/bonus-events
 * Get visible bonus XP events for riders.
 */
router.get(
  '/bonus-events',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { currentZoneId: true },
    });

    const events = await BonusXpService.getVisibleEvents(rider?.currentZoneId);

    res.status(StatusCodes.OK).json({ success: true, data: events });
  }),
);

/**
 * Admin: Bonus XP Events CRUD
 */
router.get(
  '/admin/bonus-events',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (_req: Request, res: Response) => {
    const events = await BonusXpService.listBonusEventsAdmin();

    res.status(StatusCodes.OK).json({ success: true, data: events });
  }),
);

router.post(
  '/admin/bonus-events',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createBonusXpEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const event = await BonusXpService.createBonusEvent({
      ...req.body,
      createdBy: req.user!.userId,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: event });
  }),
);

router.put(
  '/admin/bonus-events/:eventId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(updateBonusXpEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const event = await BonusXpService.updateBonusEvent(req.params.eventId as string, req.body);

    res.status(StatusCodes.OK).json({ success: true, data: event });
  }),
);

router.delete(
  '/admin/bonus-events/:eventId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    await BonusXpService.deleteBonusEvent(req.params.eventId as string);

    res.status(StatusCodes.OK).json({ success: true });
  }),
);

export { router as gamificationRouter };
