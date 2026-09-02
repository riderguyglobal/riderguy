'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Avatar, AvatarFallback, AvatarImage, Spinner } from '@riderguy/ui';
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bike,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  Layers3,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareText,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const navigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: 'Command',
    items: [
      { label: 'Command centre', href: '/dashboard', icon: Gauge },
      { label: 'Rider operations', href: '/dashboard/riders', icon: Bike },
      { label: 'Delivery control', href: '/dashboard/orders', icon: Layers3 },
      { label: 'Service zones', href: '/dashboard/zones', icon: MapPinned },
    ],
  },
  {
    label: 'People & programmes',
    items: [
      { label: 'All accounts', href: '/dashboard/users', icon: Users },
      { label: 'Asset financing', href: '/dashboard/asset-financing', icon: BadgeDollarSign },
      { label: 'Growth engine', href: '/dashboard/gamification', icon: Sparkles },
      { label: 'Opportunities', href: '/dashboard/jobs', icon: BriefcaseBusiness },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Financials', href: '/dashboard/financials', icon: CircleDollarSign },
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
      { label: 'Support inbox', href: '/dashboard/contact', icon: MessageSquareText },
      { label: 'Workspace', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

const navigationItems = navigationGroups.flatMap((group) => group.items);

function isActivePath(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const currentPage = useMemo(
    () => navigationItems
      .filter((item) => isActivePath(pathname, item.href))
      .sort((left, right) => right.href.length - left.href.length)[0],
    [pathname],
  );

  const navigation = (
    <nav className="space-y-6 px-4 pb-5 pt-4" aria-label="Administrator navigation">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/[0.35]">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setMobileNavigationOpen(false);
                    router.push(item.href);
                  }}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-all ${
                    active
                      ? 'bg-brand-500 text-[#07110D] shadow-[0_12px_25px_-16px_rgba(64,190,137,0.95)]'
                      : 'text-white/[0.62] hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] ${active ? 'text-[#07110D]' : 'text-white/[0.42] group-hover:text-brand-400'}`} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {active ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-[#07110D] text-white">
      <div className="border-b border-white/[0.08] px-5 py-5">
        <div className="flex items-center gap-3">
          <Image
            src="/images/branding/logo-square.png"
            alt="RiderGuy"
            width={44}
            height={44}
            className="h-11 w-11 rounded-[14px] object-cover shadow-lg shadow-black/20"
            priority
          />
          <div>
            <p className="text-[15px] font-bold tracking-[-0.02em]">RiderGuy</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand-400">
              Operations
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{navigation}</div>

      <div className="m-4 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3.5">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-white/[0.68]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-400" />
          </span>
          Secure administrator session
        </div>
        <div className="flex items-center gap-2.5 border-t border-white/[0.08] pt-3">
          <Avatar className="h-9 w-9 border border-white/10">
            {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-brand-500 text-xs font-bold text-[#07110D]">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-[10px] text-white/[0.40]">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className="rounded-lg p-2 text-white/[0.45] transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ProtectedRoute
      allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}
      loadingFallback={(
        <div className="flex min-h-screen items-center justify-center bg-[#F7FAF8]">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8 text-brand-700" />
            <p className="text-xs font-semibold text-[#6A7770]">Securing your workspace…</p>
          </div>
        </div>
      )}
      onUnauthenticated={() => router.replace('/login')}
      onUnauthorised={() => router.replace('/login')}
    >
      <div className="min-h-screen bg-[#F7FAF8] lg:pl-[276px]">
        <aside className="fixed inset-y-0 left-0 z-50 hidden w-[276px] overflow-hidden lg:block">
          {sidebar}
        </aside>

        {mobileNavigationOpen ? (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-[#07110D]/55 backdrop-blur-sm"
              onClick={() => setMobileNavigationOpen(false)}
            />
            <aside className="relative h-full w-[286px] max-w-[86vw] overflow-hidden shadow-2xl">
              {sidebar}
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavigationOpen(false)}
                className="absolute right-3 top-3 rounded-xl bg-white/10 p-2 text-white lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </aside>
          </div>
        ) : null}

        <header className="sticky top-0 z-40 border-b border-[#E3EEE9]/90 bg-[#F7FAF8]/90 backdrop-blur-xl">
          <div className="flex h-[72px] items-center gap-4 px-4 sm:px-6 xl:px-8">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileNavigationOpen(true)}
              className="rounded-xl border border-[#DDE9E3] bg-white p-2.5 text-[#24322B] shadow-sm lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8A9891]">
                <Activity className="h-3 w-3 text-brand-700" />
                RiderGuy control
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-[#111814]">
                {currentPage?.label ?? 'Operations workspace'}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-[#DDEBE4] bg-white px-3 py-2 text-[11px] font-semibold text-[#52625A] shadow-sm sm:flex">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                Live · Ghana
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#DDEBE4] bg-white py-1.5 pl-1.5 pr-3 shadow-sm">
                <Avatar className="h-8 w-8">
                  {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="bg-[#0C2118] text-[10px] font-bold text-brand-400">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-36 truncate text-xs font-semibold text-[#24322B] md:inline">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-72px)] p-4 sm:p-6 xl:p-8">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
