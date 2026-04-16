'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useAuthStore } from '@riderguy/auth';
import { UserRole } from '@riderguy/types';
import {
  Phone, Mail, CreditCard, ArrowLeft, Lock, Eye, EyeOff,
  AlertCircle, Check, ShieldAlert,
} from 'lucide-react';

type LoginMethod = 'phone' | 'email' | 'ghanacard';

/* ───────── Inline PIN Entry ───────── */
function InlinePinEntry({
  onComplete,
  error,
  loading,
  subtitle,
  onForgot,
  onBack,
}: {
  onComplete: (pin: string) => void;
  error: string;
  loading?: boolean;
  subtitle: string;
  onForgot: () => void;
  onBack: () => void;
}) {
  const length = 6;
  const [code, setCode] = useState<string[]>(Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (error) { setCode(Array(length).fill('')); refs.current[0]?.focus(); }
  }, [error]);

  const submit = useCallback((c: string) => { if (!loading) onComplete(c); }, [loading, onComplete]);

  function handleChange(i: number, v: string) {
    if (!/^\d*$/.test(v)) return;
    const next = [...code];
    next[i] = v.slice(-1);
    setCode(next);
    if (v && i < length - 1) refs.current[i + 1]?.focus();
    const full = next.join('');
    if (full.length === length && !next.includes('')) submit(full);
  }

  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!p) return;
    const next = Array(length).fill('');
    p.split('').forEach((c, i) => { next[i] = c; });
    setCode(next);
    refs.current[Math.min(p.length, length - 1)]?.focus();
    if (p.length === length) submit(p);
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Lock className="w-8 h-8 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-primary text-center mb-1">Enter your PIN</h2>
      <p className="text-muted text-sm text-center mb-8">{subtitle}</p>

      <div className="flex justify-center gap-3 mb-6">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={code[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-2xl border-2 bg-card transition-all duration-200 focus:outline-none ${
              error
                ? 'border-danger-500 text-danger-400 animate-shake'
                : code[i]
                  ? 'border-brand-500 text-primary shadow-sm shadow-brand-500/10'
                  : 'border-themed text-primary focus:border-brand-500 focus:shadow-sm focus:shadow-brand-500/10'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-danger-400 text-sm text-center mb-4 animate-fade-in">{error}</p>
      )}

      <button
        onClick={onForgot}
        className="block mx-auto text-brand-400 text-sm font-medium hover:text-brand-300 transition-colors"
      >
        Forgot PIN?
      </button>
    </div>
  );
}

/* ───────── Main Authenticate Page ───────── */
export default function AuthenticatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    loginWithOtp,
    loginWithPin,
    loginWithPassword,
    loginWithGhanaCard,
    requestOtp,
    checkAuthMethods,
    isAuthenticated,
    logout,
  } = useAuth();

  const [method, setMethod] = useState<LoginMethod>('phone');
  const [step, setStep] = useState<'identifier' | 'otp' | 'pin'>('identifier');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ghanaCard, setGhanaCard] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [roleError, setRoleError] = useState(searchParams.get('error') === 'role');
  const [loading, setLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownEndRef = useRef(0);
  const skipRedirectRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !skipRedirectRef.current) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const tick = () => {
      const remaining = Math.ceil((cooldownEndRef.current - Date.now()) / 1000);
      setCooldown(remaining > 0 ? remaining : 0);
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  /** Check if the logged-in user has the RIDER role. If not, logout immediately. */
  async function assertRiderRole(): Promise<boolean> {
    const currentUser = useAuthStore.getState().user;
    if (
      currentUser &&
      !currentUser.roles?.includes(UserRole.RIDER) &&
      currentUser.role !== UserRole.RIDER
    ) {
      skipRedirectRef.current = true;
      await logout();
      setRoleError(true);
      setError('');
      return false;
    }
    return true;
  }

  function formatPhone(raw: string): string {
    const cleaned = raw.replace(/\s/g, '');
    if (cleaned.startsWith('0')) return `+233${cleaned.slice(1)}`;
    if (cleaned.startsWith('233')) return `+${cleaned}`;
    if (cleaned.startsWith('+233')) return cleaned;
    return `+233${cleaned}`;
  }

  // ---- Phone Login Flow ----
  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 9) { setError('Enter a valid phone number'); return; }
    setLoading(true);
    try {
      const fullPhone = formatPhone(cleaned);
      // Check if user has PIN set up
      const methods = await checkAuthMethods(fullPhone);
      if (methods.pin) {
        // User has PIN, go to PIN step
        setStep('pin');
      } else {
        // No PIN, send OTP for login
        await requestOtp(fullPhone, 'LOGIN');
        setCooldown(60);
        cooldownEndRef.current = Date.now() + 60_000;
        setStep('otp');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Something went wrong. Try again.');
    } finally { setLoading(false); }
  }

  // ---- OTP Verify ----
  async function handleOtpComplete(code: string) {
    setLoading(true);
    setError('');
    setRoleError(false);
    try {
      await loginWithOtp(formatPhone(phone), code);
      if (!(await assertRiderRole())) return;
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Invalid OTP. Try again.');
      setOtp(Array(6).fill(''));
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  }

  async function handleResendOtp() {
    if (cooldown > 0) return;
    try {
      await requestOtp(formatPhone(phone), 'LOGIN');
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
    } catch {}
  }

  // ---- Email Login ----
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setRoleError(false);
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
    if (!password) { setError('Enter your password'); return; }
    setLoading(true);
    try {
      await loginWithPassword(email, password);
      if (!(await assertRiderRole())) return;
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Invalid email or password.');
    } finally { setLoading(false); }
  }

  // ---- Ghana Card Login ----
  async function handleGhanaCardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setRoleError(false);
    if (ghanaCard.length < 10) { setError('Enter a valid Ghana Card number'); return; }
    if (!password) { setError('Enter your password'); return; }
    setLoading(true);
    try {
      const result = await loginWithGhanaCard(ghanaCard, password);
      if (result?.requiresPin) {
        setStep('pin');
      } else {
        if (!(await assertRiderRole())) return;
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Invalid Ghana Card or password.');
    } finally { setLoading(false); }
  }

  // ---- PIN Verify ----
  async function handlePinComplete(pin: string) {
    setPinError('');
    setRoleError(false);
    try {
      const identifier =
        method === 'phone' ? formatPhone(phone)
        : method === 'email' ? email
        : ghanaCard;
      await loginWithPin(identifier, pin);
      if (!(await assertRiderRole())) return;
      router.replace('/dashboard');
    } catch (err: any) {
      setPinError(err?.response?.data?.error?.message || 'Invalid PIN. Try again.');
    }
  }

  // OTP input handlers
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

  /* ── OTP Step ── */
  if (step === 'otp') {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => { setStep('identifier'); setOtp(Array(6).fill('')); setError(''); }}
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

  /* ── PIN Step ── */
  if (step === 'pin') {
    return (
      <InlinePinEntry
        onComplete={handlePinComplete}
        error={pinError}
        subtitle={
          method === 'phone'
            ? `Logging in with ${formatPhone(phone)}`
            : method === 'email'
              ? `Logging in with ${email}`
              : 'Logging in with Ghana Card'
        }
        onForgot={() => router.push('/recovery')}
        onBack={() => { setStep('identifier'); setPinError(''); }}
      />
    );
  }

  /* ── Method config ── */
  const methods: { key: LoginMethod; label: string; sub: string; icon: React.ReactNode }[] = [
    {
      key: 'phone',
      label: 'Phone',
      sub: 'OTP verification',
      icon: <Phone className="w-5 h-5" />,
    },
    {
      key: 'email',
      label: 'Email',
      sub: 'Email & password',
      icon: <Mail className="w-5 h-5" />,
    },
    {
      key: 'ghanacard',
      label: 'Ghana Card',
      sub: 'National ID login',
      icon: <CreditCard className="w-5 h-5" />,
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.push('/login')}
        className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <h1 className="text-3xl font-bold text-primary tracking-tight mb-1">Welcome back, Rider</h1>
      <p className="text-muted mb-8">Log in to your account</p>

      {/* Role mismatch error banner */}
      {roleError && (
        <div className="mb-6 p-4 rounded-2xl bg-danger-500/10 border border-danger-500/20 animate-fade-in">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-danger-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-danger-400 text-sm font-semibold mb-1">Not a rider account</p>
              <p className="text-danger-400/80 text-xs leading-relaxed">
                This account is registered as a customer, not a rider. Please use the customer app, or register a new rider account.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Method selector cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-8">
        {methods.map((m) => {
          const active = method === m.key;
          return (
            <button
              key={m.key}
              onClick={() => { setMethod(m.key); setError(''); setPassword(''); }}
              className={`relative flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border-2 transition-all duration-200 ${
                active
                  ? 'border-brand-500 bg-brand-500/10 shadow-sm shadow-brand-500/10'
                  : 'border-themed bg-card hover:border-themed-strong'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                active ? 'gradient-brand text-white' : 'bg-card-alt text-muted'
              }`}>
                {m.icon}
              </div>
              <span className={`text-xs font-semibold transition-colors ${active ? 'text-brand-400' : 'text-secondary'}`}>
                {m.label}
              </span>
              {active && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full gradient-brand flex items-center justify-center shadow-sm">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Phone form */}
      {method === 'phone' && (
        <form onSubmit={handlePhoneSubmit} className="space-y-5 animate-fade-in">
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
                autoFocus
                className="flex-1 px-4 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
              />
            </div>
            {error && (
              <p className="text-danger-400 text-xs mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={phone.length < 9 || loading}
            className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </span>
            ) : 'Continue'}
          </button>
        </form>
      )}

      {/* Email form */}
      {method === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4 animate-fade-in">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Email Address</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 focus-within:shadow-sm focus-within:shadow-brand-500/10 transition-all duration-200">
              <div className="pl-4 text-muted">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com"
                autoFocus
                className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Password</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 focus-within:shadow-sm focus-within:shadow-brand-500/10 transition-all duration-200">
              <div className="pl-4 text-muted">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your password"
                className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="pr-4 text-muted hover:text-secondary transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-danger-400 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}
          <button
            type="submit"
            disabled={!email || !password || loading}
            className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </span>
            ) : 'Continue'}
          </button>
        </form>
      )}

      {/* Ghana Card form */}
      {method === 'ghanacard' && (
        <form onSubmit={handleGhanaCardSubmit} className="space-y-4 animate-fade-in">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Ghana Card Number</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 focus-within:shadow-sm focus-within:shadow-brand-500/10 transition-all duration-200">
              <div className="pl-4 text-muted">
                <CreditCard className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={ghanaCard}
                onChange={(e) => {
                  const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  let formatted = '';
                  for (let i = 0; i < raw.length && i < 13; i++) {
                    if (i === 3 || i === 12) formatted += '-';
                    formatted += raw[i];
                  }
                  setGhanaCard(formatted);
                  setError('');
                }}
                placeholder="GHA-XXXXXXXXX-X"
                maxLength={15}
                autoFocus
                className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none font-mono tracking-wide"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Password</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 focus-within:shadow-sm focus-within:shadow-brand-500/10 transition-all duration-200">
              <div className="pl-4 text-muted">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your password"
                className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="pr-4 text-muted hover:text-secondary transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-danger-400 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}
          <button
            type="submit"
            disabled={ghanaCard.length < 10 || !password || loading}
            className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </span>
            ) : 'Continue'}
          </button>
        </form>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-themed" />
        <span className="text-xs font-medium text-muted uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-themed" />
      </div>

      {/* Sign up link */}
      <button
        onClick={() => router.push('/signup')}
        className="w-full py-3.5 rounded-2xl font-semibold text-secondary bg-card border-2 border-themed hover:border-themed-strong active:scale-[0.98] transition-all duration-200"
      >
        Create an account
      </button>
    </div>
  );
}
