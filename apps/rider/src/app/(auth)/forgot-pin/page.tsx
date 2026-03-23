'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { OtpInput, PhoneInput, Button } from '@riderguy/ui';
import { phoneSchema } from '@riderguy/validators';
import { API_BASE_URL } from '@/lib/constants';
import { ArrowLeft, KeyRound, ShieldCheck, CheckCircle, AlertCircle, Phone } from 'lucide-react';

type Stage = 'phone' | 'otp' | 'new-pin' | 'confirm-pin' | 'success';

export default function ForgotPinPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md mx-auto animate-pulse p-8" />}>
      <ForgotPinContent />
    </Suspense>
  );
}

function ForgotPinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPhone = searchParams?.get('phone') ?? '';

  const [stage, setStage] = useState<Stage>(initialPhone ? 'phone' : 'phone');
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const otpRef = useRef<{ clear: () => void; focus: () => void }>(null);
  const pinRef = useRef<{ clear: () => void; focus: () => void }>(null);
  const confirmPinRef = useRef<{ clear: () => void; focus: () => void }>(null);

  const cooldownEndRef = useRef(0);

  // Cooldown timer — uses Date.now() delta so it stays correct when iOS backgrounds Safari
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

  // Cooldown for OTP resend
  const startCooldown = useCallback(() => {
    cooldownEndRef.current = Date.now() + 60_000;
    setCooldown(60);
  }, []);

  // Step 1: Request OTP
  const handleRequestOtp = async () => {
    setError('');
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError('Enter a valid Ghana phone number');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'PASSWORD_RESET' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Failed to send OTP');

      startCooldown();
      setStage('otp');
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify OTP and go to new PIN
  const handleOtpComplete = async (code: string) => {
    setError('');
    setOtp(code);
    // We'll verify OTP when resetting PIN — just move to PIN entry
    setStage('new-pin');
  };

  // Step 3: Validate new PIN
  const handleNewPinComplete = (code: string) => {
    setNewPin(code);
    setStage('confirm-pin');
  };

  // Step 4: Confirm PIN and reset
  const handleConfirmPinComplete = async (code: string) => {
    setConfirmPin(code);
    if (code !== newPin) {
      setError('PINs do not match — try again');
      confirmPinRef.current?.clear();
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Failed to reset PIN');

      setStage('success');
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
      if (err.message?.includes('OTP') || err.message?.includes('expired')) {
        // OTP expired — go back
        setStage('otp');
        otpRef.current?.clear();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in">
      {/* Back link */}
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand-400 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to login
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-primary">Reset your PIN</h1>
        <p className="text-muted text-sm mt-1">
          We&apos;ll send a code to verify your phone, then you can set a new PIN.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ====== Stage: Phone ====== */}
      {stage === 'phone' && (
        <div className="space-y-4">
          <div className="glass-elevated rounded-2xl p-5 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Phone className="h-6 w-6 text-amber-400" />
            </div>
            <p className="text-primary font-semibold">Enter your phone number</p>
            <p className="text-muted text-xs mt-1">We&apos;ll send a verification code</p>
          </div>

          <PhoneInput value={phone} onValueChange={setPhone} />

          <Button
            size="xl"
            className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
            onClick={handleRequestOtp}
            loading={submitting}
            disabled={submitting || !phone}
          >
            Send Verification Code
          </Button>
        </div>
      )}

      {/* ====== Stage: OTP ====== */}
      {stage === 'otp' && (
        <div className="space-y-5">
          <div className="glass-elevated rounded-2xl p-5 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-sky-500/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-sky-400" />
            </div>
            <p className="text-primary font-semibold">Enter verification code</p>
            <p className="text-muted text-xs mt-1">Sent to {phone}</p>
          </div>

          <OtpInput
            ref={otpRef}
            length={6}
            variant="light"
            onChange={setOtp}
            onComplete={handleOtpComplete}
            disabled={submitting}
          />

          <div className="text-center">
            <button
              onClick={handleRequestOtp}
              disabled={cooldown > 0 || submitting}
              className="text-sm text-muted hover:text-brand-400 transition-colors disabled:opacity-40"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </div>
      )}

      {/* ====== Stage: New PIN ====== */}
      {stage === 'new-pin' && (
        <div className="space-y-5">
          <div className="glass-elevated rounded-2xl p-5 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-primary font-semibold">Create a new PIN</p>
            <p className="text-muted text-xs mt-1">Enter a 6-digit PIN you&apos;ll remember</p>
          </div>

          <OtpInput
            ref={pinRef}
            length={6}
            variant="light"
            onChange={setNewPin}
            onComplete={handleNewPinComplete}
            disabled={submitting}
          />
        </div>
      )}

      {/* ====== Stage: Confirm PIN ====== */}
      {stage === 'confirm-pin' && (
        <div className="space-y-5">
          <div className="glass-elevated rounded-2xl p-5 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-primary font-semibold">Confirm your PIN</p>
            <p className="text-muted text-xs mt-1">Re-enter the same 6-digit PIN</p>
          </div>

          <OtpInput
            ref={confirmPinRef}
            length={6}
            variant="light"
            onChange={setConfirmPin}
            onComplete={handleConfirmPinComplete}
            disabled={submitting}
          />

          {submitting && (
            <div className="flex items-center justify-center gap-2 text-muted text-sm">
              <div className="h-4 w-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
              Resetting PIN…
            </div>
          )}
        </div>
      )}

      {/* ====== Stage: Success ====== */}
      {stage === 'success' && (
        <div className="space-y-5 text-center">
          <div className="glass-elevated rounded-2xl p-8">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-primary mb-2">PIN Reset Successfully!</h2>
            <p className="text-muted text-sm">You can now log in with your new PIN.</p>
          </div>

          <Button
            size="xl"
            className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
            onClick={() => router.push('/login')}
          >
            Go to Login
          </Button>
        </div>
      )}
    </div>
  );
}
