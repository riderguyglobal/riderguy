'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { OtpInput, PhoneInput } from '@riderguy/ui';
import { phoneSchema, emailSchema, passwordSchema } from '@riderguy/validators';
import { AlertCircle, CheckCircle, ArrowLeft, ArrowRight, Smartphone, Sparkles } from 'lucide-react';
import Link from 'next/link';

const STEP_LABELS = ['Phone', 'Verify', 'Details', 'Done'];

export default function RegisterPage() {
  const router = useRouter();
  const { requestOtp, verifyOtp, register, isAuthenticated, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownEndRef = useRef(0);

  // OTP resend cooldown timer â€” uses Date.now() delta so it stays correct when iOS backgrounds Safari
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

  // Redirect authenticated users to dashboard (don't redirect during step 3 success)
  useEffect(() => {
    if (!authLoading && isAuthenticated && step < 3) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, step, router]);

  const handleSendOtp = async () => {
    if (!phone) return;
    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await requestOtp(phone, 'REGISTRATION');
      setStep(1);
      setCooldown(60);
      cooldownEndRef.current = Date.now() + 60_000;
    } catch {
      setError('Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const otpCode = code ?? otp;
    if (otpCode.length < 6) return;
    setLoading(true);
    setError('');
    try {
      await verifyOtp(phone, otpCode, 'REGISTRATION');
      setStep(2);
    } catch {
      setError('Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) return;
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
      await register({ firstName, lastName, email, password, phone, role: 'CLIENT', otpCode: otp });
      setStep(3);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message;
      setError(msg || (err instanceof Error ? err.message : 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {step < 3 && (
        <button onClick={() => step > 0 ? setStep(step - 1) : router.replace('/login')} className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-900 transition-colors btn-press">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}

      <div>
        <h1 className="text-2xl font-extrabold text-surface-900 mb-1">Create account</h1>
        <p className="text-surface-400 text-sm">Join RiderGuy to start sending packages</p>
      </div>

      {/* â”€â”€ Step Indicator â”€â”€ */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={label} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className={`h-[3px] w-full rounded-full transition-all duration-500 ${
                  done ? 'bg-brand-500' : active ? 'bg-brand-500/40' : 'bg-surface-200'
                }`} />
                <span className={`text-[10px] font-medium tracking-wide ${
                  done || active ? 'text-brand-500' : 'text-surface-300'
                }`}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 animate-shake">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* â”€â”€ Step 0: Phone â”€â”€ */}
      {step === 0 && (
        <div className="space-y-4 animate-slide-up">
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-600">Phone number</label>
            <PhoneInput value={phone} onValueChange={setPhone} placeholder="024 XXX XXXX" />
          </div>
          <button
            onClick={handleSendOtp}
            disabled={loading || !phone}
            className="w-full h-[52px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.28)] hover:shadow-[0_4px_32px_rgba(34,197,94,0.42)]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>Continue <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      )}

      {/* â”€â”€ Step 1: OTP â”€â”€ */}
      {step === 1 && (
        <div className="space-y-4 animate-slide-up">
          <div className="bg-surface-50 border border-surface-200 rounded-2xl p-5 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto">
              <Smartphone className="h-6 w-6 text-brand-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-900">Verification code</p>
              <p className="text-xs text-surface-400 mt-1">Sent to {phone}</p>
            </div>
            <OtpInput length={6} variant="light" onChange={setOtp} onComplete={(code) => { setOtp(code); handleVerifyOtp(code); }} />
          </div>
          <button
            onClick={() => handleVerifyOtp()}
            disabled={loading || otp.length < 6}
            className="w-full h-[52px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.25)]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>Verify <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          <button
            onClick={handleSendOtp}
            disabled={loading || cooldown > 0}
            className="w-full text-sm text-surface-400 font-medium hover:text-brand-500 transition-colors disabled:opacity-40"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      )}

      {/* â”€â”€ Step 2: Details â”€â”€ */}
      {step === 2 && (
        <div className="space-y-4 animate-slide-up">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-600">First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John"
                className="w-full h-12 rounded-xl bg-surface-50 border border-surface-200 px-4 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-600">Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe"
                className="w-full h-12 rounded-xl bg-surface-50 border border-surface-200 px-4 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-600">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full h-12 rounded-xl bg-surface-50 border border-surface-200 px-4 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-600">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters"
              className="w-full h-12 rounded-xl bg-surface-50 border border-surface-200 px-4 text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all" />
          </div>
          <button
            onClick={handleRegister}
            disabled={loading || !firstName || !lastName || !email || !password}
            className="w-full h-[52px] rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-[15px] transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(34,197,94,0.28)] hover:shadow-[0_4px_32px_rgba(34,197,94,0.42)]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Sparkles className="h-4 w-4" /> Create Account</>
            )}
          </button>
        </div>
      )}

      {/* â”€â”€ Step 3: Success â”€â”€ */}
      {step === 3 && (
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
      )}

      {step < 3 && (
        <p className="text-center text-sm text-surface-400">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-500 font-semibold hover:text-brand-400 transition-colors">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
