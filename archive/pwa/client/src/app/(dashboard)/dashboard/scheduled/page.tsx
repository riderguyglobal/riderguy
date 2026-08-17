'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@riderguy/ui';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Calendar,
  Send,
  Package,
  ChevronRight,
} from 'lucide-react';
import type { Order } from '@riderguy/types';

export default function ScheduledPage() {
  const router  = useRouter();
  const { api } = useAuth();

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['scheduled-orders'],
    queryFn: async () => {
      const res = await api!.get('/orders', {
        params: { isScheduled: 'true', sort: 'scheduledAt', limit: '50' },
      });
      return (res.data.data ?? []) as Order[];
    },
    enabled: !!api,
  });

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-surface-50 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-white shadow-card">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <p className="flex-1 text-[17px] font-bold text-surface-900">Scheduled Deliveries</p>
        <button
          onClick={() => router.push('/dashboard/send?schedule=1')}
          className="h-9 w-9 rounded-full bg-surface-900 flex items-center justify-center active:scale-90 transition-all"
        >
          <Clock className="h-4 w-4 text-white" />
        </button>
      </div>

      <div className="px-5 pb-10">

        {/* ── Loading ──────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[100px] w-full rounded-2xl" />
            ))}
          </div>
        )}

        {/* ── Empty ────────────────────────────────── */}
        {!isLoading && !orders?.length && (
          <div className="bg-white rounded-2xl shadow-card py-14 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
              <Calendar className="h-6 w-6 text-surface-300" />
            </div>
            <p className="text-[15px] font-bold text-surface-700">No scheduled deliveries</p>
            <p className="text-[13px] text-surface-400 mt-1 max-w-[220px] leading-snug">
              Plan ahead by scheduling packages for a specific time.
            </p>
            <button
              onClick={() => router.push('/dashboard/send?schedule=1')}
              className="mt-5 btn-primary inline-flex px-8"
              style={{ height: 48, fontSize: 14, width: 'auto' }}
            >
              <Send className="h-4 w-4" /> Schedule a Delivery
            </button>
          </div>
        )}

        {/* ── List ─────────────────────────────────── */}
        {!isLoading && !!orders?.length && (
          <div className="space-y-3">
            {orders.map(order => {
              const scheduledAt = (order as unknown as Record<string, unknown>).scheduledAt as string | undefined;
              return (
                <button
                  key={order.id}
                  onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                  className="w-full bg-white rounded-2xl shadow-card px-4 py-4 text-left active:bg-surface-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4 text-surface-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[14px] font-bold text-surface-900">
                          #{order.id.slice(-6).toUpperCase()}
                        </p>
                        <StatusBadge status={order.status} />
                      </div>

                      {/* Scheduled time */}
                      {scheduledAt && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Clock className="h-3 w-3 text-brand-500 flex-shrink-0" />
                          <p className="text-[13px] font-semibold text-brand-600">
                            {new Date(scheduledAt).toLocaleString([], {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      )}

                      {/* Route */}
                      <p className="text-[12px] text-surface-500 flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {order.dropoffAddress || 'Destination'}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[11px] text-surface-400">{timeAgo(new Date(order.createdAt))}</p>
                        {order.totalPrice ? (
                          <p className="text-[13px] font-bold text-surface-900">
                            {formatCurrency(order.totalPrice)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-surface-300 mt-1 flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
