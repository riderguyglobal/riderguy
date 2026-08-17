'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@riderguy/utils';

interface CancelOrderModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  /** Current order status — determines fee warning */
  status: string;
  orderNumber: string;
}

const CANCELLATION_FEE = 3.0; // GHS — must match API

const QUICK_REASONS = [
  'Taking too long',
  'Found another delivery service',
  'Changed my mind',
  'Incorrect pickup/dropoff',
  'Rider is not responding',
  'Other',
];

export function CancelOrderModal({
  open,
  onClose,
  onConfirm,
  status,
  orderNumber,
}: CancelOrderModalProps) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasFee = ['ASSIGNED', 'PICKUP_EN_ROUTE'].includes(status);
  const effectiveReason = reason === 'Other' ? customReason : reason;

  // Android back button trap
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

  // Reset on close
  useEffect(() => {
    if (!open) {
      setReason('');
      setCustomReason('');
      setError('');
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (!effectiveReason.trim()) {
      setError('Please select or enter a reason');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(effectiveReason.trim());
    } catch (err: unknown) {
      // Extract server error message from Axios response if available
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = axiosErr?.response?.data?.error?.message
        || (err instanceof Error ? err.message : 'Failed to cancel order');
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
        onTouchEnd={loading ? undefined : (e) => { e.preventDefault(); onClose(); }}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-surface-900">
                Cancel Delivery
              </h3>
              <p className="text-xs text-surface-400">
                Order {orderNumber}
              </p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-surface-100 transition-colors"
            >
              <X className="h-4 w-4 text-surface-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Fee warning */}
          {hasFee && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Cancellation fee: {formatCurrency(CANCELLATION_FEE)}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  A rider has already been assigned and is heading your way. A small fee compensates them for their time.
                </p>
              </div>
            </div>
          )}

          {!hasFee && (
            <div className="bg-surface-50 rounded-2xl p-4">
              <p className="text-sm text-surface-600">
                No cancellation fee — a rider hasn&apos;t been assigned yet.
              </p>
            </div>
          )}

          {/* Reason selection */}
          <div>
            <p className="text-sm font-medium text-surface-700 mb-2">
              Why are you cancelling?
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setReason(r); setError(''); }}
                  disabled={loading}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    reason === r
                      ? 'bg-red-50 border-red-200 text-red-700 border'
                      : 'bg-surface-50 border border-surface-200 text-surface-600 hover:bg-surface-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Custom reason input */}
          {reason === 'Other' && (
            <textarea
              ref={(el) => { if (el) setTimeout(() => { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); }}
              value={customReason}
              onChange={(e) => { setCustomReason(e.target.value); setError(''); }}
              placeholder="Tell us why you're cancelling..."
              rows={2}
              maxLength={500}
              disabled={loading}
              className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none transition-all"
            />
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 border border-surface-200 rounded-xl text-sm font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-50 transition-colors"
            >
              Keep Order
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !effectiveReason.trim()}
              className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors btn-press flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>Cancel Delivery</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
