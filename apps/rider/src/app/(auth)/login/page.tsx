'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@riderguy/auth';
import { Button, Input, OtpInput, PhoneInput } from '@riderguy/ui';
import { Eye, EyeOff, Mail, Phone, AlertCircle } from 'lucide-react';

type Method = 'phone' | 'email';
type PhoneStage = 'input' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithOtp, loginWithPassword, requestOtp, isAuthenticated } = useAuth();

  const [method, setMethod] = useState<Method>('phone');
  const [phoneStage, setPhoneStage] = useState<PhoneStage>('input');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const otpRef = useRef<{ clear: () => void; focus: () => void }>(null);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const handleRequestOtp = async () => {
    if (!phone || phone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await requestOtp(phone, 'LOGIN');
      setPhoneStage('otp');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Failed to send OTP'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpComplete = async (code: string) => {
    setSubmitting(true);
    setError('');
    try {
      await loginWithOtp(phone, code);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Invalid OTP'));
      otpRef.current?.clear();
      otpRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Enter your email and password');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await loginWithPassword(email, password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Invalid credentials'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-extrabold text-primary mb-1 tracking-tight">Welcome back</h2>
      <p className="text-muted mb-8">Sign in to continue delivering</p>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-3.5 rounded-2xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-3 animate-shake backdrop-blur-sm">
          <AlertCircle className="h-5 w-5 text-danger-400 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-300">{error}</p>
        </div>
      )}

      {/* Premium segmented control */}
      <div className="relative flex p-1 rounded-2xl bg-card border border-themed mb-8">
        <div
          className="absolute top-1 bottom-1 rounded-xl gradient-brand transition-all duration-300 ease-out shadow-lg glow-brand"
          style={{ width: 'calc(50% - 4px)', left: method === 'phone' ? '4px' : 'calc(50% + 0px)' }}
        />
        {(['phone', 'email'] as Method[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMethod(m); setError(''); setPhoneStage('input'); }}
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors btn-press ${
              method === m ? 'text-primary' : 'text-muted hover:text-secondary'
            }`}
          >
            {m === 'phone' ? <Phone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {m === 'phone' ? 'Phone' : 'Email'}
          </button>
        ))}
      </div>

      {method === 'phone' ? (
        <div className="space-y-6">
          {phoneStage === 'input' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2.5">Phone Number</label>
                <PhoneInput value={phone} onValueChange={setPhone} />
              </div>
              <Button
                size="xl"
                className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
                onClick={handleRequestOtp}
                loading={submitting}
              >
                Send OTP
              </Button>
            </>
          ) : (
            <>
              <div className="text-center mb-4 glass-elevated rounded-2xl p-5">
                <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-brand-400" />
                </div>
                <p className="text-secondary text-sm">
                  We sent a code to <span className="text-primary font-semibold">{phone}</span>
                </p>
                <button onClick={() => setPhoneStage('input')} className="text-brand-400 text-sm mt-2 hover:underline font-medium">
                  Change number
                </button>
              </div>
              <OtpInput ref={otpRef} length={6} onChange={(code) => setOtp(code)} onComplete={handleOtpComplete} disabled={submitting} />
              <Button
                size="xl"
                className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
                onClick={() => handleOtpComplete(otp)}
                loading={submitting}
                disabled={submitting || otp.length < 6}
              >
                Verify & Sign In
              </Button>
              <div className="text-center mt-4">
                <button
                  onClick={handleRequestOtp}
                  disabled={submitting}
                  className="text-sm text-muted hover:text-brand-400 transition-colors font-medium"
                >
                  Resend code
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleEmailLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2.5">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2.5">Password</label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-card border-themed-strong text-primary placeholder:text-subtle pr-11 rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors"
              >
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" size="xl" className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold" loading={submitting}>
            Sign In
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted mt-8">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-brand-400 font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
