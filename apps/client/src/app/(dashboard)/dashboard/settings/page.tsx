'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@riderguy/ui';
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
  Camera,
} from 'lucide-react';

const MENU_ITEMS = [
  { icon: User, label: 'Edit Profile', color: 'bg-brand-50 text-brand-500' },
  { icon: MapPin, label: 'Saved Addresses', color: 'bg-accent-50 text-accent-500' },
  { icon: CreditCard, label: 'Payment Methods', color: 'bg-violet-50 text-violet-500' },
  { icon: Bell, label: 'Notifications', color: 'bg-amber-50 text-amber-500' },
  { icon: Shield, label: 'Privacy & Security', color: 'bg-sky-50 text-sky-500' },
  { icon: HelpCircle, label: 'Help & Support', color: 'bg-emerald-50 text-emerald-500' },
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
      {/* Profile header */}
      <div className="safe-area-top bg-white border-b border-surface-100">
        <div className="px-5 pt-4 pb-6">
          <h1 className="text-xl font-extrabold text-surface-900 mb-5">Account</h1>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16 ring-2 ring-brand-100">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.firstName} />}
                <AvatarFallback className="bg-brand-50 text-brand-600 text-xl font-extrabold">
                  {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
                </AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full brand-gradient flex items-center justify-center shadow-brand border-2 border-white">
                <Camera className="h-3 w-3 text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-surface-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-surface-500 truncate">{user?.email}</p>
              {user?.phone && (
                <p className="text-xs text-surface-400 mt-0.5">{user.phone}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Menu items */}
        <div className="card-elevated overflow-hidden divide-y divide-surface-100">
          {MENU_ITEMS.map(({ icon: Icon, label, color }) => (
            <button
              key={label}
              onClick={() => {}}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-surface-50 transition-colors text-left btn-press group"
            >
              <div className={`h-10 w-10 rounded-xl ${color.split(' ')[0]} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                <Icon className={`h-5 w-5 ${color.split(' ')[1]}`} />
              </div>
              <span className="flex-1 text-sm font-medium text-surface-900">{label}</span>
              <ChevronRight className="h-4 w-4 text-surface-300 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ))}
        </div>

        {/* Session Manager */}
        <div className="card-elevated p-4">
          <SessionManager />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full h-13 rounded-2xl border-2 border-danger-200 text-danger-600 font-semibold text-sm hover:bg-danger-50 transition-all btn-press flex items-center justify-center gap-2 mt-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>

        <p className="text-center text-xs text-surface-400 pt-3 pb-8">
          RiderGuy v1.0.0
        </p>
      </div>
    </div>
  );
}
