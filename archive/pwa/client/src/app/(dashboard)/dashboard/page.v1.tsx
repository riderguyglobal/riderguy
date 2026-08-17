'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import type { Order } from '@riderguy/types';
import {
  Menu,
  Bell,
  MapPin,
  ArrowRight,
  Eye,
  EyeOff,
  Plus,
  CreditCard,
  Receipt,
  ShieldCheck,
  Package,
  CheckCircle,
  Clock,
  Navigation,
  Bookmark,
  Calendar,
  Tag,
  Gift,
  Briefcase,
  Headphones,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

// ── Icons ──────────────────────────────────────────────

const DeliveryBikeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Rear wheel */}
    <circle cx="10" cy="34" r="6" fill="currentColor" opacity="0.15" />
    <circle cx="10" cy="34" r="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <circle cx="10" cy="34" r="2" fill="currentColor" />
    {/* Front wheel */}
    <circle cx="38" cy="34" r="6" fill="currentColor" opacity="0.15" />
    <circle cx="38" cy="34" r="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <circle cx="38" cy="34" r="2" fill="currentColor" />
    {/* Frame */}
    <path d="M10 34 L20 20 L30 20 L38 34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M20 20 L24 28 L38 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Handlebar */}
    <path d="M34 20 L38 16 L42 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Seat */}
    <path d="M20 20 L28 18 L30 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    {/* Delivery box */}
    <rect x="18" y="10" width="14" height="10" rx="2.5" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="1.8" />
    <path d="M18 14 L32 14" stroke="currentColor" strokeWidth="1.2" />
    <path d="M25 10 L25 14" stroke="currentColor" strokeWidth="1.2" />
    {/* Rider helmet */}
    <circle cx="35" cy="16" r="4" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M32 17 Q35 20 38 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
  </svg>
);

const WalletIllustration = ({ className = 'h-full w-full' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 160 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="walletBodyGradient" x1="35" y1="38" x2="124" y2="129" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#B8F5D1" />
        <stop offset="45%"  stopColor="#50D98E" />
        <stop offset="100%" stopColor="#07994A" />
      </linearGradient>
      <linearGradient id="walletFrontGradient" x1="52" y1="60" x2="135" y2="124" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#8DEDB9" />
        <stop offset="100%" stopColor="#05A84F" />
      </linearGradient>
      <linearGradient id="walletFlapGradient" x1="83" y1="42" x2="128" y2="84" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#DFFFF0" />
        <stop offset="100%" stopColor="#3FD67E" />
      </linearGradient>
      <radialGradient id="walletGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(83 82) rotate(90) scale(78)">
        <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.5" />
        <stop offset="60%"  stopColor="#FFFFFF" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <filter id="walletShadow" x="18" y="18" width="130" height="130" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#007A3D" floodOpacity="0.25" />
      </filter>
      <filter id="softInnerShadow" x="30" y="38" width="105" height="90" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#FFFFFF" floodOpacity="0.25" />
      </filter>
    </defs>

    <circle cx="80" cy="82" r="70" fill="url(#walletGlow)" />

    <g opacity="0.85">
      <rect x="54" y="35" width="67" height="48" rx="10" transform="rotate(-15 54 35)" fill="url(#walletFlapGradient)" />
      <rect x="64" y="31" width="65" height="48" rx="10" transform="rotate(-8 64 31)" fill="#CFFFE3" opacity="0.82" />
    </g>

    <g filter="url(#walletShadow)">
      <rect x="32" y="55" width="100" height="76" rx="22" fill="url(#walletBodyGradient)" />
      <path d="M50 77C50 70.373 55.373 65 62 65H122C128.627 65 134 70.373 134 77V113C134 119.627 128.627 125 122 125H62C55.373 125 50 119.627 50 113V77Z" fill="url(#walletFrontGradient)" filter="url(#softInnerShadow)" />
      <path d="M112 84H137C143.075 84 148 88.925 148 95C148 101.075 143.075 106 137 106H112C105.925 106 101 101.075 101 95C101 88.925 105.925 84 112 84Z" fill="#07994A" />
      <path d="M113 87H137C141.418 87 145 90.582 145 95C145 99.418 141.418 103 137 103H113C108.582 103 105 99.418 105 95C105 90.582 108.582 87 113 87Z" fill="#20C769" />
      <circle cx="133" cy="95" r="6" fill="#EFFFF5" />
      <path d="M46 66C50 60 57 59 68 59H105C116 59 124 61 128 68C119 65 106 64 91 64H67C57 64 50 65 46 66Z" fill="white" opacity="0.18" />
      <path d="M35 111C44 122 60 128 82 128H112C123 128 130 124 132 116V119C132 125.627 126.627 131 120 131H54C41.85 131 32 121.15 32 109V98C33 103 33.8 107 35 111Z" fill="#007A3D" opacity="0.18" />
    </g>
  </svg>
);

const PackagesIllustration = ({ className = 'h-full w-full' }: { className?: string }) => (
  <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Ground shadow */}
    <ellipse cx="26" cy="58" rx="18" ry="2" fill="rgba(0,0,0,0.06)" />

    {/* Main box — back */}
    {/* Top face */}
    <path d="M30 4 L52 14 L30 24 L8 14 Z" fill="#E2B98A" />
    {/* Left face */}
    <path d="M8 14 L8 32 L30 42 L30 24 Z" fill="#9E5E2A" />
    {/* Right face */}
    <path d="M30 24 L30 42 L52 32 L52 14 Z" fill="#BB7A40" />
    {/* Tape seam vertical */}
    <path d="M30 4 L30 24" stroke="#7A481A" strokeWidth="1.8" strokeLinecap="round" opacity="0.32" />
    {/* Tape seam horizontal */}
    <path d="M8 14 L52 14" stroke="#7A481A" strokeWidth="1.3" opacity="0.28" />

    {/* Small box — front-left */}
    {/* Top face */}
    <path d="M20 34 L34 40 L20 46 L6 40 Z" fill="#E2B98A" />
    {/* Left face */}
    <path d="M6 40 L6 52 L20 58 L20 46 Z" fill="#9E5E2A" />
    {/* Right face */}
    <path d="M20 46 L20 58 L34 52 L34 40 Z" fill="#BB7A40" />
    {/* Tape seam vertical */}
    <path d="M20 34 L20 46" stroke="#7A481A" strokeWidth="1.4" strokeLinecap="round" opacity="0.28" />
  </svg>
);

// ── Static data ────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Package,  label: 'Send Package',    href: '/dashboard/send'            },
  { icon: Bookmark, label: 'Saved Addresses', href: '/dashboard/saved-addresses' },
  { icon: Calendar, label: 'Schedule',        href: '/dashboard/send?schedule=1' },
  { icon: Tag,      label: 'Promos',          href: '/dashboard/promos'          },
] as const;

const RECOMMENDED = [
  { icon: Gift,       title: 'Refer & Earn',       desc: 'Invite friends, earn rewards.',    href: '/dashboard/refer'          },
  { icon: Briefcase,  title: 'Business',            desc: 'Manage bulk deliveries.',          href: '/dashboard/send'           },
  { icon: Headphones, title: 'Help & Support',      desc: "We're here 24/7.",                 href: '/dashboard/settings/help'  },
] as const;

// ── Page ───────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user, api } = useAuth();
  const [greeting, setGreeting] = useState('Good Morning');
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12)      setGreeting('Good Morning');
    else if (h < 17) setGreeting('Good Afternoon');
    else             setGreeting('Good Evening');
  }, []);

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['recent-orders'],
    queryFn: async () => {
      const res = await api!.get('/orders', { params: { limit: 20, sort: '-createdAt' } });
      return res.data.data ?? [];
    },
    enabled: !!api,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api!.get('/notifications', { params: { pageSize: '1' } });
      const all = res.data.data ?? [];
      return { unread: (all as { isRead: boolean }[]).filter(n => !n.isRead).length };
    },
    enabled: !!api,
    refetchInterval: 30_000,
  });

  const { data: walletData } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: async () => {
      const res = await api!.get('/wallets');
      return res.data.data ?? { balance: 0 };
    },
    enabled: !!api,
    staleTime: 60_000,
  });

  const unreadCount   = notifData?.unread   ?? 0;
  const walletBalance = walletData?.balance ?? 0;
  const firstName     = user?.firstName || 'there';

  const activeOrder = useMemo(
    () => orders?.find(o => ORDER_STATUS_CONFIG[o.status]?.isActive),
    [orders],
  );

  const stats = useMemo(() => ({
    active:    orders?.filter(o => ORDER_STATUS_CONFIG[o.status]?.isActive).length ?? 0,
    completed: orders?.filter(o => o.status === 'DELIVERED').length ?? 0,
    pending:   orders?.filter(o => o.status === 'PENDING' || o.status === 'SEARCHING_RIDER').length ?? 0,
  }), [orders]);

  return (
    <div className="animate-page-enter bg-white min-h-[100dvh]">

      {/* ── Top Bar ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 md:px-6 lg:px-8 border-b border-black/[0.04]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-14 items-center justify-between">
          <Link href="/dashboard/settings" className="grid h-9 w-9 place-items-center rounded-xl transition-colors active:bg-surface-100">
            <Menu className="h-5 w-5 text-surface-900" />
          </Link>
          <span className="text-[22px] font-extrabold tracking-[-0.5px] text-brand-600">Riderguy</span>
          <Link href="/dashboard/notifications" className="relative grid h-9 w-9 place-items-center rounded-xl transition-colors active:bg-surface-100">
            <Bell className="h-5 w-5 text-surface-900" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-[1.5px] ring-white" />
            )}
          </Link>
        </div>
      </header>

      {/* ── Greeting Hero ────────────────────────────────── */}
      {/*
        Mobile image: 1751×898 (2:1 ratio) — fits 390×200 with zero cropping.
        Desktop image: 2172×724 (3:1) — shown at md:h-[300px].
        Both PNGs carry a built-in left fade. The scrim below is a thin
        reinforcing layer only — 18% solid white, melting to transparent by 68%.
      */}
      <section className="relative h-[200px] md:h-[280px] lg:h-[320px] bg-white overflow-hidden">

        {/* Layer 1 — hero image */}
        <picture className="pointer-events-none absolute inset-0 w-full h-full">
          <source
            media="(min-width: 768px)"
            srcSet="/images/illustrations/riderguy-client-hero-desktop.png"
          />
          <img
            src="/images/illustrations/riderguy-client-hero.png"
            alt=""
            className="w-full h-full object-cover object-right-top"
          />
        </picture>

        {/* Layer 2 — scrim fades white on left AND right, image bleeds naturally */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'linear-gradient(90deg, #fff 0%, #fff 16%, rgba(255,255,255,0.78) 28%, rgba(255,255,255,0.18) 44%, transparent 56%, rgba(255,255,255,0.18) 74%, rgba(255,255,255,0.72) 86%, #fff 100%)',
          }}
        />

        {/* Layer 3 — greeting text */}
        <div className="absolute inset-0 z-20 flex flex-col justify-start pt-5 px-4 md:px-6 md:pt-8 lg:px-10 lg:pt-10">
          <p className="text-[13px] md:text-[15px] font-normal" style={{ color: '#9CA3AF' }}>
            {greeting}
          </p>
          <h1 className="mt-1 text-[28px] md:text-[36px] lg:text-[42px] font-black leading-[1.05] tracking-tight text-gray-900">
            {firstName}<span className="ml-1 text-[22px] md:text-[28px]">👋</span>
          </h1>
          <p className="mt-2 text-[12.5px] md:text-[14px] font-normal leading-[1.45]" style={{ color: '#9CA3AF' }}>
            What would you like<br />to send today?
          </p>
        </div>

      </section>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="pb-8">

        {/* Responsive grid: single column on mobile, 2 columns on tablet/desktop */}
        <div className="md:grid md:grid-cols-2 md:gap-5 md:px-5 md:pt-4 lg:gap-6 lg:px-8 lg:pt-5 space-y-4 md:space-y-0">

          {/* ── Left column ── */}
          <div className="space-y-4">

            {/* Send CTA */}
            <section className="px-4 -mt-1 md:px-0 md:mt-0">
              <button
                onClick={() => router.push('/dashboard/quick-send')}
                className="flex w-full items-center gap-3 rounded-[18px] bg-white p-3.5 text-left ring-1 ring-black/[0.06] transition-transform active:scale-[0.99]"
                style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.07)' }}
              >
                <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-black leading-tight text-surface-900">
                    Where are you sending?
                  </h2>
                  <p className="mt-0.5 text-[11px] text-surface-400">
                    Enter pickup and drop-off locations
                  </p>
                </div>
                <div
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-white"
                  style={{
                    background: 'linear-gradient(135deg, #10B85A 0%, #018C42 100%)',
                    boxShadow: '0 3px 10px rgba(0,140,66,0.30)',
                  }}
                >
                  <ArrowRight className="h-5 w-5" />
                </div>
              </button>
            </section>

            {/* Wallet Card */}
            <section className="px-4 md:px-0">
              <div
                className="relative overflow-hidden rounded-[20px] p-4 text-white"
                style={{
                  background: 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.18), transparent 30%), linear-gradient(135deg, #0AB957 0%, #008F45 100%)',
                  boxShadow: '0 10px 28px rgba(0,150,70,0.22)',
                }}
              >
                {/* Soft blur glow */}
                <div className="pointer-events-none absolute right-[-14px] top-[-14px] h-28 w-28 rounded-full bg-white/15 blur-2xl" />

                {/* Balance row */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/80">
                      <span>Wallet Balance</span>
                      <button
                        onClick={() => setBalanceVisible(v => !v)}
                        className="transition-opacity active:opacity-70"
                        aria-label="Toggle balance visibility"
                      >
                        {balanceVisible
                          ? <Eye className="h-3.5 w-3.5 text-white/70" />
                          : <EyeOff className="h-3.5 w-3.5 text-white/70" />
                        }
                      </button>
                    </div>
                    <p className="mt-1.5 text-[26px] font-black leading-none tracking-[-0.03em]">
                      {balanceVisible ? formatCurrency(walletBalance) : '• • • • •'}
                    </p>
                    <div className="mt-2 inline-flex items-center rounded-full bg-black/10 px-2.5 py-[3px] text-[10px] font-medium text-white/85">
                      Instant top-ups • Secure payments
                    </div>
                  </div>

                  {/* Wallet illustration */}
                  <div className="ml-3 h-14 w-14 flex-shrink-0">
                    <WalletIllustration />
                  </div>
                </div>

                {/* Divider */}
                <div className="relative z-10 mt-3 h-px bg-white/[0.22]" />

                {/* Actions */}
                <div className="relative z-10 mt-3 grid grid-cols-3 text-[11px] font-semibold">
                  <Link
                    href="/dashboard/wallet/add-funds"
                    className="flex items-center justify-center gap-1.5 border-r border-white/25 py-0.5 transition-transform active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Add Money</span>
                  </Link>
                  <Link
                    href="/dashboard/wallet"
                    className="flex items-center justify-center gap-1.5 border-r border-white/25 py-0.5 transition-transform active:scale-95"
                  >
                    <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Pay Now</span>
                  </Link>
                  <Link
                    href="/dashboard/wallet"
                    className="flex items-center justify-center gap-1.5 py-0.5 transition-transform active:scale-95"
                  >
                    <Receipt className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>History</span>
                  </Link>
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="grid grid-cols-4 gap-2.5 px-4 md:px-0">
              {QUICK_ACTIONS.map(({ icon: Icon, label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[16px] bg-white px-1.5 py-3 text-center ring-1 ring-black/[0.06] transition-transform active:scale-95"
                  style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}
                >
                  <Icon className="h-5 w-5 text-brand-600" />
                  <span className="text-[9.5px] font-bold leading-tight text-surface-700">{label}</span>
                </Link>
              ))}
            </section>

          </div>

          {/* ── Right column ── */}
          <div className="space-y-4">

            {/* Today's Overview */}
            <section className="px-4 md:px-0">
              <div className="rounded-[18px] bg-white p-4 ring-1 ring-black/[0.06]">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-black text-surface-900">Today's Overview</h3>
                  <Link href="/dashboard/orders" className="text-[11px] font-semibold text-brand-600">View all</Link>
                </div>
                <div className="grid grid-cols-3 divide-x divide-surface-100">

                  {/* Active */}
                  <div className="flex flex-col items-center gap-1.5 pr-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <DeliveryBikeIcon className="h-[18px] w-[18px]" />
                    </div>
                    <p className="text-[9px] font-medium text-surface-400 leading-tight text-center">Active<br />Deliveries</p>
                    <p className="text-[17px] font-black leading-none text-brand-600">
                      {ordersLoading ? '–' : stats.active}
                    </p>
                  </div>

                  {/* Completed */}
                  <div className="flex flex-col items-center gap-1.5 px-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                      <CheckCircle className="h-[18px] w-[18px]" />
                    </div>
                    <p className="text-[9px] font-medium text-surface-400 leading-tight text-center">Completed<br />Orders</p>
                    <p className="text-[17px] font-black leading-none text-emerald-600">
                      {ordersLoading ? '–' : stats.completed}
                    </p>
                  </div>

                  {/* Pending */}
                  <div className="flex flex-col items-center gap-1.5 pl-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-500">
                      <Clock className="h-[18px] w-[18px]" />
                    </div>
                    <p className="text-[9px] font-medium text-surface-400 leading-tight text-center">Pending<br />Orders</p>
                    <p className="text-[17px] font-black leading-none text-amber-500">
                      {ordersLoading ? '–' : stats.pending}
                    </p>
                  </div>

                </div>
              </div>
            </section>

            {/* Track Current Delivery */}
            <section className="px-4 md:px-0">
              <div
                className="rounded-[20px] p-3.5"
                style={{ background: '#F0FAF4', border: '1px solid rgba(5,150,70,0.10)' }}
              >
                <h3 className="mb-3 text-[13px] font-black text-surface-900">Track Current Delivery</h3>

                {activeOrder ? (
                  <div className="grid grid-cols-[70px_1fr_82px] items-stretch gap-2.5">

                    {/* Mini map */}
                    <div className="relative h-[96px] overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.04]">
                      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 70 96" fill="none">
                        <path
                          d="M22 82 C22 72 16 62 24 50 C32 38 46 42 46 30 C46 20 46 14 46 14"
                          stroke="#0AB957"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="22" cy="82" r="6" fill="#0AB957" opacity="0.12" />
                        <circle cx="22" cy="82" r="4" fill="white" stroke="#0AB957" strokeWidth="2" />
                        <circle cx="22" cy="82" r="1.8" fill="#0AB957" />
                        <circle cx="46" cy="14" r="8" fill="#0AB957" opacity="0.12" />
                        <circle cx="46" cy="14" r="5" fill="#0AB957" />
                        <circle cx="46" cy="14" r="2.2" fill="white" />
                      </svg>
                    </div>

                    {/* Order details */}
                    <div className="flex min-w-0 flex-col justify-center gap-[5px]">
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-500/10 px-2 py-[3px]">
                        <span className="h-[5px] w-[5px] rounded-full bg-brand-500" />
                        <span className="text-[9px] font-bold uppercase tracking-wide text-brand-700">
                          {ORDER_STATUS_CONFIG[activeOrder.status]?.label ?? 'On the way'}
                        </span>
                      </span>
                      <p className="text-[11px] font-bold leading-tight text-surface-800">
                        Order #{activeOrder.id.slice(-6).toUpperCase()}
                      </p>
                      <p className="truncate text-[9px] leading-snug text-surface-500">
                        <span className="font-semibold text-surface-600">Pickup:</span>{' '}
                        {activeOrder.pickupAddress}
                      </p>
                      <p className="truncate text-[9px] leading-snug text-surface-500">
                        <span className="font-semibold text-surface-600">Drop-off:</span>{' '}
                        {activeOrder.dropoffAddress}
                      </p>
                    </div>

                    {/* Packages + Track button */}
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-1 items-center justify-center rounded-xl bg-white/70">
                        <PackagesIllustration className="h-[62px] w-[62px]" />
                      </div>
                      <button
                        onClick={() => router.push(`/dashboard/orders/${activeOrder.id}/tracking`)}
                        className="flex w-full items-center justify-center gap-1 rounded-xl bg-[#0AB957] py-[7px] text-[9.5px] font-bold text-white transition-transform active:scale-95"
                      >
                        <Navigation className="h-2.5 w-2.5" />
                        Track Order
                      </button>
                    </div>

                  </div>
                ) : (
                  /* No active order — placeholder */
                  <div className="grid grid-cols-[70px_1fr_82px] items-stretch gap-2.5">

                    {/* Mini map placeholder */}
                    <div className="relative h-[96px] overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.04]">
                      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 70 96" fill="none">
                        <path
                          d="M22 82 C22 72 16 62 24 50 C32 38 46 42 46 30 C46 20 46 14 46 14"
                          stroke="#C8E6D6"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="5 4"
                        />
                        <circle cx="22" cy="82" r="4" fill="white" stroke="#C8E6D6" strokeWidth="2" />
                        <circle cx="46" cy="14" r="5" fill="#C8E6D6" />
                        <circle cx="46" cy="14" r="2.2" fill="white" />
                      </svg>
                    </div>

                    {/* Empty state text */}
                    <div className="flex min-w-0 flex-col justify-center gap-1.5">
                      <p className="text-[11.5px] font-bold leading-tight text-surface-700">No active delivery</p>
                      <p className="text-[9.5px] leading-snug text-surface-400">
                        Your live tracking will appear here once you place an order.
                      </p>
                      <Link
                        href="/dashboard/quick-send"
                        className="mt-0.5 inline-flex w-fit items-center gap-1 text-[9.5px] font-bold text-brand-600"
                      >
                        Send a package <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* Packages + Send button */}
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-1 items-center justify-center rounded-xl bg-white/70">
                        <PackagesIllustration className="h-[62px] w-[62px]" />
                      </div>
                      <button
                        onClick={() => router.push('/dashboard/quick-send')}
                        className="flex w-full items-center justify-center gap-1 rounded-xl bg-[#0AB957] py-[7px] text-[9.5px] font-bold text-white transition-transform active:scale-95"
                      >
                        Send Now
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </section>

            {/* Recommended */}
            <section className="px-4 md:px-0">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-[14px] font-black text-surface-900">Recommended for You</h3>
                <button className="text-[12px] font-semibold text-brand-600">View all</button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {RECOMMENDED.map(({ icon: Icon, title, desc, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col rounded-[16px] bg-white p-2.5 ring-1 ring-black/[0.06] transition-transform active:scale-95"
                    style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}
                  >
                    <div className="mb-1.5 grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-brand-600">
                      <Icon className="h-[15px] w-[15px]" />
                    </div>
                    <h4 className="text-[10px] font-black leading-tight text-surface-900">{title}</h4>
                    <p className="mt-0.5 text-[9px] leading-snug text-surface-400">{desc}</p>
                    <div className="mt-auto pt-1.5 flex justify-end">
                      <ChevronRight className="h-3 w-3 text-surface-300" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Safety Card */}
            <section className="px-4 md:px-0">
              <div
                className="flex items-center gap-3 rounded-[18px] bg-[#F1FBF5] p-3.5"
                style={{ outline: '1px solid rgba(0,140,66,0.08)' }}
              >
                <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white text-brand-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[12.5px] font-black text-surface-900">Pack Smart, Ship Safe</h3>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-surface-500">
                    Use sturdy packaging for safe delivery.
                  </p>
                </div>
                <button className="h-8 flex-shrink-0 rounded-lg border border-brand-500/40 bg-white px-2.5 text-[10.5px] font-bold text-brand-600 whitespace-nowrap transition-transform active:scale-95">
                  Tips
                </button>
              </div>
            </section>

          </div>

        </div>
      </div>
    </div>
  );
}
