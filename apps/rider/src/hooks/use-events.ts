'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';

// ============================================================
// Events Hook — Sprint 12
// ============================================================

const BASE = `${API_BASE_URL}/events`;

// ────── Types ──────

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  type: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  date: string;
  endDate: string | null;
  location: string | null;
  virtualLink: string | null;
  imageUrl: string | null;
  zoneId: string | null;
  capacity: number | null;
  createdBy: { firstName: string; lastName: string; avatar: string | null };
  zone: { id: string; name: string } | null;
  _count: { rsvps: number };
  hasRsvp?: boolean;
  rsvps?: Array<{
    id: string;
    user: { firstName: string; lastName: string; avatar: string | null };
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ────── Hook ──────

export function useEvents() {
  const { api } = useAuth();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<CommunityEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });

  const fetchEvents = useCallback(
    async (opts?: { status?: string; zoneId?: string; type?: string; page?: number }) => {
      if (!api) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts?.status) params.set('status', opts.status);
        if (opts?.zoneId) params.set('zoneId', opts.zoneId);
        if (opts?.type) params.set('type', opts.type);
        if (opts?.page) params.set('page', String(opts.page));
        const res = await api.get(`${BASE}?${params}`);
        const data = res.data.data;
        setEvents(data.events);
        setPagination({ total: data.total, page: data.page, totalPages: data.totalPages });
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const fetchEvent = useCallback(
    async (id: string) => {
      if (!api) return;
      setLoading(true);
      try {
        const res = await api.get(`${BASE}/${id}`);
        setCurrentEvent(res.data.data);
      } catch (err) {
        console.error('Failed to fetch event:', err);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const createEvent = useCallback(
    async (data: {
      title: string;
      description: string;
      type?: string;
      date: string;
      endDate?: string;
      location?: string;
      virtualLink?: string;
      zoneId?: string;
      capacity?: number;
    }) => {
      if (!api) return null;
      const res = await api.post(BASE, data);
      const event = res.data.data;
      setEvents((prev) => [event, ...prev]);
      return event;
    },
    [api],
  );

  const rsvp = useCallback(
    async (eventId: string) => {
      if (!api) return;
      await api.post(`${BASE}/${eventId}/rsvp`);
      // Update local state
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, hasRsvp: true, _count: { rsvps: e._count.rsvps + 1 } }
            : e,
        ),
      );
      if (currentEvent?.id === eventId) {
        setCurrentEvent((prev) =>
          prev ? { ...prev, hasRsvp: true, _count: { rsvps: prev._count.rsvps + 1 } } : prev,
        );
      }
    },
    [api, currentEvent?.id],
  );

  const cancelRsvp = useCallback(
    async (eventId: string) => {
      if (!api) return;
      await api.delete(`${BASE}/${eventId}/rsvp`);
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, hasRsvp: false, _count: { rsvps: Math.max(0, e._count.rsvps - 1) } }
            : e,
        ),
      );
      if (currentEvent?.id === eventId) {
        setCurrentEvent((prev) =>
          prev
            ? { ...prev, hasRsvp: false, _count: { rsvps: Math.max(0, prev._count.rsvps - 1) } }
            : prev,
        );
      }
    },
    [api, currentEvent?.id],
  );

  return {
    events,
    currentEvent,
    loading,
    pagination,
    fetchEvents,
    fetchEvent,
    createEvent,
    rsvp,
    cancelRsvp,
  };
}
