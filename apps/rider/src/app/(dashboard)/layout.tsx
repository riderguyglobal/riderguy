'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Home, Package, DollarSign, User, Users } from 'lucide-react';
import { IncomingRequest } from '@/components/incoming-request';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Package },
  { href: '/dashboard/community', label: 'Community', icon: Users },
  { href: '/dashboard/earnings', label: 'Earnings', icon: DollarSign },
  { href: '/dashboard/settings', label: 'Account', icon: User },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
      <div className="min-h-[100dvh] bg-[#0a0e17] flex flex-col">
        {/* Main content */}
        <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>

        {/* Premium Bottom Navigation */}
        {!hideNav && (
          <nav className="fixed bottom-0 inset-x-0 z-50">
            {/* Frosted glass background */}
            <div className="absolute inset-0 bg-[#0a0e17]/80 backdrop-blur-xl border-t border-white/[0.06]" />

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
                        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-brand-500 shadow-[0_0_12px_rgba(14,165,233,0.6)]" />
                      )}

                      {/* Icon with glow */}
                      <div className="relative">
                        {isActive && (
                          <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-lg scale-[2]" />
                        )}
                        <Icon
                          className={`relative h-[22px] w-[22px] transition-colors duration-200 ${
                            isActive ? 'text-brand-400' : 'text-surface-500'
                          }`}
                          strokeWidth={isActive ? 2.2 : 1.8}
                        />
                      </div>

                      {/* Label */}
                      <span
                        className={`text-[10px] font-medium tracking-wide transition-colors duration-200 ${
                          isActive ? 'text-brand-400' : 'text-surface-500'
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
      </div>
    </ProtectedRoute>
  );
}
