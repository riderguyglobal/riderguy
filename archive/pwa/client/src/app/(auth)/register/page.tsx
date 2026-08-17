'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { OtpInput, PhoneInput } from '@riderguy/ui';
import { phoneSchema, emailSchema, passwordSchema } from '@riderguy/validators';
import {
  Mail, AlertCircle, CheckCircle, ArrowLeft, Smartphone,
  Eye, EyeOff, User, CreditCard, ShieldQuestion, Lock,
  ChevronRight, ChevronDown, Phone,
} from 'lucide-react';
import Link from 'next/link';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is the name of the street you grew up on?",
  "What was your childhood nickname?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "In what city were you born?",
  "What is your favourite food?",
];

type Tab = 'phone' | 'email' | 'ghanacard';

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

export default function RegisterPage() {
  const router = useRouter();
  const {
    requestOtp, verifyOtp, register, registerWithEmail, registerWithGhanaCard,
    isAuthenticated, isLoading: authLoading,
  } = useAuth();

  const [tab, setTab] = useState<Tab>('phone');

  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownEndRef = useRef(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [ghanaCardStep, setGhanaCardStep] = useState<'info' | 'security'>('info');
  const [ghanaCard, setGhanaCard] = useState('');
  const [ghanaCardPassword, setGhanaCardPassword] = useState('');
  const [confirmGhanaCardPassword, setConfirmGhanaCardPassword] = useState('');
  const [showGhanaCardPassword, setShowGhanaCardPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

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

  useEffect(() => {
    if (!authLoading && isAuthenticated && !success) router.replace('/dashboard');
  }, [authLoading, isAuthenticated, success, router]);

  const handleSendOtp = async () => {
    if (!phone) return;
    const result = phoneSchema.safeParse(phone);
    if (!result.success) { setError(result.error.errors[0]?.message ?? 'Invalid phone number'); return; }
    setLoading(true); setError('');
    try {
      await requestOtp(phone, 'REGISTRATION');
      setPhoneStep('otp'); setCooldown(60); cooldownEndRef.current = Date.now() + 60_000;
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || 'Failed to send code. Please try again.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (code?: string) => {
    const otpCode = code ?? otp;
    if (otpCode.length < 6) return;
    setLoading(true); setError('');
    try {
      await verifyOtp(phone, otpCode, 'REGISTRATION');
      setOtp(otpCode); setPhoneStep('name');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Verification failed. Try again.'));
    } finally { setLoading(false); }
  };

  const handlePhoneRegister = async () => {
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!lastName.trim()) { setError('Last name is required'); return; }
    setLoading(true); setError('');
    try {
      await register({ phone, firstName: firstName.trim(), lastName: lastName.trim(), otpCode: otp, role: 'CLIENT' });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Registration failed.'));
    } finally { setLoading(false); }
  };

  const handleEmailRegister = async () => {
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!lastName.trim()) { setError('Last name is required'); return; }
    if (!email || !password) return;
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) { setError(emailResult.error.errors[0]?.message ?? 'Invalid email'); return; }
    const pwResult = passwordSchema.safeParse(password);
    if (!pwResult.success) { setError(pwResult.error.errors[0]?.message ?? 'Invalid password'); return; }
    setLoading(true); setError('');
    try {
      await registerWithEmail({ firstName: firstName.trim(), lastName: lastName.trim(), email, password, role: 'CLIENT' });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Registration failed.'));
    } finally { setLoading(false); }
  };

  const handleGhanaCardInfoSubmit = () => {
    setError('');
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!lastName.trim()) { setError('Last name is required'); return; }
    if (ghanaCard.length < 10) { setError('Enter a valid Ghana Card number'); return; }
    if (ghanaCardPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (ghanaCardPassword !== confirmGhanaCardPassword) { setError('Passwords do not match'); return; }
    setGhanaCardStep('security');
  };

  const handleGhanaCardSecuritySubmit = async () => {
    setError('');
    if (!securityQuestion) { setError('Select a security question'); return; }
    if (securityAnswer.trim().length < 2) { setError('Security answer must be at least 2 characters'); return; }
    setLoading(true);
    try {
      await registerWithGhanaCard({
        ghanaCard, password: ghanaCardPassword,
        firstName: firstName.trim(), lastName: lastName.trim(),
        role: 'CLIENT', securityQuestion, securityAnswer: securityAnswer.trim(),
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || 'Registration failed. Try again.');
    } finally { setLoading(false); }
  };

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) { setError('Google sign-in is not configured yet.'); return; }
    const redirectUri = window.location.origin + '/auth/google/callback';
    const scope = 'openid email profile';
    const state = crypto.randomUUID();
    try { sessionStorage.setItem('google_oauth_state', state); } catch {}
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=select_account&state=${encodeURIComponent(state)}`;
    window.location.href = url;
  };

  const goBack = () => {
    setError('');
    if (tab === 'ghanacard' && ghanaCardStep === 'security') { setGhanaCardStep('info'); }
    else if (phoneStep === 'name') { setPhoneStep('otp'); }
    else if (phoneStep === 'otp') { setPhoneStep('phone'); setOtp(''); }
    else { router.replace('/login'); }
  };

  const inPhoneFlow = tab === 'phone' && phoneStep !== 'phone';
  const inGhanaCardFlow = tab === 'ghanacard' && ghanaCardStep === 'security';
  const inMultiStep = inPhoneFlow || inGhanaCardFlow;

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
        height: 50, borderRadius: 13,
        background: disabled ? '#94a3b8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 55%, #0f6830 100%)',
        color: '#ffffff', fontSize: 14, fontWeight: 700, letterSpacing: '0.1px',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 18px rgba(21,128,61,0.38), 0 2px 6px rgba(21,128,61,0.18)',
      }}
    >
      {children}
      {!disabled && <ChevronRight style={{ position: 'absolute', right: 14, width: 16, height: 16, opacity: 0.55 }} />}
    </button>
  );

  const Spinner = () => (
    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
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

  /* ─── Success screen ─── */
  if (success) {
    return (
      <div>
        <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>
          <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 16px' }}>
            <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(21,128,61,0.16) 0%, transparent 70%)' }} />
            <div
              className="flex items-center justify-center"
              style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #16a34a, #0f6830)', boxShadow: '0 6px 28px rgba(21,128,61,0.40)' }}
            >
              <CheckCircle style={{ width: 28, height: 28, color: '#fff' }} />
            </div>
          </div>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>Welcome to Riderguy!</p>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24, lineHeight: 1.55 }}>Your account is ready. Start sending packages now.</p>
          <PrimaryBtn onClick={() => router.replace('/dashboard')}>Go to Dashboard</PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div>

      {/* ── Back button ── */}
      {inMultiStep
        ? <BackBtn onClick={goBack} label="Back" />
        : <BackBtn onClick={() => router.replace('/login')} label="Back to sign in" />
      }

      {/* ── Heading ── */}
      {!inMultiStep && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ width: 28, height: 3, borderRadius: 99, background: 'linear-gradient(to right, #16a34a, #4ade80)', marginBottom: 11 }} />
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            Create account
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 400 }}>
            Join Riderguy to start sending packages
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

      {/* ── Tab toggle ── */}
      {!inMultiStep && (
        <div style={{ display: 'flex', padding: 4, borderRadius: 14, background: '#f3f4f6', border: '1px solid #e8edf2', marginBottom: 14 }}>
          {([
            { key: 'phone' as Tab, icon: Phone, label: 'Phone' },
            { key: 'email' as Tab, icon: Mail, label: 'Email' },
            { key: 'ghanacard' as Tab, icon: CreditCard, label: 'Ghana Card' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); setError(''); setPhoneStep('phone'); setGhanaCardStep('info'); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '9px 4px', borderRadius: 11, fontSize: 11, fontWeight: 700,
                background: tab === key ? '#ffffff' : 'transparent',
                color: tab === key ? '#15803d' : '#94a3b8',
                boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <Icon style={{ width: 12, height: 12 }} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ══════════ PHONE TAB ══════════ */}
      {tab === 'phone' && (
        <>
          {/* Phone input step */}
          {phoneStep === 'phone' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <Label>Phone Number</Label>
                <PhoneInput value={phone} onValueChange={setPhone} placeholder="024 XXX XXXX" />
              </div>
              <PrimaryBtn onClick={handleSendOtp} disabled={loading || !phone}>
                {loading ? <Spinner /> : 'Continue'}
              </PrimaryBtn>
            </div>
          )}

          {/* OTP step */}
          {phoneStep === 'otp' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StageCard>
                <StageIcon><Smartphone style={{ width: 19, height: 19, color: '#374151' }} /></StageIcon>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>Verification code</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                  Sent to <span style={{ color: '#374151', fontWeight: 600 }}>{phone}</span>
                </p>
              </StageCard>
              <OtpInput
                length={6}
                variant="light"
                onChange={setOtp}
                onComplete={(code) => { setOtp(code); handleVerifyOtp(code); }}
                disabled={loading}
              />
              <PrimaryBtn onClick={() => handleVerifyOtp()} disabled={loading || otp.length < 6}>
                {loading ? <Spinner /> : 'Verify Code'}
              </PrimaryBtn>
              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || cooldown > 0}
                  className="disabled:opacity-50"
                >
                  {cooldown > 0
                    ? <span style={{ fontSize: 12, color: '#94a3b8' }}>Resend in <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cooldown}s</span></span>
                    : <span style={{ fontSize: 12, color: '#15803d', fontWeight: 700 }}>Resend code</span>}
                </button>
              </div>
            </div>
          )}

          {/* Name step */}
          {phoneStep === 'name' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <StageCard>
                <StageIcon><User style={{ width: 19, height: 19, color: '#374151' }} /></StageIcon>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>What&apos;s your name?</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Helps us personalise your experience</p>
              </StageCard>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <Label>First Name</Label>
                  <input
                    type="text" value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Kwame"
                    autoFocus
                    className={`${field.base} ${field.height} px-3.5`}
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <input
                    type="text" value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Mensah"
                    onKeyDown={(e) => e.key === 'Enter' && handlePhoneRegister()}
                    className={`${field.base} ${field.height} px-3.5`}
                  />
                </div>
              </div>
              <PrimaryBtn onClick={handlePhoneRegister} disabled={loading || !firstName.trim() || !lastName.trim()}>
                {loading ? <Spinner /> : 'Create Account'}
              </PrimaryBtn>
            </div>
          )}
        </>
      )}

      {/* ══════════ EMAIL TAB ══════════ */}
      {tab === 'email' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 btn-press disabled:opacity-40"
            style={{
              height: 46, borderRadius: 12, background: '#fff',
              border: '1.5px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer',
            }}
          >
            <GoogleIcon /> Continue with Google
          </button>

          {/* Gradient divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #e2e8f0)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#c4cdd8', letterSpacing: '0.7px', textTransform: 'uppercase' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #e2e8f0)' }} />
          </div>

          {/* Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label>First Name</Label>
              <input
                type="text" value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Kwame"
                className={`${field.base} ${field.height} px-3.5`}
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <input
                type="text" value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Mensah"
                className={`${field.base} ${field.height} px-3.5`}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <Label>Email Address</Label>
            <div className={field.wrapper}>
              <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
                <Mail style={{ width: 14, height: 14, color: email ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
              </span>
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`${field.base} ${field.height} pl-[38px] pr-3.5`}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <Label>Password</Label>
            <div className={field.wrapper}>
              <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock style={{ width: 14, height: 14, color: password ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                onKeyDown={(e) => e.key === 'Enter' && handleEmailRegister()}
                className={`${field.base} ${field.height} pl-[38px] pr-[40px]`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-[12px] top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#a0aab8' }}
              >
                {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
            <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Must include uppercase, lowercase, and a number</p>
          </div>

          <PrimaryBtn
            onClick={handleEmailRegister}
            disabled={loading || !email || !password || !firstName.trim() || !lastName.trim()}
          >
            {loading ? <Spinner /> : 'Create Account'}
          </PrimaryBtn>
        </div>
      )}

      {/* ══════════ GHANA CARD TAB ══════════ */}
      {tab === 'ghanacard' && (
        <>
          {/* Info step */}
          {ghanaCardStep === 'info' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <Label>First Name</Label>
                  <input
                    type="text" value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Kwame"
                    autoFocus
                    className={`${field.base} ${field.height} px-3.5`}
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <input
                    type="text" value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Mensah"
                    className={`${field.base} ${field.height} px-3.5`}
                  />
                </div>
              </div>

              {/* Ghana Card number */}
              <div>
                <Label>Ghana Card Number</Label>
                <div className={field.wrapper}>
                  <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
                    <CreditCard style={{ width: 14, height: 14, color: ghanaCard ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
                  </span>
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
                      setGhanaCard(formatted); setError('');
                    }}
                    placeholder="GHA-XXXXXXXXX-X"
                    maxLength={15}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`${field.base} ${field.height} pl-[38px] pr-3.5 font-mono tracking-wide`}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <Label>Password</Label>
                <div className={field.wrapper}>
                  <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock style={{ width: 14, height: 14, color: ghanaCardPassword ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
                  </span>
                  <input
                    type={showGhanaCardPassword ? 'text' : 'password'}
                    value={ghanaCardPassword}
                    onChange={(e) => { setGhanaCardPassword(e.target.value); setError(''); }}
                    placeholder="Min. 8 characters"
                    className={`${field.base} ${field.height} pl-[38px] pr-[40px]`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGhanaCardPassword(!showGhanaCardPassword)}
                    className="absolute right-[12px] top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#a0aab8' }}
                  >
                    {showGhanaCardPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <Label>Confirm Password</Label>
                <div className={field.wrapper}>
                  <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock style={{ width: 14, height: 14, color: confirmGhanaCardPassword ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
                  </span>
                  <input
                    type={showGhanaCardPassword ? 'text' : 'password'}
                    value={confirmGhanaCardPassword}
                    onChange={(e) => { setConfirmGhanaCardPassword(e.target.value); setError(''); }}
                    placeholder="Confirm your password"
                    onKeyDown={(e) => e.key === 'Enter' && handleGhanaCardInfoSubmit()}
                    className={`${field.base} ${field.height} pl-[38px] pr-3.5`}
                  />
                </div>
              </div>

              <PrimaryBtn
                onClick={handleGhanaCardInfoSubmit}
                disabled={!firstName.trim() || !lastName.trim() || ghanaCard.length < 10 || !ghanaCardPassword || !confirmGhanaCardPassword}
              >
                Next: Security Question
              </PrimaryBtn>
            </div>
          )}

          {/* Security step */}
          {ghanaCardStep === 'security' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Step indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <div style={{ width: 28, height: 3, borderRadius: 99, background: '#15803d' }} />
                <div style={{ width: 28, height: 3, borderRadius: 99, background: '#15803d' }} />
              </div>

              <StageCard>
                <StageIcon><ShieldQuestion style={{ width: 19, height: 19, color: '#374151' }} /></StageIcon>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>Security question</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>This helps recover your account</p>
              </StageCard>

              {/* Question select */}
              <div>
                <Label>Security Question</Label>
                <div className={field.wrapper}>
                  <select
                    value={securityQuestion}
                    onChange={(e) => { setSecurityQuestion(e.target.value); setError(''); }}
                    className={`${field.base} ${field.height} pl-3.5 pr-9`}
                    style={{ appearance: 'none' }}
                  >
                    <option value="">Select a question…</option>
                    {SECURITY_QUESTIONS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <span className="absolute right-[12px] top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown style={{ width: 13, height: 13, color: '#a0aab8' }} />
                  </span>
                </div>
              </div>

              {/* Answer */}
              <div>
                <Label>Your Answer</Label>
                <div className={field.wrapper}>
                  <span className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock style={{ width: 14, height: 14, color: securityAnswer ? '#15803d' : '#a0aab8', transition: 'color 0.2s ease' }} />
                  </span>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => { setSecurityAnswer(e.target.value); setError(''); }}
                    placeholder="Enter your answer"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleGhanaCardSecuritySubmit()}
                    className={`${field.base} ${field.height} pl-[38px] pr-3.5`}
                  />
                </div>
                <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Remember this exactly. It is case-insensitive.</p>
              </div>

              <PrimaryBtn
                onClick={handleGhanaCardSecuritySubmit}
                disabled={loading || !securityQuestion || securityAnswer.trim().length < 2}
              >
                {loading ? <Spinner /> : 'Create Account'}
              </PrimaryBtn>
            </div>
          )}
        </>
      )}

      {/* ── Sign in link ── */}
      {!inMultiStep && (
        <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Already have an account? </span>
          <Link href="/login" style={{ fontSize: 12, fontWeight: 700, color: '#15803d', borderBottom: '1.5px solid rgba(21,128,61,0.28)', paddingBottom: 1 }}>
            Sign in
          </Link>
        </div>
      )}

    </div>
  );
}
