'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, ORDER_STATUS_CONFIG } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { Badge, Skeleton } from '@riderguy/ui';
import {
  Search,
  Package,
  Clock,
  MapPin,
  ArrowRight,
  Send,
  FileText,
  ChevronRight,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const ClientMap = dynamic(() => import('@/components/client-map'), { ssr: false });

export default function DashboardPage() {
  const router = useRouter();
  const { user, api } = useAuth();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const { data: recentOrders, isLoading } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: async () => {
      const res = await api!.get(`${API_BASE_URL}/orders?limit=3&sort=-createdAt`);
      return res.data.data ?? [];
    },
    enabled: !!api,
  });

  return (
    <div className="animate-page-enter">
      {/* Map hero */}
      <div className="relative h-[38dvh] min-h-[260px]">
        <ClientMap />

        {/* Overlay greeting */}
        <div className="absolute top-0 left-0 right-0 safe-area-top">
          <div className="px-5 pt-4">
            <p className="text-sm text-surface-500">{greeting}</p>
            <h1 className="text-xl font-bold text-surface-900 truncate">
              {user?.firstName || 'there'} 👋
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative -mt-6 bg-surface-50 rounded-t-3xl px-5 py-6 space-y-5">
        {/* Search bar */}
        <button
          onClick={() => router.push('/dashboard/send')}
          className="w-full card-elevated flex items-center gap-3 px-4 py-3.5 text-left"
        >
          <Search className="h-5 w-5 text-surface-400" />
          <span className="text-surface-400 text-sm">Where are you sending to?</span>
        </button>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/dashboard/send')}
            className="card-interactive flex items-center gap-3 p-4"
          >
            <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Send className="h-5 w-5 text-brand-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-surface-900">Send Package</p>
              <p className="text-xs text-surface-400">Quick delivery</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/orders')}
            className="card-interactive flex items-center gap-3 p-4"
          >
            <div className="h-10 w-10 rounded-xl bg-accent-50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-accent-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-surface-900">My Orders</p>
              <p className="text-xs text-surface-400">Track & history</p>
            </div>
          </button>
        </div>

        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-surface-900">Recent Orders</h2>
            <button onClick={() => router.push('/dashboard/orders')} className="text-xs text-brand-500 font-medium flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : !recentOrders?.length ? (
            <div className="card-elevated py-10 text-center">
              <Package className="h-10 w-10 text-surface-300 mx-auto mb-3" />
              <p className="text-sm text-surface-500">No orders yet</p>
              <p className="text-xs text-surface-400">Send your first package today!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order: Record<string, unknown>) => {
                const id = order.id as string;
                const status = ORDER_STATUS_CONFIG[(order.status as string)] ?? { label: order.status as string, color: 'text-surface-600', bg: 'bg-surface-100' };
                return (
                  <button
                    key={id}
                    onClick={() => router.push(`/dashboard/orders/${id}/tracking`)}
                    className="card-interactive w-full text-left p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-surface-400" />
                        <span className="text-sm font-semibold text-surface-900 truncate max-w-[160px]">
                          #{id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <Badge className={`${status.bg} ${status.color} text-xs`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-surface-500">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{(order.dropoffAddress as string) || 'Destination'}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-surface-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(new Date(order.createdAt as string))}
                      </span>
                      {!!order.totalPrice && (
                        <span className="text-sm font-semibold text-surface-900">
                          {formatCurrency(order.totalPrice as number)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
