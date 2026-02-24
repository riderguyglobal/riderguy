'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Avatar, AvatarImage, AvatarFallback, Button } from '@riderguy/ui';
import { SessionManager } from '@riderguy/auth';
import {
  User,
  Bell,
  MapPin,
  CreditCard,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
} from 'lucide-react';

const MENU_ITEMS = [
  { icon: User, label: 'Edit Profile', href: '#' },
  { icon: MapPin, label: 'Saved Addresses', href: '#' },
  { icon: CreditCard, label: 'Payment Methods', href: '#' },
  { icon: Bell, label: 'Notifications', href: '#' },
  { icon: Shield, label: 'Privacy & Security', href: '#' },
  { icon: HelpCircle, label: 'Help & Support', href: '#' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white border-b border-surface-100">
        <div className="px-5 pt-4 pb-5">
          <h1 className="text-xl font-bold text-surface-900 mb-4">Account</h1>

          {/* Profile card */}
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.firstName} />}
              <AvatarFallback className="bg-brand-50 text-brand-600 text-lg font-bold">
                {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-surface-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-surface-500 truncate">{user?.email}</p>
              {user?.phone && (
                <p className="text-xs text-surface-400">{user.phone}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-2">
        {/* Menu items */}
        <div className="card-elevated overflow-hidden divide-y divide-surface-100">
          {MENU_ITEMS.map(({ icon: Icon, label, href }) => (
            <button
              key={label}
              onClick={() => {}}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center">
                <Icon className="h-4.5 w-4.5 text-surface-500" />
              </div>
              <span className="flex-1 text-sm text-surface-900">{label}</span>
              <ChevronRight className="h-4 w-4 text-surface-300" />
            </button>
          ))}
        </div>

        {/* Session Manager */}
        <div className="card-elevated p-4">
          <SessionManager />
        </div>

        {/* Logout */}
        <Button
          size="xl"
          variant="outline"
          className="w-full border-danger-200 text-danger-600 hover:bg-danger-50 mt-4"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>

        <p className="text-center text-xs text-surface-400 pt-4 pb-8">
          RiderGuy v1.0.0
        </p>
      </div>
    </div>
  );
}
