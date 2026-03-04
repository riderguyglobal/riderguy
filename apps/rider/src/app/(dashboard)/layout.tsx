'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Home, Package, DollarSign, User, Users } from 'lucide-react';
import { IncomingRequest } from '@/components/incoming-request';
import { SecuritySetupPrompt } from '@/components/security-setup-prompt';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Package },
  { href: '/dashboard/community', label: 'Community', icon: Users },
  { href: '/dashboard/earnings', label: 'Earnings', icon: DollarSign },
  { href: '/dashboard/settings', label: 'Account', icon: User },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  const hideNav =
    pathname.startsWith('/dashboard/jobs/') ||
    pathname.startsWith('/dashboard/onboarding') ||
    pathname.startsWith('/dashboard/gamification') ||
    pathname.startsWith('/dashboard/community/chat/') ||
    pathname.startsWith('/dashboard/community/forum/') ||
    pathname.startsWith('/dashboard/community/zones') ||
    pathname.startsWith('/dashboard/community/mentorship') ||
    pathname.startsWith('/dashboard/community/events') ||
    pathname.startsWith('/dashboard/community/feature-requests') ||
    pathname.startsWith('/dashboard/community/spotlights') ||
    pathname.startsWith('/dashboard/community/profile');

  return (
    <ProtectedRoute allowedRoles={[UserRole.RIDER]}>
      <div className="min-h-[100dvh] bg-page flex flex-col">
        {/* Main content */}
        <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>

        {/* Premium Bottom Navigation */}
        {!hideNav && (
          <nav className="fixed bottom-0 inset-x-0 z-50">
            {/* Frosted glass background with top accent line */}
            <div className="absolute inset-0 bg-nav backdrop-blur-xl border-t border-brand-500/10 dark:border-themed" />

            {/* Ambient glow from active tab */}
            <div className="relative px-4 pb-[env(safe-area-inset-bottom)]">
              <div className="flex items-center justify-around h-[4.5rem]">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative flex flex-col items-center justify-center gap-1 py-2 px-4 btn-press"
                    >
                      {/* Active indicator pill */}
                      {isActive && (
                        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full bg-gradient-to-r from-brand-500 to-accent-500 shadow-[0_2px_12px_rgba(34,197,94,0.5)]" />
                      )}

                      {/* Icon with glow */}
                      <div className="relative">
                        {isActive && (
                          <div className="absolute inset-0 bg-brand-500/15 rounded-full blur-xl scale-[2.5]" />
                        )}
                        <Icon
                          className={`relative h-[22px] w-[22px] transition-colors duration-200 ${
                            isActive ? 'text-brand-500 dark:text-brand-400' : 'text-subtle'
                          }`}
                          strokeWidth={isActive ? 2.2 : 1.8}
                        />
                      </div>

                      {/* Label */}
                      <span
                        className={`text-[10px] font-semibold tracking-wide transition-colors duration-200 ${
                          isActive ? 'text-brand-600 dark:text-brand-400' : 'text-subtle'
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        )}

        {/* Incoming delivery request overlay */}
        <IncomingRequest />

        {/* One-time prompt to set up faster login (PIN/biometric) */}
        <SecuritySetupPrompt />
      </div>
    </ProtectedRoute>
  );
}
