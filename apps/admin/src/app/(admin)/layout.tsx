'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Button, Avatar, AvatarFallback, AvatarImage, Spinner } from '@riderguy/ui';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute
      allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}
      loadingFallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      }
      onUnauthenticated={() => router.replace('/login')}
      onUnauthorised={() => router.replace('/login')}
    >
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 flex-shrink-0 border-r bg-white lg:block">
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">RiderGuy Admin</span>
          </div>

          <nav className="flex flex-col gap-1 p-4">
            {[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Riders', href: '/dashboard/riders' },
              { label: 'Orders', href: '/dashboard/orders' },
              { label: 'Users', href: '/dashboard/users' },
              { label: 'Zones', href: '/dashboard/zones' },
              { label: 'Gamification', href: '/dashboard/gamification' },
              { label: 'Financials', href: '/dashboard/financials' },
              { label: 'Analytics', href: '/dashboard/analytics' },
              { label: 'Settings', href: '/dashboard/settings' },
            ].map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white px-6">
            <h2 className="text-lg font-semibold text-gray-900 lg:hidden">
              RiderGuy Admin
            </h2>

            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="Avatar" />}
                  <AvatarFallback className="bg-brand-100 text-brand-700 text-xs font-semibold">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium text-gray-700 sm:inline">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await logout();
                  router.replace('/login');
                }}
              >
                Sign out
              </Button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
