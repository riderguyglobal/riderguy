'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Button, Avatar, AvatarFallback, AvatarImage, Spinner } from '@riderguy/ui';

// ============================================================
// Rider Dashboard Layout — wraps all (dashboard) pages
// ============================================================

const NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: '🏠' },
  { label: 'Jobs', href: '/dashboard/jobs', icon: '🛵' },
  { label: 'Onboarding', href: '/dashboard/onboarding', icon: '📝' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute
      allowedRoles={[UserRole.RIDER]}
      loadingFallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      }
      onUnauthenticated={() => router.replace('/login')}
      onUnauthorised={() => router.replace('/login')}
    >
      <div className="flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="Avatar" />}
              <AvatarFallback className="bg-brand-100 text-brand-700 text-sm font-semibold">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-400">Rider</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              router.replace('/');
            }}
          >
            Sign out
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-16">{children}</main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white safe-area-bottom">
          <div className="flex items-center justify-around py-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                    isActive ? 'text-brand-500 font-semibold' : 'text-gray-400'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </ProtectedRoute>
  );
}
