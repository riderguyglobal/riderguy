'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@riderguy/ui';
import { SessionManager } from '@riderguy/auth';
import { useTheme } from '@/lib/theme';
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
  Sun,
  Moon,
  Monitor,
  Fingerprint,
  Plus,
  Trash2,
  Loader2,
  Settings,
} from 'lucide-react';

const MENU_ITEMS = [
  { icon: User, label: 'Edit Profile', color: 'bg-brand-50 dark:bg-brand-500/10 text-brand-500', disabled: true },
  { icon: MapPin, label: 'Saved Addresses', color: 'bg-accent-50 dark:bg-accent-500/10 text-accent-500', disabled: true },
  { icon: CreditCard, label: 'Payment Methods', color: 'bg-violet-50 dark:bg-violet-500/10 text-violet-500', disabled: true },
  { icon: Bell, label: 'Notifications', color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500', disabled: true },
  { icon: Shield, label: 'Privacy & Security', color: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500', disabled: true },
  { icon: HelpCircle, label: 'Help & Support', color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500', disabled: true },
];

const THEME_OPTIONS = [
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'system' as const, icon: Monitor, label: 'Auto' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, setupBiometric, isBiometricSupported: biometricSupported, api } = useAuth();
  const { theme, setTheme } = useTheme();

  // Biometric credentials state
  const [biometricCredentials, setBiometricCredentials] = useState<
    Array<{ id: string; friendlyName: string | null; deviceType: string | null; createdAt: string }>
  >([]);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState('');

  // Load biometric credentials
  useEffect(() => {
    if (!biometricSupported) return;
    api
      .get('/auth/webauthn/credentials')
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

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-surface-950 animate-page-enter">
      {/* Profile header */}
      <div className="safe-area-top bg-white dark:bg-surface-950 border-b border-surface-100 dark:border-surface-800">
        <div className="px-5 pt-4 pb-6">
          <h1 className="text-xl font-bold text-surface-900 dark:text-white mb-5">Account</h1>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16 ring-2 ring-surface-100 dark:ring-surface-800">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.firstName} />}
                <AvatarFallback className="bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 text-xl font-bold">
                  {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
                </AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-surface-900 dark:bg-brand-500 flex items-center justify-center border-2 border-white dark:border-surface-950">
                <Camera className="h-3 w-3 text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-surface-900 dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400 truncate">{user?.email}</p>
              {user?.phone && (
                <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">{user.phone}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Menu items */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl overflow-hidden border border-surface-100 dark:border-surface-800">
          {MENU_ITEMS.map(({ icon: Icon, label, color, disabled }) => (
            <button
              key={label}
              onClick={() => { if (disabled) alert('Coming soon'); }}
              className={`w-full flex items-center gap-3 px-3 py-4 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors text-left btn-press group rounded-none border-b border-surface-100 dark:border-surface-800 last:border-b-0 ${disabled ? 'opacity-60 cursor-default' : ''}`}
            >
              <div className={`h-10 w-10 rounded-xl ${color.split(' ')[0]} ${color.split(' ')[1]} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${color.split(' ')[2]} ${color.split(' ')[3] ?? ''}`} />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-surface-900 dark:text-white block">{label}</span>
                {disabled && <span className="text-[10px] text-surface-400 dark:text-surface-500">Coming soon</span>}
              </div>
              <ChevronRight className="h-4 w-4 text-surface-300 dark:text-surface-600" />
            </button>
          ))}
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl overflow-hidden border border-surface-100 dark:border-surface-800">
          <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <Sun className="h-4 w-4 text-surface-400" />
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
                      ? 'brand-gradient text-white shadow-brand'
                      : 'bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Session Manager */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl overflow-hidden border border-surface-100 dark:border-surface-800">
          <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <Settings className="h-4 w-4 text-surface-400" />
              Active Sessions
            </h3>
          </div>
          <div className="p-4">
            <SessionManager />
          </div>
        </div>

        {/* Biometric / Fingerprint Setup */}
        {biometricSupported && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl overflow-hidden border border-surface-100 dark:border-surface-800">
            <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-brand-500" />
                Biometric Login
              </h3>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                Use fingerprint or Face ID for quick sign-in
              </p>
            </div>
            <div className="p-4 space-y-3">
              {biometricError && (
                <p className="text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-500/10 rounded-lg px-3 py-2">
                  {biometricError}
                </p>
              )}

              {/* Existing credentials */}
              {biometricCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
                      <Fingerprint className="h-4 w-4 text-brand-500" />
                    </div>
                    <div>
                      <p className="text-sm text-surface-900 dark:text-white font-medium">
                        {cred.friendlyName ?? 'Biometric Credential'}
                      </p>
                      <p className="text-[11px] text-surface-400 dark:text-surface-500">
                        Added {new Date(cred.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBiometric(cred.id)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* Add new biometric */}
              <button
                onClick={handleSetupBiometric}
                disabled={biometricLoading}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-surface-200 dark:border-surface-700 hover:border-brand-400 text-surface-400 hover:text-brand-500 transition-all disabled:opacity-50"
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
          className="w-full h-12 rounded-xl border border-surface-200 dark:border-surface-800 text-surface-500 dark:text-surface-400 font-medium text-sm hover:bg-surface-50 dark:hover:bg-surface-900 transition-all btn-press flex items-center justify-center gap-2 mt-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>

        <p className="text-center text-xs text-surface-400 dark:text-surface-600 pt-3 pb-8">
          RiderGuy v1.0.0
        </p>
      </div>
    </div>
  );
}
