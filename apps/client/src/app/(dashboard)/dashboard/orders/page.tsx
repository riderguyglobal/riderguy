'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, ORDER_STATUS_CONFIG } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { Badge, Skeleton } from '@riderguy/ui';
import { Package, MapPin, Clock, ChevronRight, Send, Navigation } from 'lucide-react';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

export default function OrdersPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [tab, setTab] = useState('all');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', tab],
    queryFn: async () => {
      let url = `${API_BASE_URL}/orders?sort=-createdAt&limit=50`;
      if (tab === 'active') url += '&status=PENDING,SEARCHING_RIDER,ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF';
      if (tab === 'completed') url += '&status=DELIVERED';
      const res = await api!.get(url);
      return res.data.data ?? [];
    },
    enabled: !!api,
  });

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="px-5 pt-4 pb-3">
          <h1 className="text-xl font-bold text-surface-900">My Orders</h1>
        </div>

        {/* Tab bar — Uber-style */}
        <div className="relative flex mx-5 mb-3 bg-surface-100 rounded-xl p-1">
          <div
            className="absolute top-1 bottom-1 rounded-lg bg-white transition-all duration-300"
            style={{
              width: `${100 / TABS.length}%`,
              left: `${(TABS.findIndex(t => t.key === tab) / TABS.length) * 100}%`,
              boxShadow: '0 1px 3px rgba(0,0,0,.08)',
            }}
          />
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex-1 py-2 text-sm font-semibold transition-colors z-10 ${
                tab === key ? 'text-surface-900' : 'text-surface-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />
          ))
        ) : !orders?.length ? (
          <div className="py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
              <Package className="h-6 w-6 text-surface-300" />
            </div>
            <p className="text-sm font-semibold text-surface-700">No orders found</p>
            <p className="text-xs text-surface-400 mt-1">
              {tab === 'all' ? 'Send your first package!' : `No ${tab} orders`}
            </p>
            {tab === 'all' && (
              <button
                onClick={() => router.push('/dashboard/send')}
                className="mt-4 h-11 px-6 rounded-xl bg-surface-900 text-white text-sm font-semibold btn-press inline-flex items-center gap-1.5 hover:bg-surface-800 transition-colors"
              >
                <Send className="h-3.5 w-3.5" /> Send Package
              </button>
            )}
          </div>
        ) : (
          orders.map((order: Record<string, unknown>) => {
            const id = order.id as string;
            const status = ORDER_STATUS_CONFIG[(order.status as string)] ?? { label: order.status as string, color: 'text-surface-600', bg: 'bg-surface-100' };
            const statusStr = order.status as string;
            const isActive = ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(statusStr);
            const isCancelledOrFailed = statusStr.startsWith('CANCELLED') || statusStr === 'FAILED';

            return (
              <button
                key={id}
                onClick={() => router.push(isActive ? `/dashboard/orders/${id}/tracking` : isCancelledOrFailed ? '/dashboard/orders' : `/dashboard/orders/${id}/rate`)}
                className="w-full flex items-center gap-3 px-3 py-4 rounded-2xl hover:bg-surface-50 transition-colors text-left btn-press group"
              >
                <div className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center shrink-0 group-hover:bg-surface-200 transition-colors">
                  {isActive ? (
                    <Navigation className="h-4 w-4 text-brand-500" />
                  ) : (
                    <Package className="h-4 w-4 text-surface-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-surface-900">
                      #{id.slice(-6).toUpperCase()}
                    </p>
                    <Badge className={`${status.bg} ${status.color} text-[10px] font-semibold px-1.5 py-0`}>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-500 truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {(order.dropoffAddress as string) || 'Delivery'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-surface-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(new Date(order.createdAt as string))}
                    </span>
                    {Boolean(order.totalPrice) && (
                      <span className="text-xs font-bold text-surface-900">{formatCurrency(order.totalPrice as number)}</span>
                    )}
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-surface-300 shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
