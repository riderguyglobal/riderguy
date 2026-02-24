'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { SessionManager } from '@riderguy/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@riderguy/ui';
import { getInitials } from '@riderguy/utils';
import {
  User, Shield, Bell, HelpCircle, FileText, LogOut,
  ChevronRight, Bike, Settings
} from 'lucide-react';

const MENU_ITEMS = [
  { icon: User, label: 'Edit Profile', href: '/dashboard/settings/profile', color: 'text-brand-400' },
  { icon: Shield, label: 'Security', href: '/dashboard/settings/security', color: 'text-accent-400' },
  { icon: Bell, label: 'Notifications', href: '/dashboard/settings/notifications', color: 'text-amber-400' },
  { icon: FileText, label: 'Documents', href: '/dashboard/onboarding/documents', color: 'text-purple-400' },
  { icon: Bike, label: 'Vehicle Info', href: '/dashboard/onboarding/vehicle', color: 'text-cyan-400' },
  { icon: HelpCircle, label: 'Help & Support', href: '/dashboard/settings/help', color: 'text-surface-400' },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div className="min-h-[100dvh] pb-24 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-surface-950 px-5 py-4">
        <h1 className="text-xl font-bold text-white">Account</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Profile card */}
        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-brand-500/30">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
            <AvatarFallback className="bg-brand-500/20 text-brand-400 text-lg font-bold">
              {getInitials(user?.firstName ?? '', user?.lastName ?? '')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-sm text-surface-400 truncate">{user?.phone ?? user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block h-2 w-2 rounded-full bg-accent-400" />
              <span className="text-xs text-accent-400">Verified Rider</span>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="glass rounded-2xl overflow-hidden">
          {MENU_ITEMS.map(({ icon: Icon, label, href, color }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
            >
              <Icon className={`h-5 w-5 ${color}`} />
              <span className="text-sm text-white flex-1 text-left">{label}</span>
              <ChevronRight className="h-4 w-4 text-surface-500" />
            </button>
          ))}
        </div>

        {/* Session manager */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings className="h-4 w-4 text-surface-400" />
              Active Sessions
            </h3>
          </div>
          <div className="p-4">
            <SessionManager />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="glass rounded-2xl w-full flex items-center justify-center gap-2 px-4 py-3.5 text-danger-400 hover:bg-danger-500/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
