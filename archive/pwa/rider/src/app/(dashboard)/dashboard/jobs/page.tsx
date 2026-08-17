'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useSocket } from '@/hooks/use-socket';
import { STATUS_CONFIG, PACKAGE_TYPES } from '@/lib/constants';
import { formatCurrency, formatDistance, timeAgo } from '@riderguy/utils';
import { Button } from '@riderguy/ui';
import {
  MapPin, Clock, Package, ChevronRight, RefreshCw,
  Search, CheckCircle, Zap, Navigation, AlertTriangle
} from 'lucide-react';
import type { Order } from '@riderguy/types';

type Tab = 'available' | 'active';

export default function JobsPage() {
  const router = useRouter();
  const { api } = useAuth();
  const { socket } = useSocket();
  const [tab, setTab] = useState<Tab>('available');
  const [jobs, setJobs] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!api) return;
    setFetchError(null);
    try {
      if (tab === 'available') {
        const res = await api.get('/orders/available');
        setJobs(res.data.data ?? []);
      } else {
        const res = await api.get('/orders', {
          params: { status: 'ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF' },
        });
        setJobs(res.data.data ?? []);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to load jobs';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [api, tab]);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleNew = () => {
      if (tab !== 'available') return;
      if (timer) return;
      timer = setTimeout(() => { timer = null; fetchJobs(); }, 2000);
    };
    socket.on('job:new', handleNew);
    return () => { socket.off('job:new', handleNew); if (timer) clearTimeout(timer); };
  }, [socket, tab, fetchJobs]);

  const acceptJob = async (orderId: string) => {
    if (!api || accepting) return;
    setAccepting(orderId);
    try {
      await api.post(`/orders/${orderId}/accept`);
      navigator.vibrate?.(50);
      router.push(`/dashboard/jobs/${orderId}`);
    } catch {
      setAccepting(null);
    }
  };

  return (
    <div className="min-h-[100dvh] pb-24 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-nav backdrop-blur-xl sticky top-0 z-20 border-b border-themed">
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-primary">Jobs</h1>
            <button
              onClick={fetchJobs}
              className="h-9 w-9 rounded-xl glass flex items-center justify-center btn-press"
            >
              <RefreshCw className={`h-4 w-4 text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Premium segmented control */}
        <div className="px-5 pb-3">
          <div className="relative flex p-1 rounded-2xl bg-card border border-themed">
            {/* Sliding pill indicator */}
            <div
              className="absolute top-1 bottom-1 rounded-xl gradient-brand shadow-lg transition-all duration-300 ease-out"
              style={{
                width: 'calc(50% - 4px)',
                left: tab === 'available' ? '4px' : 'calc(50% + 0px)',
              }}
            />
            {(['available', 'active'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  tab === t ? 'text-primary' : 'text-subtle'
                }`}
              >
                {t === 'available' ? (
                  <><Zap className="h-3.5 w-3.5" /> Available</>
                ) : (
                  <><Navigation className="h-3.5 w-3.5" /> Active</>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Job list */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-elevated rounded-2xl p-4 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-surface-700/50 rounded-lg w-28" />
                <div className="h-5 bg-surface-700/50 rounded-full w-20" />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-surface-700/50" />
                  <div className="w-px flex-1 bg-surface-700/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-surface-700/50" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="h-3 bg-surface-700/50 rounded w-3/4" />
                  <div className="h-3 bg-surface-700/50 rounded w-2/3" />
                </div>
              </div>
              <div className="h-10 bg-surface-700/50 rounded-xl" />
            </div>
          ))
        ) : fetchError ? (
          <div className="text-center py-20">
            <div className="relative inline-flex mb-5">
              <div className="relative h-16 w-16 rounded-2xl glass flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-red-400" />
              </div>
            </div>
            <h3 className="text-primary text-base font-semibold mb-1">Something went wrong</h3>
            <p className="text-subtle text-sm max-w-[250px] mx-auto mb-6">{fetchError}</p>
            <button
              onClick={fetchJobs}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass text-sm text-secondary font-medium btn-press"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20">
            <div className="relative inline-flex mb-5">
              <div className="absolute inset-0 rounded-full bg-brand-500/10 blur-2xl scale-[2]" />
              <div className="relative h-16 w-16 rounded-2xl glass flex items-center justify-center">
                <Search className="h-7 w-7 text-subtle" />
              </div>
            </div>
            <h3 className="text-primary text-base font-semibold mb-1">
              {tab === 'available' ? 'No jobs available' : 'No active deliveries'}
            </h3>
            <p className="text-subtle text-sm max-w-[250px] mx-auto mb-6">
              {tab === 'available' ? 'New delivery requests will appear here when available' : 'Accept a job to start earning'}
            </p>
            <button
              onClick={fetchJobs}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass text-sm text-secondary font-medium btn-press"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        ) : (
          jobs.map((job, idx) => {
            const sc = STATUS_CONFIG[job.status] ?? { label: job.status, color: 'text-muted', bg: 'bg-surface-400/10' };
            const pkg = PACKAGE_TYPES[job.packageType] ?? { label: 'Package', icon: '📦' };
            const isAvailable = tab === 'available';

            return (
              <div
                key={job.id}
                className="glass-elevated rounded-2xl overflow-hidden animate-slide-up btn-press transition-transform hover:scale-[1.01]"
                style={{ animationDelay: `${idx * 60}ms` }}
                onClick={() => !isAvailable && router.push(`/dashboard/jobs/${job.id}`)}
              >
                <div className="p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-surface-800 flex items-center justify-center text-base">
                        {pkg.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">{pkg.label}</p>
                        <p className="text-[10px] text-subtle">{timeAgo(new Date(job.createdAt))}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.color}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {sc.label}
                    </span>
                  </div>

                  {/* Route with connected dots */}
                  <div className="flex gap-3 pl-1">
                    <div className="flex flex-col items-center pt-0.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                      <div className="w-px flex-1 bg-gradient-to-b from-brand-500/60 to-accent-500/60 my-1 min-h-[16px]" />
                      <div className="h-2.5 w-2.5 rounded-full bg-accent-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <p className="text-[10px] text-subtle font-medium uppercase tracking-wider">Pickup</p>
                        <p className="text-xs text-primary font-medium truncate">{job.pickupAddress ?? 'Pickup'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-subtle font-medium uppercase tracking-wider">Dropoff</p>
                        <p className="text-xs text-primary font-medium truncate">{job.dropoffAddress ?? 'Dropoff'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Meta + Earnings + Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-themed-subtle">
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold text-accent-400 tabular-nums">
                        {formatCurrency(job.riderEarnings ?? job.totalPrice ?? 0)}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-subtle">
                        {job.distanceKm && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {formatDistance(job.distanceKm)}
                          </span>
                        )}
                        {job.estimatedDurationMinutes && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {job.estimatedDurationMinutes}m
                          </span>
                        )}
                      </div>
                    </div>
                    {isAvailable ? (
                      <Button
                        size="sm"
                        className="gradient-accent text-white rounded-xl font-semibold text-xs px-4 shadow-lg shadow-accent-500/20 btn-press"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); acceptJob(job.id); }}
                        loading={accepting === job.id}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Accept
                      </Button>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-subtle" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
