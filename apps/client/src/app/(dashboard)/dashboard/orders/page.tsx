'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, ORDER_STATUS_CONFIG } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { Badge, Skeleton } from '@riderguy/ui';
import { Package, MapPin, Clock, ChevronRight, Send } from 'lucide-react';

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
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white/80 backdrop-blur-xl sticky top-0 z-20 border-b border-surface-100">
        <div className="px-5 pt-4 pb-3">
          <h1 className="text-xl font-extrabold text-surface-900">My Orders</h1>
        </div>

        {/* Sliding tab bar */}
        <div className="relative flex mx-5 mb-3 bg-surface-100 rounded-xl p-1">
          <div
            className="absolute top-1 bottom-1 rounded-lg bg-white shadow-card transition-all duration-300"
            style={{
              width: `${100 / TABS.length}%`,
              left: `${(TABS.findIndex(t => t.key === tab) / TABS.length) * 100}%`,
            }}
          />
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex-1 py-2 text-sm font-semibold transition-colors z-10 ${
                tab === key ? 'text-brand-600' : 'text-surface-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))
        ) : !orders?.length ? (
          <div className="py-16 text-center">
            <div className="relative inline-flex mb-4">
              <div className="absolute inset-0 bg-brand-500/10 rounded-full blur-2xl scale-150" />
              <div className="relative h-14 w-14 rounded-2xl bg-surface-100 flex items-center justify-center">
                <Package className="h-7 w-7 text-surface-300" />
              </div>
            </div>
            <p className="text-sm font-semibold text-surface-600">No orders found</p>
            <p className="text-xs text-surface-400 mt-1">
              {tab === 'all' ? 'Send your first package!' : `No ${tab} orders`}
            </p>
            {tab === 'all' && (
              <button
                onClick={() => router.push('/dashboard/send')}
                className="mt-4 h-10 px-6 rounded-xl brand-gradient text-white text-sm font-semibold shadow-brand btn-press inline-flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" /> Send Package
              </button>
            )}
          </div>
        ) : (
          orders.map((order: Record<string, unknown>) => {
            const id = order.id as string;
            const status = ORDER_STATUS_CONFIG[(order.status as string)] ?? { label: order.status as string, color: 'text-surface-600', bg: 'bg-surface-100' };
            const isActive = ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(order.status as string);

            return (
              <button
                key={id}
                onClick={() => router.push(`/dashboard/orders/${id}/${isActive ? 'tracking' : 'rate'}`)}
                className="card-interactive w-full text-left p-4 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                      <Package className="h-4 w-4 text-surface-500 group-hover:text-brand-500 transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-surface-900">
                        #{id.slice(-6).toUpperCase()}
                      </p>
                      <p className="text-[11px] text-surface-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(new Date(order.createdAt as string))}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${status.bg} ${status.color} text-[11px] font-semibold`}>
                    {status.label}
                  </Badge>
                </div>

                {/* Route dots */}
                <div className="flex items-start gap-2 mb-3">
                  <div className="flex flex-col items-center gap-0.5 pt-1.5 shrink-0">
                    <div className="h-2.5 w-2.5 rounded-full brand-gradient" />
                    <div className="w-px h-3 bg-gradient-to-b from-brand-300 to-accent-300" />
                    <div className="h-2.5 w-2.5 rounded-full accent-gradient" />
                  </div>
                  <div className="text-xs space-y-1.5 min-w-0">
                    <p className="text-surface-600 truncate">{(order.pickupAddress as string) || 'Pickup'}</p>
                    <p className="text-surface-600 truncate">{(order.dropoffAddress as string) || 'Dropoff'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-surface-100">
                  {order.totalPrice ? (
                    <span className="text-sm font-bold text-surface-900">{formatCurrency(order.totalPrice as number)}</span>
                  ) : (
                    <span className="text-xs text-surface-400">Estimating...</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-surface-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
