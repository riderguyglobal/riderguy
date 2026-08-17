'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Home, ClipboardList, Wallet, User } from 'lucide-react';
import { useForegroundRecovery } from '@/hooks/use-foreground-recovery';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { SecuritySetupPrompt } from '@/components/security-setup-prompt';

const NAV_ITEMS = [
  { href: '/dashboard',          icon: Home,          label: 'Home',    exact: true  },
  { href: '/dashboard/orders',   icon: ClipboardList, label: 'Orders',  exact: false },
  { href: '/dashboard/wallet',   icon: Wallet,        label: 'Wallet',  exact: false },
  { href: '/dashboard/settings', icon: User,          label: 'Profile', exact: false },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  const hideNav = /\/orders\/[^/]+\/(tracking|payment|rate)/.test(pathname);

  useForegroundRecovery();
  usePushNotifications();

  return (
    <ProtectedRoute allowedRoles={[UserRole.CLIENT]}>
      <div className="min-h-[100dvh] bg-white pb-[calc(62px+env(safe-area-inset-bottom,0px))]">

        {/* Content — full-width on all screen sizes */}
        <div className="w-full">
          {children}
          <SecuritySetupPrompt />
        </div>

        {/* Bottom nav */}
        {!hideNav && (
          <nav
            className="fixed bottom-0 inset-x-0 z-40 pointer-events-auto backdrop-blur-xl"
            style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 -1px 0 rgba(0,0,0,0.07)' }}
          >
            <div
              className="flex items-center justify-around px-2 md:px-8 lg:px-16"
              style={{ height: 62, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
                const active = exact
                  ? pathname === href
                  : pathname.startsWith(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-1 flex-col items-center justify-center gap-[3px] h-full"
                    aria-label={label}
                  >
                    <div
                      className={`flex h-[26px] w-10 items-center justify-center rounded-full transition-colors duration-200 ${active ? 'bg-[#ECFDF5]' : ''}`}
                    >
                      <Icon
                        className="transition-colors duration-200"
                        style={{
                          width:       18,
                          height:      18,
                          color:       active ? '#0AB957' : '#9CA3AF',
                          strokeWidth: active ? 2.4 : 1.7,
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-medium leading-none transition-colors duration-200"
                      style={{ color: active ? '#0AB957' : '#9CA3AF' }}
                    >
                      {label}
                    </span>
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
