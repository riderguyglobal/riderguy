'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import {
  Button,
  Input,
  Label,
  PhoneInput,
  OtpInput,
  type OtpInputHandle,
} from '@riderguy/ui';

// ============================================================
// Client Login — email+password or phone+OTP
// ============================================================

type LoginMethod = 'email' | 'phone';
type PhoneStage = 'input' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const { requestOtp, loginWithOtp, loginWithPassword, isLoading, error } = useAuth();

  const [method, setMethod] = useState<LoginMethod>('email');
  const [phoneStage, setPhoneStage] = useState<PhoneStage>('input');

  // Phone+OTP fields
  const [phone, setPhone] = useState('');

  // Email+password fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const otpRef = useRef<OtpInputHandle>(null);

  const displayError = localError ?? error;

  // ---- Phone: Request OTP ----
  const handleRequestOtp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!phone || phone.length < 10) {
        setLocalError('Please enter a valid phone number.');
        return;
      }
      setLocalError(null);
      setSubmitting(true);
      try {
        await requestOtp(phone, 'LOGIN');
        setPhoneStage('otp');
      } catch {
        setLocalError('Failed to send OTP. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [phone, requestOtp]
  );

  // ---- Phone: Verify OTP ----
  const handleOtpComplete = useCallback(
    async (code: string) => {
      setLocalError(null);
      setSubmitting(true);
      try {
        await loginWithOtp(phone, code);
        router.replace('/dashboard');
      } catch {
        setLocalError('Invalid OTP. Please try again.');
        otpRef.current?.clear();
      } finally {
        setSubmitting(false);
      }
    },
    [phone, loginWithOtp, router]
  );

  // ---- Email+Password login ----
  const handleEmailLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) {
        setLocalError('Please enter your email address.');
        return;
      }
      if (!password) {
        setLocalError('Please enter your password.');
        return;
      }
      setLocalError(null);
      setSubmitting(true);
      try {
        await loginWithPassword(email.trim(), password);
        router.replace('/dashboard');
      } catch {
        setLocalError('Invalid email or password. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, loginWithPassword, router]
  );

  // Switch method & reset state
  const switchMethod = (m: LoginMethod) => {
    setMethod(m);
    setLocalError(null);
    setPhoneStage('input');
  };

  return (
    <div className="auth-slide-up">
      {/* Greeting section */}
      <div className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5">
          <span className="text-lg">👋</span>
          <span className="text-caption font-semibold text-brand-600">Welcome back</span>
        </div>
        <h2 className="text-heading text-surface-900">Sign in to your account</h2>
        <p className="mt-1.5 text-body-sm text-surface-500">
          {method === 'email'
            ? 'Enter your email and password to continue.'
            : phoneStage === 'input'
              ? 'Enter your registered phone number to continue.'
              : (
                <>
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-surface-700">{phone}</span>
                </>
              )}
        </p>
      </div>

      {/* Method toggle tabs */}
      <div className="mb-6 flex rounded-xl bg-surface-100 p-1">
        <button
          type="button"
          onClick={() => switchMethod('email')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-body-sm font-medium transition-all duration-200 ${
            method === 'email'
              ? 'bg-white text-surface-900 shadow-card'
              : 'text-surface-500 hover:text-surface-700'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          Email
        </button>
        <button
          type="button"
          onClick={() => switchMethod('phone')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-body-sm font-medium transition-all duration-200 ${
            method === 'phone'
              ? 'bg-white text-surface-900 shadow-card'
              : 'text-surface-500 hover:text-surface-700'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
          </svg>
          Phone
        </button>
      </div>

      {/* Error banner */}
      {displayError && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 auth-shake">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-100">
            <svg className="h-3 w-3 text-danger-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-body-sm text-danger-700">{displayError}</p>
        </div>
      )}

      {/* ─── EMAIL + PASSWORD ─── */}
      {method === 'email' && (
        <form onSubmit={handleEmailLogin} className="flex flex-col gap-4 auth-fade-in">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-body-sm font-medium text-surface-700">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kofi@email.com"
              disabled={submitting || isLoading}
              className="rounded-xl border-surface-300 bg-surface-50 px-4 py-3 text-body transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-body-sm font-medium text-surface-700">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={submitting || isLoading}
                className="rounded-xl border-surface-300 bg-surface-50 px-4 py-3 pr-12 text-body transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-surface-400 transition-colors hover:text-surface-600"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="mt-1 w-full rounded-xl bg-brand-500 py-3.5 text-body font-semibold shadow-lg shadow-brand-500/25 transition-all duration-200 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/30 active:scale-[0.98]"
            disabled={submitting || isLoading}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in…
              </span>
            ) : 'Sign In'}
          </Button>
        </form>
      )}

      {/* ─── PHONE + OTP ─── */}
      {method === 'phone' && phoneStage === 'input' && (
        <form onSubmit={handleRequestOtp} className="flex flex-col gap-5 auth-fade-in">
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone" className="text-body-sm font-medium text-surface-700">
              Phone number
            </Label>
            <PhoneInput
              value={phone}
              onValueChange={setPhone}
              disabled={submitting || isLoading}
            />
            <p className="text-caption text-surface-400">
              We&apos;ll send you a one-time verification code
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full rounded-xl bg-brand-500 py-3.5 text-body font-semibold shadow-lg shadow-brand-500/25 transition-all duration-200 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/30 active:scale-[0.98]"
            disabled={submitting || isLoading}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending code…
              </span>
            ) : 'Continue'}
          </Button>
        </form>
      )}

      {method === 'phone' && phoneStage === 'otp' && (
        <div className="flex flex-col gap-5 auth-fade-in">
          <div className="flex flex-col items-center gap-4">
            <Label className="text-body-sm font-medium text-surface-700">Enter verification code</Label>
            <OtpInput
              ref={otpRef}
              onComplete={handleOtpComplete}
              disabled={submitting || isLoading}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-center gap-1 text-body-sm text-surface-500">
            <span>Didn&apos;t get the code?</span>
            <button
              type="button"
              className="font-semibold text-brand-500 transition-colors hover:text-brand-600"
              onClick={() => {
                setPhoneStage('input');
                setLocalError(null);
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="my-8 flex items-center gap-3">
        <div className="h-px flex-1 bg-surface-200" />
        <span className="text-caption text-surface-400">or</span>
        <div className="h-px flex-1 bg-surface-200" />
      </div>

      {/* Register CTA */}
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-center transition-colors hover:bg-surface-100">
        <p className="text-body-sm text-surface-600">
          New to RiderGuy?{' '}
          <button
            type="button"
            className="font-semibold text-brand-500 transition-colors hover:text-brand-600"
            onClick={() => router.push('/register')}
          >
            Create an account
          </button>
        </p>
        <p className="mt-1 text-caption text-surface-400">
          Start sending packages in minutes
        </p>
      </div>
    </div>
  );
}
