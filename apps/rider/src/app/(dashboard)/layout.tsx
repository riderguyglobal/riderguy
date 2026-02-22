'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Avatar, AvatarFallback, AvatarImage, Spinner } from '@riderguy/ui';

// ============================================================
// Rider Dashboard Layout — Bolt/Uber-inspired mobile-first
// ============================================================

// SVG icon components for crisp bottom nav
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#0ea5e9' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      {active && <path d="M9 22V12h6v10" fill="#0ea5e9" opacity="0.15" />}
    </svg>
  );
}
function BriefcaseIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'rgba(14,165,233,0.12)' : 'none'} stroke={active ? '#0ea5e9' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}
function WalletIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'rgba(14,165,233,0.12)' : 'none'} stroke={active ? '#0ea5e9' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" />
      <path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#0ea5e9' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" fill={active ? 'rgba(14,165,233,0.15)' : 'none'} />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', Icon: HomeIcon },
  { label: 'Jobs', href: '/dashboard/jobs', Icon: BriefcaseIcon },
  { label: 'Earnings', href: '/dashboard/earnings', Icon: WalletIcon },
  { label: 'Account', href: '/dashboard/settings', Icon: UserIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <ProtectedRoute
      allowedRoles={[UserRole.RIDER]}
      loadingFallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-50">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-12 w-12">
              <Image src="/images/branding/logo-black.png" alt="RiderGuy" fill className="object-contain" />
            </div>
            <Spinner className="h-6 w-6 text-brand-500" />
          </div>
        </div>
      }
      onUnauthenticated={() => router.replace('/login')}
      onUnauthorised={() => router.replace('/login')}
    >
      <div className="flex min-h-screen flex-col bg-surface-50">
        {/* ── Minimal Top Bar ── */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-surface-100">
          <div className="flex items-center justify-between px-4 h-14">
            {/* Logo + Brand */}
            <div className="flex items-center gap-2.5">
              <div className="relative h-8 w-8">
                <Image src="/images/branding/logo-black.png" alt="RiderGuy" fill className="object-contain" />
              </div>
              <span className="text-sm font-bold text-surface-900 tracking-tight">
                RiderGuy
              </span>
            </div>

            {/* Avatar */}
            <button
              onClick={() => router.push('/dashboard/settings')}
              className="flex items-center gap-2 rounded-full p-0.5 transition-all hover:ring-2 hover:ring-brand-200 active:scale-95"
            >
              <Avatar className="h-8 w-8 ring-2 ring-surface-100">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="Avatar" />}
                <AvatarFallback className="bg-brand-500 text-white text-xs font-bold">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 pb-20 animate-fade-in">{children}</main>

        {/* ── Bottom Navigation — Bolt/Uber style ── */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-surface-100 safe-area-bottom">
          <div className="flex items-stretch justify-around h-16">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                    isActive ? 'text-brand-500' : 'text-surface-400'
                  }`}
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-brand-500 dash-nav-indicator" />
                  )}
                  <item.Icon active={isActive} />
                  <span className={`text-[10px] font-medium ${isActive ? 'text-brand-500' : 'text-surface-400'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </ProtectedRoute>
  );
}
