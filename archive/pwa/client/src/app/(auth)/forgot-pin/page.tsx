'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OtpInput, PhoneInput } from '@riderguy/ui';
import { phoneSchema } from '@riderguy/validators';
import { getApiClient } from '@riderguy/auth';
import { ArrowLeft, KeyRound, ShieldCheck, CheckCircle, AlertCircle, Phone, ChevronRight } from 'lucide-react';

type Stage = 'phone' | 'otp' | 'new-pin' | 'confirm-pin' | 'success';

export default function ForgotPinPage() {
  return (
    <Suspense fallback={<div style={{ height: 200 }} />}>
      <ForgotPinContent />
    </Suspense>
  );
}

function ForgotPinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPhone = searchParams?.get('phone') ?? '';

  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const otpRef     = useRef<{ clear: () => void; focus: () => void }>(null);
  const pinRef     = useRef<{ clear: () => void; focus: () => void }>(null);
  const confirmRef = useRef<{ clear: () => void; focus: () => void }>(null);
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

  const startCooldown = useCallback(() => {
    cooldownEndRef.current = Date.now() + 60_000;
    setCooldown(60);
  }, []);

  const handleRequestOtp = async () => {
    setError('');
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) { setError('Enter a valid Ghana phone number'); return; }
    setSubmitting(true);
    try {
      const api = getApiClient();
      if (!api) throw new Error('API client not initialised');
      const { data } = await api.post('/auth/otp/request', { phone, purpose: 'PASSWORD_RESET' });
      if (data?.success === false) throw new Error(data?.error?.message ?? 'Failed to send OTP');
      startCooldown();
      setStage('otp');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Something went wrong');
    } finally { setSubmitting(false); }
  };

  const handleOtpComplete = async (code: string) => {
    setError(''); setSubmitting(true);
    try {
      const api = getApiClient();
      if (!api) throw new Error('API client not initialised');
      const { data } = await api.post('/auth/otp/verify', { phone, code, purpose: 'PASSWORD_RESET' });
      if (data?.success === false) throw new Error(data?.error?.message ?? 'Invalid OTP');
      setOtp(code); setStage('new-pin');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Invalid OTP code');
      otpRef.current?.clear();
    } finally { setSubmitting(false); }
  };

  const handleNewPinComplete = (code: string) => {
    setNewPin(code); setStage('confirm-pin');
  };

  const handleConfirmPinComplete = async (code: string) => {
    setConfirmPin(code);
    if (code !== newPin) {
      setError('PINs do not match — try again');
      confirmRef.current?.clear();
      return;
    }
    setSubmitting(true); setError('');
    try {
      const api = getApiClient();
      if (!api) throw new Error('API client not initialised');
      const { data } = await api.post('/auth/reset-pin', { phone, otp, newPin });
      if (data?.success === false) throw new Error(data?.error?.message ?? 'Failed to reset PIN');
      setStage('success');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Something went wrong';
      setError(msg);
      if (msg?.includes('OTP') || msg?.includes('expired')) {
        setStage('otp'); otpRef.current?.clear();
      }
    } finally { setSubmitting(false); }
  };

  /* ─── Design tokens ─── */
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

  const goBack = () => {
    setError('');
    if (stage === 'otp')         { setStage('phone'); setCooldown(0); otpRef.current?.clear(); }
    else if (stage === 'new-pin') { setStage('otp'); }
    else if (stage === 'confirm-pin') { setStage('new-pin'); pinRef.current?.clear(); confirmRef.current?.clear(); }
    else { router.push('/login'); }
  };

  const BackBtn = ({ label }: { label: string }) => (
    <button type="button" onClick={goBack} className="flex items-center gap-2 mb-5 transition-colors">
      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowLeft style={{ width: 12, height: 12, color: '#64748b' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>{label}</span>
    </button>
  );

  return (
    <div className="animate-fade-in">

      {/* ── Back button ── */}
      {stage !== 'success'
        ? <BackBtn label={stage === 'phone' ? 'Back to sign in' : 'Back'} />
        : null
      }

      {/* ── Heading (phone stage only) ── */}
      {stage === 'phone' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ width: 28, height: 3, borderRadius: 99, background: 'linear-gradient(to right, #16a34a, #4ade80)', marginBottom: 11 }} />
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            Reset your PIN
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 400 }}>
            Verify your phone number then set a new PIN
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

      {/* ══════════ PHONE ══════════ */}
      {stage === 'phone' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StageCard>
            <StageIcon><Phone style={{ width: 19, height: 19, color: '#374151' }} /></StageIcon>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>Enter your phone number</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>We&apos;ll send a verification code</p>
          </StageCard>
          <PhoneInput value={phone} onValueChange={setPhone} />
          <PrimaryBtn onClick={handleRequestOtp} disabled={submitting || !phone}>
            {submitting ? <Spinner /> : 'Send Code'}
          </PrimaryBtn>
        </div>
      )}

      {/* ══════════ OTP ══════════ */}
      {stage === 'otp' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StageCard>
            <StageIcon><ShieldCheck style={{ width: 19, height: 19, color: '#374151' }} /></StageIcon>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>Verification code</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              Sent to <span style={{ color: '#374151', fontWeight: 600 }}>{phone}</span>
            </p>
          </StageCard>
          <OtpInput
            ref={otpRef}
            length={6}
            variant="light"
            onChange={setOtp}
            onComplete={handleOtpComplete}
            disabled={submitting}
          />
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={cooldown > 0 || submitting}
              className="disabled:opacity-50"
            >
              {cooldown > 0
                ? <span style={{ fontSize: 12, color: '#94a3b8' }}>Resend in <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cooldown}s</span></span>
                : <span style={{ fontSize: 12, color: '#15803d', fontWeight: 700 }}>Resend code</span>}
            </button>
          </div>
        </div>
      )}

      {/* ══════════ NEW PIN ══════════ */}
      {stage === 'new-pin' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StageCard>
            <StageIcon><KeyRound style={{ width: 19, height: 19, color: '#374151' }} /></StageIcon>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>Create a new PIN</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Enter a 6-digit PIN you&apos;ll remember</p>
          </StageCard>
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

      {/* ══════════ CONFIRM PIN ══════════ */}
      {stage === 'confirm-pin' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StageCard>
            <StageIcon><KeyRound style={{ width: 19, height: 19, color: '#374151' }} /></StageIcon>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>Confirm your PIN</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Re-enter the same 6-digit PIN</p>
          </StageCard>
          <OtpInput
            ref={confirmRef}
            length={6}
            variant="light"
            onChange={setConfirmPin}
            onComplete={handleConfirmPinComplete}
            disabled={submitting}
          />
          {submitting && (
            <div className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 border-2 border-[#15803d] border-t-transparent rounded-full animate-spin" />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Resetting PIN…</span>
            </div>
          )}
        </div>
      )}

      {/* ══════════ SUCCESS ══════════ */}
      {stage === 'success' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 8 }}>
            <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 16px' }}>
              <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(21,128,61,0.16) 0%, transparent 70%)' }} />
              <div
                className="flex items-center justify-center"
                style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #16a34a, #0f6830)', boxShadow: '0 6px 28px rgba(21,128,61,0.40)' }}
              >
                <CheckCircle style={{ width: 28, height: 28, color: '#fff' }} />
              </div>
            </div>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>PIN Reset!</p>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24, lineHeight: 1.55 }}>
              You can now log in with your new PIN.
            </p>
          </div>
          <PrimaryBtn onClick={() => router.replace('/login')}>Go to Sign In</PrimaryBtn>
        </div>
      )}

    </div>
  );
}
