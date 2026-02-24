'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, ORDER_STATUS_CONFIG } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { Badge, Skeleton } from '@riderguy/ui';
import { Package, MapPin, Clock, Search, ChevronRight } from 'lucide-react';

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
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="px-5 pt-4 pb-3">
          <h1 className="text-xl font-bold text-surface-900">My Orders</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pb-3">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-100 text-surface-500 hover:text-surface-700'
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
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : !orders?.length ? (
          <div className="py-16 text-center">
            <Package className="h-12 w-12 text-surface-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-surface-500">No orders found</p>
            <p className="text-xs text-surface-400 mt-1">
              {tab === 'all' ? 'Send your first package!' : `No ${tab} orders`}
            </p>
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
                className="card-interactive w-full text-left p-4"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-surface-100 flex items-center justify-center">
                      <Package className="h-4 w-4 text-surface-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-surface-900">
                        #{id.slice(-6).toUpperCase()}
                      </p>
                      <p className="text-xs text-surface-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(new Date(order.createdAt as string))}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${status.bg} ${status.color} text-xs`}>
                    {status.label}
                  </Badge>
                </div>

                <div className="flex items-start gap-2 mb-2">
                  <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                    <div className="h-2 w-2 rounded-full bg-brand-400" />
                    <div className="w-px h-3 bg-surface-200" />
                    <div className="h-2 w-2 rounded-full bg-accent-400" />
                  </div>
                  <div className="text-xs space-y-1 min-w-0">
                    <p className="text-surface-600 truncate">{(order.pickupAddress as string) || 'Pickup'}</p>
                    <p className="text-surface-600 truncate">{(order.dropoffAddress as string) || 'Dropoff'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-surface-100">
                  {order.totalPrice ? (
                    <span className="text-sm font-bold text-surface-900">{formatCurrency(order.totalPrice as number)}</span>
                  ) : (
                    <span className="text-xs text-surface-400">Estimating...</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-surface-300" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
