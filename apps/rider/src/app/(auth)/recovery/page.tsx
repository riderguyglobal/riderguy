'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import {
  Phone, Mail, CreditCard, ArrowLeft, Lock, AlertCircle,
  Check, ShieldQuestion, CheckCircle,
} from 'lucide-react';

type RecoveryMethod = 'phone' | 'email' | 'ghanacard';
type Step = 'select' | 'phone-otp' | 'email-sent' | 'ghanacard-security' | 'reset-pin' | 'success';

export default function RecoveryPage() {
  const router = useRouter();
  const {
    requestRecovery,
    verifyRecoveryOtp,
    getSecurityQuestion,
    verifySecurityAnswer,
    resetPinWithToken,
    requestOtp,
    forgotPassword,
  } = useAuth();

  const [method, setMethod] = useState<RecoveryMethod>('phone');
  const [step, setStep] = useState<Step>('select');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ghanaCard, setGhanaCard] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownEndRef = useRef(0);

  // PIN state
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [pinCode, setPinCode] = useState<string[]>(Array(6).fill(''));
  const [confirmCode, setConfirmCode] = useState<string[]>(Array(6).fill(''));
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // ---- Phone Recovery ----
  async function handlePhoneRecovery(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 9) { setError('Enter a valid phone number'); return; }
    setLoading(true);
    try {
      await requestRecovery('phone', formatPhone(cleaned));
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
      setStep('phone-otp');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to send OTP.');
    } finally { setLoading(false); }
  }

  async function handleOtpComplete(code: string) {
    setLoading(true);
    setError('');
    try {
      const result = await verifyRecoveryOtp(formatPhone(phone), code);
      setRecoveryToken(result.token);
      setStep('reset-pin');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Invalid OTP.');
      setOtp(Array(6).fill(''));
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  }

  async function handleResendOtp() {
    if (cooldown > 0) return;
    try {
      await requestRecovery('phone', formatPhone(phone));
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
    } catch {}
  }

  // ---- Email Recovery ----
  async function handleEmailRecovery(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
    setLoading(true);
    try {
      await forgotPassword(email);
      setStep('email-sent');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to send reset email.');
    } finally { setLoading(false); }
  }

  // ---- Ghana Card Recovery ----
  async function handleGhanaCardRecovery(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (ghanaCard.length < 10) { setError('Enter a valid Ghana Card number'); return; }
    setLoading(true);
    try {
      const result = await getSecurityQuestion(ghanaCard);
      setSecurityQuestion(result.question);
      setStep('ghanacard-security');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Ghana Card not found.');
    } finally { setLoading(false); }
  }

  async function handleSecuritySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!securityAnswer.trim()) { setError('Enter your answer'); return; }
    setLoading(true);
    try {
      const result = await verifySecurityAnswer(ghanaCard, securityAnswer.trim());
      setRecoveryToken(result.token);
      setStep('reset-pin');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Incorrect answer.');
    } finally { setLoading(false); }
  }

  // ---- PIN Reset ----
  function handlePinChange(i: number, v: string) {
    if (!/^\d*$/.test(v)) return;
    const next = [...pinCode];
    next[i] = v.slice(-1);
    setPinCode(next);
    if (v && i < 5) pinRefs.current[i + 1]?.focus();
    const full = next.join('');
    if (full.length === 6 && !next.includes('')) {
      setPin(full);
      setPinStep('confirm');
    }
  }

  function handlePinKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !pinCode[i] && i > 0) pinRefs.current[i - 1]?.focus();
  }

  function handlePinPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!p) return;
    const next = Array(6).fill('');
    p.split('').forEach((c, i) => { next[i] = c; });
    setPinCode(next);
    pinRefs.current[Math.min(p.length, 5)]?.focus();
    if (p.length === 6) { setPin(p); setPinStep('confirm'); }
  }

  function handleConfirmPinChange(i: number, v: string) {
    if (!/^\d*$/.test(v)) return;
    const next = [...confirmCode];
    next[i] = v.slice(-1);
    setConfirmCode(next);
    if (v && i < 5) confirmPinRefs.current[i + 1]?.focus();
    const full = next.join('');
    if (full.length === 6 && !next.includes('')) handlePinConfirm(full);
  }

  function handleConfirmPinKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !confirmCode[i] && i > 0) confirmPinRefs.current[i - 1]?.focus();
  }

  function handleConfirmPinPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!p) return;
    const next = Array(6).fill('');
    p.split('').forEach((c, i) => { next[i] = c; });
    setConfirmCode(next);
    confirmPinRefs.current[Math.min(p.length, 5)]?.focus();
    if (p.length === 6) handlePinConfirm(p);
  }

  async function handlePinConfirm(code: string) {
    if (code !== pin) {
      setError('PINs do not match.');
      setConfirmCode(Array(6).fill(''));
      confirmPinRefs.current[0]?.focus();
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPinWithToken(code, recoveryToken);
      setStep('success');
      setTimeout(() => router.replace('/login/authenticate'), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reset PIN.');
      setConfirmCode(Array(6).fill(''));
      confirmPinRefs.current[0]?.focus();
    } finally { setLoading(false); }
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

  /* ── Success ── */
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/30">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-primary mb-2">PIN reset successful!</h2>
        <p className="text-muted text-center">Redirecting to login...</p>
      </div>
    );
  }

  /* ── Reset PIN ── */
  if (step === 'reset-pin') {
    const isConfirm = pinStep === 'confirm';
    const currentCode = isConfirm ? confirmCode : pinCode;
    const currentRefs = isConfirm ? confirmPinRefs : pinRefs;
    const handleChange = isConfirm ? handleConfirmPinChange : handlePinChange;
    const handleKey = isConfirm ? handleConfirmPinKey : handlePinKey;
    const handlePasteAction = isConfirm ? handleConfirmPinPaste : handlePinPaste;

    return (
      <div className="animate-fade-in">
        <button
          onClick={() => {
            if (isConfirm) {
              setPinStep('create');
              setPinCode(Array(6).fill(''));
              setConfirmCode(Array(6).fill(''));
              setPin('');
              setError('');
            } else {
              setStep('select');
              setError('');
            }
          }}
          className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isConfirm ? 'Start over' : 'Back'}
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-primary text-center mb-1">
          {isConfirm ? 'Confirm new PIN' : 'Create new PIN'}
        </h2>
        <p className="text-muted text-sm text-center mb-8">
          {isConfirm ? 'Enter the same 6-digit PIN again' : 'Enter a new 6-digit PIN for your account'}
        </p>

        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-1 rounded-full bg-brand-500" />
          <div className={`w-8 h-1 rounded-full ${isConfirm ? 'bg-brand-500' : 'bg-themed'}`} />
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { currentRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={currentCode[i]}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              onPaste={i === 0 ? handlePasteAction : undefined}
              autoFocus={i === 0}
              className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-2xl border-2 bg-card transition-all duration-200 focus:outline-none ${
                error
                  ? 'border-danger-500 text-danger-400 animate-shake'
                  : currentCode[i]
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
      </div>
    );
  }

  /* ── Phone OTP ── */
  if (step === 'phone-otp') {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => { setStep('select'); setOtp(Array(6).fill('')); setError(''); }}
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

  /* ── Email Sent ── */
  if (step === 'email-sent') {
    return (
      <div className="animate-fade-in text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Mail className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-primary mb-2">Check your email</h2>
        <p className="text-muted mb-8">
          We sent a password reset link to <span className="font-semibold text-secondary">{email}</span>.
          Follow the link to reset your password, then you can reset your PIN from settings.
        </p>
        <button
          onClick={() => router.push('/login/authenticate')}
          className="w-full py-4 gradient-brand text-white font-semibold rounded-2xl active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/25"
        >
          Back to Login
        </button>
      </div>
    );
  }

  /* ── Ghana Card Security Question ── */
  if (step === 'ghanacard-security') {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => { setStep('select'); setError(''); setSecurityAnswer(''); }}
          className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
            <ShieldQuestion className="w-8 h-8 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-primary text-center mb-1">Security question</h2>
        <p className="text-muted text-sm text-center mb-8">
          Answer the question you set during registration
        </p>

        <div className="p-4 rounded-2xl bg-card-alt border border-themed mb-6">
          <p className="text-sm font-semibold text-primary">{securityQuestion}</p>
        </div>

        <form onSubmit={handleSecuritySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Your Answer</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
              <div className="pl-4 text-muted"><Lock className="w-5 h-5" /></div>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => { setSecurityAnswer(e.target.value); setError(''); }}
                placeholder="Enter your answer"
                autoFocus
                className="flex-1 px-3 py-4 text-base text-primary placeholder:text-subtle bg-transparent focus:outline-none"
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
            disabled={!securityAnswer.trim() || loading}
            className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </span>
            ) : 'Verify Answer'}
          </button>
        </form>
      </div>
    );
  }

  /* ── Method Selection ── */
  const methods: { key: RecoveryMethod; label: string; sub: string; icon: React.ReactNode }[] = [
    {
      key: 'phone',
      label: 'Phone',
      sub: 'OTP to your phone',
      icon: <Phone className="w-5 h-5" />,
    },
    {
      key: 'email',
      label: 'Email',
      sub: 'Reset link via email',
      icon: <Mail className="w-5 h-5" />,
    },
    {
      key: 'ghanacard',
      label: 'Ghana Card',
      sub: 'Security question',
      icon: <CreditCard className="w-5 h-5" />,
    },
  ];

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => router.push('/login')}
        className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-3xl font-bold text-primary tracking-tight mb-1">Recover your account</h1>
      <p className="text-muted mb-8">Choose how to reset your PIN</p>

      {/* Method selector cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-8">
        {methods.map((m) => {
          const active = method === m.key;
          return (
            <button
              key={m.key}
              onClick={() => { setMethod(m.key); setError(''); }}
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
        <form onSubmit={handlePhoneRecovery} className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Phone Number</label>
            <div className="flex rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
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
          </div>
          {error && (
            <p className="text-danger-400 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}
          <button
            type="submit"
            disabled={phone.length < 9 || loading}
            className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </span>
            ) : 'Send Recovery OTP'}
          </button>
        </form>
      )}

      {/* Email form */}
      {method === 'email' && (
        <form onSubmit={handleEmailRecovery} className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Email Address</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
              <div className="pl-4 text-muted"><Mail className="w-5 h-5" /></div>
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
          {error && (
            <p className="text-danger-400 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}
          <button
            type="submit"
            disabled={!email || loading}
            className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </span>
            ) : 'Send Reset Link'}
          </button>
        </form>
      )}

      {/* Ghana Card form */}
      {method === 'ghanacard' && (
        <form onSubmit={handleGhanaCardRecovery} className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2.5">Ghana Card Number</label>
            <div className="flex items-center rounded-2xl border-2 border-themed bg-card overflow-hidden focus-within:border-brand-500 transition-all duration-200">
              <div className="pl-4 text-muted"><CreditCard className="w-5 h-5" /></div>
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
          {error && (
            <p className="text-danger-400 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}
          <button
            type="submit"
            disabled={ghanaCard.length < 10 || loading}
            className="w-full relative py-4 rounded-2xl font-semibold text-white gradient-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Looking up...
              </span>
            ) : 'Continue'}
          </button>
        </form>
      )}
    </div>
  );
}
