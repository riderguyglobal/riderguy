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
  { icon: User, label: 'Edit Profile', href: '/dashboard/settings/profile', color: 'text-brand-400', bg: 'bg-brand-500/10', disabled: true },
  { icon: Shield, label: 'Security', href: '/dashboard/settings/security', color: 'text-accent-400', bg: 'bg-accent-500/10', disabled: true },
  { icon: Bell, label: 'Notifications', href: '/dashboard/settings/notifications', color: 'text-amber-400', bg: 'bg-amber-500/10', disabled: true },
  { icon: FileText, label: 'Documents', href: '/dashboard/onboarding/documents', color: 'text-purple-400', bg: 'bg-purple-500/10', disabled: false },
  { icon: Bike, label: 'Vehicle Info', href: '/dashboard/onboarding/vehicle', color: 'text-cyan-400', bg: 'bg-cyan-500/10', disabled: false },
  { icon: HelpCircle, label: 'Help & Support', href: '/dashboard/settings/help', color: 'text-surface-400', bg: 'bg-surface-500/10', disabled: true },
];

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
      <div className="safe-area-top bg-[#0a0e17]/95 backdrop-blur-xl px-5 pt-4 pb-3">
        <h1 className="text-xl font-bold text-white">Account</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Premium profile card */}
        <div className="glass-elevated rounded-2xl p-5">
          <div className="flex items-center gap-4">
            {/* Avatar with gradient ring */}
            <div className="relative">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 animate-gradient" style={{ backgroundSize: '200% 200%' }} />
              <Avatar className="relative h-16 w-16 ring-2 ring-[#0a0e17]">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                <AvatarFallback className="bg-brand-500/20 text-brand-400 text-lg font-bold">
                  {getInitials(user?.firstName ?? '', user?.lastName ?? '')}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-surface-400 truncate">{user?.phone ?? user?.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="status-dot online" />
                <span className="text-xs text-accent-400 font-medium">Verified Rider</span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="glass-elevated rounded-2xl overflow-hidden">
          {MENU_ITEMS.map(({ icon: Icon, label, href, color, bg, disabled }, idx) => (
            <button
              key={href}
              onClick={() => disabled ? alert('Coming soon') : router.push(href)}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-b-0 btn-press animate-slide-up ${disabled ? 'opacity-50 cursor-default' : ''}`}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4.5 w-4.5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white font-medium text-left block">{label}</span>
                {disabled && <span className="text-[10px] text-surface-500">Coming soon</span>}
              </div>
              <ChevronRight className="h-4 w-4 text-surface-600" />
            </button>
          ))}
        </div>

        {/* Session manager */}
        <div className="glass-elevated rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
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
          className="glass rounded-2xl w-full flex items-center justify-center gap-2 px-4 py-3.5 text-danger-400 hover:bg-danger-500/10 transition-colors btn-press"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-semibold">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
