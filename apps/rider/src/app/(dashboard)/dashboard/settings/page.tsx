'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { SessionManager } from '@riderguy/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@riderguy/ui';
import { getInitials } from '@riderguy/utils';
import {
  User, Shield, Bell, HelpCircle, FileText, LogOut,
  ChevronRight, Bike, Settings, Sun, Moon, Monitor,
  Fingerprint, Plus, Trash2, Loader2
} from 'lucide-react';
import { useTheme } from '@/lib/theme';

const MENU_ITEMS = [
  { icon: User, label: 'Edit Profile', href: '/dashboard/settings/profile', color: 'text-brand-400', bg: 'bg-brand-500/10', disabled: true },
  { icon: Shield, label: 'Security', href: '/dashboard/settings/security', color: 'text-accent-400', bg: 'bg-accent-500/10', disabled: true },
  { icon: Bell, label: 'Notifications', href: '/dashboard/settings/notifications', color: 'text-amber-400', bg: 'bg-amber-500/10', disabled: true },
  { icon: FileText, label: 'Documents', href: '/dashboard/onboarding/documents', color: 'text-purple-400', bg: 'bg-purple-500/10', disabled: false },
  { icon: Bike, label: 'Vehicle Info', href: '/dashboard/onboarding/vehicle', color: 'text-brand-400', bg: 'bg-brand-500/10', disabled: false },
  { icon: HelpCircle, label: 'Help & Support', href: '/dashboard/settings/help', color: 'text-muted', bg: 'bg-surface-500/10', disabled: true },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, setupBiometric, isBiometricSupported: biometricSupported, api } = useAuth();
  const { theme, setTheme } = useTheme();

  // Biometric credentials state
  const [biometricCredentials, setBiometricCredentials] = useState<Array<{ id: string; friendlyName: string | null; deviceType: string | null; createdAt: string }>>([]);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState('');

  // Load biometric credentials
  useEffect(() => {
    if (!biometricSupported) return;
    api.get('/auth/webauthn/credentials')
      .then((res) => setBiometricCredentials(res.data?.data ?? []))
      .catch(() => {});
  }, [api, biometricSupported]);

  const handleSetupBiometric = async () => {
    setBiometricLoading(true);
    setBiometricError('');
    try {
      const deviceName = navigator.userAgent.includes('iPhone')
        ? 'iPhone'
        : navigator.userAgent.includes('Android')
        ? 'Android Device'
        : navigator.userAgent.includes('Windows')
        ? 'Windows PC'
        : 'My Device';

      await setupBiometric(deviceName);
      // Refresh credentials list
      const res = await api.get('/auth/webauthn/credentials');
      setBiometricCredentials(res.data?.data ?? []);
    } catch (err: any) {
      setBiometricError(err.message ?? 'Failed to register biometric');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleRemoveBiometric = async (credId: string) => {
    try {
      await api.delete(`/auth/webauthn/credentials/${credId}`);
      setBiometricCredentials((prev) => prev.filter((c) => c.id !== credId));
    } catch {
      setBiometricError('Failed to remove credential');
    }
  };

  const THEME_OPTIONS = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'Auto' },
  ];

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div className="min-h-[100dvh] pb-24 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-nav backdrop-blur-xl px-5 pt-4 pb-3">
        <h1 className="text-xl font-bold text-primary">Account</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Premium profile card */}
        <div className="glass-elevated rounded-2xl p-5">
          <div className="flex items-center gap-4">
            {/* Avatar with gradient ring */}
            <div className="relative">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 animate-gradient" style={{ backgroundSize: '200% 200%' }} />
              <Avatar className="relative h-16 w-16 ring-2 ring-page">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                <AvatarFallback className="bg-brand-500/20 text-brand-400 text-lg font-bold">
                  {getInitials(user?.firstName ?? '', user?.lastName ?? '')}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-primary truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-muted truncate">{user?.phone ?? user?.email}</p>
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
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-hover-themed transition-colors border-b border-themed-subtle last:border-b-0 btn-press animate-slide-up ${disabled ? 'opacity-50 cursor-default' : ''}`}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4.5 w-4.5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-primary font-medium text-left block">{label}</span>
                {disabled && <span className="text-[10px] text-subtle">Coming soon</span>}
              </div>
              <ChevronRight className="h-4 w-4 text-subtle" />
            </button>
          ))}
        </div>

        {/* Appearance */}
        <div className="glass-elevated rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-themed">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Sun className="h-4 w-4 text-muted" />
              Appearance
            </h3>
          </div>
          <div className="p-3">
            <div className="flex gap-2">
              {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all btn-press ${
                    theme === value
                      ? 'gradient-brand text-white shadow-lg glow-brand'
                      : 'bg-card hover:bg-hover-themed text-secondary'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Session manager */}
        <div className="glass-elevated rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-themed">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted" />
              Active Sessions
            </h3>
          </div>
          <div className="p-4">
            <SessionManager />
          </div>
        </div>

        {/* Biometric / Fingerprint Setup */}
        {biometricSupported && (
          <div className="glass-elevated rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-themed">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-brand-400" />
                Biometric Login
              </h3>
              <p className="text-xs text-muted mt-1">
                Use fingerprint or Face ID for quick sign-in
              </p>
            </div>
            <div className="p-4 space-y-3">
              {biometricError && (
                <p className="text-xs text-danger-400 bg-danger-500/10 rounded-lg px-3 py-2">{biometricError}</p>
              )}

              {/* Existing credentials */}
              {biometricCredentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-themed">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-brand-500/10 flex items-center justify-center">
                      <Fingerprint className="h-4 w-4 text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm text-primary font-medium">{cred.friendlyName ?? 'Biometric Credential'}</p>
                      <p className="text-[11px] text-muted">
                        Added {new Date(cred.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBiometric(cred.id)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* Add new biometric */}
              <button
                onClick={handleSetupBiometric}
                disabled={biometricLoading}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-themed hover:border-brand-500/50 text-muted hover:text-brand-400 transition-all disabled:opacity-50"
              >
                {biometricLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {biometricCredentials.length > 0 ? 'Add another device' : 'Set up fingerprint / Face ID'}
                </span>
              </button>
            </div>
          </div>
        )}

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
