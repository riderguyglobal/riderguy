'use client';

import { useMemo, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Menu,
  Bell,
  Eye,
  EyeOff,
  Plus,
  ArrowUpRight,
  ClipboardList,
  Package,
  Wallet,
  Star,
  Gift,
  GraduationCap,
  Users,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Radio,
  WifiOff,
  SignalLow,
  Zap,
  MapPin,
  Navigation,
} from 'lucide-react';

interface WalletData {
  balance: number;
  totalEarned: number;
}

export default function DashboardPage() {
  const { api, user } = useAuth();
  const { availability, toggleAvailability, loading: toggling, gpsError, onboardingStatus } = useRiderAvailability();
  const { connected: socketConnected, socketError, reconnecting, reconnectAttempt } = useSocket();
  const isOnline = availability === RiderAvailability.ONLINE;
  const [balanceVisible, setBalanceVisible] = useState(true);

  // ── Persistent rider session systems ──
  const connectionHealth = useConnectionHealth(isOnline);
  useWakeLock(isOnline);
  useAudioKeepAlive(isOnline);
  useForegroundRecovery(isOnline);
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
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            api.post('/riders/location', {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }).catch(() => {});

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

  // ── Dashboard data queries ──

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
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  }, []);

  const firstName = user?.firstName || 'Rider';

  return (
    <div className="min-h-[100dvh] bg-white">

      {/* ══ 1. Top Header ══ */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 bg-white border-b border-gray-100"
        style={{ height: '60px', paddingTop: 'env(safe-area-inset-top)' }}>
        <button
          className="h-9 w-9 flex items-center justify-center rounded-xl transition-colors active:bg-gray-100"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5 text-gray-900" strokeWidth={2} />
        </button>

        <span className="text-[22px] font-extrabold tracking-tight" style={{ color: '#00A85A' }}>
          Riderguy
        </span>

        <Link
          href="/dashboard/notifications"
          className="relative h-9 w-9 flex items-center justify-center rounded-xl transition-colors active:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-gray-900" strokeWidth={1.8} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white" />
          )}
        </Link>
      </header>

      {/* Scrollable page content */}
      <div className="px-5 pt-4 pb-8 space-y-4 max-w-[480px] mx-auto">

        {/* ══ 2. Greeting Hero ══ */}
        <div
          className="relative overflow-hidden rounded-2xl px-5 pt-4 pb-0"
          style={{ background: '#F5FDF8', minHeight: '148px' }}
        >
          {/* Pale city skyline silhouette */}
          <svg
            className="absolute bottom-0 right-16 h-[75%] pointer-events-none select-none"
            viewBox="0 0 200 90"
            fill="none"
            aria-hidden="true"
          >
            <rect x="0"   y="65" width="14" height="25" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="17"  y="50" width="11" height="40" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="31"  y="60" width="9"  height="30" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="43"  y="38" width="17" height="52" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="63"  y="55" width="9"  height="35" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="75"  y="44" width="13" height="46" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="91"  y="62" width="8"  height="28" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="102" y="46" width="15" height="44" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="120" y="57" width="9"  height="33" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="132" y="34" width="18" height="56" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="153" y="52" width="11" height="38" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="167" y="42" width="13" height="48" fill="#00A85A" fillOpacity="0.18" rx="1"/>
            <rect x="183" y="60" width="10" height="30" fill="#00A85A" fillOpacity="0.18" rx="1"/>
          </svg>

          {/* Scooter illustration */}
          <div className="absolute right-3 bottom-0 pointer-events-none select-none" aria-hidden="true">
            <svg viewBox="0 0 130 100" className="h-[96px] w-auto" fill="none">
              {/* Rear wheel */}
              <circle cx="32" cy="78" r="16" stroke="#00A85A" strokeWidth="4.5" fill="none"/>
              <circle cx="32" cy="78" r="6"  fill="#00A85A"/>
              {/* Front wheel */}
              <circle cx="96" cy="78" r="16" stroke="#00A85A" strokeWidth="4.5" fill="none"/>
              <circle cx="96" cy="78" r="6"  fill="#00A85A"/>
              {/* Footboard */}
              <path d="M32 62 L96 62" stroke="#00A85A" strokeWidth="5" strokeLinecap="round"/>
              {/* Body */}
              <path d="M32 62 C35 48 46 38 62 36 C74 35 86 40 96 62" stroke="#00A85A" strokeWidth="4" fill="none" strokeLinecap="round"/>
              {/* Seat */}
              <rect x="50" y="30" width="30" height="9" rx="4.5" fill="#00A85A"/>
              {/* Handlebar stem */}
              <path d="M96 46 L102 30" stroke="#00A85A" strokeWidth="3.5" strokeLinecap="round"/>
              {/* Handlebar */}
              <path d="M96 30 L108 30" stroke="#00A85A" strokeWidth="3.5" strokeLinecap="round"/>
              {/* Front fairing */}
              <path d="M96 62 C99 52 103 44 107 44 C111 44 112 52 110 62"
                fill="#00A85A" fillOpacity="0.25" stroke="#00A85A" strokeWidth="2"/>
            </svg>
          </div>

          {/* Location pin */}
          <svg
            className="absolute right-3 top-3 h-8 w-auto pointer-events-none select-none"
            viewBox="0 0 22 32"
            fill="none"
            aria-hidden="true"
          >
            <path d="M11 0C4.9 0 0 4.9 0 11C0 19.25 11 32 11 32C11 32 22 19.25 22 11C22 4.9 17.1 0 11 0Z"
              fill="#00A85A" fillOpacity="0.25"/>
            <circle cx="11" cy="11" r="4.5" fill="#00A85A" fillOpacity="0.5"/>
          </svg>

          {/* Text block */}
          <div className="relative z-10 pb-4 max-w-[56%]">
            {/* Online status pill */}
            <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1 mb-3 shadow-sm">
              <span
                className="h-2 w-2 rounded-full shrink-0 transition-colors"
                style={{ backgroundColor: isOnline ? '#00A85A' : '#9ca3af' }}
              />
              <span className="text-xs font-semibold text-gray-700">
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </div>

            <p className="text-gray-600 font-medium text-base leading-tight">{greeting}</p>
            <h1 className="text-gray-900 font-extrabold leading-tight mt-0.5" style={{ fontSize: '28px' }}>
              {firstName} 👋
            </h1>
            <p className="text-gray-400 text-sm mt-1">Ready to deliver?</p>
          </div>
        </div>

        {/* ══ System alert banners (GPS, connection, onboarding) ══ */}
        {gpsError && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            {gpsError}
          </div>
        )}

        {isOnline && reconnecting && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium">
            <div className="h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
            Reconnecting to server (attempt #{reconnectAttempt})… Your session is safe.
          </div>
        )}

        {!socketConnected && isOnline && !reconnecting && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            Socket disconnected — you won&apos;t receive delivery requests{socketError ? `: ${socketError}` : ''}
          </div>
        )}

        {isOnline && connectionHealth.quality === 'poor' && socketConnected && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium">
            <SignalLow className="h-3.5 w-3.5 shrink-0" />
            Weak connection — heartbeat increased to keep you online
          </div>
        )}

        {isOnline && !connectionHealth.networkOnline && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            No network — session saved. Will reconnect when signal returns.
          </div>
        )}

        {onboardingStatus && onboardingStatus !== 'ACTIVATED' && !gpsError && (
          <Link
            href="/dashboard/onboarding"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium active:opacity-80 transition-opacity"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="flex-1">Complete your onboarding to start accepting deliveries</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
        )}

        {/* ══ 3. Wallet Balance Card ══ */}
        <div
          className="relative overflow-hidden rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, #008F4C 0%, #00B967 100%)',
            boxShadow: '0 8px 32px rgba(0, 168, 90, 0.30)',
          }}
        >
          {/* Decorative wallet icon */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <Wallet className="h-28 w-28 text-white opacity-[0.12]" />
          </div>

          <div className="relative">
            {/* Label + eye toggle */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white/80 text-sm font-medium">Wallet Balance</span>
              <button
                onClick={() => setBalanceVisible(v => !v)}
                className="text-white/60 hover:text-white/90 transition-colors"
                aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
              >
                {balanceVisible
                  ? <Eye className="h-4 w-4" />
                  : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            {/* Amount */}
            <p
              className="text-white font-extrabold leading-tight mb-4"
              style={{ fontSize: '34px' }}
            >
              {balanceVisible
                ? (wallet ? formatCurrency(wallet.balance) : 'GHS 0.00')
                : '••••••'}
            </p>

            {/* Divider */}
            <div className="h-px mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.20)' }} />

            {/* Action row */}
            <div className="flex items-stretch">
              <Link
                href="/dashboard/earnings?action=add"
                className="flex-1 flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center border border-white/35">
                  <Plus className="h-4 w-4 text-white" />
                </div>
                <span className="text-white text-[11px] font-semibold">Add Money</span>
              </Link>

              <div className="w-px self-stretch mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.20)' }} />

              <Link
                href="/dashboard/earnings?action=withdraw"
                className="flex-1 flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center border border-white/35">
                  <ArrowUpRight className="h-4 w-4 text-white" />
                </div>
                <span className="text-white text-[11px] font-semibold">Cash Out</span>
              </Link>

              <div className="w-px self-stretch mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.20)' }} />

              <Link
                href="/dashboard/earnings"
                className="flex-1 flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center border border-white/35">
                  <ClipboardList className="h-4 w-4 text-white" />
                </div>
                <span className="text-white text-[11px] font-semibold text-center leading-tight">
                  Transaction History
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* ══ 4. Today's Overview ══ */}
        <div
          className="bg-white rounded-2xl p-5 border border-gray-100"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-900 font-bold" style={{ fontSize: '15px' }}>Today&apos;s Overview</h2>
            <Link href="/dashboard/earnings" className="font-semibold text-sm" style={{ color: '#00A85A' }}>
              View all
            </Link>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {/* Deliveries */}
            <div className="flex flex-col items-center gap-2 px-2">
              <div
                className="h-11 w-11 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#EFFAF5' }}
              >
                <Package className="h-5 w-5" style={{ color: '#00A85A' }} />
              </div>
              <span className="text-gray-500 text-xs font-medium">Deliveries</span>
              <span className="text-gray-900 font-extrabold text-xl leading-none">
                {profile ? profile.completedDeliveries : '—'}
              </span>
            </div>

            {/* Earnings */}
            <div className="flex flex-col items-center gap-2 px-2">
              <div
                className="h-11 w-11 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#EFFAF5' }}
              >
                <Wallet className="h-5 w-5" style={{ color: '#00A85A' }} />
              </div>
              <span className="text-gray-500 text-xs font-medium">Earnings</span>
              <span className="text-gray-900 font-extrabold text-base leading-none text-center">
                {wallet ? formatCurrency(wallet.totalEarned) : '—'}
              </span>
            </div>

            {/* Rating */}
            <div className="flex flex-col items-center gap-2 px-2">
              <div
                className="h-11 w-11 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#EFFAF5' }}
              >
                <Star className="h-5 w-5" style={{ color: '#00A85A' }} />
              </div>
              <span className="text-gray-500 text-xs font-medium">Rating</span>
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-current" style={{ color: '#00A85A' }} />
                <span className="text-gray-900 font-extrabold text-xl leading-none">
                  {profile?.rating ? profile.rating.toFixed(1) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ 5. Go Online & Deliver ══ */}
        <div>
          <h2 className="text-gray-900 font-bold mb-3" style={{ fontSize: '17px' }}>
            Go Online &amp; Deliver
          </h2>

          <div
            className="rounded-2xl p-4 flex items-center gap-3 border"
            style={{ backgroundColor: '#EFFAF5', borderColor: '#C8F0DC' }}
          >
            {/* Signal icon */}
            <div
              className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: '#DFF5EA' }}
            >
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: isOnline ? '#00A85A' : '#9ca3af',
                  boxShadow: isOnline ? '0 4px 14px rgba(0,168,90,0.35)' : 'none',
                  transition: 'background-color 0.3s',
                }}
              >
                <Radio className="h-5 w-5 text-white" />
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-900 font-bold text-sm">
                  {isOnline ? 'You are Online' : 'You are Offline'}
                </span>
                <span
                  className="h-2 w-2 rounded-full shrink-0 transition-colors"
                  style={{ backgroundColor: isOnline ? '#00A85A' : '#9ca3af' }}
                />
              </div>
              <p className="text-gray-500 text-xs mt-0.5 leading-snug">
                {isOnline
                  ? "You're all set to receive delivery requests."
                  : 'Go online to start receiving delivery requests.'}
              </p>
            </div>

            {/* Toggle button */}
            <button
              onClick={() => { toggleAvailability(); navigator.vibrate?.(50); }}
              disabled={toggling}
              className="shrink-0 h-10 px-4 rounded-xl font-bold text-sm text-white flex items-center gap-1.5 transition-opacity active:opacity-80 disabled:opacity-60"
              style={{
                backgroundColor: '#00A85A',
                boxShadow: '0 4px 14px rgba(0,168,90,0.30)',
              }}
            >
              {toggling
                ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : (isOnline ? 'Go Offline' : 'Go Online')}
            </button>
          </div>
        </div>

        {/* ══ Active Deliveries (shown when orders exist) ══ */}
        {orders.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-gray-900 font-bold" style={{ fontSize: '17px' }}>Active Deliveries</h2>
              <Link
                href="/dashboard/jobs"
                className="font-semibold text-sm flex items-center gap-0.5"
                style={{ color: '#00A85A' }}
              >
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {orders.map((order) => {
                const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING ?? { label: order.status, color: 'text-gray-600', bg: 'bg-gray-100' };
                const pkg = PACKAGE_TYPES[order.packageType] ?? PACKAGE_TYPES.SMALL_PARCEL ?? { label: 'Package', icon: '📦' };

                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/jobs/${order.id}`}
                    className="block bg-white rounded-2xl p-4 border border-gray-100 active:scale-[0.99] transition-transform"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}>
                        <Zap className="h-3 w-3" />
                        {status.label}
                      </span>
                      <span className="text-gray-900 font-bold text-sm tabular-nums">
                        {formatCurrency(order.totalPrice)}
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex flex-col items-center pt-0.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#00A85A' }} />
                        <div className="w-px flex-1 my-1" style={{ background: 'linear-gradient(to bottom, #00A85A80, #00B96780)' }} />
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#00B967' }} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wider mb-0.5">Pickup</p>
                          <p className="text-gray-800 text-xs font-medium truncate">{order.pickupAddress}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wider mb-0.5">Dropoff</p>
                          <p className="text-gray-800 text-xs font-medium truncate">{order.dropoffAddress}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 self-center shrink-0" />
                    </div>

                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <MapPin className="h-3 w-3" />
                        {pkg?.icon} {pkg?.label}
                      </span>
                      {order.distanceKm && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
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

        {/* ══ 6. Recommended for You ══ */}
        <div>
          <h2 className="text-gray-900 font-bold mb-3" style={{ fontSize: '17px' }}>
            Recommended for You
          </h2>

          <div className="grid grid-cols-3 gap-3">
            {/* Refer & Earn */}
            <Link
              href="/dashboard/referral"
              className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div
                className="h-11 w-11 rounded-full flex items-center justify-center mt-1"
                style={{ backgroundColor: '#EFFAF5' }}
              >
                <Gift className="h-5 w-5" style={{ color: '#00A85A' }} />
              </div>
              <span className="text-gray-900 font-bold text-[11px] text-center leading-tight">
                Refer &amp; Earn
              </span>
              <p className="text-gray-400 text-[10px] text-center leading-tight flex-1">
                Invite friends and earn exciting bonuses.
              </p>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            </Link>

            {/* Learning Center */}
            <Link
              href="/dashboard/learning"
              className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div className="h-11 w-11 rounded-full bg-blue-50 flex items-center justify-center mt-1">
                <GraduationCap className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-gray-900 font-bold text-[11px] text-center leading-tight">
                Learning Center
              </span>
              <p className="text-gray-400 text-[10px] text-center leading-tight flex-1">
                Learn, grow and be a better rider.
              </p>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            </Link>

            {/* Community */}
            <Link
              href="/dashboard/community"
              className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div className="h-11 w-11 rounded-full bg-amber-50 flex items-center justify-center mt-1">
                <Users className="h-5 w-5 text-amber-500" />
              </div>
              <span className="text-gray-900 font-bold text-[11px] text-center leading-tight">
                Community
              </span>
              <p className="text-gray-400 text-[10px] text-center leading-tight flex-1">
                Connect with other riders in your city.
              </p>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* ══ 7. Safety Center Banner ══ */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3 border"
          style={{ backgroundColor: '#EFFAF5', borderColor: '#C8F0DC' }}
        >
          <div
            className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#DFF5EA' }}
          >
            <ShieldCheck className="h-8 w-8" style={{ color: '#00A85A' }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-gray-900 font-bold text-sm">Ride Safe, Deliver Safe</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-snug">
              Follow safety guidelines and make every delivery count.
            </p>
          </div>

          <Link
            href="/dashboard/safety"
            className="shrink-0 flex items-center gap-1 bg-white font-semibold text-xs px-3 py-2 rounded-xl border active:opacity-75 transition-opacity"
            style={{ color: '#00A85A', borderColor: '#C8F0DC' }}
          >
            Safety Center
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* ══ Gamification level card (preserved) ══ */}
        {gamification && (
          <Link
            href="/dashboard/gamification"
            className="block overflow-hidden rounded-2xl border active:scale-[0.99] transition-transform"
            style={{ borderColor: '#C8F0DC', boxShadow: '0 2px 8px rgba(0,168,90,0.08)' }}
          >
            <div
              className="p-4"
              style={{ background: 'linear-gradient(135deg, rgba(0,168,90,0.08) 0%, rgba(0,185,103,0.04) 100%)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center shadow-md shrink-0"
                  style={{ background: 'linear-gradient(135deg, #008F4C 0%, #00B967 100%)' }}
                >
                  <span className="text-xl text-white font-bold">L{gamification.currentLevel}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-900 text-sm font-bold">{gamification.levelName}</span>
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(0,168,90,0.10)' }}
                    >
                      <Zap className="h-3 w-3" style={{ color: '#00A85A' }} />
                      <span className="text-xs font-bold" style={{ color: '#00A85A' }}>
                        {gamification.totalXp.toLocaleString()} XP
                      </span>
                    </div>
                  </div>

                  {!gamification.isMaxLevel && (
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'rgba(0,168,90,0.10)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(gamification.progressPercent, 100)}%`,
                          background: 'linear-gradient(to right, #008F4C, #00B967)',
                        }}
                      />
                    </div>
                  )}
                </div>

                <ChevronRight className="h-4 w-4 shrink-0" style={{ color: '#00A85A' }} />
              </div>
            </div>
          </Link>
        )}

      </div>
    </div>
  );
}
