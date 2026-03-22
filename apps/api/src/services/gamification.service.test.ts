import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Type helper ──
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// ── Mocks ──

vi.mock('@riderguy/database', () => ({
  prisma: {
    riderProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    xpEvent: {
      create: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    badge: {
      findMany: vi.fn(),
    },
    riderBadge: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/api-error', async () => {
  const actual = await vi.importActual('../lib/api-error') as any;
  return actual;
});

vi.mock('./bonus-xp.service', () => ({
  getXpMultiplier: vi.fn().mockResolvedValue(1),
}));

// ── Import AFTER mocks ──
import {
  calculateLevel,
  getLevelProgress,
  awardXp,
  getGamificationProfile,
  markBadgesSeen,
} from './gamification.service';
import { prisma } from '@riderguy/database';
import { RiderLevel, XpAction } from '@riderguy/types';

// ============================================================
// GAMIFICATION SERVICE — COMPREHENSIVE SIMULATION TESTS
// ============================================================

describe('GamificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────
  // 1. LEVEL CALCULATION — XP thresholds
  // ────────────────────────────────────────────────────────────
  describe('calculateLevel', () => {
    it('should return ROOKIE for 0 XP', () => {
      expect(calculateLevel(0)).toBe(RiderLevel.ROOKIE);
    });

    it('should return RUNNER at 500 XP', () => {
      expect(calculateLevel(500)).toBe(RiderLevel.RUNNER);
    });

    it('should return STREAKER at 2000 XP', () => {
      expect(calculateLevel(2000)).toBe(RiderLevel.STREAKER);
    });

    it('should return PRO at 5000 XP', () => {
      expect(calculateLevel(5000)).toBe(RiderLevel.PRO);
    });

    it('should return ACE at 12000 XP', () => {
      expect(calculateLevel(12000)).toBe(RiderLevel.ACE);
    });

    it('should return CAPTAIN at 25000 XP', () => {
      expect(calculateLevel(25000)).toBe(RiderLevel.CAPTAIN);
    });

    it('should return LEGEND at 50000 XP', () => {
      expect(calculateLevel(50000)).toBe(RiderLevel.LEGEND);
    });

    it('should handle XP between thresholds correctly', () => {
      expect(calculateLevel(499)).toBe(RiderLevel.ROOKIE);
      expect(calculateLevel(501)).toBe(RiderLevel.RUNNER);
      expect(calculateLevel(1999)).toBe(RiderLevel.RUNNER);
      expect(calculateLevel(49999)).toBe(RiderLevel.CAPTAIN);
      expect(calculateLevel(100000)).toBe(RiderLevel.LEGEND);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2. LEVEL PROGRESS — progress within current level
  // ────────────────────────────────────────────────────────────
  describe('getLevelProgress', () => {
    it('should show 0% progress at level start', () => {
      const progress = getLevelProgress(500);
      expect(progress.currentLevel).toBe(RiderLevel.RUNNER);
      expect(progress.progressPercent).toBe(0);
      expect(progress.levelName).toBe('Runner');
    });

    it('should show correct mid-level progress', () => {
      // Runner: 500 → 2000 (1500 range), at 1250 = 750/1500 = 50%
      const progress = getLevelProgress(1250);
      expect(progress.currentLevel).toBe(RiderLevel.RUNNER);
      expect(progress.progressPercent).toBe(50);
    });

    it('should show 100% progress at LEGEND (max level)', () => {
      const progress = getLevelProgress(50000);
      expect(progress.currentLevel).toBe(RiderLevel.LEGEND);
      expect(progress.progressPercent).toBe(100);
      expect(progress.isMaxLevel).toBe(true);
    });

    it('should return correct currentLevelXp and nextLevelXp', () => {
      // At 3000 XP → STREAKER (2000-5000 range), 1000 into level, 3000 for level
      const progress = getLevelProgress(3000);
      expect(progress.currentLevel).toBe(RiderLevel.STREAKER);
      expect(progress.currentLevelXp).toBe(1000);
      expect(progress.nextLevelXp).toBe(3000);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3. AWARD XP — delivery complete, rating, streak
  // ────────────────────────────────────────────────────────────
  describe('awardXp', () => {
    it('should award XP for delivery completion', async () => {
      const rider = {
        id: 'rider-1',
        userId: 'user-1',
        totalXp: 400,
        currentLevel: RiderLevel.ROOKIE,
        currentZoneId: 'zone-accra',
      };

      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.riderProfile.update).mockResolvedValue({ ...rider, totalXp: 450 });
      asMock(prisma.xpEvent.create).mockResolvedValue({});
      // Badge checking
      asMock(prisma.riderBadge.findMany).mockResolvedValue([]);
      asMock(prisma.badge.findMany).mockResolvedValue([]);

      const result = await awardXp('rider-1', XpAction.DELIVERY_COMPLETE);

      expect(result.pointsAwarded).toBe(50); // base XP for delivery
      expect(result.totalXp).toBe(450);
      expect(result.leveledUp).toBe(false);
      expect(prisma.riderProfile.update).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        data: { totalXp: 450, currentLevel: RiderLevel.ROOKIE },
      });
    });

    it('should trigger level up when crossing threshold', async () => {
      const rider = {
        id: 'rider-1',
        userId: 'user-1',
        totalXp: 470, // 30 away from RUNNER (500)
        currentLevel: RiderLevel.ROOKIE,
        currentZoneId: 'zone-accra',
      };

      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.riderProfile.update).mockResolvedValue({ ...rider, totalXp: 520 });
      asMock(prisma.xpEvent.create).mockResolvedValue({});
      asMock(prisma.riderBadge.findMany).mockResolvedValue([]);
      asMock(prisma.badge.findMany).mockResolvedValue([]);
      asMock(prisma.notification.create).mockResolvedValue({});

      const result = await awardXp('rider-1', XpAction.DELIVERY_COMPLETE);

      expect(result.pointsAwarded).toBe(50);
      expect(result.totalXp).toBe(520);
      expect(result.leveledUp).toBe(true);
      expect(result.previousLevel).toBe(RiderLevel.ROOKIE);
      expect(result.currentLevel).toBe(RiderLevel.RUNNER);

      // Should create level-up notification
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          title: expect.stringContaining('Level Up'),
          type: 'GAMIFICATION',
        }),
      });
    });

    it('should award 5-star rating XP', async () => {
      const rider = {
        id: 'rider-1',
        userId: 'user-1',
        totalXp: 100,
        currentLevel: RiderLevel.ROOKIE,
        currentZoneId: null,
      };

      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.riderProfile.update).mockResolvedValue({ ...rider, totalXp: 130 });
      asMock(prisma.xpEvent.create).mockResolvedValue({});
      asMock(prisma.riderBadge.findMany).mockResolvedValue([]);
      asMock(prisma.badge.findMany).mockResolvedValue([]);

      const result = await awardXp('rider-1', XpAction.FIVE_STAR_RATING);

      expect(result.pointsAwarded).toBe(30);
    });

    it('should apply bonus XP multiplier from active events', async () => {
      const { getXpMultiplier } = await import('./bonus-xp.service');
      asMock(getXpMultiplier).mockResolvedValueOnce(2); // 2x multiplier active

      const rider = {
        id: 'rider-1',
        userId: 'user-1',
        totalXp: 100,
        currentLevel: RiderLevel.ROOKIE,
        currentZoneId: 'zone-accra',
      };

      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.riderProfile.update).mockResolvedValue({ ...rider, totalXp: 200 });
      asMock(prisma.xpEvent.create).mockResolvedValue({});
      asMock(prisma.riderBadge.findMany).mockResolvedValue([]);
      asMock(prisma.badge.findMany).mockResolvedValue([]);

      const result = await awardXp('rider-1', XpAction.DELIVERY_COMPLETE);

      expect(result.pointsAwarded).toBe(100); // 50 * 2x
    });

    it('should return zero-result for unknown action with no points', async () => {
      const result = await awardXp('rider-1', 'unknown_action');

      expect(result.pointsAwarded).toBe(0);
      expect(result.leveledUp).toBe(false);
    });

    it('should throw for non-existent rider', async () => {
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(null);

      // awardXp with a real action (non-zero XP) should throw
      await expect(awardXp('ghost', XpAction.DELIVERY_COMPLETE))
        .rejects.toThrow('Rider profile not found');
    });

    it('should award badge when criteria met', async () => {
      const rider = {
        id: 'rider-1',
        userId: 'user-1',
        totalXp: 2400,
        currentLevel: RiderLevel.STREAKER,
        currentZoneId: null,
      };

      asMock(prisma.riderProfile.findUnique)
        .mockResolvedValueOnce(rider) // awardXp lookup
        .mockResolvedValueOnce({ totalDeliveries: 10 }) // getActionCounts
        .mockResolvedValueOnce({ userId: 'user-1' }); // badge notification lookup

      asMock(prisma.riderProfile.update).mockResolvedValue({ ...rider, totalXp: 2450 });
      asMock(prisma.xpEvent.create).mockResolvedValue({});

      // No existing badges
      asMock(prisma.riderBadge.findMany).mockResolvedValue([]);

      // One badge candidate that rider qualifies for
      asMock(prisma.badge.findMany).mockResolvedValue([{
        id: 'badge-10-deliveries',
        slug: 'first-10',
        name: 'First 10 Deliveries',
        description: 'Complete 10 deliveries',
        icon: '🚀',
        criteria: { action: 'delivery_complete', threshold: 10 },
        xpReward: 25,
        isActive: true,
      }]);

      // XP event action counts
      asMock(prisma.xpEvent.groupBy).mockResolvedValue([
        { action: 'delivery_complete', _count: { action: 10 } },
      ]);

      asMock(prisma.riderBadge.create).mockResolvedValue({});
      asMock(prisma.notification.create).mockResolvedValue({});

      const result = await awardXp('rider-1', XpAction.DELIVERY_COMPLETE);

      expect(result.newBadges).toHaveLength(1);
      expect(prisma.riderBadge.create).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 4. GAMIFICATION PROFILE
  // ────────────────────────────────────────────────────────────
  describe('getGamificationProfile', () => {
    it('should return full gamification profile', async () => {
      asMock(prisma.riderProfile.findUnique).mockResolvedValue({
        totalXp: 3500,
        currentLevel: RiderLevel.STREAKER,
        badges: [
          {
            badge: { id: 'b-1', slug: 'first-10', name: 'First 10 Deliveries' },
            awardedAt: new Date(),
            seenAt: new Date(),
          },
        ],
        xpEvents: [
          { action: 'delivery_complete', points: 50, createdAt: new Date() },
        ],
      });

      const profile = await getGamificationProfile('rider-1');

      expect(profile.currentLevel).toBe(RiderLevel.STREAKER);
      expect(profile.levelName).toBe('Streaker');
      expect(profile.totalXp).toBe(3500);
      expect(profile.badges).toHaveLength(1);
      expect(profile.recentXp).toHaveLength(1);
    });

    it('should throw for non-existent rider', async () => {
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(null);

      await expect(getGamificationProfile('ghost'))
        .rejects.toThrow('Rider profile not found');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 5. MARK BADGES SEEN
  // ────────────────────────────────────────────────────────────
  describe('markBadgesSeen', () => {
    it('should mark unseen badges as seen', async () => {
      asMock(prisma.riderBadge.updateMany).mockResolvedValue({ count: 2 });

      await markBadgesSeen('rider-1', ['badge-1', 'badge-2']);

      expect(prisma.riderBadge.updateMany).toHaveBeenCalledWith({
        where: {
          riderId: 'rider-1',
          badgeId: { in: ['badge-1', 'badge-2'] },
          seenAt: null,
        },
        data: { seenAt: expect.any(Date) },
      });
    });
  });
});
