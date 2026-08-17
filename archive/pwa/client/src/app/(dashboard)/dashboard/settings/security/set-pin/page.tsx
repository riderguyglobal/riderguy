'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react';

type Step = 'enter' | 'confirm' | 'success';

export default function SetPinPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [step, setStep] = useState<Step>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [step]);

  const handlePinChange = useCallback((value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    if (step === 'enter') {
      setPin(clean); setError('');
      if (clean.length === 6) setTimeout(() => setStep('confirm'), 200);
    } else {
      setConfirmPin(clean); setError('');
    }
  }, [step]);

  const handleSubmit = useCallback(async () => {
    if (confirmPin !== pin) { setError("PINs don't match. Try again."); setConfirmPin(''); return; }
    setLoading(true); setError('');
    try {
      await api!.post('/auth/set-pin', { pin });
      setStep('success');
      setTimeout(() => router.back(), 2200);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to set PIN.');
    } finally { setLoading(false); }
  }, [api, pin, confirmPin, router]);

  const currentPin = step === 'enter' ? pin : confirmPin;
  const title      = step === 'enter' ? 'Create your PIN' : 'Confirm your PIN';
  const subtitle   = step === 'enter' ? 'Choose a 6-digit PIN to secure your account' : 'Enter the same PIN again to confirm';

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
        <p className="text-[17px] font-bold text-surface-900">Set PIN</p>
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
            <p className="text-[22px] font-black text-surface-900 tracking-tight">PIN Set!</p>
            <p className="text-[13px] text-surface-400 mt-2 leading-relaxed">
              Log in with your phone + PIN next time.
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
              <p className="text-[20px] font-black text-surface-900 tracking-tight">{title}</p>
              <p className="text-[12px] text-surface-400 mt-1.5">{subtitle}</p>
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-1.5 mb-7">
              <div className={`h-[3px] rounded-full transition-all duration-300 ${step === 'enter' ? 'w-7 bg-brand-500' : 'w-[18px] bg-brand-500'}`} />
              <div className={`h-[3px] rounded-full transition-all duration-300 ${step === 'confirm' ? 'w-7 bg-brand-500' : 'w-[18px] bg-surface-200'}`} />
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-7">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                    i < currentPin.length
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
              value={currentPin}
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
                  : 'Set PIN'
                }
              </button>
            )}

            {/* Start over */}
            {step === 'confirm' && (
              <button
                type="button"
                onClick={() => { setStep('enter'); setPin(''); setConfirmPin(''); setError(''); }}
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
