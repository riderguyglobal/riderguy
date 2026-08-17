'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { ArrowLeft, Camera, Loader2, Check } from 'lucide-react';

export default function EditProfilePage() {
  const router   = useRouter();
  const { user, api, refreshUser } = useAuth();

  const [firstName,   setFirstName]   = useState(user?.firstName ?? '');
  const [lastName,    setLastName]    = useState(user?.lastName  ?? '');
  const [email,       setEmail]       = useState(user?.email     ?? '');
  const [avatarUrl,   setAvatarUrl]   = useState(user?.avatarUrl ?? '');

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [error,           setError]           = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  const isDirty  = firstName !== (user?.firstName ?? '') ||
                   lastName  !== (user?.lastName  ?? '') ||
                   email     !== (user?.email     ?? '') ||
                   avatarUrl !== (user?.avatarUrl ?? '');

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !api) return;

    setAvatarUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await api.post('/users/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(res.data.data?.avatarUrl ?? '');
    } catch {
      setError('Failed to upload photo. Please try again.');
    } finally {
      setAvatarUploading(false);
      // Reset input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!api || !isDirty) return;
    setSaving(true);
    setError('');
    try {
      await api.patch('/users/profile', { firstName, lastName, email, avatarUrl });
      await refreshUser?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Failed to save changes.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter flex flex-col">

      {/* ── Top bar ────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 bg-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button
          onClick={() => router.back()}
          className="map-btn bg-surface-100 !shadow-none"
        >
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <p className="flex-1 text-[17px] font-bold text-surface-900">Edit Profile</p>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={[
            'h-9 px-4 rounded-full text-[14px] font-bold transition-all duration-150 active:scale-95',
            isDirty && !saving
              ? 'bg-surface-900 text-white'
              : 'bg-surface-100 text-surface-400',
          ].join(' ')}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            'Save'
          )}
        </button>
      </div>

      <div className="flex-1 px-5 pt-4 pb-10 space-y-6">

        {/* ── Avatar ─────────────────────────────── */}
        <div className="flex flex-col items-center pt-2 pb-2">
          <div className="relative">
            <div className="h-24 w-24 rounded-3xl bg-surface-900 flex items-center justify-center overflow-hidden">
              {avatarUploading ? (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              ) : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[28px] font-bold text-white">{initials || 'U'}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-xl bg-white flex items-center justify-center shadow-card border-2 border-white active:scale-90 transition-all"
            >
              <Camera className="h-4 w-4 text-surface-700" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <p className="text-[13px] text-surface-400 mt-3">Tap to change photo</p>
        </div>

        {/* ── Fields ─────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <p className="section-label mb-1.5">First Name</p>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="First name"
              className="input-field"
              autoComplete="given-name"
            />
          </div>
          <div>
            <p className="section-label mb-1.5">Last Name</p>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last name"
              className="input-field"
              autoComplete="family-name"
            />
          </div>
          <div>
            <p className="section-label mb-1.5">Email</p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="input-field"
              autoComplete="email"
              inputMode="email"
            />
          </div>

          {/* Phone — read-only */}
          <div>
            <p className="section-label mb-1.5">Phone Number</p>
            <div className="input-field flex items-center opacity-60 cursor-not-allowed">
              <span className="text-[16px] font-medium text-surface-900">
                {user?.phone ?? '—'}
              </span>
            </div>
            <p className="text-[11px] text-surface-400 mt-1.5 px-1">
              Phone number cannot be changed from the app.
            </p>
          </div>
        </div>

        {/* ── Error ──────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 rounded-2xl bg-red-50 text-[13px] font-semibold text-red-600">
            {error}
          </div>
        )}

        {/* ── Save CTA ───────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="btn-primary"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : saved ? (
            <><Check className="h-5 w-5" /> Saved!</>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>

    </div>
  );
}
