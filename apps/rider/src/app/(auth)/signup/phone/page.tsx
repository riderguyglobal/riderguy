'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { ArrowLeft, AlertCircle, Phone, User } from 'lucide-react';

type Step = 'info' | 'otp';

export default function PhoneSignupPage() {
  const router = useRouter();
  const { register, requestOtp, isAuthenticated } = useAuth();

  const [step, setStep] = useState<Step>('info');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownEndRef = useRef(0);

  useEffect(() => {
    if (isAuthenticated) router.replace('/signup/pin-setup');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const tick = () => {
      const remaining = Math.ceil((cooldownEndRef.current - Date.now()) / 1000);
      setCooldown(remaining > 0 ? remaining : 0);
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  function formatPhone(raw: string): string {
    const cleaned = raw.replace(/\s/g, '');
    if (cleaned.startsWith('0')) return `+233${cleaned.slice(1)}`;
    if (cleaned.startsWith('233')) return `+${cleaned}`;
    if (cleaned.startsWith('+233')) return cleaned;
    return `+233${cleaned}`;
  }

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!lastName.trim()) { setError('Last name is required'); return; }
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 9) { setError('Enter a valid phone number'); return; }

    setLoading(true);
    try {
      const fullPhone = formatPhone(cleaned);
      await requestOtp(fullPhone, 'REGISTRATION');
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
      setStep('otp');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to send OTP. Try again.');
    } finally { setLoading(false); }
  }

  async function handleOtpComplete(code: string) {
    setLoading(true);
    setError('');
    try {
      const fullPhone = formatPhone(phone);
      await register({
        phone: fullPhone,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        otpCode: code,
        role: 'RIDER',
      });
      router.replace('/signup/pin-setup');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Registration failed. Try again.');
      setOtp(Array(6).fill(''));
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  }

  async function handleResendOtp() {
    if (cooldown > 0) return;
    try {
      await requestOtp(formatPhone(phone), 'REGISTRATION');
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
    } catch {}
  }

  function handleOtpChange(i: number, v: string) {
    if (!/^\d*$/.test(v)) return;
    const next = [...otp];
    next[i] = v.slice(-1);
    setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
    const full = next.join('');
    if (full.length === 6 && !next.includes('')) handleOtpComplete(full);
  }

  function handleOtpKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!p) return;
    const next = Array(6).fill('');
    p.split('').forEach((c, i) => { next[i] = c; });
    setOtp(next);
    otpRefs.current[Math.min(p.length, 5)]?.focus();
    if (p.length === 6) handleOtpComplete(p);
  }

  if (step === 'otp') {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => { setStep('info'); setOtp(Array(6).fill('')); setError(''); }}
          className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Phone className="w-8 h-8 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-primary text-center mb-1">Verify your phone</h2>
        <p className="text-muted text-sm text-center mb-8">
          Enter the 6-digit code sent to {formatPhone(phone)}
        </p>

        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { otpRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={otp[i]}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKey(i, e)}
              onPaste={i === 0 ? handleOtpPaste : undefined}
              autoFocus={i === 0}
              className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-2xl border-2 bg-card transition-all duration-200 focus:outline-none ${
                error
                  ? 'border-danger-500 text-danger-400 animate-shake'
                  : otp[i]
                    ? 'border-brand-500 text-primary shadow-sm shadow-brand-500/10'
                    : 'border-themed text-primary focus:border-brand-500 focus:shadow-sm focus:shadow-brand-500/10'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-danger-400 text-sm text-center mb-4 animate-fade-in flex items-center justify-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />{error}
          </p>
        )}

        <div className="text-center">
          <button
            onClick={handleResendOtp}
            disabled={cooldown > 0}
            className="text-brand-400 text-sm font-medium hover:text-brand-300 transition-colors disabled:text-muted disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => router.push('/signup')}
        className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-3xl font-bold text-primary tracking-tight mb-1">Phone signup</h1>
      <p className="text-muted mb-8">We'll verify your number with an OTP</p>

      <form onSubmit={handleInfoSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">First Name</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
              <div className="pl-3 text-muted"><User className="w-4 h-4" /></div>
              <input
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setError(''); }}
                placeholder="Kofi"
                autoFocus
                className="flex-1 px-2 py-3.5 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">Last Name</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
              <input
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setError(''); }}
                placeholder="Mensah"
                className="flex-1 px-4 py-3.5 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-secondary mb-2.5">Phone Number</label>
          <div className="flex rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 focus-within:shadow-sm focus-within:shadow-brand-500/10 transition-all duration-200">
            <div className="flex items-center gap-2 px-4 bg-card-alt border-r border-themed">
              <span className="text-lg leading-none">🇬🇭</span>
              <span className="text-sm font-semibold text-muted">+233</span>
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/[^\d]/g, '')); setError(''); }}
              placeholder="24 000 0000"
              maxLength={10}
              className="flex-1 px-4 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-danger-400 text-xs flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </p>
        )}

        <button
          type="submit"
          disabled={!firstName.trim() || !lastName.trim() || phone.length < 9 || loading}
          className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending code...
            </span>
          ) : 'Send OTP'}
        </button>
      </form>
    </div>
  );
}
