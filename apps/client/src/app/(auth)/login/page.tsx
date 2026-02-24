'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Button, Input, Label, OtpInput, PhoneInput } from '@riderguy/ui';
import { Phone, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

type Method = 'phone' | 'email';
type PhoneStage = 'input' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithPassword, requestOtp, verifyOtp } = useAuth();
  const [method, setMethod] = useState<Method>('phone');
  const [phone, setPhone] = useState('');
  const [phoneStage, setPhoneStage] = useState<PhoneStage>('input');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleOtpSubmit = async () => {
    if (otp.length < 6) return;
    setLoading(true);
    setError('');
    try {
      await verifyOtp(phone, otp, 'LOGIN');
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
        <h1 className="text-2xl font-bold text-surface-900 mb-1">Welcome back</h1>
        <p className="text-surface-500">Sign in to send packages</p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger-50 border border-danger-100 flex items-start gap-2 animate-shake">
          <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* Method tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-xl">
        {([
          { key: 'phone' as Method, icon: Phone, label: 'Phone' },
          { key: 'email' as Method, icon: Mail, label: 'Email' },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setMethod(key); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              method === key
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Phone login */}
      {method === 'phone' && (
        <div className="space-y-4 animate-fade-in">
          {phoneStage === 'input' ? (
            <>
              <div className="space-y-2">
                <Label className="text-surface-700">Phone number</Label>
                <PhoneInput value={phone} onValueChange={setPhone} placeholder="024 XXX XXXX" />
              </div>
              <Button size="xl" className="w-full bg-brand-500 hover:bg-brand-600" onClick={handlePhoneSubmit} loading={loading}>
                Send Verification Code
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-surface-700">Enter the 6-digit code</Label>
                <p className="text-xs text-surface-400">Sent to {phone}</p>
                <OtpInput length={6} onChange={setOtp} />
              </div>
              <Button size="xl" className="w-full bg-brand-500 hover:bg-brand-600" onClick={handleOtpSubmit} loading={loading} disabled={otp.length < 6}>
                Verify & Sign In
              </Button>
              <button
                onClick={() => { setPhoneStage('input'); setOtp(''); setError(''); }}
                className="w-full text-sm text-brand-500 hover:text-brand-600"
              >
                Change number
              </button>
            </>
          )}
        </div>
      )}

      {/* Email login */}
      {method === 'email' && (
        <div className="space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-surface-700">Email address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label className="text-surface-700">Password</Label>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button size="xl" className="w-full bg-brand-500 hover:bg-brand-600" onClick={handleEmailSubmit} loading={loading}>
            Sign In
          </Button>
        </div>
      )}

      <p className="text-center text-sm text-surface-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-brand-500 font-medium hover:text-brand-600">
          Sign up
        </Link>
      </p>
    </div>
  );
}
