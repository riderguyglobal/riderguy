'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@riderguy/auth';
import { Button, Input, OtpInput, PhoneInput, StepIndicator } from '@riderguy/ui';
import { AlertCircle, CheckCircle2, Bike } from 'lucide-react';

const STEPS = [{ label: 'Phone' }, { label: 'Verify' }, { label: 'Details' }];

export default function RegisterPage() {
  const router = useRouter();
  const { register, requestOtp, verifyOtp, isAuthenticated } = useAuth();

  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const otpRef = useRef<{ clear: () => void; focus: () => void }>(null);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await requestOtp(phone, 'RIDER');
      setStep(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setSubmitting(true);
    setError('');
    setOtp(code);
    try {
      await verifyOtp(phone, code, 'REGISTRATION');
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
      otpRef.current?.clear();
      otpRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your full name');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await register({ phone, otpCode: otp, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || undefined, password, role: 'RIDER' });
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (step === 3) {
    return (
      <div className="text-center animate-scale-in">
        <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-accent-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-accent-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome Aboard!</h2>
        <p className="text-surface-400 mb-8">Your rider account has been created. Complete onboarding to start earning.</p>
        <Button
          size="xl"
          className="w-full bg-brand-500 hover:bg-brand-600"
          onClick={() => router.replace('/dashboard')}
        >
          <Bike className="h-5 w-5 mr-2" />
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Become a Rider</h2>
      <p className="text-surface-400 mb-6">Create your account to start delivering</p>

      <StepIndicator steps={STEPS} currentStep={step} className="mb-8" />

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-3 animate-shake">
          <AlertCircle className="h-5 w-5 text-danger-400 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-300">{error}</p>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Phone Number</label>
            <PhoneInput value={phone} onValueChange={setPhone} />
          </div>
          <Button size="xl" className="w-full bg-brand-500 hover:bg-brand-600" onClick={handleSendOtp} loading={submitting}>
            Continue
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center mb-2">
            <p className="text-surface-300 text-sm">
              Enter the 6-digit code sent to <span className="text-white font-medium">{phone}</span>
            </p>
            <button onClick={() => { setStep(0); setError(''); }} className="text-brand-400 text-sm mt-1 hover:underline">
              Change number
            </button>
          </div>
          <OtpInput ref={otpRef} length={6} onComplete={handleVerifyOtp} disabled={submitting} />
          <div className="text-center">
            <button onClick={handleSendOtp} disabled={submitting} className="text-sm text-surface-400 hover:text-brand-400">
              Resend code
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">First Name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Email (optional)</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500" />
          </div>
          <Button type="submit" size="xl" className="w-full bg-brand-500 hover:bg-brand-600" loading={submitting}>
            Create Account
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-surface-400 mt-8">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-400 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
