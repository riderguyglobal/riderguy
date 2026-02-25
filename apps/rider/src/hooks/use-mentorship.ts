'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';

// ============================================================
// Mentorship Hook — Sprint 12
// ============================================================

const BASE = `${API_BASE_URL}/mentorship`;

// ────── Types ──────

export interface Mentor {
  id: string;
  userId: string;
  user: { firstName: string; lastName: string; avatar: string | null };
  currentLevel: number;
  totalDeliveries: number;
  averageRating: number;
  currentZone: { id: string; name: string } | null;
  bio: string | null;
  activeMenteeCount: number;
}

export interface MentorshipRecord {
  id: string;
  mentorId: string;
  menteeId: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  zoneId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completionNote: string | null;
  createdAt: string;
  updatedAt: string;
  mentor?: {
    id: string;
    user: { firstName: string; lastName: string; avatar: string | null };
    currentLevel: number;
    totalDeliveries: number;
    averageRating?: number;
  };
  mentee?: {
    id: string;
    user: { firstName: string; lastName: string; avatar: string | null };
    currentLevel: number;
    totalDeliveries: number;
  };
  zone?: { id: string; name: string } | null;
  _count?: { checkIns: number };
}

export interface CheckIn {
  id: string;
  mentorshipId: string;
  authorId: string;
  note: string;
  rating: number | null;
  createdAt: string;
}

// ────── Hook ──────

export function useMentorship() {
  const { api } = useAuth();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [myMentorships, setMyMentorships] = useState<{
    asMentor: MentorshipRecord[];
    asMentee: MentorshipRecord[];
  }>({ asMentor: [], asMentee: [] });
  const [currentMentorship, setCurrentMentorship] = useState<MentorshipRecord | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });

  const searchMentors = useCallback(
    async (opts?: { zoneId?: string; minLevel?: number; page?: number }) => {
      if (!api) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts?.zoneId) params.set('zoneId', opts.zoneId);
        if (opts?.minLevel) params.set('minLevel', String(opts.minLevel));
        if (opts?.page) params.set('page', String(opts.page));
        const res = await api.get(`${BASE}/mentors?${params}`);
        const data = res.data.data;
        setMentors(data.mentors);
        setPagination({ total: data.total, page: data.page, totalPages: data.totalPages });
      } catch (err) {
        console.error('Failed to search mentors:', err);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const requestMentorship = useCallback(
    async (mentorId: string) => {
      if (!api) return null;
      const res = await api.post(`${BASE}/request`, { mentorId });
      return res.data.data;
    },
    [api],
  );

  const fetchMyMentorships = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/mine`);
      setMyMentorships(res.data.data);
    } catch (err) {
      console.error('Failed to fetch mentorships:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchMentorship = useCallback(
    async (id: string) => {
      if (!api) return;
      setLoading(true);
      try {
        const res = await api.get(`${BASE}/${id}`);
        setCurrentMentorship(res.data.data);
      } catch (err) {
        console.error('Failed to fetch mentorship:', err);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const updateStatus = useCallback(
    async (id: string, status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED', completionNote?: string) => {
      if (!api) return null;
      const res = await api.patch(`${BASE}/${id}/status`, { status, completionNote });
      const updated = res.data.data;
      setCurrentMentorship(updated);
      return updated;
    },
    [api],
  );

  const addCheckIn = useCallback(
    async (mentorshipId: string, note: string, rating?: number) => {
      if (!api) return null;
      const res = await api.post(`${BASE}/${mentorshipId}/check-ins`, { note, rating });
      const checkIn = res.data.data;
      setCheckIns((prev) => [checkIn, ...prev]);
      return checkIn;
    },
    [api],
  );

  const fetchCheckIns = useCallback(
    async (mentorshipId: string) => {
      if (!api) return;
      try {
        const res = await api.get(`${BASE}/${mentorshipId}/check-ins`);
        setCheckIns(res.data.data);
      } catch (err) {
        console.error('Failed to fetch check-ins:', err);
      }
    },
    [api],
  );

  return {
    mentors,
    myMentorships,
    currentMentorship,
    checkIns,
    loading,
    pagination,
    searchMentors,
    requestMentorship,
    fetchMyMentorships,
    fetchMentorship,
    updateStatus,
    addCheckIn,
    fetchCheckIns,
  };
}
