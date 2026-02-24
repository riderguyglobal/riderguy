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
  Send,
  FileText,
  ChevronRight,
  Sparkles,
  Zap,
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
          <div className="px-5 pt-4 pb-6 bg-gradient-to-b from-white/70 via-white/30 to-transparent">
            <p className="text-xs font-medium text-surface-500 tracking-wide uppercase">{greeting}</p>
            <h1 className="text-2xl font-extrabold text-surface-900 truncate">
              {user?.firstName || 'there'} <span className="inline-block animate-wave origin-bottom-right">👋</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative -mt-8 bg-surface-50 rounded-t-[2rem] px-5 py-6 space-y-5">
        {/* Search bar */}
        <button
          onClick={() => router.push('/dashboard/send')}
          className="w-full card-elevated flex items-center gap-3 px-4 py-4 text-left group hover:shadow-lg transition-shadow"
        >
          <div className="h-10 w-10 rounded-xl brand-gradient flex items-center justify-center shadow-brand shrink-0">
            <Search className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <span className="text-sm text-surface-900 font-medium">Where are you sending to?</span>
            <p className="text-xs text-surface-400">Enter pickup & delivery address</p>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-300 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/dashboard/send')}
            className="card-interactive flex items-center gap-3 p-4 group"
          >
            <div className="h-11 w-11 rounded-2xl brand-gradient flex items-center justify-center shadow-brand shrink-0 group-hover:scale-105 transition-transform">
              <Send className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-surface-900">Send</p>
              <p className="text-[11px] text-surface-400">Quick delivery</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/orders')}
            className="card-interactive flex items-center gap-3 p-4 group"
          >
            <div className="h-11 w-11 rounded-2xl accent-gradient flex items-center justify-center shadow-accent shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-surface-900">Orders</p>
              <p className="text-[11px] text-surface-400">Track & history</p>
            </div>
          </button>
        </div>

        {/* Feature pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { icon: Zap, text: 'Instant Pickup', color: 'text-brand-500 bg-brand-50' },
            { icon: Sparkles, text: 'Insured Packages', color: 'text-accent-500 bg-accent-50' },
            { icon: Clock, text: 'Live Tracking', color: 'text-amber-500 bg-amber-50' },
          ].map(({ icon: Icon, text, color }) => (
            <div key={text} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${color} shrink-0`}>
              <Icon className="h-3 w-3" />
              <span className="text-[11px] font-semibold whitespace-nowrap">{text}</span>
            </div>
          ))}
        </div>

        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-surface-900">Recent Orders</h2>
            <button onClick={() => router.push('/dashboard/orders')} className="text-xs text-brand-500 font-semibold flex items-center gap-0.5 btn-press">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : !recentOrders?.length ? (
            <div className="card-elevated py-12 text-center">
              <div className="relative inline-flex mb-4">
                <div className="absolute inset-0 bg-brand-500/10 rounded-full blur-2xl scale-150" />
                <div className="relative h-14 w-14 rounded-2xl bg-surface-100 flex items-center justify-center">
                  <Package className="h-7 w-7 text-surface-300" />
                </div>
              </div>
              <p className="text-sm font-semibold text-surface-600">No orders yet</p>
              <p className="text-xs text-surface-400 mt-1">Send your first package today!</p>
              <button
                onClick={() => router.push('/dashboard/send')}
                className="mt-4 h-10 px-6 rounded-xl brand-gradient text-white text-sm font-semibold shadow-brand btn-press inline-flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" /> Send Package
              </button>
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
                    className="card-interactive w-full text-left p-4 group"
                  >
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                          <Package className="h-4 w-4 text-surface-500 group-hover:text-brand-500 transition-colors" />
                        </div>
                        <span className="text-sm font-bold text-surface-900">
                          #{id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <Badge className={`${status.bg} ${status.color} text-[11px] font-semibold`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-surface-500 mb-2">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{(order.dropoffAddress as string) || 'Destination'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-surface-100">
                      <span className="text-[11px] text-surface-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(new Date(order.createdAt as string))}
                      </span>
                      {!!order.totalPrice && (
                        <span className="text-sm font-bold text-surface-900">
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
