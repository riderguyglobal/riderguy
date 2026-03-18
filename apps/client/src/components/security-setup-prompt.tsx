'use client';

/**
 * SecuritySetupPrompt — encourages clients to set up PIN / biometric
 * for faster subsequent logins.
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
  const [hasPIN, setHasPIN] = useState(true);
  const [hasBiometric, setHasBiometric] = useState(true);
  const [settingUpBiometric, setSettingUpBiometric] = useState(false);

  useEffect(() => {
    if (!api || !user) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    api.post('/auth/methods', { phone: user.phone }).then(({ data }) => {
      const methods = data.data as { otp: boolean; pin: boolean; biometric: boolean };
      setHasPIN(methods.pin);
      setHasBiometric(methods.biometric);
      if (!methods.pin || !methods.biometric) {
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
        if (hasPIN) dismiss();
      }
    } catch {} finally {
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative w-full max-w-md mx-4 mb-4 bg-white rounded-2xl shadow-elevated overflow-hidden animate-slide-up">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full text-surface-400 hover:bg-surface-100"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-brand-500/10">
              <Shield className="h-6 w-6 text-brand-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-surface-900">Faster Login</h3>
              <p className="text-sm text-surface-500">Skip OTP next time</p>
            </div>
          </div>
          <p className="text-sm text-surface-600 mt-2">
            Set up a PIN or fingerprint to log in instantly — no need to wait for an SMS code each time.
          </p>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {!hasPIN && (
            <button
              onClick={handleSetupPIN}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors btn-press"
            >
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Lock className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-surface-900">Set a PIN</p>
                <p className="text-xs text-surface-500">6-digit code for quick login</p>
              </div>
              <ChevronRight className="h-5 w-5 text-surface-400" />
            </button>
          )}

          {!hasBiometric && isBiometricSupported && (
            <button
              onClick={handleSetupBiometric}
              disabled={settingUpBiometric}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors btn-press disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-green-500/10">
                <Fingerprint className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-surface-900">
                  {settingUpBiometric ? 'Setting up...' : 'Use Fingerprint'}
                </p>
                <p className="text-xs text-surface-500">Login with fingerprint or Face ID</p>
              </div>
              <ChevronRight className="h-5 w-5 text-surface-400" />
            </button>
          )}

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
