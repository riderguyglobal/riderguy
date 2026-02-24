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
      await requestOtp(phone, 'RIDER');
      setPhoneStage('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP';
      setError(msg);
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
      const msg = err instanceof Error ? err.message : 'Invalid OTP';
      setError(msg);
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
      const msg = err instanceof Error ? err.message : 'Invalid credentials';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
      <p className="text-surface-400 mb-8">Sign in to continue delivering</p>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-3 animate-shake">
          <AlertCircle className="h-5 w-5 text-danger-400 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-300">{error}</p>
        </div>
      )}

      {/* Method tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-800 mb-8">
        {(['phone', 'email'] as Method[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMethod(m); setError(''); setPhoneStage('input'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              method === m ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-surface-300'
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
                <label className="block text-sm font-medium text-surface-300 mb-2">Phone Number</label>
                <PhoneInput value={phone} onValueChange={setPhone} />
              </div>
              <Button
                size="xl"
                className="w-full bg-brand-500 hover:bg-brand-600"
                onClick={handleRequestOtp}
                loading={submitting}
              >
                Send OTP
              </Button>
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <p className="text-surface-300 text-sm">
                  We sent a code to <span className="text-white font-medium">{phone}</span>
                </p>
                <button onClick={() => setPhoneStage('input')} className="text-brand-400 text-sm mt-1 hover:underline">
                  Change number
                </button>
              </div>
              <OtpInput ref={otpRef} length={6} onComplete={handleOtpComplete} disabled={submitting} />
              <div className="text-center mt-4">
                <button
                  onClick={handleRequestOtp}
                  disabled={submitting}
                  className="text-sm text-surface-400 hover:text-brand-400 transition-colors"
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
            <label className="block text-sm font-medium text-surface-300 mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Password</label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-300"
              >
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" size="xl" className="w-full bg-brand-500 hover:bg-brand-600" loading={submitting}>
            Sign In
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-surface-400 mt-8">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-brand-400 font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
