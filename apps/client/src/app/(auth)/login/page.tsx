'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { OtpInput, PhoneInput } from '@riderguy/ui';
import { Phone, Mail, AlertCircle, Eye, EyeOff, ArrowRight, Smartphone } from 'lucide-react';
import Link from 'next/link';

type Method = 'phone' | 'email';
type PhoneStage = 'input' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithPassword, loginWithOtp, requestOtp, isAuthenticated, isLoading } = useAuth();
  const [method, setMethod] = useState<Method>('phone');
  const [phone, setPhone] = useState('');
  const [phoneStage, setPhoneStage] = useState<PhoneStage>('input');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  const handlePhoneSubmit = async () => {
    if (!phone) return;
    setLoading(true);
    setError('');
    try {
      await requestOtp(phone, 'LOGIN');
      setPhoneStage('otp');
    } catch {
      setError('Failed to send code. Check your number.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (code?: string) => {
    const otpCode = code ?? otp;
    if (otpCode.length < 6) return;
    setLoading(true);
    setError('');
    try {
      await loginWithOtp(phone, otpCode);
      router.replace('/dashboard');
    } catch {
      setError('Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await loginWithPassword(email, password);
      router.replace('/dashboard');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-surface-900 mb-1">Welcome back</h1>
        <p className="text-surface-500 text-sm">Sign in to send packages</p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-danger-50 border border-danger-100 flex items-start gap-2.5 animate-shake">
          <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* ── Sliding Segmented Control ── */}
      <div className="relative flex p-1 bg-surface-100 rounded-2xl">
        {/* Sliding pill */}
        <div
          className="absolute top-1 bottom-1 rounded-xl bg-white shadow-card transition-all duration-300 ease-out"
          style={{ width: 'calc(50% - 4px)', left: method === 'phone' ? '4px' : 'calc(50% + 0px)' }}
        />
        {([
          { key: 'phone' as Method, icon: Phone, label: 'Phone' },
          { key: 'email' as Method, icon: Mail, label: 'Email' },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setMethod(key); setError(''); }}
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
              method === key ? 'text-surface-900' : 'text-surface-400 hover:text-surface-600'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Phone Login ── */}
      {method === 'phone' && (
        <div className="space-y-4 animate-fade-in">
          {phoneStage === 'input' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Phone number</label>
                <PhoneInput value={phone} onValueChange={setPhone} placeholder="024 XXX XXXX" />
              </div>
              <button
                onClick={handlePhoneSubmit}
                disabled={loading || !phone}
                className="w-full h-13 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand hover:shadow-lg transition-all btn-press disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Send Verification Code <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </>
          ) : (
            <>
              {/* OTP Card */}
              <div className="card-elevated p-5 text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto">
                  <Smartphone className="h-6 w-6 text-brand-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-900">Enter verification code</p>
                  <p className="text-xs text-surface-400 mt-1">Sent to {phone}</p>
                </div>
                <OtpInput length={6} variant="light" onChange={setOtp} onComplete={(code) => { setOtp(code); handleOtpSubmit(code); }} />
              </div>
              <button
                onClick={() => handleOtpSubmit()}
                disabled={loading || otp.length < 6}
                className="w-full h-13 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand hover:shadow-lg transition-all btn-press disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Verify & Sign In <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
              <button
                onClick={() => { setPhoneStage('input'); setOtp(''); setError(''); }}
                className="w-full text-sm text-brand-500 font-medium hover:text-brand-600 transition-colors"
              >
                Change number
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Email Login ── */}
      {method === 'email' && (
        <div className="space-y-4 animate-fade-in">
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-700">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-12 rounded-xl bg-surface-50 border border-surface-200 px-4 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 rounded-xl bg-surface-50 border border-surface-200 px-4 pr-12 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>
          <button
            onClick={handleEmailSubmit}
            disabled={loading || !email || !password}
            className="w-full h-13 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand hover:shadow-lg transition-all btn-press disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>Sign In <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      )}

      <p className="text-center text-sm text-surface-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-brand-500 font-semibold hover:text-brand-600">
          Sign up
        </Link>
      </p>
    </div>
  );
}
