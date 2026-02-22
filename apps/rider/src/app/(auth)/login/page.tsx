'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import {
  Button,
  Label,
  PhoneInput,
  OtpInput,
  type OtpInputHandle,
} from '@riderguy/ui';

// ============================================================
// Rider Login — premium phone + OTP flow
// ============================================================

type Stage = 'phone' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const { requestOtp, loginWithOtp, isLoading, error } = useAuth();

  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const otpRef = useRef<OtpInputHandle>(null);

  const displayError = localError ?? error;

  // ---- Step 1: Request OTP ----
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
        setStage('otp');
      } catch {
        setLocalError('Failed to send OTP. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [phone, requestOtp]
  );

  // ---- Step 2: Verify OTP + Login ----
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

  return (
    <div className="auth-slide-up">
      {/* Greeting section */}
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5">
          <span className="text-lg">👋</span>
          <span className="text-caption font-semibold text-brand-600">Welcome back, Rider</span>
        </div>
        <h2 className="text-heading text-surface-900">
          {stage === 'phone' ? 'Sign in to your account' : 'Verify your phone'}
        </h2>
        <p className="mt-1.5 text-body-sm text-surface-500">
          {stage === 'phone'
            ? 'Enter your registered phone number to continue.'
            : (
              <>
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-surface-700">{phone}</span>
              </>
            )}
        </p>
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

      {/* Phone stage */}
      {stage === 'phone' && (
        <form onSubmit={handleRequestOtp} className="flex flex-col gap-5">
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

      {/* OTP stage */}
      {stage === 'otp' && (
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
                setStage('phone');
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
            Create a rider account
          </button>
        </p>
        <p className="mt-1 text-caption text-surface-400">
          Start earning in as little as 24 hours
        </p>
      </div>
    </div>
  );
}
