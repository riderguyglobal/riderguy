'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/use-socket';
import type { JobOffer } from '@riderguy/types';

// ============================================================
// IncomingRequest — Full-screen Uber-style incoming job overlay
//
// Shows when the auto-dispatch system sends a targeted
// `job:offer` to this rider. Includes a 30-second countdown
// ring, order details, and Accept/Decline buttons.
// ============================================================

const OFFER_DURATION_S = 30;

export default function IncomingRequest() {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [timeLeft, setTimeLeft] = useState(OFFER_DURATION_S);
  const [responding, setResponding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Listen for job offers ──
  useEffect(() => {
    if (!socket) return;

    const handleOffer = (data: JobOffer) => {
      setOffer(data);
      setTimeLeft(OFFER_DURATION_S);

      // Vibrate on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }

      // Try playing a notification sound
      try {
        audioRef.current = new Audio('/sounds/incoming.mp3');
        audioRef.current.volume = 0.7;
        audioRef.current.play().catch(() => {});
      } catch {}
    };

    const handleExpired = (data: { orderId: string }) => {
      if (offer && offer.orderId === data.orderId) {
        dismiss();
      }
    };

    const handleTaken = (data: { orderId: string }) => {
      if (offer && offer.orderId === data.orderId) {
        dismiss();
      }
    };

    socket.on('job:offer', handleOffer);
    socket.on('job:offer:expired', handleExpired);
    socket.on('job:offer:taken', handleTaken);

    return () => {
      socket.off('job:offer', handleOffer);
      socket.off('job:offer:expired', handleExpired);
      socket.off('job:offer:taken', handleTaken);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, offer?.orderId]);

  // ── Countdown timer ──
  useEffect(() => {
    if (!offer) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          dismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.orderId]);

  const dismiss = useCallback(() => {
    setOffer(null);
    setTimeLeft(OFFER_DURATION_S);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const handleAccept = useCallback(async () => {
    if (!offer || !socket || responding) return;
    setResponding(true);

    socket.emit(
      'job:offer:respond',
      { orderId: offer.orderId, response: 'accept' },
      (res: { success: boolean; error?: string }) => {
        if (res?.success) {
          dismiss();
          router.push(`/dashboard/jobs/${offer.orderId}`);
        } else {
          alert(res?.error ?? 'Failed to accept job');
          setResponding(false);
        }
      },
    );
  }, [offer, socket, responding, dismiss, router]);

  const handleDecline = useCallback(() => {
    if (!offer || !socket) return;

    socket.emit(
      'job:offer:respond',
      { orderId: offer.orderId, response: 'decline' },
      () => {},
    );

    dismiss();
  }, [offer, socket, dismiss]);

  if (!offer) return null;

  const progress = timeLeft / OFFER_DURATION_S;
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-[100] bg-surface-900/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-300">
      {/* ── Countdown Ring ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="relative mb-6">
          <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
            {/* Background ring */}
            <circle
              cx="60" cy="60" r="52"
              fill="none" stroke="#334155" strokeWidth="6"
            />
            {/* Progress ring */}
            <circle
              cx="60" cy="60" r="52"
              fill="none" stroke="#10b981" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white">{timeLeft}</span>
            <span className="text-[10px] text-surface-400 uppercase tracking-wider">seconds</span>
          </div>
        </div>

        <h2 className="text-lg font-bold text-white mb-1">New Delivery Request</h2>
        <p className="text-sm text-surface-400">
          {offer.distanceToPickup.toFixed(1)} km away · {offer.packageType.replace(/_/g, ' ')}
        </p>
      </div>

      {/* ── Order Details Card ── */}
      <div className="mx-4 mb-4 rounded-2xl bg-white p-4">
        {/* Earnings highlight */}
        <div className="text-center mb-4">
          <p className="text-3xl font-bold text-accent-600">
            GH₵{offer.riderEarnings.toLocaleString()}
          </p>
          <p className="text-xs text-surface-400 mt-0.5">Your earnings</p>
        </div>

        {/* Route */}
        <div className="flex gap-3 mb-4">
          <div className="flex flex-col items-center pt-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-accent-500 ring-2 ring-accent-100" />
            <div className="w-0.5 flex-1 bg-surface-200 my-1" />
            <div className="h-2.5 w-2.5 rounded-full bg-danger-500 ring-2 ring-danger-100" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-surface-400 font-medium">PICKUP</p>
            <p className="text-sm text-surface-800 truncate">{offer.pickupAddress}</p>
            <div className="h-3" />
            <p className="text-xs text-surface-400 font-medium">DROPOFF</p>
            <p className="text-sm text-surface-800 truncate">{offer.dropoffAddress}</p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center justify-around rounded-xl bg-surface-50 py-2.5 mb-4">
          <div className="text-center">
            <p className="text-xs text-surface-400">Distance</p>
            <p className="text-sm font-semibold text-surface-900">{offer.distanceKm.toFixed(1)} km</p>
          </div>
          <div className="h-6 w-px bg-surface-200" />
          <div className="text-center">
            <p className="text-xs text-surface-400">Est. Time</p>
            <p className="text-sm font-semibold text-surface-900">~{offer.estimatedDurationMinutes} min</p>
          </div>
          <div className="h-6 w-px bg-surface-200" />
          <div className="text-center">
            <p className="text-xs text-surface-400">Distance</p>
            <p className="text-sm font-semibold text-surface-900">{offer.distanceToPickup.toFixed(1)} km</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            disabled={responding}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-surface-200 bg-white py-3.5 text-sm font-semibold text-surface-600 hover:bg-surface-50 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={responding}
            className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-accent-500 py-3.5 text-sm font-bold text-white hover:bg-accent-600 active:scale-[0.97] transition-all disabled:opacity-50 shadow-lg shadow-accent-500/25"
          >
            {responding ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                Accepting...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Accept
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
