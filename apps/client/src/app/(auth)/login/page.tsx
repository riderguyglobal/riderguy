'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, hasBiometricForPhone, isBiometricSupported } from '@riderguy/auth';
import { OtpInput, PhoneInput } from '@riderguy/ui';
import { phoneSchema, emailSchema, passwordSchema } from '@riderguy/validators';
import {
  Phone, Mail, AlertCircle, Eye, EyeOff, ArrowRight, ArrowLeft,
  Fingerprint, KeyRound, MessageSquare, ShieldCheck, Smartphone,
} from 'lucide-react';
import Link from 'next/link';

type Tab = 'phone' | 'email';
type Stage = 'input' | 'method-select' | 'pin' | 'otp' | 'biometric';

const LAST_PHONE_KEY = 'riderguy_client_last_phone';
const LAST_METHOD_KEY = 'riderguy_client_last_method';

export default function LoginPage() {
  const router = useRouter();
  const {
    loginWithPassword,
    loginWithOtp,
    loginWithPin,
    loginWithBiometric,
    requestOtp,
    checkAuthMethods,
    isAuthenticated,
    isLoading,
  } = useAuth();

  const [tab, setTab] = useState<Tab>('phone');
  const [stage, setStage] = useState<Stage>('input');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [methods, setMethods] = useState<{ otp: boolean; pin: boolean; biometric: boolean } | null>(null);
  const otpRef = useRef<{ clear: () => void; focus: () => void }>(null);
  const pinRef = useRef<{ clear: () => void; focus: () => void }>(null);

  // Biometric support (client-side)
  const biometricAvailable = isBiometricSupported();

  // Restore last-used phone on mount
  useEffect(() => {
    try {
      const lastPhone = localStorage.getItem(LAST_PHONE_KEY);
      if (lastPhone) setPhone(lastPhone);
    } catch { /* SSR / no localStorage */ }
  }, []);

  // OTP resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Redirect authenticated users
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  // ── Step 1: Check available methods for the phone ──
  const handlePhoneContinue = async () => {
    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      localStorage.setItem(LAST_PHONE_KEY, phone);
      const serverMethods = await checkAuthMethods(phone);
      const localBiometric = biometricAvailable && hasBiometricForPhone(phone);
      const finalMethods = {
        ...serverMethods,
        biometric: serverMethods.biometric && localBiometric,
      };
      setMethods(finalMethods);

      // Smart auto-routing based on last used method
      const lastMethod = localStorage.getItem(LAST_METHOD_KEY);
      if (lastMethod === 'biometric' && finalMethods.biometric) {
        setStage('biometric');
        handleBiometricLogin();
        return;
      }
      if (lastMethod === 'pin' && finalMethods.pin) {
        setStage('pin');
        return;
      }
      // If only OTP is available, skip method select
      if (!finalMethods.pin && !finalMethods.biometric) {
        await handleSendOtp();
        return;
      }
      setStage('method-select');
    } catch {
      setMethods({ otp: true, pin: true, biometric: false });
      setStage('method-select');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Flow ──
  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await requestOtp(phone, 'LOGIN');
      setStage('otp');
      setCooldown(60);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setError(msg || 'Failed to send code. Check your number.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpComplete = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      await loginWithOtp(phone, code);
      localStorage.setItem(LAST_METHOD_KEY, 'otp');
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setError(msg || 'Invalid verification code.');
      otpRef.current?.clear();
      otpRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── PIN Flow ──
  const handlePinComplete = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      await loginWithPin(phone, code);
      localStorage.setItem(LAST_METHOD_KEY, 'pin');
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setError(msg || 'Invalid PIN.');
      pinRef.current?.clear();
      pinRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Biometric Flow ──
  const handleBiometricLogin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithBiometric(phone);
      localStorage.setItem(LAST_METHOD_KEY, 'biometric');
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message;
      setError(msg || 'Biometric login failed');
      setStage('method-select');
    } finally {
      setLoading(false);
    }
  }, [phone, loginWithBiometric, router]);

  // ── Email/Password Flow ──
  const handleEmailSubmit = async () => {
    if (!email || !password) return;
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setError(emailResult.error.errors[0]?.message ?? 'Invalid email');
      return;
    }
    const pwResult = passwordSchema.safeParse(password);
    if (!pwResult.success) {
      setError(pwResult.error.errors[0]?.message ?? 'Invalid password');
      return;
    }
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

  // Whether we're in the multi-stage phone flow (past the initial input)
  const inPhoneFlow = tab === 'phone' && stage !== 'input';

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      {inPhoneFlow ? (
        <button onClick={goBack} className="flex items-center gap-2 text-surface-500 hover:text-surface-900 transition-colors group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>
      ) : (
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900 mb-1">Welcome back</h1>
          <p className="text-surface-500 text-sm">Sign in to send packages</p>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-danger-50 border border-danger-100 flex items-start gap-2.5 animate-shake">
          <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* ── Sliding Segmented Control (hidden during multi-step phone flow) ── */}
      {!inPhoneFlow && (
        <div className="relative flex p-1 bg-surface-100 rounded-2xl">
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow-card transition-all duration-300 ease-out"
            style={{ width: 'calc(50% - 4px)', left: tab === 'phone' ? '4px' : 'calc(50% + 0px)' }}
          />
          {([
            { key: 'phone' as Tab, icon: Phone, label: 'Phone' },
            { key: 'email' as Tab, icon: Mail, label: 'Email' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(''); setStage('input'); }}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                tab === key ? 'text-surface-900' : 'text-surface-400 hover:text-surface-600'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ═══════ Phone Tab ═══════ */}
      {tab === 'phone' && (
        <>
          {/* ── Stage: Phone Input ── */}
          {stage === 'input' && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Phone number</label>
                <PhoneInput value={phone} onValueChange={setPhone} placeholder="024 XXX XXXX" />
              </div>
              <button
                onClick={handlePhoneContinue}
                disabled={loading || !phone}
                className="w-full h-13 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand hover:shadow-lg transition-all btn-press disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Continue <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          )}

          {/* ── Stage: Method Selection ── */}
          {stage === 'method-select' && (
            <div className="space-y-3 animate-fade-in">
              <div className="text-center mb-4">
                <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-brand-500" />
                </div>
                <p className="text-surface-500 text-sm">
                  Choose how to sign in as <span className="text-surface-900 font-semibold">{phone}</span>
                </p>
              </div>

              {/* Biometric option */}
              {methods?.biometric && biometricAvailable && (
                <button
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-surface-200 hover:border-brand-400 transition-all btn-press disabled:opacity-50 card-interactive"
                >
                  <div className="h-12 w-12 rounded-xl brand-gradient flex items-center justify-center shrink-0 shadow-brand">
                    <Fingerprint className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-surface-900 font-semibold text-sm">Fingerprint / Face ID</p>
                    <p className="text-surface-400 text-xs mt-0.5">Quick and secure biometric login</p>
                  </div>
                  <span className="text-[10px] text-brand-600 font-bold px-2 py-1 rounded-lg bg-brand-50">
                    Fastest
                  </span>
                </button>
              )}

              {/* PIN option */}
              {methods?.pin && (
                <button
                  onClick={() => { setError(''); setStage('pin'); }}
                  disabled={loading}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-surface-200 hover:border-brand-400 transition-all btn-press disabled:opacity-50 card-interactive"
                >
                  <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <KeyRound className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-surface-900 font-semibold text-sm">Enter PIN</p>
                    <p className="text-surface-400 text-xs mt-0.5">Use your 6-digit security PIN</p>
                  </div>
                </button>
              )}

              {/* OTP option */}
              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-surface-200 hover:border-brand-400 transition-all btn-press disabled:opacity-50 card-interactive"
              >
                <div className="h-12 w-12 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-6 w-6 text-sky-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-surface-900 font-semibold text-sm">Send OTP</p>
                  <p className="text-surface-400 text-xs mt-0.5">Get a one-time code via SMS</p>
                </div>
              </button>
            </div>
          )}

          {/* ── Stage: PIN Entry ── */}
          {stage === 'pin' && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center card-elevated p-5">
                <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <KeyRound className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-surface-900 font-semibold mb-1">Enter your PIN</p>
                <p className="text-surface-400 text-sm">
                  6-digit PIN for <span className="text-surface-700 font-medium">{phone}</span>
                </p>
              </div>

              <OtpInput
                ref={pinRef}
                length={6}
                variant="light"
                onChange={(code) => setPin(code)}
                onComplete={handlePinComplete}
                disabled={loading}
              />

              <button
                onClick={() => handlePinComplete(pin)}
                disabled={loading || pin.length < 6}
                className="w-full h-13 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand hover:shadow-lg transition-all btn-press disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="h-4 w-4" /></>
                )}
              </button>

              <button
                onClick={() => { setError(''); setStage('method-select'); }}
                className="w-full text-sm text-surface-500 font-medium hover:text-brand-500 transition-colors"
              >
                Try a different method
              </button>
              <Link
                href={`/forgot-pin?phone=${encodeURIComponent(phone)}`}
                className="block w-full text-center text-sm text-amber-500 font-medium hover:text-amber-400 transition-colors"
              >
                Forgot PIN?
              </Link>
            </div>
          )}

          {/* ── Stage: OTP Entry ── */}
          {stage === 'otp' && (
            <div className="space-y-5 animate-fade-in">
              <div className="card-elevated p-5 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto">
                  <Smartphone className="h-6 w-6 text-sky-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-900">Enter verification code</p>
                  <p className="text-xs text-surface-400 mt-1">Sent to {phone}</p>
                </div>
              </div>

              <OtpInput
                ref={otpRef}
                length={6}
                variant="light"
                onChange={setOtp}
                onComplete={(code) => { setOtp(code); handleOtpComplete(code); }}
                disabled={loading}
              />

              <button
                onClick={() => handleOtpComplete(otp)}
                disabled={loading || otp.length < 6}
                className="w-full h-13 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand hover:shadow-lg transition-all btn-press disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Verify & Sign In <ArrowRight className="h-4 w-4" /></>
                )}
              </button>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setError(''); setStage('method-select'); }}
                  className="text-sm text-surface-500 font-medium hover:text-brand-500 transition-colors"
                >
                  Try a different method
                </button>
                <button
                  onClick={handleSendOtp}
                  disabled={loading || cooldown > 0}
                  className="text-sm text-surface-500 font-medium hover:text-brand-500 transition-colors disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>
          )}

          {/* ── Stage: Biometric in progress ── */}
          {stage === 'biometric' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center py-8">
                <div className="mx-auto mb-4 h-16 w-16 rounded-2xl brand-gradient flex items-center justify-center shadow-brand animate-pulse">
                  <Fingerprint className="h-8 w-8 text-white" />
                </div>
                <p className="text-surface-900 font-semibold text-lg mb-1">Waiting for biometric...</p>
                <p className="text-surface-400 text-sm">
                  Use your fingerprint or Face ID to sign in
                </p>
              </div>
              <button
                onClick={() => { setError(''); setStage('method-select'); }}
                className="w-full h-12 rounded-xl border border-surface-200 text-surface-600 font-medium text-sm hover:bg-surface-50 transition-all btn-press"
              >
                Cancel & choose another method
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══════ Email Tab ═══════ */}
      {tab === 'email' && (
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

      {/* ── Sign up link (hidden during multi-step) ── */}
      {!inPhoneFlow && (
        <p className="text-center text-sm text-surface-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-brand-500 font-semibold hover:text-brand-600">
            Sign up
          </Link>
        </p>
      )}
    </div>
  );
}
