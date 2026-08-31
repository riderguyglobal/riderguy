'use client';

import { useMemo, useState } from 'react';

type AuthAction = 'reset-password' | 'verify-email';
type AppAudience = 'client' | 'rider';

type AuthLinkPageProps = {
  action: AuthAction;
  audience?: AppAudience;
  description: string;
  token?: string;
  title: string;
};

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

const apps = [
  {
    audience: 'client',
    label: 'RiderGuy',
    scheme: 'riderguy-client',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.riderguy.client',
  },
  {
    audience: 'rider',
    label: 'RiderGuy Rider',
    scheme: 'riderguy-rider',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.riderguy.rider',
  },
] as const;

function passwordIssue(password: string, confirmation: string): string {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password.length > 128) return 'Password must be no more than 128 characters.';
  if (!/[A-Z]/.test(password)) return 'Add at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Add at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Add at least one number.';
  if (password !== confirmation) return 'The passwords do not match.';
  return '';
}

export function AuthLinkPage({ action, audience, description, title, token = '' }: AuthLinkPageProps) {
  const normalizedToken = token.trim();
  const availableApps = useMemo(
    () => audience ? apps.filter((app) => app.audience === audience) : apps,
    [audience],
  );
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [message, setMessage] = useState('');

  const submit = async () => {
    if (!normalizedToken || status === 'loading') return;

    if (action === 'reset-password') {
      const issue = passwordIssue(password, confirmation);
      if (issue) {
        setStatus('error');
        setMessage(issue);
        return;
      }
    }

    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch(`/api/auth/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: normalizedToken,
          ...(action === 'reset-password' ? { newPassword: password } : {}),
        }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || 'This secure link could not be completed.');
      }

      setStatus('success');
      setMessage(payload?.message || (action === 'verify-email'
        ? 'Your email address is verified.'
        : 'Your password has been reset.'));
      setPassword('');
      setConfirmation('');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'This secure link could not be completed.');
    }
  };

  return (
    <section className="px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-40">
      <div className="mx-auto max-w-xl rounded-3xl border border-surface-200 bg-white p-7 shadow-xl shadow-surface-900/5 sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary-600">Secure account link</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-surface-950 sm:text-4xl">{title}</h1>
        <p className="mt-4 leading-7 text-surface-600">{description}</p>

        {!normalizedToken ? (
          <div className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">
            This link is incomplete. Open the full link from your RiderGuy email or request a new one in the app.
          </div>
        ) : status === 'success' ? (
          <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" role="status">
            {message}
          </div>
        ) : (
          <div className="mt-7">
            {action === 'reset-password' ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-surface-800">New password</span>
                  <input
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-surface-300 px-4 py-3 text-surface-950 outline-none transition focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20"
                    maxLength={128}
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-surface-800">Confirm password</span>
                  <input
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-surface-300 px-4 py-3 text-surface-950 outline-none transition focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20"
                    maxLength={128}
                    minLength={8}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                    type="password"
                    value={confirmation}
                  />
                </label>
                <p className="text-xs leading-5 text-surface-500">Use 8–128 characters with uppercase, lowercase, and a number.</p>
              </div>
            ) : (
              <p className="rounded-2xl bg-surface-50 p-4 text-sm leading-6 text-surface-700">
                Confirm below to verify the email address associated with this secure link.
              </p>
            )}

            <button
              className="mt-5 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status === 'loading'}
              onClick={submit}
              type="button"
            >
              {status === 'loading'
                ? 'Please wait…'
                : action === 'verify-email' ? 'Verify email' : 'Reset password'}
            </button>

            {status === 'error' ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">
                {message}
              </div>
            ) : null}
          </div>
        )}

        {normalizedToken ? (
          <div className="mt-8 border-t border-surface-200 pt-6">
            <p className="text-sm font-bold text-surface-900">Prefer the app?</p>
            <div className="mt-3 space-y-3">
              {availableApps.map((app) => {
                const deepLink = `${app.scheme}://auth/${action}?token=${encodeURIComponent(normalizedToken)}`;
                return (
                  <div key={app.scheme} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                    <p className="font-bold text-surface-950">{app.label}</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <a className="rounded-xl bg-surface-950 px-4 py-3 text-center text-sm font-bold text-white hover:bg-surface-800" href={deepLink}>
                        Open app
                      </a>
                      <a className="rounded-xl border border-surface-300 bg-white px-4 py-3 text-center text-sm font-bold text-surface-800 hover:bg-surface-100" href={app.storeUrl} rel="noreferrer">
                        Get it on Google Play
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <p className="mt-7 text-sm leading-6 text-surface-500">
          For your security, never share this link or its token with anyone.
        </p>
      </div>
    </section>
  );
}
