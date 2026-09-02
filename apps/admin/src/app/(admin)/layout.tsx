'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import Image from 'next/image';
import { Button, Avatar, AvatarFallback, AvatarImage, Spinner } from '@riderguy/ui';
import { Menu, X } from 'lucide-react';

const navigationItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Rider Operations', href: '/dashboard/riders' },
  { label: 'Asset Financing', href: '/dashboard/asset-financing' },
  { label: 'Orders', href: '/dashboard/orders' },
  { label: 'Users', href: '/dashboard/users' },
  { label: 'Zones', href: '/dashboard/zones' },
  { label: 'Gamification', href: '/dashboard/gamification' },
  { label: 'Jobs', href: '/dashboard/jobs' },
  { label: 'Financials', href: '/dashboard/financials' },
  { label: 'Analytics', href: '/dashboard/analytics' },
  { label: 'Messages', href: '/dashboard/contact' },
  { label: 'Settings', href: '/dashboard/settings' },
];

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const navigation = (
    <nav className="flex flex-col gap-1 p-4">
      {navigationItems.map((item) => {
        const active = item.href === '/dashboard'
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <button
            key={item.href}
            onClick={() => {
              setMobileNavigationOpen(false);
              router.push(item.href);
            }}
            className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );

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
            <Image
              src="/images/branding/logo-square.png"
              alt="RiderGuy"
              width={192}
              height={192}
              className="h-8 w-8 rounded-lg object-cover"
              priority
            />
            <span className="text-sm font-bold text-gray-900">RiderGuy Admin</span>
          </div>

          {navigation}
        </aside>

        {mobileNavigationOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setMobileNavigationOpen(false)} />
            <aside className="relative h-full w-72 bg-white shadow-xl">
              <div className="flex h-16 items-center justify-between border-b px-5">
                <div className="flex items-center gap-2"><Image src="/images/branding/logo-square.png" alt="RiderGuy" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" /><span className="text-sm font-bold text-gray-900">RiderGuy Admin</span></div>
                <Button aria-label="Close navigation" variant="ghost" size="sm" onClick={() => setMobileNavigationOpen(false)}><X className="h-5 w-5" /></Button>
              </div>
              <div className="h-[calc(100vh-4rem)] overflow-y-auto">{navigation}</div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <Button aria-label="Open navigation" variant="ghost" size="sm" onClick={() => setMobileNavigationOpen(true)}><Menu className="h-5 w-5" /></Button>
              <Image
                src="/images/branding/logo-square.png"
                alt="RiderGuy"
                width={192}
                height={192}
                className="h-7 w-7 rounded-lg object-cover"
              />
              <h2 className="text-lg font-semibold text-gray-900">
                RiderGuy Admin
              </h2>
            </div>

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
