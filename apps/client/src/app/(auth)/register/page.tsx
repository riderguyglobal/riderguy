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
  StepIndicator,
  type OtpInputHandle,
} from '@riderguy/ui';

// ============================================================
// Client Registration — modern multi-step flow
//
// Step 0: Phone number → request OTP
// Step 1: Verify OTP
// Step 2: Name + email
// Step 3: Success
// ============================================================

const STEPS = [
  { label: 'Phone' },
  { label: 'Verify' },
  { label: 'Details' },
  { label: 'Done' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { requestOtp, register, isLoading, error } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const otpRef = useRef<OtpInputHandle>(null);
  const displayError = localError ?? error;

  const handlePhoneSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!phone || phone.length < 10) {
        setLocalError('Please enter a valid phone number.');
        return;
      }
      setLocalError(null);
      setSubmitting(true);
      try {
        await requestOtp(phone, 'REGISTRATION');
        setCurrentStep(1);
      } catch {
        setLocalError('Failed to send OTP. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [phone, requestOtp]
  );

  const handleOtpComplete = useCallback((code: string) => {
    setOtpCode(code);
    setLocalError(null);
    setCurrentStep(2);
  }, []);

  const handleDetailsSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!firstName.trim() || !lastName.trim()) {
        setLocalError('First name and last name are required.');
        return;
      }
      setLocalError(null);
      setSubmitting(true);
      try {
        await register({
          phone,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          role: 'CLIENT',
          otpCode,
        });
        setCurrentStep(3);
      } catch {
        setLocalError('Registration failed. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [phone, otpCode, firstName, lastName, email, register]
  );

  return (
    <div className="auth-slide-up">
      <StepIndicator steps={STEPS} currentStep={currentStep} className="mb-6" />

      {/* Greeting section */}
      <div className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1.5">
          <span className="text-lg">📦</span>
          <span className="text-caption font-semibold text-accent-600">Get started</span>
        </div>
        <h2 className="text-heading text-surface-900">
          {currentStep === 0 && 'Create your account'}
          {currentStep === 1 && 'Verify your phone'}
          {currentStep === 2 && 'Your details'}
          {currentStep === 3 && 'You\u2019re all set!'}
        </h2>
        <p className="mt-1.5 text-body-sm text-surface-500">
          {currentStep === 0 && 'Enter your phone number to get started.'}
          {currentStep === 1 && (
            <>
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-surface-700">{phone}</span>
            </>
          )}
          {currentStep === 2 && 'Tell us a bit about yourself.'}
          {currentStep === 3 && 'Your account has been created successfully.'}
        </p>
      </div>

      {/* Error banner */}
      {displayError && currentStep < 3 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 auth-shake">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-100">
            <svg className="h-3 w-3 text-danger-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-body-sm text-danger-700">{displayError}</p>
        </div>
      )}

      {/* Step 0 — Phone */}
      {currentStep === 0 && (
        <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-5 auth-fade-in">
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone" className="text-body-sm font-medium text-surface-700">Phone number</Label>
            <PhoneInput value={phone} onValueChange={setPhone} disabled={submitting || isLoading} />
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
                Sending OTP…
              </span>
            ) : 'Continue'}
          </Button>
        </form>
      )}

      {/* Step 1 — OTP */}
      {currentStep === 1 && (
        <div className="flex flex-col gap-5 auth-fade-in">
          <div className="flex flex-col items-center gap-4">
            <Label className="text-body-sm font-medium text-surface-700">Enter verification code</Label>
            <OtpInput ref={otpRef} onComplete={handleOtpComplete} disabled={submitting || isLoading} autoFocus />
          </div>
          <div className="flex items-center justify-center gap-1 text-body-sm text-surface-500">
            <span>Didn&apos;t get the code?</span>
            <button
              type="button"
              className="font-semibold text-brand-500 transition-colors hover:text-brand-600"
              onClick={() => { setCurrentStep(0); setLocalError(null); }}
            >
              Go back
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Details */}
      {currentStep === 2 && (
        <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4 auth-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName" className="text-body-sm font-medium text-surface-700">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Kofi"
                required
                disabled={submitting}
                className="rounded-xl border-surface-300 bg-surface-50 px-4 py-3 text-body transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lastName" className="text-body-sm font-medium text-surface-700">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Asante"
                required
                disabled={submitting}
                className="rounded-xl border-surface-300 bg-surface-50 px-4 py-3 text-body transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-body-sm font-medium text-surface-700">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kofi@example.com"
              disabled={submitting}
              className="rounded-xl border-surface-300 bg-surface-50 px-4 py-3 text-body transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
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
                Creating account…
              </span>
            ) : 'Create Account'}
          </Button>
        </form>
      )}

      {/* Step 3 — Success */}
      {currentStep === 3 && (
        <div className="flex flex-col items-center gap-5 auth-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 auth-scale-in">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-accent-600">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-center text-body-sm text-surface-500">
            Welcome to RiderGuy! You can now send packages across the city.
          </p>
          <Button
            size="lg"
            className="w-full rounded-xl bg-brand-500 py-3.5 text-body font-semibold shadow-lg shadow-brand-500/25 transition-all duration-200 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/30 active:scale-[0.98]"
            onClick={() => router.replace('/dashboard')}
          >
            Send a Package
          </Button>
        </div>
      )}

      {/* Sign in link */}
      {currentStep < 3 && (
        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-surface-200" />
          <span className="text-caption text-surface-400">or</span>
          <div className="h-px flex-1 bg-surface-200" />
        </div>
      )}

      {currentStep < 3 && (
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-center transition-colors hover:bg-surface-100">
          <p className="text-body-sm text-surface-600">
            Already have an account?{' '}
            <button
              type="button"
              className="font-semibold text-brand-500 transition-colors hover:text-brand-600"
              onClick={() => router.push('/login')}
            >
              Sign in
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
