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
// Rider Registration — premium multi-step form
//
// Step 0: Phone number → request OTP
// Step 1: Verify OTP
// Step 2: Personal details (name, email, password)
// Step 3: Success celebration
// ============================================================

const STEPS = [
  { key: 'phone', label: 'Phone', icon: '📱' },
  { key: 'verify', label: 'Verify', icon: '🔐' },
  { key: 'details', label: 'Details', icon: '📝' },
  { key: 'done', label: 'Done', icon: '🎉' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { requestOtp, register, isLoading, error } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Form data
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const otpRef = useRef<OtpInputHandle>(null);

  const displayError = localError ?? error;

  // ---- Step 0: Request OTP ----
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

  // ---- Step 1: OTP Complete ----
  const handleOtpComplete = useCallback(
    (code: string) => {
      setOtpCode(code);
      setLocalError(null);
      setCurrentStep(2);
    },
    []
  );

  // ---- Step 2: Submit Registration ----
  const handleDetailsSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!firstName.trim() || !lastName.trim()) {
        setLocalError('First name and last name are required.');
        return;
      }
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
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
          password,
          role: 'RIDER',
          otpCode,
        });
        setCurrentStep(3);
      } catch {
        setLocalError('Registration failed. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [phone, otpCode, firstName, lastName, email, password, confirmPassword, register]
  );

  return (
    <div className="auth-slide-up">
      {/* Step progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              {/* Step circle */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold
                    transition-all duration-300
                    ${i < currentStep
                      ? 'bg-accent-500 text-white shadow-md shadow-accent-500/30'
                      : i === currentStep
                        ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30 ring-4 ring-brand-100'
                        : 'bg-surface-100 text-surface-400'
                    }
                  `}
                >
                  {i < currentStep ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span>{step.icon}</span>
                  )}
                </div>
                <span className={`text-caption font-medium transition-colors duration-300 ${
                  i <= currentStep ? 'text-surface-700' : 'text-surface-400'
                }`}>
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="mb-6 h-0.5 flex-1 mx-2 rounded-full bg-surface-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-500 transition-all duration-500 ease-out"
                    style={{ width: i < currentStep ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Section header */}
      <div className="mb-6">
        <h2 className="text-heading text-surface-900">
          {currentStep === 0 && 'Create your account'}
          {currentStep === 1 && 'Verify your phone'}
          {currentStep === 2 && 'Tell us about yourself'}
          {currentStep === 3 && 'Welcome aboard! 🎉'}
        </h2>
        <p className="mt-1.5 text-body-sm text-surface-500">
          {currentStep === 0 && 'Start by entering your phone number.'}
          {currentStep === 1 && (
            <>
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-surface-700">{phone}</span>
            </>
          )}
          {currentStep === 2 && 'Just a few more details and you\'re in.'}
          {currentStep === 3 && 'Your rider account has been created successfully.'}
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

      {/* ---- Step 0: Phone ---- */}
      {currentStep === 0 && (
        <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-5 auth-fade-in">
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
              We&apos;ll send you a verification code via SMS
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
            ) : 'Get Started'}
          </Button>
        </form>
      )}

      {/* ---- Step 1: OTP ---- */}
      {currentStep === 1 && (
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
                setCurrentStep(0);
                setLocalError(null);
              }}
            >
              Go back
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 2: Details ---- */}
      {currentStep === 2 && (
        <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4 auth-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName" className="text-body-sm font-medium text-surface-700">
                First name
              </Label>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName" className="text-body-sm font-medium text-surface-700">
                Last name
              </Label>
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-body-sm font-medium text-surface-700">
              Email <span className="text-surface-400">(optional)</span>
            </Label>
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-body-sm font-medium text-surface-700">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                disabled={submitting}
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
            {/* Password strength indicator */}
            {password.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        password.length >= level * 3
                          ? password.length >= 12
                            ? 'bg-accent-500'
                            : password.length >= 8
                              ? 'bg-warning-500'
                              : 'bg-danger-400'
                          : 'bg-surface-200'
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-caption font-medium ${
                  password.length >= 12 ? 'text-accent-600' : password.length >= 8 ? 'text-warning-600' : 'text-danger-500'
                }`}>
                  {password.length >= 12 ? 'Strong' : password.length >= 8 ? 'Good' : 'Weak'}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword" className="text-body-sm font-medium text-surface-700">
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              disabled={submitting}
              className="rounded-xl border-surface-300 bg-surface-50 px-4 py-3 text-body transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-caption text-danger-500">Passwords don&apos;t match</p>
            )}
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

      {/* ---- Step 3: Success ---- */}
      {currentStep === 3 && (
        <div className="flex flex-col items-center gap-6 auth-fade-in">
          {/* Celebration animation */}
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-100 auth-scale-in">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-10 w-10 text-accent-600"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            {/* Floating confetti dots */}
            <div className="absolute -top-2 -right-2 h-3 w-3 rounded-full bg-brand-400 animate-bounce [animation-delay:0.1s]" />
            <div className="absolute -top-1 -left-3 h-2 w-2 rounded-full bg-accent-400 animate-bounce [animation-delay:0.3s]" />
            <div className="absolute -bottom-1 -right-3 h-2.5 w-2.5 rounded-full bg-warning-400 animate-bounce [animation-delay:0.5s]" />
          </div>

          <div className="text-center">
            <p className="text-body text-surface-600">
              Welcome to <span className="font-semibold text-brand-500">RiderGuy</span>,{' '}
              <span className="font-semibold text-surface-800">{firstName}</span>! 🏍️
            </p>
            <p className="mt-2 text-body-sm text-surface-500">
              Complete your onboarding to start accepting deliveries and earning.
            </p>
          </div>

          {/* Next steps preview */}
          <div className="w-full space-y-2.5 rounded-xl bg-surface-50 p-4">
            <p className="text-caption font-semibold uppercase tracking-wider text-surface-500">
              What&apos;s next
            </p>
            {[
              { icon: '📄', label: 'Upload your documents', desc: 'ID, license & insurance' },
              { icon: '🏍️', label: 'Add your vehicle', desc: 'Vehicle details & photos' },
              { icon: '✅', label: 'Get approved', desc: 'Usually within 24 hours' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-card">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <p className="text-body-sm font-medium text-surface-800">{item.label}</p>
                  <p className="text-caption text-surface-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full rounded-xl bg-brand-500 py-3.5 text-body font-semibold shadow-lg shadow-brand-500/25 transition-all duration-200 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/30 active:scale-[0.98]"
            onClick={() => router.replace('/dashboard')}
          >
            Go to Dashboard
          </Button>
        </div>
      )}

      {/* Link to login */}
      {currentStep < 3 && (
        <>
          <div className="my-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-surface-200" />
            <span className="text-caption text-surface-400">or</span>
            <div className="h-px flex-1 bg-surface-200" />
          </div>

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
        </>
      )}
    </div>
  );
}
