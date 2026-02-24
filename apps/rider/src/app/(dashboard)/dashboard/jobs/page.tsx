'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useSocket } from '@/hooks/use-socket';
import { API_BASE_URL, STATUS_CONFIG, PACKAGE_TYPES } from '@/lib/constants';
import { formatCurrency, formatDistance, timeAgo } from '@riderguy/utils';
import { Button, Badge } from '@riderguy/ui';
import {
  MapPin, Clock, Package, ChevronRight, RefreshCw,
  Search, Filter, CheckCircle
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

  const fetchJobs = useCallback(async () => {
    if (!api) return;
    try {
      if (tab === 'available') {
        const res = await api.get(`${API_BASE_URL}/orders/available`);
        setJobs(res.data.data ?? []);
      } else {
        const res = await api.get(`${API_BASE_URL}/orders?status=ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF`);
        setJobs(res.data.data ?? []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [api, tab]);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);

  // Listen for new jobs via socket
  useEffect(() => {
    if (!socket) return;
    const handleNew = () => { if (tab === 'available') fetchJobs(); };
    socket.on('job:new', handleNew);
    return () => { socket.off('job:new', handleNew); };
  }, [socket, tab, fetchJobs]);

  const acceptJob = async (orderId: string) => {
    if (!api || accepting) return;
    setAccepting(orderId);
    try {
      await api.post(`${API_BASE_URL}/orders/${orderId}/accept`);
      router.push(`/dashboard/jobs/${orderId}`);
    } catch {
      setAccepting(null);
    }
  };

  return (
    <div className="min-h-[100dvh] pb-24 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-surface-950 sticky top-0 z-20 border-b border-white/5">
        <div className="px-5 py-4">
          <h1 className="text-xl font-bold text-white">Jobs</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-5 mb-3 p-1 rounded-xl bg-surface-800">
          {(['available', 'active'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-surface-300'
              }`}
            >
              {t === 'available' ? 'Available' : 'Active'}
            </button>
          ))}
        </div>
      </div>

      {/* Job list */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-4 animate-pulse space-y-3">
              <div className="h-4 bg-surface-700 rounded w-3/4" />
              <div className="h-3 bg-surface-700 rounded w-1/2" />
              <div className="h-10 bg-surface-700 rounded" />
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-surface-600 mx-auto mb-4" />
            <p className="text-surface-400 text-lg font-medium">
              {tab === 'available' ? 'No jobs available right now' : 'No active deliveries'}
            </p>
            <p className="text-surface-500 text-sm mt-1">
              {tab === 'available' ? 'New jobs will appear here' : 'Accept a job to get started'}
            </p>
            <Button variant="outline" className="mt-6 border-surface-700 text-surface-300" onClick={fetchJobs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        ) : (
          jobs.map((job, idx) => {
            const sc = STATUS_CONFIG[job.status] ?? { label: job.status, color: 'text-surface-400', bg: 'bg-surface-400/10' };
            const pkg = PACKAGE_TYPES[job.packageType] ?? { label: 'Package', icon: '📦' };
            const isAvailable = tab === 'available';

            return (
              <div
                key={job.id}
                className="glass rounded-2xl overflow-hidden animate-slide-up"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{pkg.icon}</span>
                      <span className="text-sm font-medium text-white">{pkg.label}</span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sc.bg} ${sc.color}`}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                      <p className="text-sm text-surface-300 truncate">{job.pickupAddress ?? 'Pickup'}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-accent-400 shrink-0" />
                      <p className="text-sm text-surface-300 truncate">{job.dropoffAddress ?? 'Dropoff'}</p>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 text-xs text-surface-500">
                    {job.distanceKm && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {formatDistance(job.distanceKm)}
                      </span>
                    )}
                    {job.estimatedDurationMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.estimatedDurationMinutes} min
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(new Date(job.createdAt))}
                    </span>
                  </div>

                  {/* Earnings + Action */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-lg font-bold text-accent-400">
                      {formatCurrency(job.riderEarnings ?? job.totalPrice ?? 0)}
                    </p>
                    {isAvailable ? (
                      <Button
                        size="sm"
                        className="bg-accent-500 hover:bg-accent-600 text-white"
                        onClick={() => acceptJob(job.id)}
                        loading={accepting === job.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-surface-600 text-surface-300"
                        onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                      >
                        View
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
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
