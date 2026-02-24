'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Home, Package, ClipboardList, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/dashboard/send', icon: Package, label: 'Send' },
  { href: '/dashboard/orders', icon: ClipboardList, label: 'Orders' },
  { href: '/dashboard/settings', icon: User, label: 'Account' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide nav on tracking / order detail pages
  const hideNav = /\/orders\/[^/]+\/(tracking|payment|rate)/.test(pathname);

  return (
    <ProtectedRoute allowedRoles={[UserRole.CLIENT]}>
      <div className="min-h-[100dvh] bg-surface-50 pb-20">
        {children}

        {!hideNav && (
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-surface-100 safe-area-bottom">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                      active ? 'text-brand-500' : 'text-surface-400 hover:text-surface-600'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </ProtectedRoute>
  );
}
