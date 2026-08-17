'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react';

type Step = 'current' | 'new' | 'confirm' | 'success';

const STEPS: Step[] = ['current', 'new', 'confirm'];

export default function ChangePinPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [step, setStep] = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [step]);

  const activePin = step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin;

  const handlePinChange = useCallback((value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    setError('');
    if (step === 'current') {
      setCurrentPin(clean);
      if (clean.length === 6) setTimeout(() => setStep('new'), 200);
    } else if (step === 'new') {
      setNewPin(clean);
      if (clean.length === 6) setTimeout(() => setStep('confirm'), 200);
    } else {
      setConfirmPin(clean);
    }
  }, [step]);

  const handleSubmit = useCallback(async () => {
    if (confirmPin !== newPin) {
      setError("PINs don't match. Try again."); setConfirmPin(''); return;
    }
    if (currentPin === newPin) {
      setError('New PIN must be different from your current PIN.'); setConfirmPin(''); setNewPin(''); setStep('new'); return;
    }
    setLoading(true); setError('');
    try {
      await api!.post('/auth/change-pin', { currentPin, newPin });
      setStep('success');
      setTimeout(() => router.back(), 2200);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message ?? 'Failed to change PIN.';
      setError(msg);
      if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('incorrect')) {
        setCurrentPin(''); setNewPin(''); setConfirmPin(''); setStep('current');
      }
    } finally { setLoading(false); }
  }, [api, currentPin, newPin, confirmPin, router]);

  const labels: Record<Exclude<Step, 'success'>, { title: string; subtitle: string }> = {
    current: { title: 'Enter current PIN',  subtitle: 'Verify your identity first' },
    new:     { title: 'Enter new PIN',       subtitle: 'Choose a new 6-digit PIN' },
    confirm: { title: 'Confirm new PIN',     subtitle: 'Enter the same PIN again' },
  };

  const stepIdx = step !== 'success' ? STEPS.indexOf(step) : -1;

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-surface-100 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 10px)', paddingBottom: 10 }}
      >
        <button type="button" onClick={() => router.back()} className="map-btn bg-surface-50 shadow-none border border-surface-200">
          <ArrowLeft className="h-4 w-4 text-surface-700" />
        </button>
        <p className="text-[17px] font-bold text-surface-900">Change PIN</p>
      </div>

      <div className="max-w-sm mx-auto px-5 pt-8 pb-10">

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="animate-fade-in flex flex-col items-center text-center pt-6">
            <div className="relative mb-5">
              <div className="absolute inset-0 -m-4 rounded-full bg-brand-500/10 blur-xl" />
              <div className="relative h-[68px] w-[68px] rounded-full bg-brand-500 flex items-center justify-center shadow-[0_8px_30px_rgba(34,197,94,0.45)]">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
            </div>
            <p className="text-[22px] font-black text-surface-900 tracking-tight">PIN Changed!</p>
            <p className="text-[13px] text-surface-400 mt-2 leading-relaxed">
              Your new PIN is ready to use.
            </p>
          </div>
        )}

        {/* ── PIN entry ── */}
        {step !== 'success' && (
          <div className="animate-fade-in">

            {/* Icon + heading */}
            <div className="text-center mb-7">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-4 shadow-[0_4px_14px_rgba(34,197,94,0.12)]">
                <Lock className="h-6 w-6 text-brand-600" />
              </div>
              <p className="text-[20px] font-black text-surface-900 tracking-tight">{labels[step].title}</p>
              <p className="text-[12px] text-surface-400 mt-1.5">{labels[step].subtitle}</p>
            </div>

            {/* Step indicator — 3 dots */}
            <div className="flex justify-center gap-1.5 mb-7">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`h-[3px] rounded-full transition-all duration-300 ${
                    i === stepIdx
                      ? 'w-7 bg-brand-500'
                      : i < stepIdx
                      ? 'w-[18px] bg-brand-500/50'
                      : 'w-[18px] bg-surface-200'
                  }`}
                />
              ))}
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-7">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                    i < activePin.length
                      ? 'bg-brand-500 scale-[1.15] shadow-[0_2px_8px_rgba(34,197,94,0.4)]'
                      : 'bg-surface-200'
                  }`}
                />
              ))}
            </div>

            {/* Hidden numeric input */}
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={activePin}
              onChange={(e) => handlePinChange(e.target.value)}
              className="opacity-0 absolute -z-10"
              autoFocus
            />

            {/* Keyboard helper */}
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="w-full py-2.5 text-center text-[12px] text-surface-400 hover:text-surface-600 transition-colors mb-2"
            >
              Tap here if keyboard closes
            </button>

            {/* Error */}
            {error && (
              <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100 border-l-[3px] border-l-red-500">
                <p className="text-[12px] text-red-600 leading-snug">{error}</p>
              </div>
            )}

            {/* Submit */}
            {step === 'confirm' && confirmPin.length === 6 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary brand w-full mt-2"
              >
                {loading
                  ? <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  : 'Change PIN'
                }
              </button>
            )}

            {/* Start over */}
            {step !== 'current' && (
              <button
                type="button"
                onClick={() => { setCurrentPin(''); setNewPin(''); setConfirmPin(''); setError(''); setStep('current'); }}
                className="w-full mt-3 py-2 text-center text-[12px] text-surface-400 hover:text-surface-600 transition-colors font-medium"
              >
                Start over
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
