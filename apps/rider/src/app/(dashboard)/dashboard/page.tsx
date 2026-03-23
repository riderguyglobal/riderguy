'use client';

import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@riderguy/auth';
import { formatCurrency } from '@riderguy/utils';
import { RiderAvailability, type Order } from '@riderguy/types';
import { useRiderAvailability } from '@/hooks/use-rider-availability';
import { useSocket } from '@/hooks/use-socket';
import { useConnectionHealth } from '@/hooks/use-connection-health';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { useAudioKeepAlive } from '@/hooks/use-audio-keep-alive';
import { useForegroundRecovery } from '@/hooks/use-foreground-recovery';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { STATUS_CONFIG, PACKAGE_TYPES, API_BASE_URL } from '@/lib/constants';
import { tokenStorage } from '@riderguy/auth';
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
  Wifi,
  WifiOff,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Bell,
} from 'lucide-react';

const RiderMap = dynamic(() => import('@/components/rider-map').then(mod => mod.RiderMap), {
  ssr: false,
  loading: () => <div className="w-full h-full min-h-[200px] bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />,
});
import type { RiderMapStatus } from '@/components/rider-map';

interface WalletData {
  balance: number;
  totalEarned: number;
}

export default function DashboardPage() {
  const { api, user } = useAuth();
  const { availability, toggleAvailability, loading: toggling, gpsError, onboardingStatus } = useRiderAvailability();
  const { connected: socketConnected, socketError, reconnecting, reconnectAttempt } = useSocket();
  const isOnline = availability === RiderAvailability.ONLINE;

  // ── Persistent rider session systems ──

  // Connection health: adaptive heartbeats, quality monitoring, background sync
  const connectionHealth = useConnectionHealth(isOnline);

  // Screen wake lock: prevents device sleep while rider is ONLINE
  useWakeLock(isOnline);

  // Audio keep-alive: prevents browser from suspending PWA during phone calls/app switches
  useAudioKeepAlive(isOnline);

  // Foreground recovery: resync all state when returning from background
  useForegroundRecovery(isOnline);

  // Push notifications: register FCM token + handle foreground messages
  usePushNotifications();

  // Notify service worker when rider goes online/offline for background sync
  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: isOnline ? 'RIDER_ONLINE' : 'RIDER_OFFLINE',
      });
    }
  }, [isOnline]);

  // Listen for background heartbeat ticks from service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'HEARTBEAT_TICK' && isOnline && api) {
        // Service worker triggered a background heartbeat — sync location
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            api.post('/riders/location', {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }).catch(() => {});

            // Also try to sync via service worker background sync
            navigator.serviceWorker.controller?.postMessage({
              type: 'SYNC_LOCATION',
              data: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                token: tokenStorage.getAccessToken(),
                apiUrl: API_BASE_URL,
              },
            });
          },
          () => {},
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
        );
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [isOnline, api]);

  // ── Dashboard data via React Query (cached + background refresh) ──

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api!.get('/wallets').then(r => r.data.data as WalletData),
    enabled: !!api,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', 'active-rider'],
    queryFn: () => api!.get('/orders', {
      params: { role: 'rider', status: 'ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF', limit: 5 },
    }).then(r => (r.data.data ?? []) as Order[]),
    enabled: !!api,
    // Poll faster during active delivery, slower when idle, stop when offline
    refetchInterval: (query) => {
      const data = query.state.data as Order[] | undefined;
      if (!navigator.onLine) return false;
      return data && data.length > 0 ? 5_000 : 30_000;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ['rider-profile-full'],
    queryFn: () => api!.get('/riders/profile').then(r => r.data.data),
    select: (d: any) => ({ completedDeliveries: d?.completedDeliveries ?? 0, rating: d?.rating ?? 0 }),
    enabled: !!api,
    staleTime: 30_000,
  });

  const { data: gamification } = useQuery({
    queryKey: ['gamification-profile'],
    queryFn: () => api!.get('/gamification/profile').then(r => {
      const d = r.data.data;
      if (!d) return null;
      return {
        totalXp: d.totalXp ?? 0,
        currentLevel: d.currentLevel ?? 1,
        levelName: d.levelName ?? 'Rookie',
        progressPercent: d.progressPercent ?? 0,
        isMaxLevel: d.isMaxLevel ?? false,
        nextLevelXp: d.nextLevelXp ?? 500,
      };
    }),
    enabled: !!api,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api!.get('/notifications', { params: { pageSize: '1' } });
      return { unread: res.data.unreadCount ?? 0 };
    },
    enabled: !!api,
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.unread ?? 0;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const firstName = user?.firstName || 'Rider';

  // Connection quality icon helper
  const QualityIcon = connectionHealth.quality === 'excellent' ? SignalHigh
    : connectionHealth.quality === 'good' ? SignalMedium
    : connectionHealth.quality === 'poor' ? SignalLow
    : WifiOff;

  // Format session duration as HH:MM:SS
  const sessionTime = useMemo(() => {
    const s = connectionHealth.sessionDurationSec;
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }, [connectionHealth.sessionDurationSec]);

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
        <div className="bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl rounded-2xl px-4 py-2.5 shadow-theme-card">
          <p className="text-muted text-[10px] font-semibold tracking-[0.12em] uppercase">{greeting}</p>
          <h1 className="text-primary text-lg font-bold -mt-0.5">{firstName}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <Link href="/dashboard/notifications" className="relative h-10 w-10 rounded-2xl bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl shadow-theme-card flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          {/* Status badge — shows connection quality when online */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold tracking-wide shadow-theme-card backdrop-blur-xl ${
          isOnline
            ? 'bg-brand-500/15 text-brand-600 dark:text-accent-400 border border-brand-500/25'
            : 'bg-white/70 dark:bg-surface-800/60 text-muted border border-themed'
        }`}>
          <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          {isOnline ? 'Online' : 'Offline'}
          {/* Connection quality indicator (only when online) */}
          {isOnline && (
            <QualityIcon className={`h-3.5 w-3.5 ${
              connectionHealth.quality === 'excellent' ? 'text-green-400' :
              connectionHealth.quality === 'good' ? 'text-brand-400' :
              connectionHealth.quality === 'poor' ? 'text-amber-400 animate-pulse' :
              'text-red-500 animate-pulse'
            }`} />
          )}
          {/* Socket dot — fallback indicator */}
          {!isOnline && (
            <div className={`h-2 w-2 rounded-full ${
              socketConnected ? 'bg-green-400' : 'bg-red-500 animate-pulse'
            }`} title={socketConnected ? 'Socket connected' : 'Socket disconnected'} />
          )}
        </div>
        </div>
      </header>

      {/* ── Content Area ── */}
      <div className="relative z-10 mt-[38dvh] px-4 space-y-4 pb-8">
        {/* ── Go Online Toggle ── */}
        <div className="flex justify-center -mt-8 mb-2">
          <button
            onClick={() => { toggleAvailability(); navigator.vibrate?.(50); }}
            disabled={toggling}
            className={`relative group flex items-center gap-3 px-10 py-4 rounded-2xl font-bold text-base transition-all duration-300 btn-press ${
              isOnline
                ? 'bg-surface-800/90 dark:bg-surface-800/80 backdrop-blur-xl text-white border border-white/10 shadow-xl hover:bg-surface-700/90'
                : 'gradient-accent text-white glow-accent shadow-2xl hover:shadow-brand-500/40'
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

        {/* Session Timer — shows how long rider has been online */}
        {isOnline && (
          <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-brand-500/5 border border-brand-500/10 text-xs">
            <div className="flex items-center gap-2 text-muted">
              <Clock className="h-3.5 w-3.5" />
              <span>Session: <span className="text-primary font-semibold tabular-nums">{sessionTime}</span></span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Wifi className="h-3.5 w-3.5" />
              <span className="capitalize">{connectionHealth.quality}</span>
              {connectionHealth.latencyMs > 0 && (
                <span className="tabular-nums text-[10px]">{connectionHealth.latencyMs}ms</span>
              )}
            </div>
          </div>
        )}

        {/* Connection Warning Banners */}
        {isOnline && reconnecting && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
            Reconnecting to server (attempt #{reconnectAttempt})… Your session is safe.
          </div>
        )}

        {!socketConnected && isOnline && !reconnecting && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            Socket disconnected — you won&apos;t receive delivery requests{socketError ? `: ${socketError}` : ''}
          </div>
        )}

        {isOnline && connectionHealth.quality === 'poor' && socketConnected && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/15 text-amber-500 text-xs font-medium">
            <SignalLow className="h-3.5 w-3.5 shrink-0" />
            Weak connection — heartbeat increased to keep you online
          </div>
        )}

        {isOnline && !connectionHealth.networkOnline && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            No network — your session is saved. Will reconnect automatically when signal returns.
          </div>
        )}

        {/* GPS Error Banner */}
        {gpsError && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            {gpsError}
          </div>
        )}

        {/* Onboarding Banner — show when rider hasn't been activated yet */}
        {onboardingStatus && onboardingStatus !== 'ACTIVATED' && !gpsError && (
          <Link
            href="/dashboard/onboarding"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="flex-1">Complete your onboarding to start accepting deliveries</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
        )}

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Earnings */}
          <div className="stat-card-earned rounded-2xl p-3.5 text-center shadow-theme-sm backdrop-blur-lg">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <div className="h-5 w-5 rounded-md bg-accent-500/15 flex items-center justify-center">
                <TrendingUp className="h-3 w-3 text-accent-500" />
              </div>
              <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Total Earned</span>
            </div>
            <p className="text-primary font-extrabold text-lg tabular-nums">
              {wallet ? formatCurrency(wallet.totalEarned) : '—'}
            </p>
          </div>

          {/* Deliveries */}
          <div className="stat-card-trips rounded-2xl p-3.5 text-center shadow-theme-sm backdrop-blur-lg">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <div className="h-5 w-5 rounded-md bg-blue-500/15 flex items-center justify-center">
                <Package className="h-3 w-3 text-blue-500" />
              </div>
              <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Trips</span>
            </div>
            <p className="text-primary font-extrabold text-lg tabular-nums">
              {profile ? profile.completedDeliveries : '—'}
            </p>
          </div>

          {/* Rating */}
          <div className="stat-card-rating rounded-2xl p-3.5 text-center shadow-theme-sm backdrop-blur-lg">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <div className="h-5 w-5 rounded-md bg-amber-500/15 flex items-center justify-center">
                <Star className="h-3 w-3 text-amber-500" />
              </div>
              <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Rating</span>
            </div>
            <p className="text-primary font-extrabold text-lg tabular-nums">
              {profile?.rating ? profile.rating.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        {/* ── XP & Level Card ── */}
        {gamification && (
          <Link href="/dashboard/gamification" className="block overflow-hidden rounded-2xl shadow-theme-card btn-press transition-transform hover:scale-[1.01]">
            <div className="relative bg-gradient-to-r from-brand-500/10 via-accent-500/8 to-brand-500/5 dark:from-brand-500/15 dark:via-accent-500/10 dark:to-brand-500/8 border border-brand-500/12 dark:border-brand-500/20 p-4">
              {/* Decorative corner glow */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-brand-500/10 dark:bg-brand-500/15 rounded-full blur-2xl" />

              <div className="relative flex items-center gap-3">
                {/* Level badge */}
                <div className="relative flex-shrink-0">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-lg shadow-brand-500/25">
                    <span className="text-xl text-white font-bold">L{gamification.currentLevel}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-primary text-sm font-bold">{gamification.levelName}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-accent-500/10 px-2 py-0.5 rounded-full">
                      <Zap className="h-3 w-3 text-accent-500" />
                      <span className="text-accent-600 dark:text-accent-400 text-xs font-bold tabular-nums">{gamification.totalXp.toLocaleString()} XP</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {!gamification.isMaxLevel && (
                    <div className="h-2 rounded-full bg-brand-500/10 dark:bg-brand-500/15 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700 shadow-sm shadow-brand-500/30"
                        style={{ width: `${Math.min(gamification.progressPercent, 100)}%` }}
                      />
                    </div>
                  )}
                  {gamification.isMaxLevel && (
                    <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 shadow-sm shadow-amber-400/30" />
                  )}
                </div>

                <ChevronRight className="h-4 w-4 text-brand-400 flex-shrink-0" />
              </div>
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
          <div className="relative overflow-hidden rounded-2xl border border-themed-subtle shadow-theme-card bg-card p-6 text-center">
            {/* Decorative bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-accent-500/5" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-20 bg-brand-500/8 rounded-full blur-3xl" />

            <div className="relative">
              <div className="relative inline-flex mb-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/10 flex items-center justify-center border border-brand-500/10">
                  <Package className="h-7 w-7 text-brand-500" />
                </div>
              </div>
              <h3 className="text-primary text-sm font-bold mb-1">
                {isOnline ? 'Waiting for deliveries' : 'Go online to start earning'}
              </h3>
              <p className="text-muted text-xs leading-relaxed">
                {isOnline
                  ? 'New delivery requests will appear here'
                  : 'Toggle online to receive delivery requests near you'}
              </p>
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/dashboard/earnings"
            className="rounded-2xl p-4 flex flex-col items-center gap-2.5 btn-press group transition-all hover:scale-[1.02] bg-card border border-themed-subtle shadow-theme-sm"
          >
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-accent-500/15 to-accent-500/5 flex items-center justify-center group-hover:from-accent-500/25 group-hover:to-accent-500/10 transition-all border border-accent-500/10">
              <TrendingUp className="h-5 w-5 text-accent-500" />
            </div>
            <p className="text-primary text-xs font-semibold">Earnings</p>
          </Link>

          <Link
            href="/dashboard/gamification"
            className="rounded-2xl p-4 flex flex-col items-center gap-2.5 btn-press group transition-all hover:scale-[1.02] bg-card border border-themed-subtle shadow-theme-sm"
          >
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center group-hover:from-amber-500/25 group-hover:to-amber-500/10 transition-all border border-amber-500/10">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-primary text-xs font-semibold">Rank & XP</p>
          </Link>

          <Link
            href="/dashboard/jobs"
            className="rounded-2xl p-4 flex flex-col items-center gap-2.5 btn-press group transition-all hover:scale-[1.02] bg-card border border-themed-subtle shadow-theme-sm"
          >
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500/15 to-brand-500/5 flex items-center justify-center group-hover:from-brand-500/25 group-hover:to-brand-500/10 transition-all border border-brand-500/10">
              <Clock className="h-5 w-5 text-brand-500" />
            </div>
            <p className="text-primary text-xs font-semibold">History</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
