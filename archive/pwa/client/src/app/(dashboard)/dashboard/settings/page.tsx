'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { removeBiometricPhone } from '@riderguy/auth';
import { SessionManager } from '@riderguy/auth';
import { useTheme } from '@/lib/theme';
import {
  Bell,
  MapPin,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Fingerprint,
  Plus,
  Trash2,
  Loader2,
  Lock,
  KeyRound,
  Star,
  Heart,
  Info,
  Settings2,
} from 'lucide-react';

const THEME_OPTIONS = [
  { value: 'light' as const,  icon: Sun,     label: 'Light' },
  { value: 'dark'  as const,  icon: Moon,    label: 'Dark'  },
  { value: 'system' as const, icon: Monitor, label: 'Auto'  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, setupBiometric, isBiometricSupported: biometricSupported, api } = useAuth();
  const { theme, setTheme } = useTheme();

  const [biometricCredentials, setBiometricCredentials] = useState<
    Array<{ id: string; friendlyName: string | null; deviceType: string | null; createdAt: string }>
  >([]);
  const [biometricLoading, setBiometricLoading]   = useState(false);
  const [biometricError, setBiometricError]       = useState('');
  const [hasPinSet, setHasPinSet]                 = useState<boolean | null>(null);

  useEffect(() => {
    if (!api || !user?.phone) return;
    api
      .post('/auth/methods', { phone: user.phone })
      .then((res) => setHasPinSet(res.data?.data?.pin ?? false))
      .catch(() => {});
  }, [api, user?.phone]);

  useEffect(() => {
    if (!biometricSupported || !api) return;
    api
      .get('/auth/webauthn/credentials')
      .then((res) => setBiometricCredentials(res.data?.data ?? []))
      .catch(() => {});
  }, [api, biometricSupported]);

  const handleSetupBiometric = async () => {
    if (!api) return;
    setBiometricLoading(true);
    setBiometricError('');
    try {
      const ua = navigator.userAgent;
      const deviceName = ua.includes('iPhone')  ? 'iPhone'
                       : ua.includes('Android') ? 'Android Device'
                       : ua.includes('Windows') ? 'Windows PC'
                       : 'My Device';
      await setupBiometric(deviceName);
      const res = await api.get('/auth/webauthn/credentials');
      setBiometricCredentials(res.data?.data ?? []);
    } catch (err: unknown) {
      setBiometricError((err as Error)?.message ?? 'Failed to register biometric');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleRemoveBiometric = async (credId: string) => {
    if (!api) return;
    setBiometricError('');
    try {
      await api.delete(`/auth/webauthn/credentials/${credId}`);
      const remaining = biometricCredentials.filter((c) => c.id !== credId);
      setBiometricCredentials(remaining);
      if (remaining.length === 0 && user?.phone) removeBiometricPhone(user.phone);
    } catch {
      setBiometricError('Failed to remove credential');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-surface-50 px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 16px)', paddingBottom: 8 }}
      >
        <h1 className="text-[22px] font-bold text-surface-900">Account</h1>
      </div>

      <div className="px-5 pb-10 space-y-4">

        {/* ── Profile card ─────────────────────────── */}
        <button
          onClick={() => router.push('/dashboard/settings/profile')}
          className="w-full bg-white rounded-3xl px-4 py-4 flex items-center gap-4 btn-press text-left shadow-card"
        >
          <div className="h-14 w-14 rounded-2xl bg-surface-900 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[20px] font-bold text-white">{initials || 'U'}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-bold text-surface-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            {user?.email && (
              <p className="text-[13px] text-surface-500 truncate mt-0.5">{user.email}</p>
            )}
            {user?.phone && (
              <p className="text-[12px] text-surface-400 mt-0.5">{user.phone}</p>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-surface-300 flex-shrink-0" />
        </button>

        {/* ── Account section ──────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-card">
          <p className="section-label px-4 pt-4 pb-2">Account</p>
          <SettingsRow
            icon={<MapPin className="h-[18px] w-[18px] text-white" />}
            iconBg="bg-blue-500"
            label="Saved Addresses"
            onPress={() => router.push('/dashboard/saved-addresses')}
          />
          <SettingsRow
            icon={<CreditCard className="h-[18px] w-[18px] text-white" />}
            iconBg="bg-violet-500"
            label="Payment Methods"
            onPress={() => router.push('/dashboard/settings/payment-methods')}
          />
          <SettingsRow
            icon={<Heart className="h-[18px] w-[18px] text-white" />}
            iconBg="bg-rose-500"
            label="Favourite Riders"
            onPress={() => router.push('/dashboard/favorite-riders')}
            last
          />
        </div>

        {/* ── Preferences ──────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-card">
          <p className="section-label px-4 pt-4 pb-2">Preferences</p>
          <SettingsRow
            icon={<Bell className="h-[18px] w-[18px] text-white" />}
            iconBg="bg-amber-500"
            label="Notifications"
            onPress={() => router.push('/dashboard/settings/notifications')}
          />
          {/* Appearance inline */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-surface-50">
            <div className="h-8 w-8 rounded-xl bg-surface-700 flex items-center justify-center flex-shrink-0">
              <Sun className="h-[18px] w-[18px] text-white" />
            </div>
            <p className="flex-1 text-[15px] font-semibold text-surface-900">Appearance</p>
            <div className="flex gap-1.5">
              {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  title={label}
                  className={[
                    'h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95',
                    theme === value
                      ? 'bg-surface-900 text-white'
                      : 'bg-surface-100 text-surface-500',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Security ─────────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-card">
          <p className="section-label px-4 pt-4 pb-2">Security</p>

          {/* PIN */}
          <div className="border-t border-surface-50">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="h-8 w-8 rounded-xl bg-surface-900 flex items-center justify-center flex-shrink-0">
                <Lock className="h-[18px] w-[18px] text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-surface-900">PIN Login</p>
                <p className="text-[12px] text-surface-400">
                  {hasPinSet === null ? 'Checking…' : hasPinSet ? 'PIN is active' : 'Not set up'}
                </p>
              </div>
              {hasPinSet === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-surface-300" />
              ) : hasPinSet ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push('/dashboard/settings/security/change-pin')}
                    className="h-8 px-3 rounded-xl bg-surface-100 text-[12px] font-semibold text-surface-700 flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/dashboard/settings/security/set-pin')}
                  className="h-8 px-3 rounded-xl bg-surface-900 text-white text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Set PIN
                </button>
              )}
            </div>
          </div>

          {/* Biometric */}
          {biometricSupported && (
            <div className="border-t border-surface-50 px-4 pb-3 pt-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
                  <Fingerprint className="h-[18px] w-[18px] text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-surface-900">Biometric Login</p>
                  <p className="text-[12px] text-surface-400">Fingerprint or Face ID</p>
                </div>
              </div>

              {biometricError && (
                <div className="mb-2 px-3 py-2 rounded-xl bg-red-50 text-[12px] font-semibold text-red-600">
                  {biometricError}
                </div>
              )}

              {biometricCredentials.map((cred) => (
                <div key={cred.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-surface-50 mb-2">
                  <Fingerprint className="h-4 w-4 text-brand-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-surface-900 truncate">
                      {cred.friendlyName ?? 'Biometric Credential'}
                    </p>
                    <p className="text-[11px] text-surface-400">
                      Added {new Date(cred.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveBiometric(cred.id)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-surface-400 active:bg-red-50 active:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={handleSetupBiometric}
                disabled={biometricLoading}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-surface-200 text-[13px] font-semibold text-surface-400 active:border-brand-400 active:text-brand-500 transition-all disabled:opacity-50"
              >
                {biometricLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Plus className="h-4 w-4" />
                }
                {biometricCredentials.length > 0 ? 'Add another device' : 'Set up fingerprint / Face ID'}
              </button>
            </div>
          )}
        </div>

        {/* ── Sessions ─────────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-card px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="h-4 w-4 text-surface-400" />
            <p className="text-[13px] font-bold uppercase tracking-wide text-surface-400">Active Sessions</p>
          </div>
          <SessionManager />
        </div>

        {/* ── Support ──────────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-card">
          <p className="section-label px-4 pt-4 pb-2">Support</p>
          <SettingsRow
            icon={<HelpCircle className="h-[18px] w-[18px] text-white" />}
            iconBg="bg-teal-500"
            label="Help & Support"
            onPress={() => router.push('/dashboard/settings/help')}
          />
          <SettingsRow
            icon={<Star className="h-[18px] w-[18px] text-white" />}
            iconBg="bg-amber-400"
            label="Rate the App"
            onPress={() => {
              const ua = navigator.userAgent;
              if (/android/i.test(ua)) {
                window.open('https://play.google.com/store/apps/details?id=com.myriderguy.app', '_blank', 'noopener');
              } else {
                window.open('https://apps.apple.com/app/riderguy/id0000000000', '_blank', 'noopener');
              }
            }}
          />
          <SettingsRow
            icon={<Info className="h-[18px] w-[18px] text-white" />}
            iconBg="bg-surface-400"
            label="About RiderGuy"
            onPress={() => router.push('/dashboard/settings/about')}
            last
          />
        </div>

        {/* ── Sign Out ─────────────────────────────── */}
        <button
          onClick={handleLogout}
          className="w-full h-12 rounded-2xl bg-white text-red-500 font-semibold text-[15px] flex items-center justify-center gap-2 btn-press shadow-card"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>

        <p className="text-center text-[12px] text-surface-400 pb-4">
          RiderGuy v1.0.0
        </p>
      </div>
    </div>
  );
}

// ── Shared row component ─────────────────────────────────────────
function SettingsRow({
  icon,
  iconBg,
  label,
  sublabel,
  onPress,
  last = false,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <button
      onClick={onPress}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-50 ${
        last ? '' : 'border-t border-surface-50'
      }`}
    >
      <div className={`h-8 w-8 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[15px] font-semibold text-surface-900">{label}</p>
        {sublabel && <p className="text-[12px] text-surface-400 mt-0.5">{sublabel}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-surface-300 flex-shrink-0" />
    </button>
  );
}
