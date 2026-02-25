'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import type { RiderLevel } from '@riderguy/types';

// ────── Sprint 9 types ──────

export interface GamificationBadge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  awardedAt?: string;
  seenAt?: string | null;
}

export interface GamificationProfile {
  riderId: string;
  totalXp: number;
  currentLevel: number;
  levelName: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  isMaxLevel: boolean;
  badges: GamificationBadge[];
  recentXpEvents: Array<{
    id: string;
    action: string;
    points: number;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
  rank?: number;
}

export interface LeaderboardEntry {
  riderId: string;
  rank: number;
  totalXp: number;
  currentLevel: number;
  levelName: string;
  riderName: string;
  avatarUrl?: string | null;
  totalDeliveries?: number;
  isCurrentUser?: boolean;
}

// ────── Sprint 10 types ──────

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  streakStartDate: string | null;
  isActiveToday: boolean;
}

export interface ChallengeWithProgress {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  icon: string;
  criteriaAction: string;
  criteriaCount: number;
  xpReward: number;
  pointsReward: number;
  startsAt: string;
  endsAt: string;
  participation: {
    progress: number;
    completedAt: string | null;
    rewardClaimed: boolean;
  } | null;
  progressPercent: number;
  timeRemaining: string;
  isJoined: boolean;
  isCompleted: boolean;
}

export interface RewardStoreItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  imageUrl: string | null;
  category: string;
  pointsCost: number;
  inventory: number;
  isFeatured: boolean;
  isActive: boolean;
}

export interface RewardRedemption {
  id: string;
  itemId: string;
  item?: RewardStoreItem;
  pointsSpent: number;
  status: string;
  createdAt: string;
}

export interface BonusXpEventInfo {
  id: string;
  title: string;
  description: string;
  multiplier: number;
  targetActions: string[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export type LeaderboardTimeRange = 'today' | 'week' | 'month' | 'alltime';
export type LeaderboardCategory = 'xp' | 'deliveries' | 'rating' | 'streak';

// ────── Main hook ──────

export function useGamification() {
  const { api } = useAuth();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<ChallengeWithProgress[]>([]);
  const [rewardItems, setRewardItems] = useState<RewardStoreItem[]>([]);
  const [rewardBalance, setRewardBalance] = useState(0);
  const [redemptionHistory, setRedemptionHistory] = useState<RewardRedemption[]>([]);
  const [bonusEvents, setBonusEvents] = useState<BonusXpEventInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Gamification profile (Sprint 9) ──
  const fetchProfile = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${API_BASE_URL}/gamification/profile`);
      const data = res.data.data;
      // Ensure arrays are never undefined (API may omit them for new users)
      if (data) {
        data.badges = data.badges ?? [];
        data.recentXpEvents = data.recentXpEvents ?? [];
      }
      setProfile(data);
      setError(null);
    } catch {
      setError('Failed to load gamification data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  // ── Enhanced Leaderboard (Sprint 10) ──
  const fetchLeaderboard = useCallback(async (
    options?: { category?: LeaderboardCategory; timeRange?: LeaderboardTimeRange; zoneId?: string },
  ) => {
    if (!api) return;
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (options?.category) params.set('category', options.category);
      if (options?.timeRange) params.set('timeRange', options.timeRange);
      if (options?.zoneId) params.set('zoneId', options.zoneId);
      const res = await api.get(`${API_BASE_URL}/gamification/leaderboard?${params}`);
      setLeaderboard(res.data.data ?? []);
    } catch {
      // silent fail
    }
  }, [api]);

  const markBadgesSeen = useCallback(async (badgeIds: string[]) => {
    if (!api || badgeIds.length === 0) return;
    try {
      await api.post(`${API_BASE_URL}/gamification/badges/seen`, { badgeIds });
      setProfile(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          badges: prev.badges.map(b =>
            badgeIds.includes(b.id) ? { ...b, seenAt: new Date().toISOString() } : b
          ),
        };
      });
    } catch {
      // silent fail
    }
  }, [api]);

  // ── Streak (Sprint 10) ──
  const fetchStreak = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${API_BASE_URL}/gamification/streak`);
      setStreak(res.data.data);
    } catch {
      // silent fail
    }
  }, [api]);

  // ── Challenges (Sprint 10) ──
  const fetchChallenges = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${API_BASE_URL}/gamification/challenges`);
      setChallenges(res.data.data ?? []);
    } catch {
      // silent fail
    }
  }, [api]);

  const fetchCompletedChallenges = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${API_BASE_URL}/gamification/challenges/completed`);
      setCompletedChallenges(res.data.data ?? []);
    } catch {
      // silent fail
    }
  }, [api]);

  const joinChallenge = useCallback(async (challengeId: string) => {
    if (!api) return false;
    try {
      await api.post(`${API_BASE_URL}/gamification/challenges/join`, { challengeId });
      await fetchChallenges();
      return true;
    } catch {
      return false;
    }
  }, [api, fetchChallenges]);

  // ── Rewards Store (Sprint 10) ──
  const fetchRewardItems = useCallback(async (category?: string) => {
    if (!api) return;
    try {
      const params = category ? `?category=${category}` : '';
      const res = await api.get(`${API_BASE_URL}/gamification/rewards${params}`);
      setRewardItems(res.data.data ?? []);
    } catch {
      // silent fail
    }
  }, [api]);

  const fetchRewardBalance = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${API_BASE_URL}/gamification/rewards/balance`);
      setRewardBalance(res.data.data?.balance ?? 0);
    } catch {
      // silent fail
    }
  }, [api]);

  const fetchRedemptionHistory = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${API_BASE_URL}/gamification/rewards/history`);
      setRedemptionHistory(res.data.data?.redemptions ?? []);
    } catch {
      // silent fail
    }
  }, [api]);

  const redeemReward = useCallback(async (itemId: string) => {
    if (!api) return false;
    try {
      await api.post(`${API_BASE_URL}/gamification/rewards/redeem`, { itemId });
      await Promise.all([fetchRewardBalance(), fetchRedemptionHistory()]);
      return true;
    } catch {
      return false;
    }
  }, [api, fetchRewardBalance, fetchRedemptionHistory]);

  // ── Bonus XP Events (Sprint 10) ──
  const fetchBonusEvents = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${API_BASE_URL}/gamification/bonus-events`);
      setBonusEvents(res.data.data ?? []);
    } catch {
      // silent fail
    }
  }, [api]);

  // Initial fetch
  useEffect(() => {
    fetchProfile();
    fetchStreak();
    fetchBonusEvents();
  }, [fetchProfile, fetchStreak, fetchBonusEvents]);

  const unseenBadges = (profile?.badges ?? []).filter(b => b.awardedAt && !b.seenAt);

  return {
    // Sprint 9
    profile,
    leaderboard,
    unseenBadges,
    loading,
    error,
    fetchProfile,
    fetchLeaderboard,
    markBadgesSeen,
    // Sprint 10
    streak,
    challenges,
    completedChallenges,
    rewardItems,
    rewardBalance,
    redemptionHistory,
    bonusEvents,
    fetchStreak,
    fetchChallenges,
    fetchCompletedChallenges,
    joinChallenge,
    fetchRewardItems,
    fetchRewardBalance,
    fetchRedemptionHistory,
    redeemReward,
    fetchBonusEvents,
  };
}
