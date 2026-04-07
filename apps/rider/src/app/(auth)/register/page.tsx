'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth, isBiometricSupported } from '@riderguy/auth';
import { Button, Input, OtpInput, PhoneInput } from '@riderguy/ui';
import { phoneSchema, pinSchema, emailSchema, passwordSchema } from '@riderguy/validators';
import { AlertCircle, CheckCircle2, Bike, Sparkles, Lock, Phone, Mail, Eye, EyeOff, Fingerprint } from 'lucide-react';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type RegisterMethod = 'phone' | 'email';
const STEPS = [{ label: 'Phone' }, { label: 'Verify' }, { label: 'Details' }];
const EMAIL_STEPS = [{ label: 'Email' }, { label: 'Verify' }, { label: 'Details' }];

export default function RegisterPage() {
  const router = useRouter();
  const { register, requestOtp, verifyOtp, registerWithEmail, setupBiometric, isAuthenticated } = useAuth();

  const [method, setMethod] = useState<RegisterMethod>('phone');
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [biometricSetupDone, setBiometricSetupDone] = useState(false);
  const [biometricAvailable] = useState(() => isBiometricSupported());
  const otpRef = useRef<{ clear: () => void; focus: () => void }>(null);

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

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  // ---- Email flow: single-step registration ----
  const handleEmailRegister = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your full name');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    const emailResult = emailSchema.safeParse(email.trim());
    if (!emailResult.success) {
      setError(emailResult.error.errors[0]?.message ?? 'Invalid email');
      return;
    }
    const pwResult = passwordSchema.safeParse(password);
    if (!pwResult.success) {
      setError(pwResult.error.errors[0]?.message ?? 'Invalid password');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await registerWithEmail({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        role: 'RIDER',
      });
      localStorage.setItem('riderguy_last_phone', email.trim());
      localStorage.setItem('riderguy_last_login_method', 'pin');
      setStep(3);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Registration failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid phone number');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await requestOtp(phone, 'REGISTRATION');
      setStep(1);
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Failed to send OTP'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setSubmitting(true);
    setError('');
    setOtp(code);
    try {
      await verifyOtp(phone, code, 'REGISTRATION');
      setStep(2);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Invalid OTP'));
      otpRef.current?.clear();
      otpRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your full name');
      return;
    }

    if (method === 'phone') {
      // Phone registration requires a PIN
      const pinResult = pinSchema.safeParse(pin);
      if (!pinResult.success) {
        setError(pinResult.error.errors[0]?.message ?? 'Please set a 6-digit PIN');
        return;
      }
    } else {
      // Email registration requires email + password
      if (!email.trim()) {
        setError('Email is required');
        return;
      }
      const emailResult = emailSchema.safeParse(email.trim());
      if (!emailResult.success) {
        setError(emailResult.error.errors[0]?.message ?? 'Invalid email');
        return;
      }
      const pwResult = passwordSchema.safeParse(password);
      if (!pwResult.success) {
        setError(pwResult.error.errors[0]?.message ?? 'Invalid password');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      await register({
        phone,
        otpCode: otp,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        pin: method === 'phone' ? pin : undefined,
        password: method === 'email' ? password : undefined,
        role: 'RIDER',
      });
      localStorage.setItem('riderguy_last_phone', phone);
      localStorage.setItem('riderguy_last_login_method', 'pin');
      setStep(3);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Registration failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupBiometric = async () => {
    setSubmitting(true);
    try {
      const ua = navigator.userAgent;
      const name = /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iPhone' : 'Device';
      await setupBiometric(name);
      setBiometricSetupDone(true);
      localStorage.setItem('riderguy_last_login_method', 'biometric');
    } catch {
      setError('Fingerprint setup failed. You can try again later in Settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google sign-in is not configured yet.');
      return;
    }
    const state = crypto.randomUUID();
    try { sessionStorage.setItem('google_oauth_state', state); } catch {}
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/google/callback`,
      response_type: 'token',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

// Success state
  if (step === 3) {
    return (
      <div className="text-center animate-scale-in">
        {/* Success illustration */}
        <div className="relative mx-auto mb-6">
          <div className="absolute inset-0 scale-150 rounded-full bg-accent-500/10 blur-2xl" />
          <div className="relative mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-accent-500/20 to-brand-500/10 border border-accent-500/20 flex items-center justify-center overflow-hidden">
            <Image
              src="/images/illustrations/talking-rider.svg"
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 object-contain animate-float"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full gradient-accent flex items-center justify-center shadow-lg glow-accent">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-primary mb-1.5 tracking-tight">Welcome Aboard!</h2>
        <p className="text-muted text-sm mb-8 max-w-xs mx-auto leading-relaxed">
          Your rider account has been created. Complete onboarding to start earning.
        </p>

        {/* Biometric setup prompt */}
        {biometricAvailable && !biometricSetupDone && (
          <div className="mb-4 p-4 rounded-2xl glass-elevated">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-11 w-11 rounded-xl bg-brand-500/10 flex items-center justify-center ring-4 ring-brand-500/5">
                <Fingerprint className="h-5 w-5 text-brand-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-primary">Enable Fingerprint Login</p>
                <p className="text-xs text-muted">Sign in faster next time</p>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full gradient-brand text-white btn-press rounded-xl font-semibold"
              onClick={handleSetupBiometric}
              loading={submitting}
            >
              <Fingerprint className="h-4 w-4 mr-2" />
              Set Up Fingerprint
            </Button>
          </div>
        )}

        {biometricSetupDone && (
          <div className="mb-4 p-3 rounded-2xl bg-accent-500/10 border border-accent-500/20 flex items-center gap-2 justify-center animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-accent-400" />
            <span className="text-sm text-accent-400 font-medium">Fingerprint login enabled!</span>
          </div>
        )}

        <Button
          size="xl"
          className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
          onClick={() => router.replace('/dashboard')}
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header area ── */}
      <div className="space-y-5 mb-8">
        {/* Mobile: Illustration */}
        <div className="lg:hidden flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 scale-150 rounded-full bg-brand-500/[0.08] blur-2xl" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/15 to-brand-500/5 border border-brand-500/20 flex items-center justify-center overflow-hidden">
              <Image
                src="/images/illustrations/talking-rider.svg"
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 object-contain animate-float"
                priority
              />
            </div>
          </div>
        </div>
        <div className="text-center lg:text-left">
          <h2 className="text-2xl font-extrabold text-primary tracking-tight">Become a Rider</h2>
          <p className="text-muted text-sm mt-1">Create your account to start delivering</p>
        </div>
      </div>

      {/* Phone / Email method toggle */}
      {step === 0 && (
        <div className="flex p-1 mb-6 rounded-2xl bg-card border border-themed-strong">
          <button
            type="button"
            onClick={() => { setMethod('phone'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              method === 'phone'
                ? 'gradient-brand text-white shadow-md'
                : 'text-muted hover:text-secondary'
            }`}
          >
            <Phone className="h-4 w-4" />
            Phone
          </button>
          <button
            type="button"
            onClick={() => { setMethod('email'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              method === 'email'
                ? 'gradient-brand text-white shadow-md'
                : 'text-muted hover:text-secondary'
            }`}
          >
            <Mail className="h-4 w-4" />
            Email
          </button>
        </div>
      )}

      {/* Step indicator (phone flow only) */}
      {method === 'phone' && (
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  i < step ? 'gradient-accent text-white shadow-md' :
                  i === step ? 'gradient-brand text-white shadow-lg glow-brand' :
                  'bg-skeleton text-subtle border border-themed-strong'
                }`}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-[11px] mt-1.5 font-medium ${
                  i <= step ? 'text-primary' : 'text-subtle'
                }`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all duration-500 ${
                  i < step ? 'bg-accent-500' : 'bg-skeleton'
                }`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-3.5 rounded-2xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2.5 animate-shake">
          <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-300 leading-snug">{error}</p>
        </div>
      )}

      {/* ====== Step 0: Phone entry ====== */}
      {step === 0 && method === 'phone' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">Phone Number</label>
            <PhoneInput value={phone} onValueChange={setPhone} />
          </div>
          <Button
            size="xl"
            className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
            onClick={handleSendOtp}
            loading={submitting}
          >
            Continue
          </Button>
        </div>
      )}

      {/* ====== Step 0: Email registration (single step) ====== */}
      {step === 0 && method === 'email' && (
        <div className="space-y-5 animate-fade-in">
          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleClick}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-2xl bg-card border border-themed-strong text-primary font-semibold text-sm hover:bg-hover-themed transition-all btn-press"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="relative flex items-center gap-4">
            <div className="flex-1 h-px bg-themed" />
            <span className="text-xs text-subtle font-medium">or</span>
            <div className="flex-1 h-px bg-themed" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-2">First Name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-2">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">Email Address</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">
              <Lock className="inline h-4 w-4 mr-1.5 -mt-0.5 text-muted" />
              Password
            </label>
            <p className="text-xs text-subtle mb-3">At least 8 characters with uppercase, lowercase &amp; number</p>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
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
            className="w-full gradient-accent text-white shadow-lg glow-accent btn-press rounded-2xl font-semibold"
            onClick={handleEmailRegister}
            loading={submitting}
            disabled={submitting || !email || !password || !firstName.trim() || !lastName.trim()}
          >
            Create Account
          </Button>
        </div>
      )}

      {/* ====== Step 1: OTP Verification ====== */}
      {step === 1 && (
        <div className="space-y-5 animate-fade-in">
          <div className="text-center glass-elevated rounded-2xl p-6">
            <div className="mx-auto mb-3 h-13 w-13 rounded-2xl bg-brand-500/10 flex items-center justify-center ring-4 ring-brand-500/5">
              <Bike className="h-6 w-6 text-brand-400" />
            </div>
            <p className="text-primary font-bold mb-0.5">Verify your number</p>
            <p className="text-muted text-sm">
              Enter the 6-digit code sent to <span className="text-secondary font-medium">{phone}</span>
            </p>
            <button onClick={() => { setStep(0); setError(''); }} className="text-brand-400 text-sm mt-2 hover:text-brand-300 font-medium transition-colors">
              Change number
            </button>
          </div>

          <OtpInput ref={otpRef} length={6} variant="light" onChange={setOtp} onComplete={handleVerifyOtp} disabled={submitting} />

          <Button
            size="xl"
            className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
            onClick={() => handleVerifyOtp(otp)}
            loading={submitting}
            disabled={submitting || otp.length < 6}
          >
            Verify & Continue
          </Button>

          <div className="text-center">
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

      {/* ====== Step 2: Details (Name, PIN/Password) ====== */}
      {step === 2 && (
        <form onSubmit={handleRegister} className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-2">First Name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-2">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
            </div>
          </div>

          {method === 'email' ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">
                  <Lock className="inline h-4 w-4 mr-1.5 -mt-0.5 text-muted" />
                  Password
                </label>
                <p className="text-xs text-subtle mb-3">At least 8 characters</p>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
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
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">Email <span className="text-subtle">(optional)</span></label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2.5">
                  <Lock className="inline h-4 w-4 mr-1.5 -mt-0.5 text-muted" />
                  Set a 6-digit PIN
                </label>
                <p className="text-xs text-subtle mb-3">You&apos;ll use this PIN to confirm transactions</p>
                <OtpInput length={6} variant="light" onChange={setPin} onComplete={setPin} />
              </div>
            </>
          )}

          <Button
            type="submit"
            size="xl"
            className="w-full gradient-accent text-white shadow-lg glow-accent btn-press rounded-2xl font-semibold"
            loading={submitting}
          >
            Create Account
          </Button>
        </form>
      )}

      {/* Sign in link */}
      <div className="pt-5 mt-3">
        <div className="relative flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-themed" />
          <span className="text-xs text-subtle font-medium">or</span>
          <div className="flex-1 h-px bg-themed" />
        </div>
        <p className="text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-400 font-semibold hover:text-brand-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
