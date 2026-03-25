'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import { isActiveStatus, isTerminalStatus } from '@/lib/order-statuses';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import type { Order } from '@riderguy/types';
import { Badge, Skeleton } from '@riderguy/ui';
import {
  Search,
  Package,
  MapPin,
  Send,
  ChevronRight,
  Navigation,
  ArrowRight,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
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
      const res = await api!.get('/orders', { params: { limit: 5, sort: '-createdAt' } });
      return res.data.data ?? [];
    },
    enabled: !!api,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api!.get('/notifications', { params: { pageSize: '1' } });
      const all = res.data.data ?? [];
      return { unread: all.filter((n: { isRead: boolean }) => !n.isRead).length };
    },
    enabled: !!api,
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.unread ?? 0;

  return (
    <div className="animate-page-enter">
      {/* ─── Map Hero (dominant, like Uber) ─── */}
      <div className="relative h-[52dvh] min-h-[300px]">
        <ClientMap />

        {/* Floating greeting badge */}
        <div className="absolute top-0 left-0 right-0 safe-area-top pointer-events-none">
          <div className="px-5 pt-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-light pointer-events-auto">
              <div className="h-7 w-7 rounded-full bg-surface-900 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {(user?.firstName?.[0] || 'R').toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-[11px] text-surface-500 leading-none">{greeting}</p>
                <p className="text-sm font-bold text-surface-900 leading-tight">
                  {user?.firstName || 'there'}
                </p>
              </div>
            </div>
            <Link href="/dashboard/notifications" className="relative h-10 w-10 rounded-full glass-light flex items-center justify-center pointer-events-auto">
              <Bell className="h-5 w-5 text-surface-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Bottom Sheet Content ─── */}
      <div className="relative -mt-6 bottom-sheet px-5 pt-4 pb-6 space-y-5 animate-sheet-up">
        {/* Drag handle */}
        <div className="drag-handle mb-1" />

        {/* Where to? — Uber-style search bar → Quick Send */}
        <button
          onClick={() => router.push('/dashboard/quick-send')}
          className="w-full flex items-center gap-3 h-14 px-4 bg-surface-100 rounded-xl text-left group hover:bg-surface-200/70 transition-colors btn-press"
        >
          <Search className="h-5 w-5 text-surface-900 shrink-0" />
          <span className="flex-1 text-[15px] font-semibold text-surface-900">Where are you sending?</span>
          <div className="h-8 w-8 rounded-lg bg-surface-200/60 flex items-center justify-center group-hover:bg-surface-300/50 transition-colors">
            <ArrowRight className="h-4 w-4 text-surface-600" />
          </div>
        </button>

        {/* Recent Orders (clean like Uber's destinations) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-surface-900">Recent</h2>
            {recentOrders?.length > 0 && (
              <button onClick={() => router.push('/dashboard/orders')} className="text-xs text-surface-500 font-medium flex items-center gap-0.5 btn-press hover:text-surface-700">
                See all <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
              ))}
            </div>
          ) : !recentOrders?.length ? (
            <div className="py-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                <Package className="h-6 w-6 text-surface-300" />
              </div>
              <p className="text-sm font-semibold text-surface-700">No deliveries yet</p>
              <p className="text-xs text-surface-400 mt-1">Send your first package today</p>
              <button
                onClick={() => router.push('/dashboard/send')}
                className="mt-4 h-11 px-6 rounded-xl bg-surface-900 text-white text-sm font-semibold btn-press inline-flex items-center gap-1.5 hover:bg-surface-800 transition-colors"
              >
                <Send className="h-3.5 w-3.5" /> Send Package
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {recentOrders.map((order: Order) => {
                const isActive = isActiveStatus(order.status);
                const isCancelledOrFailed = isTerminalStatus(order.status);
                const statusCfg = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-surface-600', bg: 'bg-surface-100' };
                return (
                  <button
                    key={order.id}
                    onClick={() => router.push(isActive ? `/dashboard/orders/${order.id}/tracking` : isCancelledOrFailed ? '/dashboard/orders' : `/dashboard/orders/${order.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-surface-50 transition-colors text-left btn-press group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center shrink-0 group-hover:bg-surface-200 transition-colors">
                      {isActive ? (
                        <Navigation className="h-4 w-4 text-brand-500" />
                      ) : (
                        <MapPin className="h-4 w-4 text-surface-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-900 truncate">
                        {order.dropoffAddress || 'Delivery'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-surface-400">
                          {timeAgo(new Date(order.createdAt))}
                        </span>
                        {isActive && (
                          <Badge className={`${statusCfg.bg} ${statusCfg.color} text-[10px] font-semibold px-1.5 py-0`}>
                            {statusCfg.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!!order.totalPrice && (
                        <span className="text-sm font-bold text-surface-900">
                          {formatCurrency(order.totalPrice)}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-surface-300" />
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
