'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@riderguy/auth';
import { useRiderAvailability } from '@/hooks/use-rider-availability';
import { API_BASE_URL, STATUS_CONFIG, PACKAGE_TYPES } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import {
  Power, ChevronRight, Bike, TrendingUp, ClipboardList,
  AlertCircle, Wallet, Star
} from 'lucide-react';
import type { Order, Wallet as WalletType } from '@riderguy/types';
import { RiderAvailability } from '@riderguy/types';

const RiderMap = dynamic(() => import('@/components/rider-map').then((m) => m.RiderMap), { ssr: false });

export default function DashboardPage() {
  const router = useRouter();
  const { user, api } = useAuth();
  const { availability, toggleAvailability, loading: toggling } = useRiderAvailability();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({ todayEarnings: 0, todayDeliveries: 0, rating: 0 });

  const isOnline = availability === RiderAvailability.ONLINE;

  useEffect(() => {
    if (!api) return;
    // Fetch wallet
    api.get(`${API_BASE_URL}/wallets`).then((r) => setWallet(r.data.data)).catch(() => {});

    // Fetch active orders
    api.get(`${API_BASE_URL}/orders?status=ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF&limit=5`)
      .then((r) => setActiveOrders(r.data.data ?? []))
      .catch(() => {});

    // Basic stats from rider profile
    api.get(`${API_BASE_URL}/riders/profile`)
      .then((r) => {
        const d = r.data.data;
        setStats({
          todayEarnings: d?.todayEarnings ?? 0,
          todayDeliveries: d?.todayDeliveries ?? 0,
          rating: d?.averageRating ?? 0,
        });
      })
      .catch(() => {});
  }, [api]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="animate-page-enter pb-24">
      {/* Map hero */}
      <div className="relative h-[45dvh] min-h-[280px]">
        <RiderMap className="w-full h-full" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 safe-area-top">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-white/70">{greeting}</p>
              <h1 className="text-xl font-bold text-white">{user?.firstName ?? 'Rider'}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium glass ${
                isOnline ? 'text-accent-400' : 'text-surface-400'
              }`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${
                  isOnline ? 'bg-accent-400 animate-pulse' : 'bg-surface-500'
                }`} />
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content sheet */}
      <div className="relative z-10 -mt-8 px-4 space-y-4">
        {/* Go Online/Offline toggle */}
        <button
          onClick={toggleAvailability}
          disabled={toggling}
          className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-lg transition-all shadow-xl ${
            isOnline
              ? 'bg-accent-500 text-white shadow-accent-500/25 active:bg-accent-600'
              : 'bg-surface-800 text-white border border-surface-700 active:bg-surface-700'
          }`}
        >
          <Power className={`h-6 w-6 ${toggling ? 'animate-spin-slow' : ''}`} />
          {toggling ? 'Updating...' : isOnline ? 'Go Offline' : 'Go Online'}
        </button>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => router.push('/dashboard/earnings')} className="glass rounded-2xl p-4 text-left hover:bg-white/10 transition-colors">
            <Wallet className="h-5 w-5 text-brand-400 mb-2" />
            <p className="text-lg font-bold text-white">{formatCurrency(stats.todayEarnings)}</p>
            <p className="text-xs text-surface-400">Today</p>
          </button>
          <button onClick={() => router.push('/dashboard/jobs')} className="glass rounded-2xl p-4 text-left hover:bg-white/10 transition-colors">
            <TrendingUp className="h-5 w-5 text-accent-400 mb-2" />
            <p className="text-lg font-bold text-white">{stats.todayDeliveries}</p>
            <p className="text-xs text-surface-400">Deliveries</p>
          </button>
          <div className="glass rounded-2xl p-4 text-left">
            <Star className="h-5 w-5 text-amber-400 mb-2" />
            <p className="text-lg font-bold text-white">{stats.rating ? stats.rating.toFixed(1) : '—'}</p>
            <p className="text-xs text-surface-400">Rating</p>
          </div>
        </div>

        {/* Active orders */}
        {activeOrders.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Active Deliveries</h3>
              <span className="text-xs text-brand-400">{activeOrders.length} active</span>
            </div>
            {activeOrders.map((order) => {
              const sc = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-surface-400', bg: 'bg-surface-400/10' };
              const pkg = PACKAGE_TYPES[order.packageType] ?? { label: 'Package', icon: '📦' };
              return (
                <button
                  key={order.id}
                  onClick={() => router.push(`/dashboard/jobs/${order.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                >
                  <span className="text-xl shrink-0">{pkg.icon}</span>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm text-white truncate">{order.dropoffAddress ?? 'Delivery'}</p>
                    <p className={`text-xs ${sc.color}`}>{sc.label}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Quick actions */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
          </div>
          {[
            { icon: ClipboardList, label: 'View All Jobs', href: '/dashboard/jobs', color: 'text-brand-400' },
            { icon: Wallet, label: 'My Earnings', href: '/dashboard/earnings', color: 'text-accent-400' },
            { icon: AlertCircle, label: 'Onboarding', href: '/dashboard/onboarding', color: 'text-amber-400' },
          ].map(({ icon: Icon, label, href, color }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
            >
              <Icon className={`h-5 w-5 ${color}`} />
              <span className="text-sm text-white flex-1 text-left">{label}</span>
              <ChevronRight className="h-4 w-4 text-surface-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
