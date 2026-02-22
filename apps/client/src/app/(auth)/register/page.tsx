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
// Client Registration — simpler flow than rider
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
    <>
      <StepIndicator steps={STEPS} currentStep={currentStep} className="mb-6" />

      <h2 className="mb-1 text-xl font-semibold text-gray-900">
        {currentStep === 0 && 'Create your account'}
        {currentStep === 1 && 'Verify your phone'}
        {currentStep === 2 && 'Your details'}
        {currentStep === 3 && 'You\'re all set!'}
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        {currentStep === 0 && 'Enter your phone number to get started.'}
        {currentStep === 1 && 'Enter the 6-digit code sent to your phone.'}
        {currentStep === 2 && 'Tell us a bit about yourself.'}
        {currentStep === 3 && 'Your account has been created successfully.'}
      </p>

      {displayError && currentStep < 3 && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      )}

      {currentStep === 0 && (
        <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <PhoneInput value={phone} onValueChange={setPhone} disabled={submitting || isLoading} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting || isLoading}>
            {submitting ? 'Sending OTP…' : 'Continue'}
          </Button>
        </form>
      )}

      {currentStep === 1 && (
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
              onClick={() => { setCurrentStep(0); setLocalError(null); }}
            >
              Go back
            </button>
          </p>
        </div>
      )}

      {currentStep === 2 && (
        <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" required disabled={submitting} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" required disabled={submitting} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" disabled={submitting} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting || isLoading}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>
      )}

      {currentStep === 3 && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-green-600">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-center text-sm text-gray-500">
            Welcome to RiderGuy! You can now send packages across the city.
          </p>
          <Button size="lg" className="w-full" onClick={() => router.replace('/dashboard')}>
            Send a Package
          </Button>
        </div>
      )}

      {currentStep < 3 && (
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <button type="button" className="font-medium text-brand-500 hover:underline" onClick={() => router.push('/login')}>
            Sign in
          </button>
        </p>
      )}
    </>
  );
}
