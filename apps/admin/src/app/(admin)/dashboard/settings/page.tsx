'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, getApiClient, useAuthStore } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import { changePasswordSchema } from '@riderguy/validators';
import {
  BellRing,
  Cloud,
  Database,
  KeyRound,
  Mail,
  MapPinned,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@riderguy/ui';

interface ServiceReadiness {
  state:
    | 'OPERATIONAL'
    | 'CONFIGURED'
    | 'UNAVAILABLE'
    | 'UNCONFIGURED'
    | 'FALLBACK'
    | 'MANUAL_FALLBACK'
    | 'GHANA_FALLBACK';
  detail: string;
}

interface SystemReadiness {
  environment: string;
  generatedAt: string;
  services: Record<string, ServiceReadiness>;
}

type ProfileFeedback = {
  tone: 'success' | 'info' | 'warning' | 'error';
  text: string;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const setAuthUser = useAuthStore((state) => state.setUser);
  const isSuperAdmin =
    user?.role === UserRole.SUPER_ADMIN || user?.roles?.includes(UserRole.SUPER_ADMIN) === true;

  // Profile form
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<ProfileFeedback | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [readiness, setReadiness] = useState<SystemReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState('');

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setEmail(user.email ?? '');
  }, [user]);

  const loadReadiness = async () => {
    setReadinessLoading(true);
    setReadinessError('');
    try {
      const api = getApiClient();
      const { data } = await api.get('/admin/system-readiness');
      setReadiness(data.data);
    } catch {
      setReadinessError('System readiness could not be loaded.');
    } finally {
      setReadinessLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) void loadReadiness();
    // The readiness check should run once when Super Admin identity resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const api = getApiClient();
      const { data } = await api.patch('/users/profile', {
        firstName,
        lastName,
        email: email || undefined,
      });
      if (user) {
        setAuthUser({
          ...user,
          ...data.data,
          roles: data.data.roles ?? user.roles,
          createdAt: data.data.createdAt ?? user.createdAt,
        });
      }
      if (data.meta?.emailVerificationRequired) {
        setProfileMsg(
          data.meta.emailVerificationRequested
            ? {
                tone: 'info',
                text: 'Profile saved. Email verification is required and has been requested. Delivery is not confirmed; save again to request another message if it does not arrive.',
              }
            : {
                tone: 'warning',
                text: 'Profile saved. Email verification is required, but the verification request could not be prepared. Save again to retry the request.',
              },
        );
      } else {
        setProfileMsg({ tone: 'success', text: 'Profile updated successfully.' });
      }
    } catch {
      setProfileMsg({ tone: 'error', text: 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    const input = { currentPassword, newPassword, confirmPassword };
    const validation = changePasswordSchema.safeParse(input);
    if (!validation.success) {
      setPwMsg(validation.error.issues[0]?.message ?? 'Review the password fields.');
      return;
    }
    setPwSaving(true);
    setPwMsg('');
    try {
      const api = getApiClient();
      await api.post('/users/change-password', validation.data);
      setPwMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (passwordError) {
      const response = passwordError as {
        response?: { data?: { error?: { message?: string }; message?: string } };
      };
      setPwMsg(
        response.response?.data?.error?.message ??
          response.response?.data?.message ??
          'Failed to change password.',
      );
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="mb-6">
        <p className="admin-kicker">Access &amp; identity</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-[#07110D]">
          Administrator settings
        </h1>
        <p className="mt-2 text-sm text-[#6E7A73]">
          Keep your command-centre identity and credentials secure.
        </p>
      </div>

      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.9fr]">
        {/* Profile */}
        <Card className="rounded-2xl border-[#E3EEE9] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-[#079B61]" />
              Profile information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={user?.phone ?? ''} disabled className="bg-gray-50" />
              <p className="text-xs text-gray-400">Phone number cannot be changed.</p>
            </div>

            {profileMsg && (
              <p
                role={profileMsg.tone === 'error' ? 'alert' : 'status'}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  profileMsg.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : profileMsg.tone === 'info'
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : profileMsg.tone === 'warning'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {profileMsg.text}
              </p>
            )}

            <Button onClick={handleProfileSave} disabled={profileSaving}>
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Password */}
          <Card className="rounded-2xl border-[#E3EEE9] shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#079B61]" />
                Change password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPw">Current Password</Label>
                <Input
                  id="currentPw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPw">New Password</Label>
                <Input
                  id="newPw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPw">Confirm Password</Label>
                <Input
                  id="confirmPw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {pwMsg && (
                <p
                  className={`text-sm ${pwMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}
                >
                  {pwMsg}
                </p>
              )}

              <Button onClick={handlePasswordChange} disabled={pwSaving}>
                {pwSaving ? 'Changing...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>

          {/* Account info */}
          <Card className="shadow-premium overflow-hidden rounded-2xl border-[#087B50] bg-[#087B50] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ShieldCheck className="h-5 w-5 text-white" />
                Account authority
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-white/20 pb-3">
                <span className="text-white/70">Role</span>
                <span className="font-semibold text-white">
                  {user?.role?.replace(/_/g, ' ') ?? '—'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/20 pb-3">
                <span className="text-white/70">Account status</span>
                <span className="font-semibold text-white">
                  {user?.status?.replace(/_/g, ' ') ?? '—'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/70">User ID</span>
                <span className="truncate font-mono text-xs text-white/80">{user?.id ?? '—'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isSuperAdmin && (
        <Card className="max-w-5xl rounded-2xl border-[#E3EEE9] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-[#079B61]" />
                System readiness
              </CardTitle>
              <p className="mt-1 text-xs text-[#718078]">
                Safe configuration signals only—credentials and secret values are never exposed.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadReadiness()}
              disabled={readinessLoading}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${readinessLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {readinessError ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {readinessError}
              </p>
            ) : null}
            {readiness ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(readiness.services).map(([key, service]) => {
                  const meta = readinessMeta(key);
                  const healthy = ['OPERATIONAL', 'CONFIGURED', 'GHANA_FALLBACK'].includes(
                    service.state,
                  );
                  const Icon = meta.icon;
                  return (
                    <div key={key} className="rounded-2xl border border-[#E5EDE9] bg-[#FAFCFB] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF8F1] text-[#079B61]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[9px] font-bold tracking-wide ${healthy ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                        >
                          {service.state.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-bold text-[#142019]">{meta.label}</p>
                      <p className="mt-1 text-[11px] leading-5 text-[#75827B]">{service.detail}</p>
                    </div>
                  );
                })}
              </div>
            ) : readinessLoading ? (
              <p className="text-sm text-[#718078]">Checking configured services…</p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function readinessMeta(key: string): { label: string; icon: React.ElementType } {
  const values: Record<string, { label: string; icon: React.ElementType }> = {
    database: { label: 'Database', icon: Database },
    fileStorage: { label: 'File storage', icon: Cloud },
    googleSignIn: { label: 'Google sign-in', icon: KeyRound },
    email: { label: 'Email delivery', icon: Mail },
    sms: { label: 'SMS delivery', icon: MessageSquareText },
    payments: { label: 'Payments', icon: WalletCards },
    riderPush: { label: 'Rider notifications', icon: BellRing },
    maps: { label: 'Maps & routing', icon: MapPinned },
  };
  return values[key] ?? { label: key, icon: ShieldCheck };
}
