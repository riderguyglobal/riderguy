'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { OFFER_COUNTDOWN } from '@/lib/constants';
import { formatCurrency, formatDistance } from '@riderguy/utils';
import { Button } from '@riderguy/ui';
import { MapPin, Clock, Package, X, Check } from 'lucide-react';
import type { JobOffer } from '@riderguy/types';

export function IncomingRequest() {
  const { socket, respondToOffer } = useSocket();
  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [countdown, setCountdown] = useState(OFFER_COUNTDOWN);
  const [responding, setResponding] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clearOffer = useCallback(() => {
    setOffer(null);
    setCountdown(OFFER_COUNTDOWN);
    if (intervalRef.current) clearInterval(intervalRef.current);
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleOffer = (data: JobOffer) => {
      setOffer(data);
      setCountdown(OFFER_COUNTDOWN);

      // Try to play sound
      try {
        audioRef.current = new Audio('/sounds/incoming.mp3');
        audioRef.current.play().catch(() => {});
      } catch {}

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
    respondToOffer(offer.orderId, accepted);
    clearOffer();
    setResponding(false);
  };

  if (!offer) return null;

  const strokeDash = (countdown / OFFER_COUNTDOWN) * 283;

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
            loading={responding}
          >
            <Check className="h-5 w-5 mr-1" />
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
