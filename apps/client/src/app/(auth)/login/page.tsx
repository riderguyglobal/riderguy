'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Button, Label, PhoneInput, OtpInput, type OtpInputHandle } from '@riderguy/ui';

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
    <>
      <h2 className="mb-1 text-xl font-semibold text-gray-900">Welcome back</h2>
      <p className="mb-6 text-sm text-gray-500">
        {stage === 'phone'
          ? 'Enter your phone number to sign in.'
          : 'Enter the 6-digit code sent to your phone.'}
      </p>

      {displayError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      )}

      {stage === 'phone' && (
        <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <PhoneInput
              value={phone}
              onValueChange={setPhone}
              disabled={submitting || isLoading}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting || isLoading}>
            {submitting ? 'Sending OTP…' : 'Continue'}
          </Button>
        </form>
      )}

      {stage === 'otp' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <Label>Verification code</Label>
            <OtpInput ref={otpRef} onComplete={handleOtpComplete} disabled={submitting || isLoading} autoFocus />
          </div>
          <p className="text-center text-xs text-gray-400">
            Didn&#39;t receive a code?{' '}
            <button
              type="button"
              className="font-medium text-brand-500 hover:underline"
              onClick={() => { setStage('phone'); setLocalError(null); }}
            >
              Resend
            </button>
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&#39;t have an account?{' '}
        <button
          type="button"
          className="font-medium text-brand-500 hover:underline"
          onClick={() => router.push('/register')}
        >
          Sign up
        </button>
      </p>
    </>
  );
}
