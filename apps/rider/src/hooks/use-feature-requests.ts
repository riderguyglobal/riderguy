'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';

// ============================================================
// Feature Requests Hook — Sprint 12
// ============================================================

const BASE = `${API_BASE_URL}/feature-requests`;

// ────── Types ──────

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: 'SUBMITTED' | 'REVIEWED' | 'PLANNED' | 'IN_PROGRESS' | 'SHIPPED' | 'DECLINED';
  adminNote: string | null;
  upvoteCount: number;
  author: { firstName: string; lastName: string; avatar: string | null };
  hasUpvoted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ────── Hook ──────

export function useFeatureRequests() {
  const { api } = useAuth();
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<FeatureRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });

  const fetchRequests = useCallback(
    async (opts?: { status?: string; sort?: string; page?: number }) => {
      if (!api) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts?.status) params.set('status', opts.status);
        if (opts?.sort) params.set('sort', opts.sort);
        if (opts?.page) params.set('page', String(opts.page));
        const res = await api.get(`${BASE}?${params}`);
        const data = res.data.data;
        setRequests(data.requests);
        setPagination({ total: data.total, page: data.page, totalPages: data.totalPages });
      } catch (err) {
        console.error('Failed to fetch feature requests:', err);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const fetchRequest = useCallback(
    async (id: string) => {
      if (!api) return;
      setLoading(true);
      try {
        const res = await api.get(`${BASE}/${id}`);
        setCurrentRequest(res.data.data);
      } catch (err) {
        console.error('Failed to fetch feature request:', err);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const createRequest = useCallback(
    async (title: string, description: string) => {
      if (!api) return null;
      const res = await api.post(BASE, { title, description });
      const request = res.data.data;
      setRequests((prev) => [{ ...request, hasUpvoted: false }, ...prev]);
      return request;
    },
    [api],
  );

  const toggleUpvote = useCallback(
    async (id: string) => {
      if (!api) return;
      const res = await api.post(`${BASE}/${id}/upvote`);
      const { upvoted, newCount } = res.data.data;
      // Update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, hasUpvoted: upvoted, upvoteCount: newCount } : r,
        ),
      );
      if (currentRequest?.id === id) {
        setCurrentRequest((prev) =>
          prev ? { ...prev, hasUpvoted: upvoted, upvoteCount: newCount } : prev,
        );
      }
    },
    [api, currentRequest?.id],
  );

  const deleteRequest = useCallback(
    async (id: string) => {
      if (!api) return;
      await api.delete(`${BASE}/${id}`);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    },
    [api],
  );

  return {
    requests,
    currentRequest,
    loading,
    pagination,
    fetchRequests,
    fetchRequest,
    createRequest,
    toggleUpvote,
    deleteRequest,
  };
}
