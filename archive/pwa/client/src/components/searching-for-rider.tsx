'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RadarLoader } from '@/components/radar-loader';
import { formatCurrency } from '@riderguy/utils';
import { ArrowLeft, X, AlertCircle } from 'lucide-react';

interface SearchingForRiderProps {
  orderId: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  totalPrice?: number;
  onCancel?: () => void;
  noRidersMessage?: string | null;
}

const SEARCHING_MESSAGES = [
  'Looking for a rider near you...',
  'Connecting you with the best available rider...',
  'A rider is on the way soon...',
  'Almost there, finding your rider...',
];

export function SearchingForRider({
  orderId,
  pickupAddress,
  dropoffAddress,
  totalPrice,
  onCancel,
  noRidersMessage,
}: SearchingForRiderProps) {
  const router  = useRouter();
  const [msgIdx, setMsgIdx] = useState(0);

  // Cycle through messages to show activity
  useEffect(() => {
    const t = setInterval(() => {
      setMsgIdx(i => (i + 1) % SEARCHING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col animate-page-enter">

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button
          onClick={() => router.back()}
          className="map-btn bg-surface-100 !shadow-none"
        >
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <span className="text-[15px] font-semibold text-surface-500">Order #{orderId.slice(-6).toUpperCase()}</span>
        <div className="w-10" />
      </div>

      {/* Radar animation — center of screen */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-8">
        <RadarLoader size={160} className="mb-10" />

        {/* Cycling message */}
        <h2 className="text-[20px] font-bold text-surface-900 text-center leading-snug mb-2">
          Finding your rider
        </h2>
        <p
          key={msgIdx}
          className="text-[14px] text-surface-400 text-center animate-slide-from-top"
        >
          {SEARCHING_MESSAGES[msgIdx]}
        </p>
      </div>

      {/* Bottom panel — order summary + cancel */}
      <div
        className="bottom-sheet px-5 pt-5 pb-safe"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)' }}
      >
        <div className="drag-handle" />

        {/* Route summary */}
        <div className="location-card my-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: 3 }}>
              <span className="dot-pickup" />
              <div className="route-connector" style={{ height: 28, width: 2, margin: '4px 0' }} />
              <span className="dot-dropoff" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide mb-0.5">Pickup</p>
                <p className="text-[14px] font-semibold text-surface-900 truncate">
                  {pickupAddress || 'Your location'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide mb-0.5">Delivery</p>
                <p className="text-[14px] font-semibold text-surface-900 truncate">
                  {dropoffAddress || 'Destination'}
                </p>
              </div>
            </div>
            {totalPrice != null && (
              <div className="flex-shrink-0 text-right">
                <p className="text-[11px] text-surface-400">Total</p>
                <p className="text-[16px] font-extrabold text-surface-900">{formatCurrency(totalPrice)}</p>
              </div>
            )}
          </div>
        </div>

        {/* No-riders warning */}
        {noRidersMessage && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-2xl bg-amber-50 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-700 leading-snug">{noRidersMessage}</p>
          </div>
        )}

        {/* Hint text */}
        {!noRidersMessage && (
          <p className="text-[12px] text-surface-400 text-center mb-4 leading-snug px-4">
            This usually takes under 2 minutes. You'll be notified as soon as a rider accepts.
          </p>
        )}

        {/* Cancel */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-surface-100 text-[14px] font-semibold text-surface-700 active:bg-surface-200 transition-colors"
          >
            <X className="h-4 w-4" /> Cancel order
          </button>
        )}
      </div>

    </div>
  );
}
