'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';

// ============================================================
// Rider Identity Hook — Sprint 12
// Profile upgrade, public card, spotlights
// ============================================================

const BASE = `${API_BASE_URL}/rider-identity`;

// ────── Types ──────

export interface RiderIdentity {
  id: string;
  bio: string | null;
  publicProfileUrl: string | null;
  currentLevel: number;
  totalDeliveries: number;
  averageRating: number;
  totalRatings: number;
  completionRate: number;
  onTimeRate: number;
  createdAt: string;
  user: { firstName: string; lastName: string; avatar: string | null };
  currentZone: { id: string; name: string } | null;
  badges: Array<{
    badge: { name: string; description: string; imageUrl: string | null };
    earnedAt: string;
  }>;
}

export interface PublicRiderCard {
  id: string;
  bio: string | null;
  publicProfileUrl: string | null;
  currentLevel: number;
  totalDeliveries: number;
  averageRating: number;
  totalRatings: number;
  completionRate: number;
  onTimeRate: number;
  createdAt: string;
  user: { firstName: string; lastName: string; avatar: string | null };
  currentZone: { id: string; name: string } | null;
  badges: Array<{
    badge: { name: string; description: string; imageUrl: string | null };
  }>;
  spotlights: Array<{ title: string; month: number; year: number }>;
}

export interface Spotlight {
  id: string;
  title: string;
  story: string;
  imageUrl: string | null;
  month: number;
  year: number;
  isFeatured: boolean;
  rider: {
    id: string;
    publicProfileUrl: string | null;
    user: { firstName: string; lastName: string; avatar: string | null };
    currentLevel: number;
    totalDeliveries: number;
    averageRating: number;
    currentZone?: { name: string } | null;
  };
  createdAt: string;
}

// ────── Hook ──────

export function useRiderIdentity() {
  const { api } = useAuth();
  const [identity, setIdentity] = useState<RiderIdentity | null>(null);
  const [publicCard, setPublicCard] = useState<PublicRiderCard | null>(null);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [latestSpotlight, setLatestSpotlight] = useState<Spotlight | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMyIdentity = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/me`);
      setIdentity(res.data.data);
    } catch (err) {
      console.error('Failed to fetch identity:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const updateIdentity = useCallback(
    async (data: { bio?: string; publicProfileUrl?: string }) => {
      if (!api) return null;
      const res = await api.patch(`${BASE}/me`, data);
      const updated = res.data.data;
      setIdentity((prev) => (prev ? { ...prev, ...updated } : prev));
      return updated;
    },
    [api],
  );

  const fetchPublicCard = useCallback(
    async (slug: string) => {
      if (!api) return;
      setLoading(true);
      try {
        const res = await api.get(`${BASE}/card/${slug}`);
        setPublicCard(res.data.data);
      } catch (err) {
        console.error('Failed to fetch public card:', err);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const fetchSpotlights = useCallback(
    async (page?: number) => {
      if (!api) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (page) params.set('page', String(page));
        const res = await api.get(`${BASE}/spotlights?${params}`);
        setSpotlights(res.data.data.spotlights);
      } catch (err) {
        console.error('Failed to fetch spotlights:', err);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const fetchLatestSpotlight = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get(`${BASE}/spotlights/latest`);
      setLatestSpotlight(res.data.data);
    } catch (err) {
      console.error('Failed to fetch latest spotlight:', err);
    }
  }, [api]);

  return {
    identity,
    publicCard,
    spotlights,
    latestSpotlight,
    loading,
    fetchMyIdentity,
    updateIdentity,
    fetchPublicCard,
    fetchSpotlights,
    fetchLatestSpotlight,
  };
}
