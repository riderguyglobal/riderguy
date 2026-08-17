'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, hasBiometricForPhone, isBiometricSupported } from '@riderguy/auth';
import { OtpInput, PhoneInput } from '@riderguy/ui';
import { phoneSchema, emailSchema, passwordSchema } from '@riderguy/validators';
import {
  Mail, AlertCircle, Eye, EyeOff, ArrowLeft,
  Fingerprint, KeyRound, MessageSquare, ShieldCheck, Smartphone,
  ChevronRight, CreditCard, ChevronDown, ChevronUp,
} from 'lucide-react';

type Tab   = 'phone' | 'email' | 'ghanacard';
type Stage = 'input' | 'method-select' | 'pin' | 'otp' | 'biometric';

const LAST_PHONE_KEY  = 'riderguy_client_last_phone';
const LAST_METHOD_KEY = 'riderguy_client_last_method';

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.388 17.64 12.08 17.64 9.205z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIconWhite() {
  return (
    <svg width="12" height="15" viewBox="0 0 814 1000" fill="#ffffff">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.5 263-317.5 70.2 0 128.7 45.8 172.8 45.8 42.3 0 108.9-48.4 190.3-48.4 27.5 0 127.7 3.2 197.2 101z"/>
      <path d="M549.9 143.8c24.9-30.6 42.9-73.1 42.9-115.7 0-6.4-.6-12.8-1.9-19.2-40.2 1.3-87.9 27.5-116.4 61.4-22.4 26.2-43.6 68.8-43.6 112.4 0 7.1.6 14.2 1.3 16.5 2.6.6 6.5 1.3 10.4 1.3 36.7 0 82.4-24.9 107.3-56.7z"/>
    </svg>
  );
}

function LockIcon({ active }: { active?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#15803d' : '#a0aab8'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'stroke 0.2s ease' }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const {
    loginWithPassword, loginWithOtp, loginWithPin, loginWithBiometric,
    loginWithGhanaCard, requestOtp, checkAuthMethods, isAuthenticated, isLoading,
  } = useAuth();

  const [tab,   setTab]   = useState<Tab>('phone');
  const [stage, setStage] = useState<Stage>('input');

  const [phone,        setPhone]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [email,        setEmail]        = useState('');
  const [emailPw,      setEmailPw]      = useState('');
  const [showEmailPw,  setShowEmailPw]  = useState(false);
  const [pin,          setPin]          = useState('');
  const [otp,          setOtp]          = useState('');

  const [ghanaNum,     setGhanaNum]     = useState('');
  const [ghanaPw,      setGhanaPw]      = useState('');
  const [showGhanaPw,  setShowGhanaPw]  = useState(false);
  const [ghanaLoading, setGhanaLoading] = useState(false);
  const [ghanaPin,     setGhanaPin]     = useState(false);
  const [ghanaPinCode, setGhanaPinCode] = useState('');

  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [cooldown,  setCooldown]  = useState(0);
  const [methods,   setMethods]   = useState<{ otp: boolean; pin: boolean; biometric: boolean } | null>(null);
  const [showMore,  setShowMore]  = useState(false);

  const otpRef      = useRef<{ clear: () => void; focus: () => void }>(null);
  const pinRef      = useRef<{ clear: () => void; focus: () => void }>(null);
  const ghanaPinRef = useRef<{ clear: () => void; focus: () => void }>(null);

  const biometricAvailable = isBiometricSupported();

  useEffect(() => {
    try { const p = localStorage.getItem(LAST_PHONE_KEY); if (p) setPhone(p); } catch {}
  }, []);

  const cooldownEndRef = useRef(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const tick = () => { const r = Math.ceil((cooldownEndRef.current - Date.now()) / 1000); setCooldown(r > 0 ? r : 0); };
    const t = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [cooldown > 0]);

  useEffect(() => { if (!isLoading && isAuthenticated) router.replace('/dashboard'); }, [isLoading, isAuthenticated, router]);

  const handlePhonePasswordSubmit = async () => {
    const r = phoneSchema.safeParse(phone);
    if (!r.success) { setError(r.error.errors[0]?.message ?? 'Invalid phone number'); return; }
    if (!password)  { setError('Please enter your password'); return; }
    setLoading(true); setError('');
    try {
      try { localStorage.setItem(LAST_PHONE_KEY, phone); } catch {}
      await loginWithPassword(phone, password);
      router.replace('/dashboard');
    } catch (e: any) { setError(e?.response?.data?.error?.message || 'Incorrect phone number or password.'); }
    finally { setLoading(false); }
  };

  const handleCheckMethods = async () => {
    const r = phoneSchema.safeParse(phone);
    if (!r.success) { setError(r.error.errors[0]?.message ?? 'Invalid phone number'); return; }
    setLoading(true); setError('');
    try {
      try { localStorage.setItem(LAST_PHONE_KEY, phone); } catch {}
      const srv  = await checkAuthMethods(phone);
      const bio  = biometricAvailable && hasBiometricForPhone(phone);
      const fin  = { ...srv, biometric: srv.biometric && bio };
      setMethods(fin);
      const last = localStorage.getItem(LAST_METHOD_KEY);
      if (last === 'biometric' && fin.biometric) { setStage('biometric'); handleBiometricLogin(); return; }
      if (last === 'pin'       && fin.pin)        { setStage('pin'); return; }
      if (!fin.pin && !fin.biometric)             { await handleSendOtp(); return; }
      setStage('method-select');
    } catch { setMethods({ otp: true, pin: false, biometric: false }); await handleSendOtp(); }
    finally { setLoading(false); }
  };

  const handleSendOtp = async () => {
    setLoading(true); setError('');
    try {
      await requestOtp(phone, 'LOGIN');
      setStage('otp'); setCooldown(60); cooldownEndRef.current = Date.now() + 60_000;
    } catch (e: any) { setError(e?.response?.data?.error?.message || 'Failed to send code. Check your number.'); }
    finally { setLoading(false); }
  };

  const handleOtpComplete = async (code: string) => {
    setLoading(true); setError('');
    try {
      await loginWithOtp(phone, code);
      try { localStorage.setItem(LAST_METHOD_KEY, 'otp'); } catch {}
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Invalid verification code.');
      otpRef.current?.clear(); otpRef.current?.focus();
    } finally { setLoading(false); }
  };

  const handlePinComplete = async (code: string) => {
    setLoading(true); setError('');
    try {
      await loginWithPin(phone, code);
      try { localStorage.setItem(LAST_METHOD_KEY, 'pin'); } catch {}
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Invalid PIN.');
      pinRef.current?.clear(); pinRef.current?.focus();
    } finally { setLoading(false); }
  };

  const handleBiometricLogin = useCallback(async () => {
    setLoading(true); setError('');
    try {
      await loginWithBiometric(phone);
      try { localStorage.setItem(LAST_METHOD_KEY, 'biometric'); } catch {}
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e?.message ?? 'Biometric login failed');
      setStage('method-select');
    } finally { setLoading(false); }
  }, [phone, loginWithBiometric, router]);

  const handleEmailSubmit = async () => {
    if (!email || !emailPw) return;
    const er = emailSchema.safeParse(email);     if (!er.success) { setError(er.error.errors[0]?.message ?? 'Invalid email');    return; }
    const pr = passwordSchema.safeParse(emailPw); if (!pr.success) { setError(pr.error.errors[0]?.message ?? 'Invalid password'); return; }
    setLoading(true); setError('');
    try { await loginWithPassword(email, emailPw); router.replace('/dashboard'); }
    catch { setError('Invalid email or password.'); }
    finally { setLoading(false); }
  };

  const formatGhanaCard = (val: string) => {
    const raw = val.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 13);
    if (raw.length <= 3) return raw;
    if (raw.length <= 12) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 12)}-${raw.slice(12)}`;
  };

  const handleGhanaSubmit = async () => {
    if (!ghanaNum || !ghanaPw) { setError('Please fill in all fields'); return; }
    setGhanaLoading(true); setError('');
    try {
      const result = await loginWithGhanaCard(ghanaNum, ghanaPw);
      if (result?.requiresPin) {
        setGhanaPin(true);
      } else {
        router.replace('/dashboard');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Invalid Ghana Card number or password.');
    } finally { setGhanaLoading(false); }
  };

  const handleGhanaPinComplete = async (code: string) => {
    setGhanaLoading(true); setError('');
    try {
      await loginWithPin(ghanaNum, code);
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Invalid PIN.');
      ghanaPinRef.current?.clear(); ghanaPinRef.current?.focus();
    } finally { setGhanaLoading(false); }
  };

  const goBack = () => {
    setError(''); setPin(''); setOtp('');
    if (tab === 'ghanacard' && ghanaPin) { setGhanaPin(false); }
    else if (stage === 'method-select')  { setStage('input'); setMethods(null); }
    else                                 { setStage('method-select'); }
  };

  const inPhoneFlow = tab === 'phone' && stage !== 'input';
  const inGhanaFlow = tab === 'ghanacard' && ghanaPin;
  const inMultiStep = inPhoneFlow || inGhanaFlow;

  /* ─── Design tokens ─── */
  const field = {
    wrapper: 'relative',
    base: [
      'w-full appearance-none',
      'bg-[#f3f4f6]',
      'border-2 border-transparent',
      'rounded-[11px]',
      'text-[14px] text-[#0f172a]',
      'placeholder:text-[#a0aab8]',
      'focus:outline-none focus:bg-white focus:border-[#15803d]/70',
      'transition-all duration-200',
    ].join(' '),
    height: 'h-[46px]',
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, letterSpacing: '0.4px', textTransform: 'uppercase' as const }}>
      {children}
    </label>
  );

  const PrimaryBtn = ({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full relative flex items-center justify-center btn-press disabled:opacity-50 transition-all duration-200"
      style={{
        height: 50,
        borderRadius: 13,
        background: disabled ? '#94a3b8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 55%, #0f6830 100%)',
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '0.1px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 18px rgba(21,128,61,0.38), 0 2px 6px rgba(21,128,61,0.18)',
      }}
    >
      {children}
      {!disabled && (
        <ChevronRight style={{ position: 'absolute', right: 14, width: 16, height: 16, opacity: 0.55 }} />
      )}
    </button>
  );

  const Spinner = () => (
    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
  );

  const MethodCard = ({ icon, title, sub, badge, onClick }: {
    icon: React.ReactNode; title: string; sub: string; badge?: string; onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 btn-press"
      style={{
        padding: '11px 13px', borderRadius: 15,
        background: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        border: 'none', cursor: 'pointer',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
        border: '1px solid rgba(21,128,61,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div className="text-left flex-1 min-w-0">
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{title}</p>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</p>
      </div>
      {badge && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#15803d',
          padding: '2px 7px', borderRadius: 99, flexShrink: 0,
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1px solid rgba(21,128,61,0.25)',
        }}>{badge}</span>
      )}
      <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronRight style={{ width: 12, height: 12, color: '#94a3b8' }} />
      </div>
    </button>
  );

  const StageCard = ({ children }: { children: React.ReactNode }) => (
    <div style={{ padding: 17, borderRadius: 18, textAlign: 'center', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', border: '1px solid #e2e8f0' }}>
      {children}
    </div>
  );

  const StageIcon = ({ children }: { children: React.ReactNode }) => (
    <div className="mx-auto flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 13, marginBottom: 10, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
      {children}
    </div>
  );

  const BackBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button type="button" onClick={onClick} className="flex items-center gap-2 mb-5 transition-colors">
      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowLeft style={{ width: 12, height: 12, color: '#64748b' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>{label}</span>
    </button>
  );

  return (
    <div>

      {inMultiStep && <BackBtn onClick={goBack} label="Back" />}

      {/* ── Heading ── */}
      {tab === 'phone' && !inMultiStep && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ width: 28, height: 3, borderRadius: 99, background: 'linear-gradient(to right, #16a34a, #4ade80)', marginBottom: 11 }} />
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 400 }}>
            Sign in to continue your journey
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="animate-shake" style={{
          marginBottom: 12, padding: '9px 12px', borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '3px solid #ef4444',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <AlertCircle style={{ width: 13, height: 13, color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: '#dc2626', lineHeight: 1.4 }}>{error}</p>
        </div>
      )}

      {/* ══════════ PHONE TAB ══════════ */}
      {tab === 'phone' && (
        <>
          {stage === 'input' && (
            <div className="animate-fade-in">

              {/* Phone */}
              <div style={{ marginBottom: 10 }}>
                <Label>Phone Number</Label>
                <PhoneInput value={phone} onValueChange={setPhone} placeholder="Enter your phone number" />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 6 }}>
                <Label>Password</Label>
                <div className={field.wrapper}>
                  <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
                    <LockIcon active={!!password} />
                  </span>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePhonePasswordSubmit()}
                    placeholder="Enter your password"
                    className={`${field.base} ${field.height} pl-[38px] pr-[40px]`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-[12px] top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#a0aab8' }}
                  >
                    {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              {/* Forgot */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 13 }}>
                <Link href="/forgot-password" style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>
                  Forgot password?
                </Link>
              </div>

              {/* Primary CTA */}
              <div style={{ marginBottom: 9 }}>
                <PrimaryBtn onClick={handlePhonePasswordSubmit} disabled={loading || !phone || !password}>
                  {loading ? <Spinner /> : 'Log In'}
                </PrimaryBtn>
              </div>

              {/* OTP / PIN ghost pill */}
              <div style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={handleCheckMethods}
                  disabled={loading || !phone}
                  className="w-full flex items-center justify-center gap-1.5 btn-press transition-all disabled:opacity-40"
                  style={{ height: 40, borderRadius: 11, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 12, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
                >
                  <KeyRound style={{ width: 12, height: 12, color: '#94a3b8' }} />
                  Sign in with OTP or PIN
                </button>
              </div>

              {/* Gradient divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #e2e8f0)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#c4cdd8', letterSpacing: '0.7px', textTransform: 'uppercase' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #e2e8f0)' }} />
              </div>

              {/* Social */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <a
                  href="/api/auth/google"
                  className="flex items-center justify-center gap-2 btn-press"
                  style={{ height: 46, borderRadius: 12, background: '#fff', border: '1.5px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none' }}
                >
                  <GoogleIcon /> Google
                </a>
                <a
                  href="/api/auth/apple"
                  className="flex items-center justify-center gap-2 btn-press"
                  style={{ height: 46, borderRadius: 12, background: '#0a0a0a', border: '1.5px solid #0a0a0a', boxShadow: '0 2px 8px rgba(0,0,0,0.18)', fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none' }}
                >
                  <AppleIconWhite /> Apple
                </a>
              </div>

              {/* Sign up */}
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>New to Riderguy? </span>
                <Link href="/register" style={{ fontSize: 12, fontWeight: 700, color: '#15803d', borderBottom: '1.5px solid rgba(21,128,61,0.28)', paddingBottom: 1 }}>
                  Create account
                </Link>
              </div>

              {/* More sign-in options — email + Ghana Card */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowMore(!showMore)}
                  className="w-full flex items-center justify-center gap-1.5 transition-colors"
                  style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', paddingBottom: showMore ? 10 : 0 }}
                >
                  {showMore
                    ? <ChevronUp style={{ width: 12, height: 12 }} />
                    : <ChevronDown style={{ width: 12, height: 12 }} />}
                  More sign-in options
                </button>
                {showMore && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <button
                      type="button"
                      onClick={() => { setTab('email'); setError(''); setShowMore(false); }}
                      className="w-full flex items-center gap-2.5 btn-press"
                      style={{
                        padding: '10px 13px', borderRadius: 12,
                        background: '#f8fafc', border: '1px solid #e8edf2',
                        fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Mail style={{ width: 13, height: 13, color: '#64748b' }} />
                      </div>
                      <div className="text-left">
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Email address</p>
                        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Sign in with your email</p>
                      </div>
                      <ChevronRight style={{ width: 12, height: 12, color: '#c4cdd8', marginLeft: 'auto' }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTab('ghanacard'); setError(''); setShowMore(false); }}
                      className="w-full flex items-center gap-2.5 btn-press"
                      style={{
                        padding: '10px 13px', borderRadius: 12,
                        background: '#f8fafc', border: '1px solid #e8edf2',
                        fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CreditCard style={{ width: 13, height: 13, color: '#64748b' }} />
                      </div>
                      <div className="text-left">
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Ghana Card</p>
                        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Sign in with your Ghana Card</p>
                      </div>
                      <ChevronRight style={{ width: 12, height: 12, color: '#c4cdd8', marginLeft: 'auto' }} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Method select ── */}
          {stage === 'method-select' && (
            <div className="space-y-3 animate-fade-in">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div className="mx-auto flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, marginBottom: 12, background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid rgba(21,128,61,0.22)', boxShadow: '0 4px 12px rgba(21,128,61,0.12)' }}>
                  <ShieldCheck style={{ width: 22, height: 22, color: '#15803d' }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>Verify your identity</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  Signing in as <span style={{ color: '#374151', fontWeight: 600 }}>{phone}</span>
                </p>
              </div>
              {methods?.biometric && biometricAvailable && (
                <MethodCard icon={<Fingerprint style={{ width: 17, height: 17, color: '#15803d' }} />} title="Fingerprint / Face ID" sub="Quick and secure biometric" badge="Fastest" onClick={handleBiometricLogin} />
              )}
              {methods?.pin && (
                <MethodCard icon={<KeyRound style={{ width: 17, height: 17, color: '#15803d' }} />} title="Enter PIN" sub="Your 6-digit security PIN" onClick={() => { setError(''); setStage('pin'); }} />
              )}
              <MethodCard icon={<MessageSquare style={{ width: 17, height: 17, color: '#15803d' }} />} title="SMS Code (OTP)" sub="One-time code via SMS" onClick={handleSendOtp} />
            </div>
          )}

          {/* ── PIN ── */}
          {stage === 'pin' && (
            <div className="space-y-4 animate-fade-in">
              <StageCard>
                <StageIcon><KeyRound style={{ width: 19, height: 19, color: '#374151' }} /></StageIcon>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>Enter your PIN</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>6-digit PIN for <span style={{ color: '#374151', fontWeight: 600 }}>{phone}</span></p>
              </StageCard>
              <OtpInput ref={pinRef} length={6} variant="light" onChange={(c) => setPin(c)} onComplete={handlePinComplete} disabled={loading} />
              <PrimaryBtn onClick={() => handlePinComplete(pin)} disabled={loading || pin.length < 6}>
                {loading ? <Spinner /> : 'Sign In'}
              </PrimaryBtn>
              <div className="flex items-center justify-center gap-3">
                <button type="button" onClick={() => { setError(''); setStage('method-select'); }} style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Other method</button>
                <span style={{ color: '#e2e8f0' }}>·</span>
                <Link href={`/forgot-pin?phone=${encodeURIComponent(phone)}`} style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>Forgot PIN?</Link>
              </div>
            </div>
          )}

          {/* ── OTP ── */}
          {stage === 'otp' && (
            <div className="space-y-4 animate-fade-in">
              <StageCard>
                <StageIcon><Smartphone style={{ width: 19, height: 19, color: '#374151' }} /></StageIcon>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>Verification code</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Sent to <span style={{ color: '#374151', fontWeight: 600 }}>{phone}</span></p>
              </StageCard>
              <OtpInput ref={otpRef} length={6} variant="light" onChange={setOtp} onComplete={(c) => { setOtp(c); handleOtpComplete(c); }} disabled={loading} />
              <PrimaryBtn onClick={() => handleOtpComplete(otp)} disabled={loading || otp.length < 6}>
                {loading ? <Spinner /> : 'Verify & Sign In'}
              </PrimaryBtn>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => { setError(''); setStage('method-select'); }} style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Other method</button>
                <button type="button" onClick={handleSendOtp} disabled={loading || cooldown > 0} className="disabled:opacity-50">
                  {cooldown > 0
                    ? <span style={{ fontSize: 12, color: '#94a3b8' }}>Resend in <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cooldown}s</span></span>
                    : <span style={{ fontSize: 12, color: '#15803d', fontWeight: 700 }}>Resend code</span>}
                </button>
              </div>
            </div>
          )}

          {/* ── Biometric ── */}
          {stage === 'biometric' && (
            <div className="animate-fade-in">
              <div style={{ textAlign: 'center', paddingTop: 34, paddingBottom: 34 }}>
                <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 16px' }}>
                  <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(21,128,61,0.16) 0%, transparent 70%)' }} />
                  <div
                    className="flex items-center justify-center animate-pulse"
                    style={{ width: 72, height: 72, borderRadius: 36, background: 'linear-gradient(135deg, #16a34a, #0f6830)', boxShadow: '0 6px 28px rgba(21,128,61,0.40)' }}
                  >
                    <Fingerprint style={{ width: 30, height: 30, color: '#fff' }} />
                  </div>
                </div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px', marginBottom: 4 }}>Verifying identity…</p>
                <p style={{ fontSize: 11, color: '#94a3b8' }}>Use your fingerprint or Face ID</p>
              </div>
              <button
                type="button"
                onClick={() => { setError(''); setStage('method-select'); }}
                style={{ width: '100%', height: 42, borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 13, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {/* ══════════ EMAIL TAB ══════════ */}
      {tab === 'email' && (
        <div className="animate-fade-in">
          <BackBtn onClick={() => { setTab('phone'); setError(''); }} label="Back to phone login" />
          <div style={{ marginBottom: 11 }}>
            <Label>Email address</Label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={`${field.base} ${field.height} px-3.5`} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <Label>Password</Label>
            <div className={field.wrapper}>
              <input type={showEmailPw ? 'text' : 'password'} value={emailPw} onChange={(e) => setEmailPw(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()} className={`${field.base} ${field.height} px-3.5 pr-[40px]`} />
              <button type="button" onClick={() => setShowEmailPw(!showEmailPw)} className="absolute right-[12px] top-1/2 -translate-y-1/2" style={{ color: '#a0aab8' }}>
                {showEmailPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Link href="/forgot-password" style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Forgot password?</Link>
          </div>
          <PrimaryBtn onClick={handleEmailSubmit} disabled={loading || !email || !emailPw}>{loading ? <Spinner /> : 'Sign In'}</PrimaryBtn>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#94a3b8' }}>
            New to Riderguy?{' '}
            <Link href="/register" style={{ fontWeight: 700, color: '#15803d', borderBottom: '1.5px solid rgba(21,128,61,0.28)', paddingBottom: 1 }}>Create account</Link>
          </div>
        </div>
      )}

      {/* ══════════ GHANA CARD TAB ══════════ */}
      {tab === 'ghanacard' && (
        <div className="animate-fade-in">
          {!ghanaPin ? (
            <>
              <BackBtn onClick={() => { setTab('phone'); setError(''); }} label="Back to phone login" />
              <div style={{ marginBottom: 14 }}>
                <div style={{ width: 28, height: 3, borderRadius: 99, background: 'linear-gradient(to right, #16a34a, #4ade80)', marginBottom: 11 }} />
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                  Ghana Card Login
                </h2>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 400 }}>
                  Sign in with your national ID
                </p>
              </div>

              {/* Ghana Card Number */}
              <div style={{ marginBottom: 10 }}>
                <Label>Ghana Card Number</Label>
                <div className={field.wrapper}>
                  <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
                    <CreditCard style={{ width: 14, height: 14, color: ghanaNum ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
                  </span>
                  <input
                    type="text"
                    value={ghanaNum}
                    onChange={(e) => setGhanaNum(formatGhanaCard(e.target.value))}
                    placeholder="GHA-XXXXXXXXX-X"
                    className={`${field.base} ${field.height} pl-[38px] pr-3.5`}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 6 }}>
                <Label>Password</Label>
                <div className={field.wrapper}>
                  <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
                    <LockIcon active={!!ghanaPw} />
                  </span>
                  <input
                    type={showGhanaPw ? 'text' : 'password'}
                    value={ghanaPw}
                    onChange={(e) => setGhanaPw(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGhanaSubmit()}
                    placeholder="Enter your password"
                    className={`${field.base} ${field.height} pl-[38px] pr-[40px]`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGhanaPw(!showGhanaPw)}
                    className="absolute right-[12px] top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#a0aab8' }}
                  >
                    {showGhanaPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Link href="/forgot-password" style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>
                  Forgot password?
                </Link>
              </div>

              <PrimaryBtn onClick={handleGhanaSubmit} disabled={ghanaLoading || !ghanaNum || !ghanaPw}>
                {ghanaLoading ? <Spinner /> : 'Sign In'}
              </PrimaryBtn>

              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#94a3b8' }}>
                New to Riderguy?{' '}
                <Link href="/register" style={{ fontWeight: 700, color: '#15803d', borderBottom: '1.5px solid rgba(21,128,61,0.28)', paddingBottom: 1 }}>Create account</Link>
              </div>
            </>
          ) : (
            /* Ghana Card PIN stage */
            <div className="space-y-4 animate-fade-in">
              <StageCard>
                <StageIcon>
                  <CreditCard style={{ width: 19, height: 19, color: '#374151' }} />
                </StageIcon>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>Enter your PIN</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                  Ghana Card <span style={{ color: '#374151', fontWeight: 600 }}>{ghanaNum}</span>
                </p>
              </StageCard>
              <OtpInput
                ref={ghanaPinRef}
                length={4}
                variant="light"
                onChange={(c) => setGhanaPinCode(c)}
                onComplete={handleGhanaPinComplete}
                disabled={ghanaLoading}
              />
              <PrimaryBtn
                onClick={() => handleGhanaPinComplete(ghanaPinCode)}
                disabled={ghanaLoading || ghanaPinCode.length < 4}
              >
                {ghanaLoading ? <Spinner /> : 'Verify PIN'}
              </PrimaryBtn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
