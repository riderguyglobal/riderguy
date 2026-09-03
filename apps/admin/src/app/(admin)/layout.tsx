'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  HeartHandshake,
  Layers3,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareText,
  Settings,
  ShieldCheck,
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
      {
        label: 'Rider experience',
        href: '/dashboard/rider-experience',
        icon: HeartHandshake,
      },
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

const dispatcherNavigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: 'Delivery operations',
    items: [{ label: 'Delivery control', href: '/dashboard/orders', icon: Layers3 }],
  },
];

function isActivePath(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}

function displayRole(role?: string | null) {
  if (!role) return 'Administrator';
  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.trim().toUpperCase() || 'RG';
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);

  const hasAdministratorAccess =
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.roles?.includes(UserRole.ADMIN) === true ||
    user?.roles?.includes(UserRole.SUPER_ADMIN) === true;
  const isDispatcherOnly =
    !hasAdministratorAccess &&
    (user?.role === UserRole.DISPATCHER || user?.roles?.includes(UserRole.DISPATCHER) === true);
  const dispatcherRouteAllowed =
    pathname === '/dashboard/orders' || pathname.startsWith('/dashboard/orders/');
  const redirectingDispatcher = isDispatcherOnly && !dispatcherRouteAllowed;
  const visibleNavigationGroups = isDispatcherOnly ? dispatcherNavigationGroups : navigationGroups;

  const currentPage = useMemo(
    () =>
      visibleNavigationGroups
        .flatMap((group) => group.items)
        .filter((item) => isActivePath(pathname, item.href))
        .sort((left, right) => right.href.length - left.href.length)[0],
    [pathname, visibleNavigationGroups],
  );

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!redirectingDispatcher) return;
    setMobileNavigationOpen(false);
    router.replace('/dashboard/orders');
  }, [redirectingDispatcher, router]);

  useEffect(() => {
    if (!mobileNavigationOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      mobileCloseButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileNavigationOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !mobileDrawerRef.current) return;
      const focusableElements = Array.from(
        mobileDrawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'));

      if (focusableElements.length === 0) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [mobileNavigationOpen]);

  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'RiderGuy administrator';
  const navigationLabel = isDispatcherOnly
    ? 'Delivery operations navigation'
    : 'Administrator navigation';

  const workspaceLoading = (
    <div className="flex min-h-screen items-center justify-center bg-[#F7FAF8]">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <Spinner className="h-8 w-8 text-[#087B50]" />
        <p className="text-sm font-semibold text-[#52625A]">
          {redirectingDispatcher ? 'Opening delivery control…' : 'Securing your workspace…'}
        </p>
      </div>
    </div>
  );

  const navigation = (
    <nav className="space-y-7 px-4 pb-5 pt-5" aria-label={navigationLabel}>
      {visibleNavigationGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#52625A]">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onNavigate={() => setMobileNavigationOpen(false)}
                  className={`group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087B50] focus-visible:ring-offset-2 ${
                    active
                      ? 'bg-[#40BE89] text-[#050505] shadow-[0_14px_32px_-22px_rgba(8,123,80,0.72)]'
                      : 'text-[#34433B] hover:bg-[#F0F8F4] hover:text-[#050505]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition-colors ${
                      active
                        ? 'bg-white/55 text-[#050505]'
                        : 'bg-[#F3F8F5] text-[#52625A] group-hover:bg-white group-hover:text-[#087B50]'
                    }`}
                  >
                    <Icon className="h-[17px] w-[17px]" strokeWidth={2.15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {active ? <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden border-r border-[#DDE9E3] bg-white text-[#050505]">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#40BE89]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#40BE89]/10 blur-3xl"
      />

      <div className="relative border-b border-[#E3EEE9] px-6 py-[22px]">
        <Link
          href={isDispatcherOnly ? '/dashboard/orders' : '/dashboard'}
          className="inline-flex min-h-11 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087B50] focus-visible:ring-offset-4"
        >
          <Image
            src="/images/branding/logo-wide.png"
            alt="RiderGuy"
            width={132}
            height={32}
            className="h-auto w-[132px] object-contain"
            priority
          />
          <span className="ml-3 border-l border-[#CBDCD3] pl-3 text-[9px] font-bold uppercase leading-4 tracking-[0.18em] text-[#52625A]">
            Control
            <br />
            Centre
          </span>
        </Link>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">{navigation}</div>

      <div className="relative m-4 rounded-[18px] border border-[#D6E8DF] bg-[#F3FBF7] p-3.5">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#DCEBE4] pb-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#34433B]">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[#087B50]" />
            Ghana operations
          </div>
          <span
            className="h-2.5 w-2.5 rounded-full bg-[#40BE89] ring-4 ring-[#40BE89]/15"
            aria-hidden="true"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <Avatar className="h-10 w-10 border border-[#C9DDD3] bg-white">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={`${userName} profile`} />
            ) : null}
            <AvatarFallback className="bg-white text-xs font-bold text-[#087B50]">
              {getInitials(user?.firstName, user?.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#050505]">{userName}</p>
            <p className="mt-0.5 truncate text-[11px] text-[#52625A]">{displayRole(user?.role)}</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#52625A] transition-colors hover:bg-white hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087B50]"
          >
            <LogOut aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ProtectedRoute
      allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPATCHER]}
      loadingFallback={workspaceLoading}
      onUnauthenticated={() => router.replace('/login')}
      onUnauthorised={() => router.replace('/login')}
    >
      {redirectingDispatcher ? (
        workspaceLoading
      ) : (
        <>
          <a href="#admin-main" className="admin-skip-link">
            Skip to main content
          </a>

          <div className="min-h-screen bg-[#F7FAF8] lg:pl-[264px]">
            <aside
              className="fixed inset-y-0 left-0 z-50 hidden w-[264px] lg:block"
              aria-label={
                isDispatcherOnly ? 'RiderGuy Delivery Control' : 'RiderGuy Control Centre'
              }
            >
              {sidebar}
            </aside>

            {mobileNavigationOpen ? (
              <div className="fixed inset-0 z-[70] lg:hidden" role="presentation">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[#075C3D]/35 backdrop-blur-[3px]"
                  onClick={() => setMobileNavigationOpen(false)}
                />
                <aside
                  ref={mobileDrawerRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={navigationLabel}
                  className="relative h-full w-[304px] max-w-[88vw] overflow-hidden shadow-[24px_0_72px_-32px_rgba(5,31,20,0.5)]"
                >
                  {sidebar}
                  <button
                    ref={mobileCloseButtonRef}
                    type="button"
                    aria-label="Close navigation"
                    onClick={() => setMobileNavigationOpen(false)}
                    className="absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-xl border border-[#D6E8DF] bg-white text-[#050505] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087B50]"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </aside>
              </div>
            ) : null}

            <header className="sticky top-0 z-40 border-b border-[#DDE9E3]/90 bg-white/90 backdrop-blur-xl">
              <div className="mx-auto flex h-[76px] max-w-[1680px] items-center gap-3 px-4 sm:gap-4 sm:px-6 xl:px-8">
                <button
                  type="button"
                  aria-label="Open navigation"
                  aria-expanded={mobileNavigationOpen}
                  onClick={() => setMobileNavigationOpen(true)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#DDE9E3] bg-white text-[#24322B] shadow-sm transition-colors hover:border-[#BFD8CC] hover:bg-[#F3FBF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087B50] lg:hidden"
                >
                  <Menu aria-hidden="true" className="h-5 w-5" />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#52625A]">
                    <Activity aria-hidden="true" className="h-3.5 w-3.5 text-[#087B50]" />
                    <span className="hidden sm:inline">RiderGuy Control</span>
                    <span className="sm:hidden">Control</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-bold text-[#050505] sm:text-[15px]">
                    {currentPage?.label ?? 'Operations workspace'}
                  </p>
                </div>

                <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="hidden min-h-11 items-center gap-2 rounded-full border border-[#DDEBE4] bg-[#F8FBF9] px-4 text-xs font-semibold text-[#34433B] shadow-sm md:flex">
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-[#40BE89] ring-4 ring-[#40BE89]/15"
                      aria-hidden="true"
                    />
                    Ghana operations
                  </div>
                  <div className="flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-[#DDEBE4] bg-white p-1 shadow-sm sm:pr-3">
                    <Avatar className="h-9 w-9">
                      {user?.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt={`${userName} profile`} />
                      ) : null}
                      <AvatarFallback className="bg-[#DDF5E9] text-[11px] font-bold text-[#087B50]">
                        {getInitials(user?.firstName, user?.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-36 truncate text-xs font-semibold text-[#24322B] sm:inline">
                      {userName}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            <main
              id="admin-main"
              tabIndex={-1}
              className="mx-auto min-h-[calc(100vh-76px)] w-full max-w-[1680px] p-4 focus:outline-none sm:p-6 xl:p-8"
            >
              {children}
            </main>
          </div>
        </>
      )}
    </ProtectedRoute>
  );
}
