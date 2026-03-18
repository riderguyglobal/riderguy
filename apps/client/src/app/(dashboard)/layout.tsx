'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { Home, Package, ClipboardList, User } from 'lucide-react';
import { useForegroundRecovery } from '@/hooks/use-foreground-recovery';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { SecuritySetupPrompt } from '@/components/security-setup-prompt';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/dashboard/send', icon: Package, label: 'Send' },
  { href: '/dashboard/orders', icon: ClipboardList, label: 'Orders' },
  { href: '/dashboard/settings', icon: User, label: 'Account' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  const hideNav = /\/orders\/[^/]+\/(tracking|payment|rate)/.test(pathname);

  // Resync data when client returns from background (e.g. after switching apps)
  useForegroundRecovery();

  // Push notifications: register FCM token + handle foreground messages
  usePushNotifications();

  return (
    <ProtectedRoute allowedRoles={[UserRole.CLIENT]}>
      <div className="min-h-[100dvh] bg-surface-50 pb-20">
        {children}

        {/* One-time prompt to set up PIN/biometric for faster login */}
        <SecuritySetupPrompt />

        {!hideNav && (
          <nav className="fixed bottom-0 inset-x-0 z-40">
            {/* Frosted glass nav — inset for home indicator on modern iPhones */}
            <div className="mx-4 mb-2 pb-[env(safe-area-inset-bottom)] rounded-2xl bg-white/80 backdrop-blur-xl border border-surface-100 shadow-elevated overflow-hidden">
              <div className="flex items-center justify-around h-16 max-w-lg mx-auto relative">
                {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`relative flex flex-col items-center gap-0.5 px-4 py-1.5 transition-all duration-300 btn-press ${
                        active ? 'text-brand-500' : 'text-surface-400 hover:text-surface-600'
                      }`}
                    >
                      <div className={`relative transition-transform duration-300 ${active ? 'scale-110 -translate-y-0.5' : ''}`}>
                        <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
                        {active && (
                          <div className="absolute -inset-2 bg-brand-500/10 rounded-xl -z-10 animate-scale-in" />
                        )}
                      </div>
                      <span className={`text-[10px] transition-all duration-300 ${
                        active ? 'font-bold' : 'font-medium'
                      }`}>{label}</span>
                      {active && (
                        <div className="absolute -bottom-0.5 w-5 h-0.5 rounded-full bg-brand-500 animate-scale-in" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        )}
      </div>
    </ProtectedRoute>
  );
}
