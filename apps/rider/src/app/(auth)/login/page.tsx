'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, hasBiometricForPhone, isBiometricSupported } from '@riderguy/auth';
import { Button, Input, OtpInput, PhoneInput } from '@riderguy/ui';
import { phoneSchema, pinSchema, emailSchema, passwordSchema } from '@riderguy/validators';
import { Fingerprint, KeyRound, MessageSquare, Phone, Mail, AlertCircle, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';

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

  // OTP resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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
      localStorage.setItem(LAST_PHONE_KEY, phone);

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
      localStorage.setItem(LAST_METHOD_KEY, 'otp');
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
      localStorage.setItem(LAST_METHOD_KEY, 'pin');
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
      localStorage.setItem(LAST_METHOD_KEY, 'biometric');
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
      {/* Header */}
      {stage === 'input' ? (
        <>
          <h2 className="text-3xl font-extrabold text-primary mb-1 tracking-tight">Welcome back</h2>
          <p className="text-muted mb-8">Sign in to continue delivering</p>
        </>
      ) : (
        <button onClick={goBack} className="flex items-center gap-2 text-muted hover:text-primary transition-colors mb-6 group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-3.5 rounded-2xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-3 animate-shake backdrop-blur-sm">
          <AlertCircle className="h-5 w-5 text-danger-400 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-300">{error}</p>
        </div>
      )}

      {/* ====== Stage: Input (Phone or Email) ====== */}
      {stage === 'input' && (
        <div className="space-y-6">
          {/* Phone / Email toggle */}
          <div className="flex p-1 rounded-xl bg-card border border-themed-strong">
            <button
              type="button"
              onClick={() => { setTab('phone'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
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
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
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
                <label className="block text-sm font-medium text-secondary mb-2.5">Phone Number</label>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
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

          <p className="text-center text-sm text-muted mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-400 font-semibold hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      )}

      {/* ====== Stage: Method Selection ====== */}
      {stage === 'method-select' && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-brand-400" />
            </div>
            <p className="text-secondary text-sm">
              Choose how to sign in as <span className="text-primary font-semibold">{phone}</span>
            </p>
          </div>

          {/* Biometric option */}
          {methods?.biometric && biometricAvailable && (
            <button
              onClick={handleBiometricLogin}
              disabled={submitting}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-themed hover:border-brand-500/50 transition-all group btn-press disabled:opacity-50"
            >
              <div className="h-12 w-12 rounded-xl gradient-brand flex items-center justify-center shrink-0 shadow-lg glow-brand">
                <Fingerprint className="h-6 w-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="text-primary font-semibold">Fingerprint / Face ID</p>
                <p className="text-muted text-xs mt-0.5">Quick and secure biometric login</p>
              </div>
              <div className="text-xs text-brand-400 font-medium px-2 py-1 rounded-lg bg-brand-500/10">
                Fastest
              </div>
            </button>
          )}

          {/* PIN option */}
          {methods?.pin && (
            <button
              onClick={() => { setError(''); setStage('pin'); }}
              disabled={submitting}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-themed hover:border-brand-500/50 transition-all group btn-press disabled:opacity-50"
            >
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <KeyRound className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-primary font-semibold">Enter PIN</p>
                <p className="text-muted text-xs mt-0.5">Use your 6-digit security PIN</p>
              </div>
            </button>
          )}

          {/* OTP option */}
          <button
            onClick={handleSendOtp}
            disabled={submitting}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-themed hover:border-brand-500/50 transition-all group btn-press disabled:opacity-50"
          >
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <MessageSquare className="h-6 w-6 text-blue-400" />
            </div>
            <div className="text-left flex-1">
              <p className="text-primary font-semibold">Send OTP</p>
              <p className="text-muted text-xs mt-0.5">Get a one-time code via SMS</p>
            </div>
          </button>
        </div>
      )}

      {/* ====== Stage: PIN Entry ====== */}
      {stage === 'pin' && (
        <div className="space-y-6">
          <div className="text-center mb-4 glass-elevated rounded-2xl p-5">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-primary font-semibold mb-1">Enter your PIN</p>
            <p className="text-muted text-sm">
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

          <div className="text-center space-y-2">
            <button
              onClick={() => { setError(''); setStage('method-select'); }}
              className="text-sm text-muted hover:text-brand-400 transition-colors font-medium"
            >
              Try a different method
            </button>
            <div>
              <Link
                href={`/forgot-pin?phone=${encodeURIComponent(phone)}`}
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors font-medium"
              >
                Forgot PIN?
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ====== Stage: OTP Entry ====== */}
      {stage === 'otp' && (
        <div className="space-y-6">
          <div className="text-center mb-4 glass-elevated rounded-2xl p-5">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-blue-400" />
            </div>
            <p className="text-primary font-semibold mb-1">Enter verification code</p>
            <p className="text-secondary text-sm">
              We sent a code to <span className="font-semibold">{phone}</span>
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
              Try a different method
            </button>
            <button
              onClick={handleSendOtp}
              disabled={submitting || cooldown > 0}
              className="text-sm text-muted hover:text-brand-400 transition-colors font-medium disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </div>
      )}

      {/* ====== Stage: Biometric in progress ====== */}
      {stage === 'biometric' && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg glow-brand animate-pulse">
              <Fingerprint className="h-8 w-8 text-white" />
            </div>
            <p className="text-primary font-semibold text-lg mb-1">Waiting for biometric...</p>
            <p className="text-muted text-sm">
              Use your fingerprint or Face ID to sign in
            </p>
          </div>

          <Button
            variant="outline"
            size="xl"
            className="w-full rounded-2xl font-semibold"
            onClick={() => { setError(''); setStage('method-select'); }}
          >
            Cancel & choose another method
          </Button>
        </div>
      )}
    </div>
  );
}
