'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { OtpInput, PhoneInput } from '@riderguy/ui';
import { phoneSchema, emailSchema, passwordSchema } from '@riderguy/validators';
import {
  Phone, Mail, AlertCircle, CheckCircle, ArrowLeft, ArrowRight,
  Sparkles, Smartphone, Eye, EyeOff, User,
} from 'lucide-react';
import Link from 'next/link';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

type Tab = 'phone' | 'email';

export default function RegisterPage() {
  const router = useRouter();
  const {
    requestOtp, verifyOtp, register, registerWithEmail,
    isAuthenticated, isLoading: authLoading,
  } = useAuth();

  const [tab, setTab] = useState<Tab>('phone');

  // Phone flow state
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownEndRef = useRef(0);

  // Email flow state (shared password/eye toggle)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Name fields (shared across both flows)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Cooldown timer
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
    if (!authLoading && isAuthenticated && !success) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, success, router]);

  // ---- Phone flow handlers ----
  const handleSendOtp = async () => {
    if (!phone) return;
    const result = phoneSchema.safeParse(phone);
    if (!result.success) { setError(result.error.errors[0]?.message ?? 'Invalid phone number'); return; }
    setLoading(true); setError('');
    try {
      await requestOtp(phone, 'REGISTRATION');
      setPhoneStep('otp');
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || 'Failed to send code. Please try again.');
    }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (code?: string) => {
    const otpCode = code ?? otp;
    if (otpCode.length < 6) return;
    setLoading(true); setError('');
    try {
      await verifyOtp(phone, otpCode, 'REGISTRATION');
      // Move to name collection step
      setOtp(otpCode);
      setPhoneStep('name');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Verification failed. Try again.'));
    } finally { setLoading(false); }
  };

  // ---- Phone flow: final registration after name ----
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

  // ---- Email flow handler ----
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

  // ---- Google handler ----
  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) { setError('Google sign-in is not configured yet.'); return; }
    const redirectUri = window.location.origin + '/auth/google/callback';
    const scope = 'openid email profile';
    // Generate CSRF state nonce
    const state = crypto.randomUUID();
    try { sessionStorage.setItem('google_oauth_state', state); } catch {}
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=select_account&state=${encodeURIComponent(state)}`;
    window.location.href = url;
  };

  const goBack = () => {
    setError('');
    if (phoneStep === 'name') { setPhoneStep('otp'); }
    else if (phoneStep === 'otp') { setPhoneStep('phone'); setOtp(''); }
    else { router.replace('/login'); }
  };

  const inPhoneFlow = tab === 'phone' && phoneStep !== 'phone';

  // ---- Success screen ----
  if (success) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 animate-scale-in">
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-2xl scale-150 animate-ping-soft" />
            <div className="relative h-20 w-20 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-brand-500" />
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-surface-900 mb-2">Welcome to RiderGuy!</h2>
          <p className="text-surface-400 text-sm mb-8">Your account is ready. Start sending packages now.</p>
          <button
            onClick={() => router.replace('/dashboard')}
            className="h-[52px] px-8 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press inline-flex items-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.3)]"
          >
            <Sparkles className="h-4 w-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      {inPhoneFlow ? (
        <button onClick={goBack} className="flex items-center gap-2 text-surface-400 hover:text-surface-900 transition-colors group mb-6">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>
      ) : (
        <button onClick={() => router.replace('/login')} className="flex items-center gap-2 text-surface-400 hover:text-surface-900 transition-colors group mb-6">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}

      {/* Heading (initial stage only) */}
      {!inPhoneFlow && (
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight leading-tight">Create account</h1>
          <p className="text-surface-400 text-base mt-2">Join RiderGuy to start sending packages</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 animate-shake">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 leading-snug">{error}</p>
        </div>
      )}

      {/* Tab toggle (initial stage only) */}
      {!inPhoneFlow && (
        <div className="flex gap-0 mb-8 border-b border-surface-200">
          {([
            { key: 'phone' as Tab, icon: Phone, label: 'Phone' },
            { key: 'email' as Tab, icon: Mail, label: 'Email' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(''); setPhoneStep('phone'); }}
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

      {/* ======= PHONE TAB ======= */}
      {tab === 'phone' && (
        <>
          {/* Phone input */}
          {phoneStep === 'phone' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-base font-medium text-surface-600 mb-2.5">Phone number</label>
                <PhoneInput value={phone} onValueChange={setPhone} placeholder="024 XXX XXXX" />
              </div>
              <button
                onClick={handleSendOtp}
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

          {/* OTP verification */}
          {phoneStep === 'otp' && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center mb-2">
                <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-surface-600" />
                </div>
                <p className="text-surface-900 font-semibold text-sm">Enter verification code</p>
                <p className="text-surface-400 text-xs mt-1">Sent to <span className="font-medium text-surface-600">{phone}</span></p>
              </div>
              <OtpInput
                length={6}
                variant="light"
                onChange={setOtp}
                onComplete={(code) => { setOtp(code); handleVerifyOtp(code); }}
                disabled={loading}
              />
              <button
                onClick={() => handleVerifyOtp()}
                disabled={loading || otp.length < 6}
                className="w-full h-[52px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press disabled:opacity-40 flex items-center justify-center shadow-[0_4px_24px_rgba(34,197,94,0.25)]"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Verify & Create Account'
                )}
              </button>
              <div className="flex items-center justify-center">
                <button onClick={handleSendOtp} disabled={loading || cooldown > 0} className="text-sm font-medium transition-colors disabled:opacity-50">
                  {cooldown > 0 ? (
                    <span className="text-surface-400">Resend in <span className="tabular-nums font-semibold text-surface-500">{cooldown}s</span></span>
                  ) : (
                    <span className="text-brand-500 hover:text-brand-400">Resend code</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Name collection */}
          {phoneStep === 'name' && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center mb-2">
                <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center">
                  <User className="h-5 w-5 text-surface-600" />
                </div>
                <p className="text-surface-900 font-semibold text-sm">What&apos;s your name?</p>
                <p className="text-surface-400 text-xs mt-1">This helps us personalise your experience</p>
              </div>
              <div>
                <label className="block text-base font-medium text-surface-600 mb-2.5">First name</label>
                <input
                  type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Kwame" autoFocus
                  className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-surface-600 mb-2.5">Last name</label>
                <input
                  type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Mensah"
                  onKeyDown={(e) => e.key === 'Enter' && handlePhoneRegister()}
                  className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
                />
              </div>
              <button
                onClick={handlePhoneRegister}
                disabled={loading || !firstName.trim() || !lastName.trim()}
                className="w-full h-[52px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.25)]"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Sparkles className="h-4 w-4" /> Create Account</>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* ======= EMAIL TAB ======= */}
      {tab === 'email' && (
        <div className="space-y-6 animate-fade-in">
          {/* Google button */}
          <button
            onClick={handleGoogleClick}
            disabled={loading}
            className="w-full h-[56px] rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 font-semibold text-base transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-3"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-surface-200" />
            <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-surface-200" />
          </div>

          {/* Email + Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-medium text-surface-600 mb-2.5">First name</label>
              <input
                type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Kwame"
                className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-base font-medium text-surface-600 mb-2.5">Last name</label>
              <input
                type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Mensah"
                className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-base font-medium text-surface-600 mb-2.5">Email address</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-surface-600 mb-2.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                onKeyDown={(e) => e.key === 'Enter' && handleEmailRegister()}
                className="w-full h-[56px] rounded-xl bg-surface-50 border border-surface-200 px-5 pr-12 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors p-1">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-xs text-surface-400 mt-1.5">Must include uppercase, lowercase, and a number</p>
          </div>
          <button
            onClick={handleEmailRegister}
            disabled={loading || !email || !password || !firstName.trim() || !lastName.trim()}
            className="w-full h-[56px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-base transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.28)]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Sparkles className="h-4 w-4" /> Create Account</>
            )}
          </button>
        </div>
      )}

      {/* Sign in link */}
      {!inPhoneFlow && (
        <div className="mt-10 text-center">
          <p className="text-base text-surface-400">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-500 font-semibold hover:text-brand-400 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
