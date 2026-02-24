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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-surface-900 rounded-3xl border border-white/10 shadow-2xl animate-slide-up overflow-hidden">
        {/* Countdown header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white">New Delivery Request</h3>
          <div className="relative h-12 w-12">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke={countdown > 10 ? '#0ea5e9' : '#ef4444'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray="283" strokeDashoffset={283 - strokeDash}
                className="transition-all duration-1000 linear"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
              {countdown}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {/* Earnings */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-accent-500/10 border border-accent-500/20">
            <span className="text-sm text-accent-300">You&apos;ll earn</span>
            <span className="text-xl font-bold text-accent-400">
              {formatCurrency(offer.riderEarnings ?? 0)}
            </span>
          </div>

          {/* Route info */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <div className="h-2 w-2 rounded-full bg-amber-400" />
              </div>
              <div>
                <p className="text-xs text-surface-400">Pickup</p>
                <p className="text-sm text-white">{offer.pickupAddress ?? 'Pickup location'}</p>
              </div>
            </div>
            <div className="ml-2.5 w-px h-4 bg-surface-700" />
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-accent-500/20 flex items-center justify-center shrink-0">
                <div className="h-2 w-2 rounded-full bg-accent-400" />
              </div>
              <div>
                <p className="text-xs text-surface-400">Dropoff</p>
                <p className="text-sm text-white">{offer.dropoffAddress ?? 'Dropoff location'}</p>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-surface-400">
            {offer.distanceKm && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {formatDistance(offer.distanceKm)}
              </span>
            )}
            {offer.estimatedDurationMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {offer.estimatedDurationMinutes} min
              </span>
            )}
            {offer.packageType && (
              <span className="flex items-center gap-1">
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
            className="flex-1 border-surface-700 text-surface-300 hover:bg-surface-800"
            onClick={() => handleRespond(false)}
            disabled={responding}
          >
            <X className="h-5 w-5 mr-1" />
            Decline
          </Button>
          <Button
            size="xl"
            className="flex-1 bg-accent-500 hover:bg-accent-600 text-white"
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
