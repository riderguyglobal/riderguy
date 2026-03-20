'use client';

import { useEffect, useRef } from 'react';

/**
 * Audio Keep-Alive — prevents mobile browsers from suspending the PWA.
 *
 * When enabled, plays an inaudible oscillator tone through the Web Audio API.
 * This keeps the browser's audio thread active, which prevents iOS Safari and
 * Android Chrome from freezing the page when it's backgrounded (e.g., during
 * a phone call or when switching apps).
 *
 * Battery impact is negligible since the gain is set to near-zero (0.001).
 *
 * @param enabled - Whether the keep-alive should be active (tie to rider ONLINE status)
 */
export function useAudioKeepAlive(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Clean up when disabled
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch { /* already stopped */ }
        oscRef.current = null;
      }
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
      gainRef.current = null;
      return;
    }

    // Create Web Audio API context and silent oscillator
    try {
      const AudioContextClass = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      ctxRef.current = ctx;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      // Set gain to near-zero — inaudible but keeps the audio thread alive
      gain.gain.value = 0.001;

      // Use a low frequency to minimize any chance of audible artifacts
      oscillator.frequency.value = 20; // Below human hearing threshold
      oscillator.type = 'sine';

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();

      oscRef.current = oscillator;
      gainRef.current = gain;

      // Resume audio context on user interaction (required by autoplay policies)
      const resumeOnInteraction = () => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };
      document.addEventListener('touchstart', resumeOnInteraction);
      document.addEventListener('click', resumeOnInteraction);

      // Re-register resume when AudioContext auto-suspends after a background cycle
      ctx.onstatechange = () => {
        if (ctx.state === 'suspended') {
          document.addEventListener('touchstart', resumeOnInteraction, { once: true });
          document.addEventListener('click', resumeOnInteraction, { once: true });
        }
      };

      // Also resume when returning from background
      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        document.removeEventListener('touchstart', resumeOnInteraction);
        document.removeEventListener('click', resumeOnInteraction);

        try { oscillator.stop(); } catch { /* already stopped */ }
        if (ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
        oscRef.current = null;
        ctxRef.current = null;
        gainRef.current = null;
      };
    } catch {
      // Web Audio API not available
      console.warn('[AudioKeepAlive] Web Audio API not available');
    }
  }, [enabled]);
}
