'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================
// PWA Install Prompt — captures `beforeinstallprompt` event and
// exposes a custom install banner & programmatic install trigger.
// ============================================================

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * Custom hook that manages the PWA install lifecycle.
 *
 * Returns:
 * - `canInstall`  — true when the browser has an install prompt available
 * - `isInstalled` — true when the app is already running in standalone mode
 * - `install()`   — trigger the native install prompt
 * - `dismiss()`   — hide the custom banner (stores preference for 7 days)
 * - `dismissed`   — true when user dismissed the banner
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone or fullscreen)
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(display-mode: standalone)');
      setIsInstalled(mq.matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true);

      const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
      mq.addEventListener('change', handler);

      // Check if user dismissed within the last 7 days
      const dismissedAt = localStorage.getItem('pwa-install-dismissed');
      if (dismissedAt) {
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parseInt(dismissedAt, 10) < oneWeek) {
          setDismissed(true);
        } else {
          localStorage.removeItem('pwa-install-dismissed');
        }
      }

      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detect when app is installed
    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }, []);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    dismissed,
    install,
    dismiss,
  };
}

// ============================================================
// Install Banner — a slide-up bottom banner
// ============================================================

interface InstallBannerProps {
  /** App name shown in the banner */
  appName?: string;
  /** Optional description text */
  description?: string;
}

export function InstallBanner({
  appName = 'RiderGuy',
  description = 'Install the app for the best experience — fast, offline-capable, and always one tap away.',
}: InstallBannerProps) {
  const { canInstall, dismissed, install, dismiss } = useInstallPrompt();

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-500 md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          {/* App icon */}
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">
              Install {appName}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={install}
                className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600"
              >
                Install
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
              >
                Not now
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={dismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
