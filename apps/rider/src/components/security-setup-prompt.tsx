'use client';

/**
 * SecuritySetupPrompt — a bottom-sheet prompt shown once per device
 * when the user logs in without PIN or biometric set up.
 *
 * Encourages riders to set up a PIN and biometric so that subsequent
 * logins don't require an SMS OTP (which the pastor called "re-verification").
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@riderguy/auth';
import { Shield, Fingerprint, Lock, X, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const DISMISS_KEY = 'riderguy_security_prompt_dismissed';

export function SecuritySetupPrompt() {
  const { api, user, setupBiometric, isBiometricSupported } = useAuth();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [hasPIN, setHasPIN] = useState(true); // assume yes until checked
  const [hasBiometric, setHasBiometric] = useState(true);
  const [settingUpBiometric, setSettingUpBiometric] = useState(false);

  useEffect(() => {
    if (!api || !user) return;

    // Don't show if dismissed within the last 7 days
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (!isNaN(dismissedAt) && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
      localStorage.removeItem(DISMISS_KEY);
    }

    // Check what methods the user has
    api.post('/auth/methods', { phone: user.phone }).then(({ data }) => {
      const methods = data.data as { otp: boolean; pin: boolean; biometric: boolean };
      setHasPIN(methods.pin);
      setHasBiometric(methods.biometric);

      // Show prompt only if missing at least one fast-auth method
      if (!methods.pin || !methods.biometric) {
        // Small delay so the dashboard loads first
        setTimeout(() => setShow(true), 2000);
      }
    }).catch(() => {});
  }, [api, user]);

  const dismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  // Android back button trap — dismiss prompt instead of navigating away
  useEffect(() => {
    if (!show) return;
    let pushed = true;
    history.pushState({ __backTrap: true }, '');
    const handlePop = () => { pushed = false; dismiss(); };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (pushed) history.back();
    };
  }, [show, dismiss]);

  const handleSetupBiometric = useCallback(async () => {
    setSettingUpBiometric(true);
    try {
      const success = await setupBiometric('Phone fingerprint');
      if (success) {
        setHasBiometric(true);
        // If PIN is also set, fully dismiss
        if (hasPIN) dismiss();
      }
    } catch {
      // User cancelled or error
    } finally {
      setSettingUpBiometric(false);
    }
  }, [setupBiometric, hasPIN, dismiss]);

  const handleSetupPIN = useCallback(() => {
    dismiss();
    router.push('/dashboard/settings/security/set-pin');
  }, [router, dismiss]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismiss} />

      {/* Sheet */}
      <div className="relative w-full max-w-md mx-4 mb-4 bg-white dark:bg-surface-900 rounded-2xl shadow-elevated overflow-hidden animate-slide-up">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-brand-500/10">
              <Shield className="h-6 w-6 text-brand-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-surface-900 dark:text-white">Faster Login</h3>
              <p className="text-sm text-surface-500">Skip OTP next time</p>
            </div>
          </div>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">
            Set up a PIN or fingerprint to log in instantly — no need to wait for an SMS code each time.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          {/* PIN setup */}
          {!hasPIN && (
            <button
              onClick={handleSetupPIN}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors btn-press"
            >
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Lock className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-surface-900 dark:text-white">Set a PIN</p>
                <p className="text-xs text-surface-500">6-digit code for quick login</p>
              </div>
              <ChevronRight className="h-5 w-5 text-surface-400" />
            </button>
          )}

          {/* Biometric setup */}
          {!hasBiometric && isBiometricSupported && (
            <button
              onClick={handleSetupBiometric}
              disabled={settingUpBiometric}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors btn-press disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-green-500/10">
                <Fingerprint className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-surface-900 dark:text-white">
                  {settingUpBiometric ? 'Setting up...' : 'Use Fingerprint'}
                </p>
                <p className="text-xs text-surface-500">Login with your fingerprint or Face ID</p>
              </div>
              <ChevronRight className="h-5 w-5 text-surface-400" />
            </button>
          )}

          {/* Skip */}
          <button
            onClick={dismiss}
            className="w-full py-2 text-sm text-surface-400 hover:text-surface-600 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
