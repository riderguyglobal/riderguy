'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Spinner,
  Switch,
} from '@riderguy/ui';
import { useRiderAvailability } from '@/hooks/use-rider-availability';
import { useSocket } from '@/hooks/use-socket';
import type { NewJobNotification } from '@riderguy/types';

// ============================================================
// Rider Job Feed — Bolt/Uber-inspired design
// ============================================================

const PACKAGE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  DOCUMENT: {
    label: 'Document',
    color: 'bg-blue-50 text-blue-600',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  },
  SMALL_PARCEL: {
    label: 'Small Parcel',
    color: 'bg-brand-50 text-brand-600',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  },
  MEDIUM_PARCEL: {
    label: 'Medium Parcel',
    color: 'bg-brand-50 text-brand-600',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  },
  LARGE_PARCEL: {
    label: 'Large Parcel',
    color: 'bg-purple-50 text-purple-600',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  },
  FOOD: {
    label: 'Food',
    color: 'bg-orange-50 text-orange-600',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  },
  FRAGILE: {
    label: 'Fragile',
    color: 'bg-amber-50 text-amber-600',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  },
  HIGH_VALUE: {
    label: 'High Value',
    color: 'bg-emerald-50 text-emerald-600',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
};

interface AvailableJob {
  id: string;
  orderNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  packageDescription?: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  totalPrice: number;
  serviceFee: number;
  currency: string;
  createdAt: string;
}

export default function JobFeedPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<AvailableJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const {
    isOnline,
    toggling: togglingAvailability,
    error: availabilityError,
    toggleAvailability,
    loading: availabilityLoading,
  } = useRiderAvailability();

  const { socket, connected } = useSocket();

  const fetchJobs = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const api = getApiClient();
      const { data } = await api.get('/orders/available');
      setJobs(data.data ?? []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    if (!isOnline) return;
    const interval = setInterval(() => fetchJobs(), 15000);
    return () => clearInterval(interval);
  }, [fetchJobs, isOnline]);

  // ── Real-time: listen for new jobs via WebSocket ──
  useEffect(() => {
    if (!socket || !connected || !isOnline) return;

    const handleNewJob = (data: NewJobNotification) => {
      // Refresh the full list to get complete job data
      fetchJobs();

      // Vibrate to alert rider
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    };

    const handleJobCancelled = (data: { orderId: string }) => {
      setJobs((prev) => prev.filter((j) => j.id !== data.orderId));
    };

    const handleJobTaken = (data: { orderId: string }) => {
      setJobs((prev) => prev.filter((j) => j.id !== data.orderId));
    };

    socket.on('job:new', handleNewJob);
    socket.on('job:cancelled', handleJobCancelled);
    socket.on('job:offer:taken', handleJobTaken);

    return () => {
      socket.off('job:new', handleNewJob);
      socket.off('job:cancelled', handleJobCancelled);
      socket.off('job:offer:taken', handleJobTaken);
    };
  }, [socket, connected, isOnline, fetchJobs]);

  async function handleAcceptJob(orderId: string) {
    setAcceptingId(orderId);
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/accept`);
      router.push(`/dashboard/jobs/${orderId}`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error?: string } } }).response?.data?.error
          : 'Failed to accept job';
      alert(msg || 'Failed to accept job');
    } finally {
      setAcceptingId(null);
    }
  }

  function riderEarnings(job: AvailableJob): number {
    return job.totalPrice - (job.serviceFee ?? 0);
  }

  function timeAgo(dateStr: string): string {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  return (
    <div className="dash-page-enter">
      {/* ── Status Bar ── */}
      <div className="bg-white px-4 py-3 border-b border-surface-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-surface-900">Jobs</h1>
            <p className="text-xs text-surface-400">
              {jobs.length} available near you
              {connected && isOnline && (
                <span className="ml-1.5 text-accent-500">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500 animate-pulse mr-0.5" />
                  Live
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              isOnline
                ? 'bg-accent-50 text-accent-700'
                : 'bg-surface-100 text-surface-500'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-accent-500 dash-pulse-dot' : 'bg-surface-400'}`} />
              {togglingAvailability ? '...' : isOnline ? 'Online' : 'Offline'}
            </div>
            <Switch
              checked={isOnline}
              disabled={togglingAvailability || availabilityLoading}
              onCheckedChange={() => toggleAvailability()}
              className="data-[state=checked]:bg-accent-500"
            />
          </div>
        </div>
      </div>

      {/* ── Offline State ── */}
      {!isOnline && !loading && (
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-100">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1l22 22" />
              <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
              <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0122.56 9" />
              <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
              <path d="M8.53 16.11a6 6 0 016.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-surface-900 mt-5">You&apos;re Offline</h2>
          <p className="text-sm text-surface-400 mt-1 text-center max-w-[260px]">
            Go online to start seeing delivery requests in your area
          </p>
          <Button
            className="mt-5 bg-accent-500 hover:bg-accent-600 rounded-xl px-8"
            disabled={togglingAvailability}
            onClick={() => toggleAvailability()}
          >
            Go Online
          </Button>
        </div>
      )}

      {/* ── Availability error ── */}
      {availabilityError && (
        <div className="mx-4 mt-3 rounded-xl bg-danger-50 border border-danger-100 p-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <p className="text-xs text-danger-600">{availabilityError}</p>
        </div>
      )}

      {/* ── Refresh ── */}
      {isOnline && !loading && (
        <div className="px-4 pt-3">
          <button
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-white py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {refreshing ? (
              <Spinner className="h-4 w-4 text-brand-500" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'animate-spin' : ''}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            )}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && isOnline && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-surface-900 mt-5">No jobs right now</h2>
          <p className="text-sm text-surface-400 mt-1 text-center max-w-[260px]">
            New delivery requests will appear here automatically
          </p>
        </div>
      )}

      {/* ── Job Cards ── */}
      {!loading && isOnline && jobs.length > 0 && (
        <div className="px-4 pt-3 pb-24 space-y-3 dash-stagger-in">
          {jobs.map((job, index) => {
            const pkg = PACKAGE_CONFIG[job.packageType] ?? {
              label: job.packageType,
              color: 'bg-surface-50 text-surface-600',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
            };
            const earnings = riderEarnings(job);

            return (
              <div
                key={job.id}
                className="rounded-2xl bg-white shadow-card overflow-hidden transition-all hover:shadow-card-hover"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Card Header */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${pkg.color}`}>
                        {pkg.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{pkg.label}</p>
                        <p className="text-[10px] text-surface-400 mt-0.5">#{job.orderNumber} · {timeAgo(job.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-accent-600">GH₵{earnings.toLocaleString()}</p>
                      <p className="text-[10px] text-surface-400">earnings</p>
                    </div>
                  </div>
                </div>

                {/* Route */}
                <div className="px-4 pb-3">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center pt-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-accent-500 ring-2 ring-accent-100" />
                      <div className="w-0.5 flex-1 bg-surface-200 my-1" />
                      <div className="h-2.5 w-2.5 rounded-full bg-danger-500 ring-2 ring-danger-100" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-700 truncate">{job.pickupAddress}</p>
                      <div className="h-4" />
                      <p className="text-sm text-surface-700 truncate">{job.dropoffAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Info strip */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-50 border-t border-surface-100">
                  <div className="flex items-center gap-1 text-surface-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span className="text-xs font-medium">{job.distanceKm.toFixed(1)} km</span>
                  </div>
                  <div className="h-3 w-px bg-surface-200" />
                  <div className="flex items-center gap-1 text-surface-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span className="text-xs font-medium">~{job.estimatedDurationMinutes} min</span>
                  </div>
                  {job.packageDescription && (
                    <>
                      <div className="h-3 w-px bg-surface-200" />
                      <span className="text-xs text-surface-400 truncate">{job.packageDescription}</span>
                    </>
                  )}
                </div>

                {/* Accept button */}
                <div className="px-4 py-3">
                  <Button
                    className="w-full bg-brand-500 hover:bg-brand-600 rounded-xl h-11 text-sm font-semibold"
                    onClick={() => handleAcceptJob(job.id)}
                    disabled={acceptingId === job.id}
                  >
                    {acceptingId === job.id ? (
                      <span className="flex items-center gap-2">
                        <Spinner className="h-4 w-4" />
                        Accepting...
                      </span>
                    ) : (
                      'Accept Job'
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
