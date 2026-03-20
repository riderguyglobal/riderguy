'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/use-socket';
import { useQueryClient } from '@tanstack/react-query';
import { OFFER_COUNTDOWN } from '@/lib/constants';
import { formatCurrency, formatDistance } from '@riderguy/utils';
import { Button } from '@riderguy/ui';
import { MapPin, Clock, Package, X, Check, Loader2 } from 'lucide-react';
import type { JobOffer } from '@riderguy/types';

/** Generate a notification tone using Web Audio API when .mp3 is unavailable */
function playNotificationTone() {
  try {
    const ctx = getUnlockedAudioContext();
    if (!ctx) return;
    const playBeep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    // Three ascending tones
    playBeep(880, 0, 0.15);
    playBeep(1100, 0.18, 0.15);
    playBeep(1320, 0.36, 0.2);
  } catch {
    // Web Audio API not available — silent
  }
}

// ── iOS Audio Unlock ──
// iOS Safari requires a user gesture before AudioContext can produce sound.
// We create + unlock the context on the first touch/click and reuse it.
let _audioCtx: AudioContext | null = null;
let _audioUnlocked = false;

function getUnlockedAudioContext(): AudioContext | null {
  if (_audioCtx) return _audioCtx;
  try {
    _audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return _audioCtx;
  } catch {
    return null;
  }
}

function unlockAudio() {
  if (_audioUnlocked) return;
  const ctx = getUnlockedAudioContext();
  if (!ctx) return;
  // Resume suspended context (iOS puts new contexts in 'suspended' state)
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  // Play a silent buffer to fully unlock playback
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
  _audioUnlocked = true;
}

if (typeof window !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'click'];
  const onFirstInteraction = () => {
    unlockAudio();
    unlockEvents.forEach((e) => document.removeEventListener(e, onFirstInteraction, true));
  };
  unlockEvents.forEach((e) => document.addEventListener(e, onFirstInteraction, { capture: true, passive: true }));
}

export function IncomingRequest() {
  const router = useRouter();
  const { socket, respondToOfferAsync } = useSocket();
  const queryClient = useQueryClient();
  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [countdown, setCountdown] = useState(OFFER_COUNTDOWN);
  const [responding, setResponding] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollYRef = useRef(0);
  const totalCountdownRef = useRef(OFFER_COUNTDOWN);

  const clearOffer = useCallback(() => {
    setOffer(null);
    setCountdown(OFFER_COUNTDOWN);
    if (intervalRef.current) clearInterval(intervalRef.current);
    audioRef.current?.pause();
  }, []);

  // Lock body scroll when offer modal is visible (prevents iOS scroll-through)
  useEffect(() => {
    if (!offer) return;
    scrollYRef.current = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, scrollYRef.current);
    };
  }, [offer]);

  // Android back button trap — close offer instead of navigating away
  useEffect(() => {
    if (!offer) return;
    let pushed = true;
    history.pushState({ __backTrap: true }, '');
    const handlePop = () => { pushed = false; clearOffer(); };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (pushed) history.back();
    };
  }, [offer, clearOffer]);

  useEffect(() => {
    if (!socket) return;

    const handleOffer = (data: JobOffer) => {
      console.log('[IncomingRequest] Received job:offer!', data.orderId, data.orderNumber);
      setOffer(data);

      // Derive remaining seconds from server's expiresAt to stay in sync
      const remaining = data.expiresAt
        ? Math.max(1, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000))
        : OFFER_COUNTDOWN;
      totalCountdownRef.current = remaining;
      setCountdown(remaining);

      // Play notification sound — try .mp3 first, fallback to Web Audio API tone
      try {
        const audio = new Audio('/sounds/incoming.mp3');
        audioRef.current = audio;
        audio.play().catch(() => {
          // .mp3 not available — generate a notification tone via Web Audio API
          playNotificationTone();
        });
      } catch {
        playNotificationTone();
      }

      // Vibrate
      navigator.vibrate?.([200, 100, 200]);
    };

    const handleExpired = () => clearOffer();
    const handleTaken = () => clearOffer();

    socket.on('job:offer', handleOffer);
    socket.on('job:offer:expired', handleExpired);
    socket.on('job:offer:taken', handleTaken);

    return () => {
      socket.off('job:offer', handleOffer);
      socket.off('job:offer:expired', handleExpired);
      socket.off('job:offer:taken', handleTaken);
    };
  }, [socket, clearOffer]);

  // Countdown timer
  useEffect(() => {
    if (!offer) return;

    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearOffer();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [offer, clearOffer]);

  const handleRespond = async (accepted: boolean) => {
    if (!offer || responding) return;
    setResponding(true);
    setRespondError(null);

    try {
      const result = await respondToOfferAsync(offer.orderId, accepted);

      if (accepted && result.success) {
        // Success! Stop the countdown, clear the modal, navigate to job page
        if (intervalRef.current) clearInterval(intervalRef.current);
        audioRef.current?.pause();

        // Immediately invalidate active orders cache so dashboard reflects the new job
        queryClient.invalidateQueries({ queryKey: ['active-orders'] });
        queryClient.invalidateQueries({ queryKey: ['rider-stats'] });

        const orderId = offer.orderId;
        clearOffer();

        // Navigate to the active delivery page
        router.replace(`/dashboard/jobs/${orderId}`);
      } else if (accepted && !result.success) {
        // Job was already taken or another error
        setRespondError(result.error || 'This job was already taken by another rider');
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
          clearOffer();
          setRespondError(null);
        }, 3000);
      } else {
        // Declined — just close
        clearOffer();
      }
    } catch {
      setRespondError('Failed to respond. Please try again.');
      setTimeout(() => setRespondError(null), 3000);
    } finally {
      setResponding(false);
    }
  };

  if (!offer) return null;

  const strokeDash = (countdown / totalCountdownRef.current) * 283;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-card-strong rounded-3xl border border-themed-strong shadow-2xl animate-slide-up overflow-hidden">
        {/* Countdown header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-themed">
          <div>
            <h3 className="text-lg font-bold text-primary tracking-tight">New Delivery Request</h3>
            <p className="text-xs text-muted mt-0.5">Respond before time runs out</p>
          </div>
          <div className="relative h-14 w-14">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke={countdown > 10 ? '#22c55e' : '#ef4444'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray="283" strokeDashoffset={283 - strokeDash}
                className="transition-all duration-1000 linear"
                style={{ filter: `drop-shadow(0 0 6px ${countdown > 10 ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)'})` }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-primary tabular-nums">
              {countdown}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {/* Earnings */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-accent-500/10 border border-accent-500/15">
            <span className="text-sm text-accent-300 font-medium">You&apos;ll earn</span>
            <span className="text-2xl font-extrabold text-accent-400 tabular-nums">
              {formatCurrency(offer.riderEarnings ?? 0)}
            </span>
          </div>

          {/* Route info */}
          <div className="glass-elevated rounded-2xl p-4 space-y-2">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-6 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,.4)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-subtle uppercase tracking-wider font-medium">Pickup</p>
                <p className="text-sm text-primary font-medium truncate">{offer.pickupAddress ?? 'Pickup location'}</p>
              </div>
            </div>
            <div className="ml-3 w-px h-3 bg-gradient-to-b from-amber-500/30 to-accent-500/30" />
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-6 rounded-full bg-accent-500/15 flex items-center justify-center shrink-0">
                <div className="h-2.5 w-2.5 rounded-full bg-accent-400 shadow-[0_0_6px_rgba(34,197,94,.4)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-subtle uppercase tracking-wider font-medium">Dropoff</p>
                <p className="text-sm text-primary font-medium truncate">{offer.dropoffAddress ?? 'Dropoff location'}</p>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-muted">
            {offer.distanceKm && (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card">
                <MapPin className="h-3.5 w-3.5" />
                {formatDistance(offer.distanceKm)}
              </span>
            )}
            {offer.estimatedDurationMinutes && (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card">
                <Clock className="h-3.5 w-3.5" />
                {offer.estimatedDurationMinutes} min
              </span>
            )}
            {offer.packageType && (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card">
                <Package className="h-3.5 w-3.5" />
                {offer.packageType}
              </span>
            )}
          </div>
        </div>

        {/* Error message */}
        {respondError && (
          <div className="mx-5 mb-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400 text-center font-medium">{respondError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <Button
            variant="outline"
            size="xl"
            className="flex-1 border-themed-strong text-secondary rounded-2xl btn-press"
            onClick={() => handleRespond(false)}
            disabled={responding}
          >
            <X className="h-5 w-5 mr-1" />
            Decline
          </Button>
          <Button
            size="xl"
            className="flex-1 gradient-accent text-white shadow-lg glow-accent btn-press rounded-2xl font-semibold"
            onClick={() => handleRespond(true)}
            disabled={responding}
          >
            {responding ? (
              <>
                <Loader2 className="h-5 w-5 mr-1 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-1" />
                Accept
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
