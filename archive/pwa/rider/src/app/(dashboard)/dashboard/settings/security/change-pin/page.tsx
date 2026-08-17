'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { ArrowLeft, Lock, CheckCircle, Loader2 } from 'lucide-react';

type Step = 'current' | 'new' | 'confirm' | 'success';

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

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const activePin =
    step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin;

  const handlePinChange = useCallback(
    (value: string) => {
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
    },
    [step],
  );

  const handleSubmit = useCallback(async () => {
    if (confirmPin !== newPin) {
      setError("PINs don't match. Try again.");
      setConfirmPin('');
      return;
    }
    if (currentPin === newPin) {
      setError('New PIN must be different from current PIN.');
      setConfirmPin('');
      setNewPin('');
      setStep('new');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api!.post('/auth/change-pin', { currentPin, newPin });
      setStep('success');
      setTimeout(() => router.back(), 2000);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ?? 'Failed to change PIN.';
      setError(msg);
      if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('incorrect')) {
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setStep('current');
      }
    } finally {
      setLoading(false);
    }
  }, [api, currentPin, newPin, confirmPin, router]);

  const title =
    step === 'current'
      ? 'Enter current PIN'
      : step === 'new'
        ? 'Enter new PIN'
        : 'Confirm new PIN';

  const subtitle =
    step === 'current'
      ? 'Verify your identity first'
      : step === 'new'
        ? 'Choose a new 6-digit PIN'
        : 'Enter the same PIN again';

  return (
    <div className="min-h-[100dvh] bg-page">
      <div className="sticky top-0 z-10 bg-nav backdrop-blur-xl border-b border-themed">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-xl hover:bg-hover-themed transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-secondary" />
          </button>
          <h1 className="text-lg font-bold text-primary">Change PIN</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 pt-12 pb-8">
        {step === 'success' ? (
          <div className="text-center space-y-4 animate-scale-in">
            <div className="mx-auto w-16 h-16 rounded-full bg-accent-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-accent-400" />
            </div>
            <h2 className="text-xl font-bold text-primary">PIN Changed!</h2>
            <p className="text-muted">
              Your new PIN is ready to use.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-brand-400" />
              </div>
              <h2 className="text-xl font-bold text-primary">{title}</h2>
              <p className="text-sm text-muted mt-1">{subtitle}</p>
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mb-6">
              {(['current', 'new', 'confirm'] as const).map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step
                      ? 'w-8 bg-brand-500'
                      : (['current', 'new', 'confirm'].indexOf(s) <
                          ['current', 'new', 'confirm'].indexOf(step))
                        ? 'w-4 bg-brand-300'
                        : 'w-4 bg-skeleton'
                  }`}
                />
              ))}
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    i < activePin.length
                      ? 'bg-brand-500 scale-110'
                      : 'bg-skeleton'
                  }`}
                />
              ))}
            </div>

            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              autoCorrect="off"
              value={activePin}
              onChange={(e) => handlePinChange(e.target.value)}
              className="opacity-0 absolute -z-10"
              autoFocus
            />

            <button
              onClick={() => inputRef.current?.focus()}
              className="w-full py-4 text-center text-sm text-muted"
            >
              Tap here if keyboard closes
            </button>

            {error && (
              <p className="text-center text-sm text-danger-400 mt-2">{error}</p>
            )}

            {step === 'confirm' && confirmPin.length === 6 && (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full mt-6 py-3.5 rounded-2xl gradient-brand text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg glow-brand"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Changing PIN...
                  </>
                ) : (
                  'Change PIN'
                )}
              </button>
            )}

            {step !== 'current' && (
              <button
                onClick={() => {
                  setCurrentPin('');
                  setNewPin('');
                  setConfirmPin('');
                  setError('');
                  setStep('current');
                }}
                className="w-full mt-3 py-2 text-sm text-muted hover:text-secondary"
              >
                Start over
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
