'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import type { RiderLevel } from '@riderguy/types';

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
}

export function useGamification() {
  const { api } = useAuth();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${API_BASE_URL}/gamification/profile`);
      setProfile(res.data.data);
      setError(null);
    } catch {
      setError('Failed to load gamification data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchLeaderboard = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${API_BASE_URL}/gamification/leaderboard?limit=20`);
      setLeaderboard(res.data.data ?? []);
    } catch {
      // silent fail
    }
  }, [api]);

  const markBadgesSeen = useCallback(async (badgeIds: string[]) => {
    if (!api || badgeIds.length === 0) return;
    try {
      await api.post(`${API_BASE_URL}/gamification/badges/seen`, { badgeIds });
      // Update local state
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

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const unseenBadges = profile?.badges.filter(b => b.awardedAt && !b.seenAt) ?? [];

  return {
    profile,
    leaderboard,
    unseenBadges,
    loading,
    error,
    fetchProfile,
    fetchLeaderboard,
    markBadgesSeen,
  };
}
