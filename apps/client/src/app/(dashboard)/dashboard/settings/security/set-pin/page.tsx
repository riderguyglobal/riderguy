'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { ArrowLeft, Lock, CheckCircle, Loader2 } from 'lucide-react';

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
      setPin(clean);
      setError('');
      if (clean.length === 6) setTimeout(() => setStep('confirm'), 200);
    } else {
      setConfirmPin(clean);
      setError('');
    }
  }, [step]);

  const handleSubmit = useCallback(async () => {
    if (confirmPin !== pin) {
      setError("PINs don't match. Try again.");
      setConfirmPin('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api!.post('/auth/set-pin', { pin });
      setStep('success');
      setTimeout(() => router.back(), 2000);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message ?? 'Failed to set PIN.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [api, pin, confirmPin, router]);

  const currentPin = step === 'enter' ? pin : confirmPin;

  return (
    <div className="min-h-[100dvh] bg-surface-50">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-surface-100 transition-colors">
            <ArrowLeft className="h-5 w-5 text-surface-700" />
          </button>
          <h1 className="text-lg font-bold text-surface-900">Set PIN</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 pt-12 pb-8">
        {step === 'success' ? (
          <div className="text-center space-y-4 animate-scale-in">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-surface-900">PIN Set!</h2>
            <p className="text-surface-500">Log in with your phone + PIN next time.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-brand-500" />
              </div>
              <h2 className="text-xl font-bold text-surface-900">
                {step === 'enter' ? 'Create your PIN' : 'Confirm your PIN'}
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                {step === 'enter' ? 'Choose a 6-digit PIN' : 'Enter the same PIN again'}
              </p>
            </div>

            <div className="flex justify-center gap-3 mb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    i < currentPin.length ? 'bg-brand-500 scale-110' : 'bg-surface-200'
                  }`}
                />
              ))}
            </div>

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

            <button onClick={() => inputRef.current?.focus()} className="w-full py-4 text-center text-sm text-surface-400">
              Tap here if keyboard closes
            </button>

            {error && <p className="text-center text-sm text-red-500 mt-2">{error}</p>}

            {step === 'confirm' && confirmPin.length === 6 && (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full mt-6 py-3.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-5 w-5 animate-spin" />Setting PIN...</> : 'Set PIN'}
              </button>
            )}

            {step === 'confirm' && (
              <button onClick={() => { setStep('enter'); setPin(''); setConfirmPin(''); setError(''); }} className="w-full mt-3 py-2 text-sm text-surface-400 hover:text-surface-600">
                Start over
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
