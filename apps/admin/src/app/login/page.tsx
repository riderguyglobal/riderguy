'use client';

import React, { useCallback, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginWithPassword, logout, api, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setLocalError('Enter your administrator email address.');
      return;
    }
    if (!password) {
      setLocalError('Enter your password.');
      return;
    }

    setLocalError(null);
    setSubmitting(true);
    try {
      await loginWithPassword(email.trim(), password);
      const session = await api.get('/auth/me');
      const authenticatedUser = session.data.data as { role?: string; roles?: string[] };
      const roles = new Set([authenticatedUser.role, ...(authenticatedUser.roles ?? [])]);
      if (!roles.has('ADMIN') && !roles.has('SUPER_ADMIN')) {
        await logout();
        setLocalError('This account is not authorized for RiderGuy Operations.');
        return;
      }
      router.replace('/dashboard');
    } catch {
      setLocalError('We could not sign you in. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  }, [api, email, loginWithPassword, logout, password, router]);

  const displayError = localError ?? error;
  const busy = submitting || isLoading;

  return (
    <main className="grid min-h-screen bg-[#F7FAF8] lg:grid-cols-[minmax(420px,0.92fr)_1.08fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#07110D] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-36 -top-40 h-[440px] w-[440px] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-52 -left-32 h-[480px] w-[480px] rounded-full bg-brand-700/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.055]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />

        <div className="relative z-10 flex items-center gap-3">
          <Image src="/images/branding/logo-square.png" alt="RiderGuy" width={48} height={48} className="h-12 w-12 rounded-2xl object-cover" priority />
          <div>
            <p className="text-lg font-bold tracking-[-0.03em]">RiderGuy</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-400">Operations control</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl py-16">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-500/10 px-3.5 py-2 text-[11px] font-semibold text-brand-300">
            <span className="h-2 w-2 rounded-full bg-brand-400" />
            Secure production workspace · Ghana
          </div>
          <h1 className="max-w-lg text-4xl font-bold leading-[1.12] tracking-[-0.045em] xl:text-5xl">
            Every RiderGuy decision, in one trusted place.
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-white/[0.55]">
            Review Rider evidence, coordinate deliveries, protect payouts and manage the programmes that move the network forward.
          </p>

          <div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-3">
            {['Role-protected', 'Decision-audited', 'Live operations'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/[0.09] bg-white/[0.045] px-4 py-4">
                <Check className="mb-3 h-4 w-4 text-brand-400" />
                <p className="text-xs font-semibold text-white/[0.75]">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.17em] text-white/[0.28]">
          Internal access · Authorized personnel only
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Image src="/images/branding/logo-square.png" alt="RiderGuy" width={44} height={44} className="h-11 w-11 rounded-[14px] object-cover" priority />
            <div>
              <p className="font-bold text-[#111814]">RiderGuy</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-brand-700">Operations</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D8EAE1] bg-[#EAF7F1] text-brand-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="admin-kicker">Administrator access</p>
            <h2 className="mt-2 text-[32px] font-bold leading-tight tracking-[-0.04em] text-[#07110D]">Welcome back.</h2>
            <p className="mt-2 text-sm leading-6 text-[#6A7770]">Sign in to open the RiderGuy command centre.</p>
          </div>

          {displayError ? (
            <div role="alert" className="mb-5 rounded-2xl border border-[#F2C7C2] bg-[#FFF4F2] px-4 py-3 text-sm font-medium text-[#A93226]">
              {displayError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold text-[#34433B]">Work email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@riderguy.com"
                autoComplete="username"
                required
                disabled={busy}
                autoFocus
                className="admin-field w-full"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-semibold text-[#34433B]">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  className="admin-field w-full pr-12"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#829087] transition hover:bg-[#F0F6F3] hover:text-[#24322B]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#079B61] px-5 text-sm font-bold text-white shadow-[0_16px_32px_-18px_rgba(7,155,97,0.9)] transition hover:bg-[#087B50] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Securing workspace…</>
              ) : (
                <>Enter command centre<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></>
              )}
            </button>
          </form>

          <div className="mt-7 flex items-center justify-center gap-2 text-[11px] font-medium text-[#829087]">
            <LockKeyhole className="h-3.5 w-3.5 text-brand-700" />
            Encrypted access · Session activity monitored
          </div>
        </div>
      </section>
    </main>
  );
}
