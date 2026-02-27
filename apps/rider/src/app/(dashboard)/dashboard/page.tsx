'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@riderguy/auth';
import { formatCurrency } from '@riderguy/utils';
import { RiderAvailability, type Order } from '@riderguy/types';
import { useRiderAvailability } from '@/hooks/use-rider-availability';
import { STATUS_CONFIG, PACKAGE_TYPES } from '@/lib/constants';
import {
  Power,
  TrendingUp,
  Star,
  Package,
  ChevronRight,
  MapPin,
  Navigation,
  Zap,
  Clock,
  Trophy,
} from 'lucide-react';

const RiderMap = dynamic(() => import('@/components/rider-map').then(mod => mod.RiderMap), { ssr: false });
import type { RiderMapStatus } from '@/components/rider-map';

interface WalletData {
  balance: number;
  totalEarned: number;
}

export default function DashboardPage() {
  const { api, user } = useAuth();
  const { availability, toggleAvailability, loading: toggling } = useRiderAvailability();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<{ completedDeliveries: number; rating: number } | null>(null);
  const [gamification, setGamification] = useState<{
    totalXp: number; currentLevel: number; levelName: string;
    progressPercent: number; isMaxLevel: boolean; nextLevelXp: number;
  } | null>(null);
  const [greeting, setGreeting] = useState('Good morning');

  const isOnline = availability === RiderAvailability.ONLINE;

  // Greeting based on time
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  // Fetch data
  useEffect(() => {
    if (!api) return;
    api.get('/wallets').then(r => setWallet(r.data.data)).catch(() => {});
    api.get('/orders', { params: { role: 'rider', status: 'ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF', limit: 5 } })
      .then(r => setOrders(r.data.data ?? []))
      .catch(() => {});
    api.get('/riders/profile')
      .then(r => {
        const d = r.data.data;
        setProfile({ completedDeliveries: d?.completedDeliveries ?? 0, rating: d?.rating ?? 0 });
      })
      .catch(() => {});
    api.get('/gamification/profile')
      .then(r => {
        const d = r.data.data;
        if (d) setGamification({
          totalXp: d.totalXp ?? 0,
          currentLevel: d.currentLevel ?? 1,
          levelName: d.levelName ?? 'Rookie',
          progressPercent: d.progressPercent ?? 0,
          isMaxLevel: d.isMaxLevel ?? false,
          nextLevelXp: d.nextLevelXp ?? 500,
        });
      })
      .catch(() => {});
  }, [api]);

  const firstName = user?.firstName || 'Rider';

  // Derive map marker status: offline → gray, online (no rides) → green, on-route → red
  const mapStatus: RiderMapStatus = !isOnline ? 'offline' : orders.length > 0 ? 'on-route' : 'online';

  return (
    <div className="relative min-h-[100dvh]">
      {/* ── Full-bleed Map ── */}
      <div className="absolute inset-0 h-[52dvh]">
        <RiderMap className="w-full h-full" status={mapStatus} />
        {/* Gradient fade at bottom */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-page to-transparent" />
      </div>

      {/* ── Floating Header ── */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div>
          <p className="text-muted text-xs font-medium tracking-wider uppercase">{greeting}</p>
          <h1 className="text-primary text-xl font-bold mt-0.5">{firstName}</h1>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide ${
          isOnline
            ? 'bg-accent-500/15 text-accent-400 border border-accent-500/30'
            : 'bg-surface-800/60 text-muted border border-themed'
        }`}>
          <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </header>

      {/* ── Content Area ── */}
      <div className="relative z-10 mt-[38dvh] px-4 space-y-4 pb-8">
        {/* ── Go Online Toggle ── */}
        <div className="flex justify-center -mt-8 mb-2">
          <button
            onClick={toggleAvailability}
            disabled={toggling}
            className={`relative group flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 btn-press shadow-2xl ${
              isOnline
                ? 'bg-surface-800/80 backdrop-blur-xl text-secondary border border-themed hover:bg-surface-700/80'
                : 'gradient-accent text-white glow-accent hover:shadow-accent-500/30'
            }`}
          >
            {toggling ? (
              <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Power className={`h-5 w-5 transition-transform duration-300 ${isOnline ? '' : 'group-hover:scale-110'}`} />
            )}
            {isOnline ? 'Go Offline' : 'Go Online'}

            {/* Pulsing ring when offline */}
            {!isOnline && !toggling && (
              <span className="absolute inset-0 rounded-2xl animate-ping bg-accent-500/20 pointer-events-none" style={{ animationDuration: '2s' }} />
            )}
          </button>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Earnings */}
          <div className="glass rounded-2xl p-3.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-accent-400" />
              <span className="text-[10px] text-muted font-medium uppercase tracking-wider">Earned</span>
            </div>
            <p className="text-primary font-bold text-lg tabular-nums">
              {wallet ? formatCurrency(wallet.totalEarned) : '—'}
            </p>
          </div>

          {/* Deliveries */}
          <div className="glass rounded-2xl p-3.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <Package className="h-3.5 w-3.5 text-brand-400" />
              <span className="text-[10px] text-muted font-medium uppercase tracking-wider">Trips</span>
            </div>
            <p className="text-primary font-bold text-lg tabular-nums">
              {profile ? profile.completedDeliveries : '—'}
            </p>
          </div>

          {/* Rating */}
          <div className="glass rounded-2xl p-3.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <Star className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] text-muted font-medium uppercase tracking-wider">Rating</span>
            </div>
            <p className="text-primary font-bold text-lg tabular-nums">
              {profile?.rating ? profile.rating.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        {/* ── XP & Level Card ── */}
        {gamification && (
          <Link href="/dashboard/gamification" className="block glass-elevated rounded-2xl p-4 btn-press transition-transform hover:scale-[1.01]">
            <div className="flex items-center gap-3">
              {/* Level badge */}
              <div className="relative flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-500/20 to-accent-500/20 flex items-center justify-center">
                  <span className="text-2xl">{['🏁','🏃','🔥','⚡','🎯','👑','🌟'][gamification.currentLevel - 1] ?? '🏁'}</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-primary text-sm font-bold">{gamification.levelName}</span>
                    <span className="text-subtle text-[10px]">Lvl {gamification.currentLevel}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-accent-400" />
                    <span className="text-accent-400 text-xs font-bold tabular-nums">{gamification.totalXp.toLocaleString()} XP</span>
                  </div>
                </div>

                {/* Progress bar */}
                {!gamification.isMaxLevel && (
                  <div className="h-1.5 rounded-full bg-skeleton overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700"
                      style={{ width: `${Math.min(gamification.progressPercent, 100)}%` }}
                    />
                  </div>
                )}
                {gamification.isMaxLevel && (
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" />
                )}
              </div>

              <ChevronRight className="h-4 w-4 text-subtle flex-shrink-0" />
            </div>
          </Link>
        )}

        {/* ── Active Orders ── */}
        {orders.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-primary font-semibold text-sm">Active Deliveries</h2>
              <Link href="/dashboard/jobs" className="text-brand-400 text-xs font-medium flex items-center gap-0.5">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {orders.map((order) => {
                const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING ?? { label: order.status, color: 'text-muted', bg: 'bg-skeleton' };
                const pkg = PACKAGE_TYPES[order.packageType] ?? PACKAGE_TYPES.SMALL_PARCEL ?? { label: 'Package', icon: '📦' };

                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/jobs/${order.id}`}
                    className="block glass-elevated rounded-2xl p-4 btn-press transition-transform duration-200 hover:scale-[1.01]"
                  >
                    {/* Top row: status + price */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}>
                        <Zap className="h-3 w-3" />
                        {status.label}
                      </span>
                      <span className="text-primary font-bold text-sm tabular-nums">
                        {formatCurrency(order.totalPrice)}
                      </span>
                    </div>

                    {/* Route */}
                    <div className="flex gap-3">
                      {/* Route dots */}
                      <div className="flex flex-col items-center pt-0.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <div className="w-px flex-1 bg-gradient-to-b from-brand-500/60 to-accent-500/60 my-1" />
                        <div className="h-2.5 w-2.5 rounded-full bg-accent-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                      </div>

                      {/* Addresses */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="text-muted text-[10px] font-medium uppercase tracking-wider mb-0.5">Pickup</p>
                          <p className="text-primary text-xs font-medium truncate">{order.pickupAddress}</p>
                        </div>
                        <div>
                          <p className="text-muted text-[10px] font-medium uppercase tracking-wider mb-0.5">Dropoff</p>
                          <p className="text-primary text-xs font-medium truncate">{order.dropoffAddress}</p>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center">
                        <ChevronRight className="h-4 w-4 text-subtle" />
                      </div>
                    </div>

                    {/* Bottom meta */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-themed-subtle">
                      <span className="flex items-center gap-1 text-[10px] text-muted">
                        <MapPin className="h-3 w-3" />
                        {pkg?.icon} {pkg?.label}
                      </span>
                      {order.distanceKm && (
                        <span className="flex items-center gap-1 text-[10px] text-muted">
                          <Navigation className="h-3 w-3" />
                          {order.distanceKm.toFixed(1)} km
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Empty State ── */}
        {orders.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center">
            <div className="relative inline-flex mb-3">
              <div className="absolute inset-0 bg-brand-500/10 rounded-full blur-xl scale-150" />
              <div className="relative h-14 w-14 rounded-full bg-brand-500/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-brand-400" />
              </div>
            </div>
            <h3 className="text-primary text-sm font-semibold mb-1">
              {isOnline ? 'Waiting for deliveries' : 'Go online to start earning'}
            </h3>
            <p className="text-muted text-xs">
              {isOnline
                ? 'New delivery requests will appear here'
                : 'Toggle online to receive delivery requests near you'}
            </p>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/dashboard/earnings"
            className="glass rounded-2xl p-4 flex flex-col items-center gap-2 btn-press group transition-transform hover:scale-[1.02]"
          >
            <div className="h-10 w-10 rounded-xl bg-accent-500/10 flex items-center justify-center group-hover:bg-accent-500/20 transition-colors">
              <TrendingUp className="h-5 w-5 text-accent-400" />
            </div>
            <div className="text-center">
              <p className="text-primary text-xs font-semibold">Earnings</p>
            </div>
          </Link>

          <Link
            href="/dashboard/gamification"
            className="glass rounded-2xl p-4 flex flex-col items-center gap-2 btn-press group transition-transform hover:scale-[1.02]"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <Trophy className="h-5 w-5 text-amber-400" />
            </div>
            <div className="text-center">
              <p className="text-primary text-xs font-semibold">Rank & XP</p>
            </div>
          </Link>

          <Link
            href="/dashboard/jobs"
            className="glass rounded-2xl p-4 flex flex-col items-center gap-2 btn-press group transition-transform hover:scale-[1.02]"
          >
            <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
              <Clock className="h-5 w-5 text-brand-400" />
            </div>
            <div className="text-center">
              <p className="text-primary text-xs font-semibold">History</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
