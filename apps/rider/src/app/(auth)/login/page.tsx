'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth, hasBiometricForPhone, isBiometricSupported } from '@riderguy/auth';
import { Button, Input, OtpInput, PhoneInput } from '@riderguy/ui';
import { phoneSchema, pinSchema, emailSchema, passwordSchema } from '@riderguy/validators';
import {
  Fingerprint, KeyRound, MessageSquare, Phone, Mail, AlertCircle,
  ArrowLeft, ShieldCheck, Eye, EyeOff, ChevronRight, Bike,
} from 'lucide-react';

type Tab = 'phone' | 'email';
type Stage = 'input' | 'method-select' | 'pin' | 'otp' | 'biometric';

const LAST_PHONE_KEY = 'riderguy_last_phone';
const LAST_METHOD_KEY = 'riderguy_last_login_method';

export default function LoginPage() {
  const router = useRouter();
  const {
    loginWithOtp,
    loginWithPin,
    loginWithBiometric,
    loginWithPassword,
    requestOtp,
    checkAuthMethods,
    isAuthenticated,
  } = useAuth();

  const [tab, setTab] = useState<Tab>('phone');
  const [stage, setStage] = useState<Stage>('input');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [methods, setMethods] = useState<{ otp: boolean; pin: boolean; biometric: boolean } | null>(null);
  const otpRef = useRef<{ clear: () => void; focus: () => void }>(null);
  const pinRef = useRef<{ clear: () => void; focus: () => void }>(null);

  // Biometric support (client-side check)
  const biometricAvailable = isBiometricSupported();

  // Restore last-used phone on mount
  useEffect(() => {
    try {
      const lastPhone = localStorage.getItem(LAST_PHONE_KEY);
      if (lastPhone) setPhone(lastPhone);
    } catch { /* SSR / no localStorage */ }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  // OTP resend cooldown timer — uses Date.now() delta so it stays correct when iOS backgrounds Safari
  const cooldownEndRef = useRef(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const tick = () => {
      const remaining = Math.ceil((cooldownEndRef.current - Date.now()) / 1000);
      setCooldown(remaining > 0 ? remaining : 0);
    };
    const timer = setInterval(tick, 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [cooldown > 0]);

  // ---- Step 1: Check available methods for the phone ----
  const handlePhoneContinue = async () => {
    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid phone number');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Remember phone for next visit
      try { localStorage.setItem(LAST_PHONE_KEY, phone); } catch {}

      // Check available methods from server
      const serverMethods = await checkAuthMethods(phone);

      // Also check local biometric availability
      const localBiometric = biometricAvailable && hasBiometricForPhone(phone);
      const finalMethods = {
        ...serverMethods,
        biometric: serverMethods.biometric && localBiometric,
      };
      setMethods(finalMethods);

      // Smart auto-routing: if user has a preferred method from last time, jump there
      const lastMethod = localStorage.getItem(LAST_METHOD_KEY);

      if (lastMethod === 'biometric' && finalMethods.biometric) {
        setStage('biometric');
        // Auto-trigger biometric immediately
        handleBiometricLogin();
        return;
      }

      if (lastMethod === 'pin' && finalMethods.pin) {
        setStage('pin');
        return;
      }

      // If only OTP is available, go straight to OTP
      if (!finalMethods.pin && !finalMethods.biometric) {
        await handleSendOtp();
        return;
      }

      // Show method selection
      setStage('method-select');
    } catch (err: any) {
      // If methods check fails, fall back to showing all options
      setMethods({ otp: true, pin: true, biometric: false });
      setStage('method-select');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- OTP Flow ----
  const handleSendOtp = async () => {
    setSubmitting(true);
    setError('');
    try {
      await requestOtp(phone, 'LOGIN');
      setStage('otp');
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
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
      try { localStorage.setItem(LAST_METHOD_KEY, 'otp'); } catch {}
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Invalid OTP'));
      otpRef.current?.clear();
      otpRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  // ---- PIN Flow ----
  const handlePinComplete = async (code: string) => {
    setSubmitting(true);
    setError('');
    try {
      await loginWithPin(phone, code);
      try { localStorage.setItem(LAST_METHOD_KEY, 'pin'); } catch {}
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Invalid PIN'));
      pinRef.current?.clear();
      pinRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Biometric Flow ----
  const handleBiometricLogin = useCallback(async () => {
    setSubmitting(true);
    setError('');
    try {
      await loginWithBiometric(phone);
      try { localStorage.setItem(LAST_METHOD_KEY, 'biometric'); } catch {}
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message;
      setError(msg || 'Biometric login failed');
      // If biometric fails, show method select so user can try another way
      setStage('method-select');
    } finally {
      setSubmitting(false);
    }
  }, [phone, loginWithBiometric, router]);

  // ---- Email+Password Flow ----
  const handleEmailLogin = async () => {
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setError(emailResult.error.errors[0]?.message ?? 'Invalid email');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await loginWithPassword(email, password);
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Invalid email or password'));
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setError('');
    setPin('');
    setOtp('');
    if (stage === 'method-select') {
      setStage('input');
      setMethods(null);
    } else {
      setStage('method-select');
    }
  };

  return (
    <div>
      {/* ── Header area ── */}
      {stage === 'input' ? (
        <div className="text-center space-y-4 mb-8">
          {/* Rider illustration circle */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-brand-500/10 animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-brand-500/20 to-brand-500/5 border border-brand-500/20 flex items-center justify-center overflow-hidden">
              <Image
                src="/images/illustrations/biker-train.svg"
                alt=""
                width={68}
                height={68}
                className="h-[68px] w-[68px] object-contain drop-shadow-sm"
                priority
              />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Welcome back, rider</h2>
            <p className="text-muted text-sm mt-1">Sign in to start delivering</p>
          </div>
        </div>
      ) : (
        <button onClick={goBack} className="flex items-center gap-2 text-muted hover:text-primary transition-colors mb-6 group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="mb-6 p-3 rounded-2xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2.5 animate-shake backdrop-blur-sm">
          <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-300 leading-snug">{error}</p>
        </div>
      )}

      {/* ====== Stage: Input (Phone or Email) ====== */}
      {stage === 'input' && (
        <div className="space-y-5">
          {/* Phone / Email toggle */}
          <div className="flex p-1 rounded-2xl bg-card border border-themed-strong">
            <button
              type="button"
              onClick={() => { setTab('phone'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                tab === 'phone'
                  ? 'gradient-brand text-white shadow-md'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              <Phone className="h-4 w-4" />
              Phone
            </button>
            <button
              type="button"
              onClick={() => { setTab('email'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                tab === 'email'
                  ? 'gradient-brand text-white shadow-md'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
          </div>

          {tab === 'phone' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Phone Number</label>
                <PhoneInput value={phone} onValueChange={setPhone} />
              </div>
              <Button
                size="xl"
                className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
                onClick={handlePhoneContinue}
                loading={submitting}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
                    className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                size="xl"
                className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
                onClick={handleEmailLogin}
                loading={submitting}
              >
                Sign In
              </Button>
            </>
          )}

          {/* Divider + Sign up */}
          <div className="pt-2">
            <div className="relative flex items-center gap-4 mb-4">
              <div className="flex-1 h-px bg-themed" />
              <span className="text-xs text-subtle font-medium">or</span>
              <div className="flex-1 h-px bg-themed" />
            </div>
            <p className="text-center text-sm text-muted">
              New rider?{' '}
              <Link href="/register" className="text-brand-400 font-semibold hover:text-brand-300 transition-colors">
                Join the team
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* ====== Stage: Method Selection ====== */}
      {stage === 'method-select' && (
        <div className="space-y-3">
          <div className="text-center mb-5">
            <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-brand-500/10 flex items-center justify-center ring-4 ring-brand-500/5">
              <ShieldCheck className="h-7 w-7 text-brand-400" />
            </div>
            <p className="text-sm font-semibold text-primary mb-0.5">Verify your identity</p>
            <p className="text-muted text-xs">
              Signing in as <span className="text-secondary font-medium">{phone}</span>
            </p>
          </div>

          {/* Biometric option */}
          {methods?.biometric && biometricAvailable && (
            <button
              onClick={handleBiometricLogin}
              disabled={submitting}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-card border border-themed hover:border-brand-500/40 hover:bg-card-elevated transition-all group btn-press disabled:opacity-50"
            >
              <div className="h-11 w-11 rounded-xl gradient-brand flex items-center justify-center shrink-0 shadow-lg glow-brand group-hover:scale-105 transition-transform">
                <Fingerprint className="h-5 w-5 text-white" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-primary font-semibold text-sm">Fingerprint / Face ID</p>
                <p className="text-muted text-xs mt-0.5">Quick and secure</p>
              </div>
              <div className="text-[10px] text-brand-400 font-bold px-2 py-1 rounded-lg bg-brand-500/10 shrink-0">
                Fastest
              </div>
              <ChevronRight className="h-4 w-4 text-muted shrink-0" />
            </button>
          )}

          {/* PIN option */}
          {methods?.pin && (
            <button
              onClick={() => { setError(''); setStage('pin'); }}
              disabled={submitting}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-card border border-themed hover:border-emerald-500/40 hover:bg-card-elevated transition-all group btn-press disabled:opacity-50"
            >
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <KeyRound className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-primary font-semibold text-sm">Enter PIN</p>
                <p className="text-muted text-xs mt-0.5">Your 6-digit security PIN</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted shrink-0" />
            </button>
          )}

          {/* OTP option */}
          <button
            onClick={handleSendOtp}
            disabled={submitting}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-card border border-themed hover:border-blue-500/40 hover:bg-card-elevated transition-all group btn-press disabled:opacity-50"
          >
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquare className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-primary font-semibold text-sm">Send OTP</p>
              <p className="text-muted text-xs mt-0.5">One-time code via SMS</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted shrink-0" />
          </button>
        </div>
      )}

      {/* ====== Stage: PIN Entry ====== */}
      {stage === 'pin' && (
        <div className="space-y-5">
          <div className="text-center glass-elevated rounded-2xl p-5">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center ring-4 ring-emerald-500/5">
              <KeyRound className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-primary font-semibold mb-0.5">Enter your PIN</p>
            <p className="text-muted text-xs">
              6-digit PIN for <span className="text-secondary font-medium">{phone}</span>
            </p>
          </div>

          <OtpInput
            ref={pinRef}
            length={6}
            onChange={(code) => setPin(code)}
            onComplete={handlePinComplete}
            disabled={submitting}
          />

          <Button
            size="xl"
            className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
            onClick={() => handlePinComplete(pin)}
            loading={submitting}
            disabled={submitting || pin.length < 6}
          >
            Sign In
          </Button>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { setError(''); setStage('method-select'); }}
              className="text-sm text-muted hover:text-brand-400 transition-colors font-medium"
            >
              Different method
            </button>
            <span className="text-subtle">|</span>
            <Link
              href={`/forgot-pin?phone=${encodeURIComponent(phone)}`}
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors font-medium"
            >
              Forgot PIN?
            </Link>
          </div>
        </div>
      )}

      {/* ====== Stage: OTP Entry ====== */}
      {stage === 'otp' && (
        <div className="space-y-5">
          <div className="text-center glass-elevated rounded-2xl p-5">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center ring-4 ring-blue-500/5">
              <MessageSquare className="h-6 w-6 text-blue-400" />
            </div>
            <p className="text-primary font-semibold mb-0.5">Enter verification code</p>
            <p className="text-secondary text-xs">
              Sent to <span className="font-medium">{phone}</span>
            </p>
          </div>

          <OtpInput
            ref={otpRef}
            length={6}
            onChange={(code) => setOtp(code)}
            onComplete={handleOtpComplete}
            disabled={submitting}
          />

          <Button
            size="xl"
            className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
            onClick={() => handleOtpComplete(otp)}
            loading={submitting}
            disabled={submitting || otp.length < 6}
          >
            Verify & Sign In
          </Button>

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setError(''); setStage('method-select'); }}
              className="text-sm text-muted hover:text-brand-400 transition-colors font-medium"
            >
              Different method
            </button>
            <button
              onClick={handleSendOtp}
              disabled={submitting || cooldown > 0}
              className="text-sm font-medium transition-colors disabled:opacity-50"
            >
              {cooldown > 0 ? (
                <span className="text-muted">Resend in <span className="tabular-nums font-semibold text-secondary">{cooldown}s</span></span>
              ) : (
                <span className="text-brand-400 hover:text-brand-300">Resend code</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ====== Stage: Biometric in progress ====== */}
      {stage === 'biometric' && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="mx-auto mb-5 h-20 w-20 rounded-3xl gradient-brand flex items-center justify-center shadow-lg glow-brand animate-pulse">
              <Fingerprint className="h-10 w-10 text-white" />
            </div>
            <p className="text-primary font-bold text-lg mb-1">Verifying identity…</p>
            <p className="text-muted text-sm">
              Use your fingerprint or Face ID
            </p>
          </div>

          <Button
            variant="outline"
            size="xl"
            className="w-full rounded-2xl font-semibold"
            onClick={() => { setError(''); setStage('method-select'); }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
