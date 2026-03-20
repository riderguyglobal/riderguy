'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================
// Screen Wake Lock — prevents device from sleeping while ONLINE
//
// Uses the Screen Wake Lock API (supported on Chrome, Edge, Samsung
// Internet, Android WebView). Falls back gracefully on unsupported
// browsers (Safari has partial support via video hack).
//
// The lock is automatically re-acquired when:
// - The tab regains visibility (user switches back to app)
// - The document is unfrozen (system suspended & resumed)
// ============================================================

export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [isActive, setIsActive] = useState(false);
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const acquireLock = useCallback(async () => {
    if (!isSupported || !enabled) return;

    try {
      // Release existing lock before acquiring new one
      if (wakeLockRef.current) {
        await wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        setIsActive(false);
      }

      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);

      wakeLockRef.current.addEventListener('release', () => {
        console.log('[WakeLock] Released');
        wakeLockRef.current = null;
        setIsActive(false);
      });

      console.log('[WakeLock] Acquired ✓');
    } catch (err) {
      console.warn('[WakeLock] Failed to acquire:', err);
    }
  }, [isSupported, enabled]);

  const releaseLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
      setIsActive(false);
      console.log('[WakeLock] Released manually');
    }
  }, []);

  // Acquire/release based on enabled state
  useEffect(() => {
    if (enabled) {
      acquireLock();
    } else {
      releaseLock();
    }

    return () => {
      releaseLock();
    };
  }, [enabled, acquireLock, releaseLock]);

  // Re-acquire when tab becomes visible again
  // (Screen Wake Lock is released when tab is hidden)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        acquireLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, acquireLock]);

  return {
    isSupported,
    isActive,
    acquireLock,
    releaseLock,
  };
}
