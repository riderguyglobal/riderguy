'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@riderguy/auth';
import { Button, Input, OtpInput, PhoneInput } from '@riderguy/ui';
import { AlertCircle, CheckCircle2, Bike, Sparkles, Lock } from 'lucide-react';

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
  const [pin, setPin] = useState('');
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
      await requestOtp(phone, 'REGISTRATION');
      setStep(1);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Failed to send OTP'));
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
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Invalid OTP'));
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
    if (pin.length !== 6) {
      setError('Please set a 6-digit PIN');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await register({ phone, otpCode: otp, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || undefined, pin, role: 'RIDER' });
      setStep(3);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Registration failed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (step === 3) {
    return (
      <div className="text-center animate-scale-in">
        <div className="relative mx-auto mb-6 h-24 w-24">
          <div className="absolute inset-0 rounded-full bg-accent-500/20 animate-ping" />
          <div className="relative h-24 w-24 rounded-full gradient-accent flex items-center justify-center shadow-xl glow-accent">
            <CheckCircle2 className="h-12 w-12 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-primary mb-2 tracking-tight">Welcome Aboard!</h2>
        <p className="text-muted mb-8 max-w-xs mx-auto">Your rider account has been created. Complete onboarding to start earning.</p>
        <Button
          size="xl"
          className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
          onClick={() => router.replace('/dashboard')}
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-extrabold text-primary mb-1 tracking-tight">Become a Rider</h2>
      <p className="text-muted mb-6">Create your account to start delivering</p>

      {/* Premium step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                i < step ? 'gradient-accent text-white shadow-md' :
                i === step ? 'gradient-brand text-white shadow-lg glow-brand' :
                'bg-skeleton text-subtle border border-themed-strong'
              }`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${
                i <= step ? 'text-primary' : 'text-subtle'
              }`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all duration-500 ${
                i < step ? 'bg-accent-500' : 'bg-skeleton'
              }`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded-2xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-3 animate-shake backdrop-blur-sm">
          <AlertCircle className="h-5 w-5 text-danger-400 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-300">{error}</p>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-6 animate-slide-up">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2.5">Phone Number</label>
            <PhoneInput value={phone} onValueChange={setPhone} />
          </div>
          <Button size="xl" className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold" onClick={handleSendOtp} loading={submitting}>
            Continue
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6 animate-slide-up">
          <div className="text-center mb-2 glass-elevated rounded-2xl p-5">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
              <Bike className="h-6 w-6 text-brand-400" />
            </div>
            <p className="text-secondary text-sm">
              Enter the 6-digit code sent to <span className="text-primary font-semibold">{phone}</span>
            </p>
            <button onClick={() => { setStep(0); setError(''); }} className="text-brand-400 text-sm mt-2 hover:underline font-medium">
              Change number
            </button>
          </div>
          <OtpInput ref={otpRef} length={6} onChange={setOtp} onComplete={handleVerifyOtp} disabled={submitting} />
          <Button
            size="xl"
            className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
            onClick={() => handleVerifyOtp(otp)}
            loading={submitting}
            disabled={submitting || otp.length < 6}
          >
            Verify & Continue
          </Button>
          <div className="text-center">
            <button onClick={handleSendOtp} disabled={submitting} className="text-sm text-muted hover:text-brand-400 font-medium transition-colors">
              Resend code
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleRegister} className="space-y-5 animate-slide-up">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2.5">First Name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2.5">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2.5">Email <span className="text-subtle">(optional)</span></label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">
              <Lock className="inline h-4 w-4 mr-1.5 -mt-0.5 text-muted" />
              Set a 6-digit PIN
            </label>
            <p className="text-xs text-subtle mb-3">You&apos;ll use this PIN to confirm transactions</p>
            <OtpInput length={6} onChange={setPin} onComplete={setPin} />
          </div>
          <Button type="submit" size="xl" className="w-full gradient-accent text-white shadow-lg glow-accent btn-press rounded-2xl font-semibold" loading={submitting}>
            Create Account
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted mt-8">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-400 font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
