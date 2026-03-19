'use client';

import { useEffect, useRef } from 'react';
import { formatCurrency } from '@riderguy/utils';
import { PACKAGE_TYPES } from '@/lib/constants';
import { PriceBreakdown, type PriceEstimate } from './price-breakdown';
import type { LocationValue } from './location-input';
import {
  MapPin,
  Navigation,
  Package,
  CreditCard,
  Smartphone,
  Banknote,
  Loader2,
  CheckCircle2,
  X,
  Calendar,
  Layers,
  AlertCircle,
  Zap,
  Wallet,
} from 'lucide-react';

interface LocationData {
  location: LocationValue;
  contactName: string;
  contactPhone: string;
  notes: string;
}

interface OrderConfirmationProps {
  open: boolean;
  onClose: () => void;
  estimate: PriceEstimate;
  pickup: LocationData;
  dropoff: LocationData;
  packageType: string;
  paymentMethod: string;
  scheduleType: string;
  additionalStops: number;
  packagePhotos: { file: File; preview: string }[];
  isExpress?: boolean;
  /** Whether the parent is currently submitting the order */
  submitting: boolean;
  /** Error message from the parent submission, if any */
  submitError: string;
  /** Timestamp (ms) when the estimate was last fetched */
  estimatedAt: number;
  /** Callback that does the actual order creation; returns order ID on success */
  onConfirm: () => Promise<string | null>;
}

/** Truncate long addresses */
function truncate(str: string, max = 40) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + '…';
}

export function OrderConfirmation({
  open,
  onClose,
  estimate,
  pickup,
  dropoff,
  packageType,
  paymentMethod,
  scheduleType,
  additionalStops,
  packagePhotos,
  isExpress,
  submitting,
  submitError,
  estimatedAt,
  onConfirm,
}: OrderConfirmationProps) {
  const scrollYRef = useRef(0);

  // Lock body scroll when open — prevents iOS scroll-through-modal bug
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  // Android back button trap — close modal instead of navigating away
  useEffect(() => {
    if (!open) return;
    let pushed = true;
    history.pushState({ __backTrap: true }, '');
    const handlePop = () => { pushed = false; onClose(); };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (pushed) history.back();
    };
  }, [open, onClose]);

  if (!open) return null;

  const pkg = PACKAGE_TYPES.find((p) => p.value === packageType);

  const paymentLabel =
    paymentMethod === 'MOBILE_MONEY' ? 'Mobile Money' :
    paymentMethod === 'CASH' ? 'Cash' :
    paymentMethod === 'CARD' ? 'Card' :
    paymentMethod === 'WALLET' ? 'Wallet' : paymentMethod;

  const paymentIcon =
    paymentMethod === 'MOBILE_MONEY' ? <Smartphone className="h-4 w-4" /> :
    paymentMethod === 'CASH' ? <Banknote className="h-4 w-4" /> :
    paymentMethod === 'WALLET' ? <Wallet className="h-4 w-4" /> :
    <CreditCard className="h-4 w-4" />;

  const scheduleLabel =
    scheduleType === 'NEXT_DAY' ? 'Next Day (5% off)' :
    scheduleType === 'RECURRING' ? 'Recurring (10% off)' :
    scheduleType === 'SAME_DAY' ? 'Today (scheduled)' :
    'Now';

  const handleConfirm = async () => {
    if (submitting) return;
    onConfirm();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={!submitting ? onClose : undefined}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bottom-sheet animate-sheet-up max-h-[85dvh] overflow-y-auto safe-area-bottom">
        {/* Drag handle */}
        <div className="sticky top-0 bg-white rounded-t-[1.75rem] pt-3 pb-1 z-10">
          <div className="drag-handle" />
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-surface-900">Confirm Delivery</h2>
            {!submitting && (
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center btn-press"
              >
                <X className="h-4 w-4 text-surface-500" />
              </button>
            )}
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-danger-50 flex items-start gap-2.5 animate-shake">
              <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
              <p className="text-sm text-danger-600">{submitError}</p>
            </div>
          )}

          {/* Route summary */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-1.5 shrink-0">
              <div className="h-2.5 w-2.5 rounded-full bg-brand-500" />
              <div className="w-0.5 h-8 bg-surface-200 rounded-full" />
              <div className="h-2.5 w-2.5 rounded-full bg-surface-900" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-xs font-medium text-surface-400">Pickup</p>
                <p className="text-sm font-semibold text-surface-800 truncate">{truncate(pickup.location.address, 50)}</p>
                {pickup.contactName && (
                  <p className="text-xs text-surface-400 mt-0.5">{pickup.contactName}{pickup.contactPhone ? ` · ${pickup.contactPhone}` : ''}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-surface-400">Delivery</p>
                <p className="text-sm font-semibold text-surface-800 truncate">{truncate(dropoff.location.address, 50)}</p>
                {dropoff.contactName && (
                  <p className="text-xs text-surface-400 mt-0.5">{dropoff.contactName}{dropoff.contactPhone ? ` · ${dropoff.contactPhone}` : ''}</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick info chips */}
          <div className="flex flex-wrap gap-2">
            {pkg && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 text-xs font-medium text-surface-600">
                <span>{pkg.emoji}</span> {pkg.label}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 text-xs font-medium text-surface-600">
              {paymentIcon} {paymentLabel}
            </span>
            {scheduleType !== 'NOW' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-xs font-medium text-brand-600">
                <Calendar className="h-3.5 w-3.5" /> {scheduleLabel}
              </span>
            )}
            {additionalStops > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 text-xs font-medium text-surface-600">
                <Layers className="h-3.5 w-3.5" /> +{additionalStops} stop{additionalStops > 1 ? 's' : ''}
              </span>
            )}
            {isExpress && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                <Zap className="h-3.5 w-3.5" /> Express
              </span>
            )}
          </div>

          {/* Package photos preview */}
          {packagePhotos.length > 0 && (
            <div className="flex gap-2">
              {packagePhotos.map((photo, idx) => (
                <div key={idx} className="h-14 w-14 rounded-lg overflow-hidden border border-surface-200">
                  {photo.file.type.startsWith('video/') ? (
                    <video src={photo.preview} className="h-full w-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.preview} alt={`Package ${idx + 1}`} className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Full price breakdown */}
          {estimatedAt > 0 && Date.now() - estimatedAt > 2 * 60 * 1000 && (
            <div className="p-3 rounded-xl bg-amber-50 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                This price was estimated {Math.round((Date.now() - estimatedAt) / 60000)} min ago and may have changed.
              </p>
            </div>
          )}
          <div className="bg-surface-50 rounded-2xl p-4">
            <PriceBreakdown estimate={estimate} variant="expanded" />
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full h-14 rounded-2xl bg-surface-900 text-white font-bold text-base hover:bg-surface-800 transition-all btn-press disabled:opacity-60 flex items-center justify-center gap-2.5"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Creating delivery…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>Confirm · {formatCurrency(estimate.totalPrice, estimate.currency)}</span>
              </>
            )}
          </button>

          {/* Disclaimer */}
          <p className="text-[10px] text-center text-surface-400 leading-relaxed px-4">
            By confirming, you agree to RiderGuy&apos;s terms of service.
            Final price may vary if route changes.
          </p>
        </div>
      </div>
    </>
  );
}
