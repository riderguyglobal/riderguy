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
  ChevronRight,
} from 'lucide-react';

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

  // OTP resend cooldown timer â€” uses Date.now() delta so it stays correct when iOS backgrounds Safari
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

  // Redirect authenticated users
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  // â”€â”€ Step 1: Check available methods for the phone â”€â”€
  const handlePhoneContinue = async () => {
    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      try { localStorage.setItem(LAST_PHONE_KEY, phone); } catch {}
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

  // â”€â”€ OTP Flow â”€â”€
  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await requestOtp(phone, 'LOGIN');
      setStage('otp');
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
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
      try { localStorage.setItem(LAST_METHOD_KEY, 'otp'); } catch {}
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

  // â”€â”€ PIN Flow â”€â”€
  const handlePinComplete = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      await loginWithPin(phone, code);
      try { localStorage.setItem(LAST_METHOD_KEY, 'pin'); } catch {}
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

  // â”€â”€ Biometric Flow â”€â”€
  const handleBiometricLogin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithBiometric(phone);
      try { localStorage.setItem(LAST_METHOD_KEY, 'biometric'); } catch {}
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message;
      setError(msg || 'Biometric login failed');
      setStage('method-select');
    } finally {
      setLoading(false);
    }
  }, [phone, loginWithBiometric, router]);

  // â”€â”€ Email/Password Flow â”€â”€
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
    <div>
      {/* â”€â”€ Back button (multi-step phone flow) â”€â”€ */}
      {inPhoneFlow && (
        <button onClick={goBack} className="flex items-center gap-2 text-surface-400 hover:text-surface-900 transition-colors group mb-6">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}

      {/* â”€â”€ Heading (initial stage only) â”€â”€ */}
      {!inPhoneFlow && (
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight leading-tight">Welcome back</h1>
          <p className="text-surface-400 text-base mt-2">Sign in to your RiderGuy account</p>
        </div>
      )}

      {/* â”€â”€ Error banner â”€â”€ */}
      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 animate-shake">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 leading-snug">{error}</p>
        </div>
      )}

      {/* â”€â”€ Segmented toggle (initial stage) â”€â”€ */}
      {!inPhoneFlow && (
        <div className="flex gap-0 mb-8 border-b border-surface-200">
          {([
            { key: 'phone' as Tab, icon: Phone, label: 'Phone' },
            { key: 'email' as Tab, icon: Mail, label: 'Email' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(''); setStage('input'); }}
              className={`flex items-center justify-center gap-2 pb-3.5 px-6 text-base font-semibold transition-all border-b-2 -mb-px ${
                tab === key
                  ? 'text-brand-500 border-brand-500'
                  : 'text-surface-400 border-transparent hover:text-surface-600'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* â•â•â•â•â•â•â• Phone Tab â•â•â•â•â•â•â• */}
      {tab === 'phone' && (
        <>
          {/* â”€â”€ Stage: Phone Input â”€â”€ */}
          {stage === 'input' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-base font-medium text-surface-600 mb-2.5">Phone number</label>
                <PhoneInput value={phone} onValueChange={setPhone} placeholder="024 XXX XXXX" />
              </div>
              <button
                onClick={handlePhoneContinue}
                disabled={loading || !phone}
                className="w-full h-[56px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-base transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.28)] hover:shadow-[0_4px_32px_rgba(34,197,94,0.42)]"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Continue <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          )}

          {/* â”€â”€ Stage: Method Selection â”€â”€ */}
          {stage === 'method-select' && (
            <div className="space-y-3 animate-fade-in">
              <div className="text-center mb-5">
                <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-brand-500" />
                </div>
                <p className="text-sm font-semibold text-surface-900">Verify your identity</p>
                <p className="text-surface-400 text-xs mt-1">
                  Signing in as <span className="text-surface-600 font-medium">{phone}</span>
                </p>
              </div>

              {methods?.biometric && biometricAvailable && (
                <button
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-surface-50 border border-surface-200 hover:border-brand-500/40 hover:bg-brand-50 transition-all btn-press disabled:opacity-50 group"
                >
                  <div className="h-10 w-10 rounded-full bg-brand-500 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(34,197,94,0.35)] group-hover:shadow-[0_0_24px_rgba(34,197,94,0.5)] transition-shadow">
                    <Fingerprint className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-surface-900 font-semibold text-sm">Fingerprint / Face ID</p>
                    <p className="text-surface-400 text-xs">Quick and secure</p>
                  </div>
                  <span className="text-[10px] text-brand-400 font-bold px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 shrink-0">Fastest</span>
                  <ChevronRight className="h-4 w-4 text-surface-300 shrink-0" />
                </button>
              )}

              {methods?.pin && (
                <button
                  onClick={() => { setError(''); setStage('pin'); }}
                  disabled={loading}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-surface-50 border border-surface-200 hover:border-brand-500/40 hover:bg-brand-50 transition-all btn-press disabled:opacity-50 group"
                >
                  <div className="h-10 w-10 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center shrink-0">
                    <KeyRound className="h-5 w-5 text-surface-600" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-surface-900 font-semibold text-sm">Enter PIN</p>
                    <p className="text-surface-400 text-xs">Your 6-digit security PIN</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-300 shrink-0" />
                </button>
              )}

              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-surface-50 border border-surface-200 hover:border-brand-500/40 hover:bg-brand-50 transition-all btn-press disabled:opacity-50 group"
              >
                <div className="h-10 w-10 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-5 w-5 text-surface-600" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-surface-900 font-semibold text-sm">Send OTP</p>
                  <p className="text-surface-400 text-xs">One-time code via SMS</p>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-300 shrink-0" />
              </button>
            </div>
          )}

          {/* â”€â”€ Stage: PIN Entry â”€â”€ */}
          {stage === 'pin' && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center mb-2">
                <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-surface-600" />
                </div>
                <p className="text-surface-900 font-semibold text-sm">Enter your PIN</p>
                <p className="text-surface-400 text-xs mt-1">
                  6-digit PIN for <span className="text-surface-600 font-medium">{phone}</span>
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
                className="w-full h-[52px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press disabled:opacity-40 flex items-center justify-center shadow-[0_4px_24px_rgba(34,197,94,0.25)]"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="flex items-center justify-center gap-3 text-sm">
                <button onClick={() => { setError(''); setStage('method-select'); }} className="text-surface-400 font-medium hover:text-surface-600 transition-colors">
                  Different method
                </button>
                <span className="text-surface-200">&middot;</span>
                <Link href={`/forgot-pin?phone=${encodeURIComponent(phone)}`} className="text-amber-400 font-medium hover:text-amber-300 transition-colors">
                  Forgot PIN?
                </Link>
              </div>
            </div>
          )}

          {/* â”€â”€ Stage: OTP Entry â”€â”€ */}
          {stage === 'otp' && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center mb-2">
                <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-surface-600" />
                </div>
                <p className="text-surface-900 font-semibold text-sm">Enter verification code</p>
                <p className="text-surface-400 text-xs mt-1">Sent to <span className="font-medium text-surface-600">{phone}</span></p>
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
                className="w-full h-[52px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press disabled:opacity-40 flex items-center justify-center shadow-[0_4px_24px_rgba(34,197,94,0.25)]"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Verify & Sign In'
                )}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button onClick={() => { setError(''); setStage('method-select'); }} className="text-surface-400 font-medium hover:text-surface-600 transition-colors">
                  Different method
                </button>
                <button onClick={handleSendOtp} disabled={loading || cooldown > 0} className="font-medium transition-colors disabled:opacity-50">
                  {cooldown > 0 ? (
                    <span className="text-surface-400">Resend in <span className="tabular-nums font-semibold text-surface-500">{cooldown}s</span></span>
                  ) : (
                    <span className="text-brand-500 hover:text-brand-400">Resend code</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ Stage: Biometric â”€â”€ */}
          {stage === 'biometric' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center py-10">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-brand-500 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.5)] animate-pulse">
                  <Fingerprint className="h-8 w-8 text-white" />
                </div>
                <p className="text-surface-900 font-bold text-lg mb-1">Verifying identity&hellip;</p>
                <p className="text-surface-400 text-sm">Use your fingerprint or Face ID</p>
              </div>
              <button
                onClick={() => { setError(''); setStage('method-select'); }}
                className="w-full h-11 rounded-xl border border-surface-200 text-surface-500 font-medium text-sm hover:bg-surface-100 hover:text-surface-900 transition-all btn-press"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {/* â•â•â•â•â•â•â• Email Tab â•â•â•â•â•â•â• */}
      {tab === 'email' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <label className="block text-base font-medium text-surface-600 mb-2.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-surface-600 mb-2.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 pr-12 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors p-1"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm font-medium text-brand-500 hover:text-brand-400 transition-colors">
              Forgot password?
            </Link>
          </div>
          <button
            onClick={handleEmailSubmit}
            disabled={loading || !email || !password}
            className="w-full h-[56px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-base transition-all btn-press disabled:opacity-40 flex items-center justify-center shadow-[0_4px_24px_rgba(34,197,94,0.25)]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </div>
      )}

      {/* â”€â”€ Sign up link â”€â”€ */}
      {!inPhoneFlow && (
        <div className="mt-10 text-center">
          <p className="text-base text-surface-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-500 font-semibold hover:text-brand-400 transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
