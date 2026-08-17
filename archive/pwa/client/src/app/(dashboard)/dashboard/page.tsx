'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';

import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import type { Order } from '@riderguy/types';
import {
  Bell,
  ArrowRight,
  User,
  ChevronRight,
  Package,
} from 'lucide-react';
import Link from 'next/link';

// ── Utility action data ────────────────────────────────

const UTILITY_ACTIONS = [
  { label: 'Schedule\nDelivery', icon: 'schedule', href: '/dashboard/send?schedule=1'   },
  { label: 'Track\nOrders',      icon: 'track',    href: '/dashboard/track'              },
  { label: 'Saved\nAddresses',   icon: 'saved',    href: '/dashboard/saved-addresses'   },
  { label: 'Rider\nWizard',      icon: 'rider',    href: '/dashboard/rider-genius'      },
  { label: 'Refer & Earn',       icon: 'refer',    href: '/dashboard/promos'            },
  { label: 'Safety\nCenter',     icon: 'safety',   href: '/dashboard/safety-center'    },
  { label: 'Support',            icon: 'support',  href: '/dashboard/settings/help'    },
  { label: 'More',               icon: 'more',     href: '/dashboard/settings'         },
];

// ── Utility icon set ───────────────────────────────────

function UtilityIcon({ name, className = 'h-[31px] w-[31px]' }: { name: string; className?: string }) {
  const stroke = {
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const icons: Record<string, React.ReactNode> = {
    schedule: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
        <path d="M22.8 8.2A10.5 10.5 0 1 0 25.9 16" {...stroke}/>
        <path d="M22.8 3.8v4.4h4.4" {...stroke}/>
        <path d="M16 10.2v6.1l4.1 2.5" {...stroke}/>
        <circle cx="16" cy="16.3" r="1.2" fill="currentColor"/>
      </svg>
    ),
    track: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
        <path d="M16 28s8.7-7.2 8.7-15.1A8.7 8.7 0 0 0 7.3 12.9C7.3 20.8 16 28 16 28Z" {...stroke}/>
        <circle cx="16" cy="12.9" r="3.2" {...stroke}/>
        <circle cx="16" cy="12.9" r="1" fill="currentColor"/>
      </svg>
    ),
    saved: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
        <path d="M16 4.5l3.45 7 7.75 1.12-5.6 5.45 1.32 7.68L16 22.1l-6.92 3.65 1.32-7.68-5.6-5.45 7.75-1.12L16 4.5Z" {...stroke}/>
      </svg>
    ),
    rider: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
        <circle cx="16" cy="10.8" r="5.2" {...stroke}/>
        <path d="M7.4 27c1.25-5.7 4.65-8.8 8.6-8.8s7.35 3.1 8.6 8.8" {...stroke}/>
        <path d="M12.8 10.8h.01M19.2 10.8h.01" {...stroke}/>
      </svg>
    ),
    refer: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
        <rect x="7" y="13.2" width="18" height="13.3" rx="1.8" {...stroke}/>
        <rect x="5.3" y="8.6" width="21.4" height="5.2" rx="1.7" {...stroke}/>
        <path d="M16 8.6v17.9" {...stroke}/>
        <path d="M16 8.6h-4.4a3.2 3.2 0 1 1 3.2-3.2C14.8 7.2 16 8.6 16 8.6Z" {...stroke}/>
        <path d="M16 8.6h4.4a3.2 3.2 0 1 0-3.2-3.2C17.2 7.2 16 8.6 16 8.6Z" {...stroke}/>
      </svg>
    ),
    safety: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
        <path d="M16 28s10.2-4.9 10.2-14.2V7.2L16 3.8 5.8 7.2v6.6C5.8 23.1 16 28 16 28Z" {...stroke}/>
        <path d="M11.8 15.8l3 3 5.7-6.2" {...stroke}/>
      </svg>
    ),
    support: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
        <path d="M6.8 17.8v-2.2a9.2 9.2 0 0 1 18.4 0v2.2" {...stroke}/>
        <path d="M6.8 17.8h4.1v6H8.5a1.7 1.7 0 0 1-1.7-1.7v-4.3Z" {...stroke}/>
        <path d="M25.2 17.8h-4.1v6h2.4a1.7 1.7 0 0 0 1.7-1.7v-4.3Z" {...stroke}/>
        <path d="M21.1 23.8c0 2.2-1.8 3.4-5.1 3.4" {...stroke}/>
        <path d="M14.1 27.2h3.8" {...stroke}/>
      </svg>
    ),
    more: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
        <circle cx="10.5" cy="16" r="2.15" fill="currentColor"/>
        <circle cx="16" cy="16" r="2.15" fill="currentColor"/>
        <circle cx="21.5" cy="16" r="2.15" fill="currentColor"/>
      </svg>
    ),
  };
  return <>{icons[name] ?? null}</>;
}

// ── Service card icons ─────────────────────────────────

function SendPackageIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* top face */}
      <path d="M12 3L21 7.5L12 12L3 7.5L12 3Z" fill="#0AB957" fillOpacity="0.18" stroke="#0AB957" strokeWidth="1.4" strokeLinejoin="round"/>
      {/* left face */}
      <path d="M3 7.5V15.5L12 20V12L3 7.5Z" fill="#0AB957" fillOpacity="0.07" stroke="#0AB957" strokeWidth="1.4" strokeLinejoin="round"/>
      {/* right face */}
      <path d="M21 7.5V15.5L12 20V12L21 7.5Z" fill="#0AB957" fillOpacity="0.14" stroke="#0AB957" strokeWidth="1.4" strokeLinejoin="round"/>
      {/* tape cross */}
      <path d="M12 3V12" stroke="#0AB957" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M7.5 5.25L16.5 9.75" stroke="#0AB957" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function BookRideIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id="bikeGreen" x1="12" y1="18" x2="52" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#20C863"/>
          <stop offset="100%" stopColor="#08994A"/>
        </linearGradient>
        <filter id="softShadow" x="4" y="10" width="56" height="44" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.12"/>
        </filter>
      </defs>
      <g filter="url(#softShadow)">
        <circle cx="18" cy="44" r="8" fill="white" stroke="#1F2937" strokeWidth="3"/>
        <circle cx="46" cy="44" r="8" fill="white" stroke="#1F2937" strokeWidth="3"/>
        <circle cx="18" cy="44" r="2" fill="#1F2937"/>
        <circle cx="46" cy="44" r="2" fill="#1F2937"/>
        <path d="M22 44L28 32H38L43 44" stroke="url(#bikeGreen)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M25 32H36C38.8 32 40.5 33 42 35L46 40" stroke="url(#bikeGreen)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M28 24C28 22.9 28.9 22 30 22H37C39.3 22 41 23.7 41 26V28H30C28.9 28 28 27.1 28 26V24Z" fill="url(#bikeGreen)"/>
        <path d="M25 29H34C35.4 29 36.6 29.6 37.5 30.7L38 31.3H27.5C26.4 31.3 25.4 30.8 24.8 29.9L24.2 29H25Z" fill="#1F2937"/>
        <path d="M39 23L44 20" stroke="#1F2937" strokeWidth="3" strokeLinecap="round"/>
        <path d="M44 20H48" stroke="#1F2937" strokeWidth="3" strokeLinecap="round"/>
        <path d="M44 28L46 36" stroke="#1F2937" strokeWidth="3" strokeLinecap="round"/>
        <path d="M28 32L22 44" stroke="#1F2937" strokeWidth="3" strokeLinecap="round"/>
        <path d="M31 32L18 44" stroke="#1F2937" strokeWidth="3" strokeLinecap="round"/>
        <path d="M31 36H38" stroke="#1F2937" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="45.5" cy="28" r="2.2" fill="#FACC15" stroke="#1F2937" strokeWidth="1.5"/>
        <path d="M24 28L20 25" stroke="#1F2937" strokeWidth="3" strokeLinecap="round"/>
      </g>
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user, api } = useAuth();

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

  const unreadCount  = notifData?.unread ?? 0;
  const firstName    = user?.firstName ?? '';
  const lastName     = user?.lastName  ?? '';
  const initials     = (firstName[0] ?? '') + (lastName[0] ?? '');
  const recentOrders = useMemo(() => orders?.slice(0, 3) ?? [], [orders]);

  return (
    <div className="animate-page-enter min-h-[100dvh] bg-[#F4F4F4]">

      {/* ── Header ───────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 bg-white border-b border-black/[0.05] px-4"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-14 items-center justify-between">
          <span className="text-[22px] font-black tracking-tight text-gray-900">riderguy</span>
          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-xl"
            >
              <Bell className="h-[22px] w-[22px] text-gray-700" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#0AB957] ring-[1.5px] ring-white" />
              )}
            </Link>
            <Link
              href="/dashboard/settings/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0AB957] overflow-hidden"
            >
              {initials ? (
                <span className="text-[12px] font-bold text-white">{initials.toUpperCase()}</span>
              ) : (
                <User className="h-4 w-4 text-white" />
              )}
            </Link>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 pb-8 pt-4">

        {/* ── Hero Banner ──────────────────────────────── */}
        <div className="relative h-[145px] overflow-hidden rounded-[20px]">
          {/* Rectangular crop — rider anchored top-right, waist-up visible */}
          <img
            src="/images/illustrations/header-hero-client.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[right_top]"
          />

          {/* Text — left 46%, fully clear of rider */}
          <div className="absolute inset-0 flex flex-col justify-center pl-4 pr-1 w-[46%]">
            <div
              className="mb-1.5 inline-block w-fit rounded-full px-2 py-[2px] text-[7.5px] font-normal tracking-wide text-white"
              style={{ background: 'rgba(0,0,0,0.50)' }}
            >
              Fast. Safe. Reliable.
            </div>
            <h1 className="text-[13px] font-medium leading-[1.25] text-white">
              Deliveries made easy with Riderguy
            </h1>
            <p className="mt-0.5 text-[8.5px] font-light text-white/75">
              Your packages, our priority.
            </p>
            <button
              onClick={() => router.push('/dashboard/quick-send')}
              className="mt-2 flex w-fit items-center gap-1 rounded-[8px] bg-white px-2.5 py-1 text-[7.5px] font-medium text-gray-900 active:scale-95 transition-transform"
            >
              Send a Package
              <ArrowRight className="h-2 w-2 text-[#0AB957]" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ── What would you like to do? ───────────────── */}
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-gray-900">
            What would you like to do?
          </h2>
          <div className="grid grid-cols-2 gap-3">

            {/* Send a Package */}
            <button
              onClick={() => router.push('/dashboard/quick-send')}
              className="flex flex-col rounded-[16px] bg-[#EEF9F2] px-3 py-3 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2">
                <SendPackageIcon />
                <span className="flex-1 text-[11px] font-medium leading-tight text-gray-900">Quick Delivery</span>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-[#0AB957]" strokeWidth={2} />
              </div>
              <p className="mt-1.5 pl-[34px] text-[9px] font-light leading-snug text-gray-500">
                Deliver items to anywhere, anytime.
              </p>
            </button>

            {/* Book a Ride */}
            <button
              onClick={() => router.push('/dashboard/book-ride')}
              className="flex flex-col rounded-[16px] bg-[#EDF2FD] px-3 py-3 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2">
                <BookRideIcon />
                <span className="flex-1 text-[11px] font-medium leading-tight text-gray-900">Book a Ride</span>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-[#4A80F0]" strokeWidth={2} />
              </div>
              <p className="mt-1.5 pl-[34px] text-[9px] font-light leading-snug text-gray-500">
                Get a ride to your destination safely.
              </p>
            </button>

          </div>
        </section>

        {/* ── Quick Actions ─────────────────────────────── */}
        <section>
          <div className="overflow-hidden rounded-[20px] border border-[#ECEFEC] bg-white shadow-[0_10px_28px_rgba(17,24,39,0.045)]">
            <div className="grid grid-cols-4">
              {UTILITY_ACTIONS.map(({ label, icon, href }, index) => {
                const isRightEdge = (index + 1) % 4 === 0;
                const isBottomRow = index >= 4;
                return (
                  <Link
                    key={label}
                    href={href}
                    aria-label={label.replace('\n', ' ')}
                    className={[
                      'group relative flex h-[72px] flex-col items-center justify-center bg-white px-1.5 text-center',
                      'transition duration-150 ease-out active:scale-[0.97] active:bg-[#F8FCFA]',
                      !isRightEdge ? 'border-r border-[#EEEEEE]' : '',
                      !isBottomRow ? 'border-b border-[#EEEEEE]' : '',
                    ].join(' ')}
                  >
                    <div className="mb-1.5 flex h-[22px] w-[22px] items-center justify-center text-[#0FA958] transition duration-150 group-active:scale-95">
                      <UtilityIcon name={icon} className="h-[20px] w-[20px]" />
                    </div>
                    <span className="whitespace-pre-line text-[9.5px] font-extrabold leading-[1.12] tracking-[-0.02em] text-[#111111]">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>


        {/* ── Recent Orders ─────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-black text-gray-900">Recent Orders</h2>
            <Link href="/dashboard/orders" className="text-[13px] font-semibold text-[#0AB957]">
              View all
            </Link>
          </div>

          {ordersLoading ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-[74px] animate-pulse rounded-[16px] bg-white" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center rounded-[18px] bg-white py-8">
              <Package className="mb-2 h-9 w-9 text-gray-200" />
              <p className="text-[13px] font-semibold text-gray-400">No orders yet</p>
              <button
                onClick={() => router.push('/dashboard/quick-send')}
                className="mt-3 rounded-full bg-[#0AB957] px-4 py-2 text-[12px] font-bold text-white"
              >
                Send your first package
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentOrders.map(order => {
                const cfg     = ORDER_STATUS_CONFIG[order.status];
                const date    = new Date(order.createdAt);
                const dateStr = date.toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                }) + ' • ' + date.toLocaleTimeString('en-GB', {
                  hour: '2-digit', minute: '2-digit',
                });
                const statusColor =
                  order.status === 'DELIVERED'
                    ? 'bg-[#EEF9F2] text-[#0AB957]'
                    : cfg?.isActive
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-gray-100 text-gray-500';

                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center gap-3 rounded-[16px] bg-white p-4 active:bg-gray-50 transition-colors"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#EEF9F2]">
                      <Package className="h-5 w-5 text-[#0AB957]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900">
                        Order #{order.orderNumber}
                      </p>
                      <p className="mt-[2px] truncate text-[11px] text-gray-500">
                        {order.pickupAddress} → {order.dropoffAddress}
                      </p>
                      <p className="mt-[2px] text-[10px] text-gray-400">{dateStr}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      <span className={`rounded-full px-2.5 py-[3px] text-[10px] font-semibold ${statusColor}`}>
                        {cfg?.label ?? order.status}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
