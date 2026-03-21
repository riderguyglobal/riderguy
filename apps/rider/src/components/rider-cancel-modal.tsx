'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface RiderCancelModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  /** Current order status — determines which reasons to show */
  status: string;
  orderNumber: string;
}

const PRE_PICKUP_REASONS = [
  'Vehicle breakdown',
  'Personal emergency',
  'Unsafe pickup location',
  'Package not as described',
  'Prohibited / suspicious items',
  'Sender not available',
  'Other',
];

const POST_PICKUP_REASONS = [
  'Vehicle breakdown / accident',
  'Personal emergency',
  'Package damaged in transit',
  'Road inaccessible',
  'Extreme weather conditions',
  'Prohibited contents discovered',
  'Other',
];

export function RiderCancelModal({
  open,
  onClose,
  onConfirm,
  status,
  orderNumber,
}: RiderCancelModalProps) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isPostPickup = ['PICKED_UP', 'IN_TRANSIT'].includes(status);
  const reasons = isPostPickup ? POST_PICKUP_REASONS : PRE_PICKUP_REASONS;
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
        onTouchEnd={loading ? undefined : (e) => { e.preventDefault(); onClose(); }}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Cancel Delivery
              </h3>
              <p className="text-xs text-gray-400">
                Order {orderNumber}
              </p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Post-pickup warning */}
          {isPostPickup && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  Package already picked up
                </p>
                <p className="text-xs text-red-600 mt-1">
                  You have the client&apos;s package. Cancelling now means the package must be returned to the pickup location. This will be recorded on your profile.
                </p>
              </div>
            </div>
          )}

          {!isPostPickup && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm text-amber-800">
                Frequent cancellations may affect your rating and job priority.
              </p>
            </div>
          )}

          {/* Reason selection */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Why are you cancelling?
            </p>
            <div className="flex flex-wrap gap-2">
              {reasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setReason(r); setError(''); }}
                  disabled={loading}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    reason === r
                      ? 'bg-red-50 border-red-300 text-red-700 border'
                      : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Custom reason input */}
          {reason === 'Other' && (
            <div>
              <textarea
                value={customReason}
                onChange={(e) => { setCustomReason(e.target.value); setError(''); }}
                placeholder="Describe the reason..."
                maxLength={500}
                disabled={loading}
                onFocus={(e) => {
                  setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                }}
                className="w-full min-h-[80px] p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 disabled:opacity-50 transition-all btn-press"
          >
            Keep Delivering
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !effectiveReason.trim()}
            className="flex-1 h-12 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all disabled:opacity-40 btn-press flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Cancelling…
              </>
            ) : (
              'Cancel Delivery'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
