'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Home, ClipboardList, Wallet, User } from 'lucide-react';
import { IncomingRequest } from '@/components/incoming-request';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/jobs', label: 'Jobs', icon: ClipboardList },
  { href: '/dashboard/earnings', label: 'Earnings', icon: Wallet },
  { href: '/dashboard/settings', label: 'Account', icon: User },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  // Hide bottom nav on active job pages
  const isJobDetail = pathname.startsWith('/dashboard/jobs/') && pathname !== '/dashboard/jobs';
  const isOnboarding = pathname.startsWith('/dashboard/onboarding');
  const showBottomNav = !isJobDetail && !isOnboarding;

  return (
    <ProtectedRoute allowedRoles={[UserRole.RIDER]}>
      <div className="min-h-[100dvh] bg-surface-950">
        {children}

        {/* Bottom navigation */}
        {showBottomNav && (
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-900/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1.5 rounded-xl transition-all ${
                      isActive ? 'text-brand-400' : 'text-surface-500 active:text-surface-300'
                    }`}
                  >
                    <div className="relative">
                      <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.5} />
                      {isActive && (
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-400" />
                      )}
                    </div>
                    <span className="text-[10px] font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {/* Incoming job request overlay */}
        <IncomingRequest />
      </div>
    </ProtectedRoute>
  );
}
