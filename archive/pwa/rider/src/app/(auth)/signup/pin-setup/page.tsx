'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

type Step = 'create' | 'confirm' | 'success';

export default function PinSetupPage() {
  const router = useRouter();
  const { setPin, isAuthenticated } = useAuth();

  const [step, setStep] = useState<Step>('create');
  const [pin, setPinState] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const length = 6;
  const createRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [createCode, setCreateCode] = useState<string[]>(Array(length).fill(''));
  const [confirmCode, setConfirmCode] = useState<string[]>(Array(length).fill(''));

  // Redirect back to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      // Allow a short grace period - user might be mid-registration redirect
      const timer = setTimeout(() => {
        if (!isAuthenticated) router.replace('/login');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (step === 'create') createRefs.current[0]?.focus();
    if (step === 'confirm') confirmRefs.current[0]?.focus();
  }, [step]);

  function handleCreateChange(i: number, v: string) {
    if (!/^\d*$/.test(v)) return;
    const next = [...createCode];
    next[i] = v.slice(-1);
    setCreateCode(next);
    if (v && i < length - 1) createRefs.current[i + 1]?.focus();
    const full = next.join('');
    if (full.length === length && !next.includes('')) {
      setPinState(full);
      setStep('confirm');
    }
  }

  function handleCreateKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !createCode[i] && i > 0) createRefs.current[i - 1]?.focus();
  }

  function handleCreatePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!p) return;
    const next = Array(length).fill('');
    p.split('').forEach((c, i) => { next[i] = c; });
    setCreateCode(next);
    createRefs.current[Math.min(p.length, length - 1)]?.focus();
    if (p.length === length) {
      setPinState(p);
      setStep('confirm');
    }
  }

  function handleConfirmChange(i: number, v: string) {
    if (!/^\d*$/.test(v)) return;
    const next = [...confirmCode];
    next[i] = v.slice(-1);
    setConfirmCode(next);
    if (v && i < length - 1) confirmRefs.current[i + 1]?.focus();
    const full = next.join('');
    if (full.length === length && !next.includes('')) {
      handleConfirmComplete(full);
    }
  }

  function handleConfirmKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !confirmCode[i] && i > 0) confirmRefs.current[i - 1]?.focus();
  }

  function handleConfirmPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!p) return;
    const next = Array(length).fill('');
    p.split('').forEach((c, i) => { next[i] = c; });
    setConfirmCode(next);
    confirmRefs.current[Math.min(p.length, length - 1)]?.focus();
    if (p.length === length) handleConfirmComplete(p);
  }

  async function handleConfirmComplete(code: string) {
    if (code !== pin) {
      setError('PINs do not match. Try again.');
      setConfirmCode(Array(length).fill(''));
      confirmRefs.current[0]?.focus();
      return;
    }
    setError('');
    setLoading(true);
    try {
      await setPin(code);
      setStep('success');
      // Auto-redirect after success animation
      setTimeout(() => router.replace('/dashboard'), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to set PIN. Try again.');
      setConfirmCode(Array(length).fill(''));
      confirmRefs.current[0]?.focus();
    } finally { setLoading(false); }
  }

  /* ── Success ── */
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/30 animate-bounce-in">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          {/* Ripple effect */}
          <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
        </div>
        <h2 className="text-2xl font-bold text-primary mb-2">You're all set!</h2>
        <p className="text-muted text-center">
          Your PIN has been created. Redirecting to dashboard...
        </p>
      </div>
    );
  }

  /* ── Confirm PIN ── */
  if (step === 'confirm') {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => {
            setStep('create');
            setCreateCode(Array(length).fill(''));
            setConfirmCode(Array(length).fill(''));
            setPinState('');
            setError('');
          }}
          className="flex items-center gap-1.5 text-muted hover:text-secondary text-sm mb-8 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Start over
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-primary text-center mb-1">Confirm your PIN</h2>
        <p className="text-muted text-sm text-center mb-8">Enter the same 6-digit PIN again</p>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-1 rounded-full bg-brand-500" />
          <div className="w-8 h-1 rounded-full bg-brand-500" />
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { confirmRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={confirmCode[i]}
              onChange={(e) => handleConfirmChange(i, e.target.value)}
              onKeyDown={(e) => handleConfirmKey(i, e)}
              onPaste={i === 0 ? handleConfirmPaste : undefined}
              className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-2xl border-2 bg-card transition-all duration-200 focus:outline-none ${
                error
                  ? 'border-danger-500 text-danger-400 animate-shake'
                  : confirmCode[i]
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

  /* ── Create PIN ── */
  return (
    <div className="animate-fade-in">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Lock className="w-8 h-8 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-primary text-center mb-1">Create your PIN</h2>
      <p className="text-muted text-sm text-center mb-8">
        This 6-digit PIN secures your account and will be used to log in quickly
      </p>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-8 h-1 rounded-full bg-brand-500" />
        <div className="w-8 h-1 rounded-full bg-themed" />
      </div>

      <div className="flex justify-center gap-3 mb-6">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { createRefs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={createCode[i]}
            onChange={(e) => handleCreateChange(i, e.target.value)}
            onKeyDown={(e) => handleCreateKey(i, e)}
            onPaste={i === 0 ? handleCreatePaste : undefined}
            className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-2xl border-2 bg-card transition-all duration-200 focus:outline-none ${
              createCode[i]
                ? 'border-brand-500 text-primary shadow-sm shadow-brand-500/10'
                : 'border-themed text-primary focus:border-brand-500 focus:shadow-sm focus:shadow-brand-500/10'
            }`}
          />
        ))}
      </div>

      <p className="text-xs text-muted text-center">
        Use a PIN you can remember. Avoid obvious sequences like 123456.
      </p>
    </div>
  );
}
