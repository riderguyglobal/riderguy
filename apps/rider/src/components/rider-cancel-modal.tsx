'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, ShieldAlert, Info } from 'lucide-react';

interface RiderCancelModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  /** Current order status — determines which reasons to show */
  status: string;
  orderNumber: string;
}

interface CancelReason {
  label: string;
  consequence: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const PRE_PICKUP_REASONS: CancelReason[] = [
  { label: 'Vehicle breakdown', consequence: 'Warning recorded. Proof may be requested.', severity: 'low' },
  { label: 'Personal emergency', consequence: 'Warning recorded. No penalty if infrequent.', severity: 'low' },
  { label: 'Unsafe pickup location', consequence: 'No penalty. Location flagged for admin review.', severity: 'low' },
  { label: 'Package not as described', consequence: 'Warning recorded. May require details.', severity: 'medium' },
  { label: 'Prohibited / suspicious items', consequence: 'No penalty. Will be investigated.', severity: 'medium' },
  { label: 'Sender not available', consequence: 'No penalty if client confirmed unreachable.', severity: 'low' },
  { label: 'Waited too long at pickup', consequence: 'Warning recorded. Excessive wait logged.', severity: 'medium' },
  { label: 'Other', consequence: 'Reviewed by admin. Penalty depends on frequency.', severity: 'medium' },
];

const POST_PICKUP_REASONS: CancelReason[] = [
  { label: 'Vehicle breakdown / accident', consequence: 'Penalty likely: GHS 15 + investigation. Package must be returned.', severity: 'critical' },
  { label: 'Personal emergency', consequence: 'Penalty: GHS 15 + investigation. Package must be returned.', severity: 'critical' },
  { label: 'Package damaged in transit', consequence: 'Investigation required. You may be liable for package value.', severity: 'critical' },
  { label: 'Road inaccessible', consequence: 'Penalty: GHS 15 + suspension. Location reviewed.', severity: 'critical' },
  { label: 'Extreme weather conditions', consequence: 'Investigation required. Package must be returned.', severity: 'critical' },
  { label: 'Prohibited contents discovered', consequence: 'Investigation required. Report to authorities if dangerous.', severity: 'critical' },
  { label: 'Other', consequence: 'Penalty: GHS 15 + 24hr suspension + admin investigation.', severity: 'critical' },
];

const SEVERITY_COLORS = {
  low: 'bg-amber-50 text-amber-700 border-amber-200',
  medium: 'bg-orange-50 text-orange-700 border-orange-200',
  high: 'bg-red-50 text-red-700 border-red-200',
  critical: 'bg-red-100 text-red-800 border-red-300',
} as const;

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
  const selectedReason = reasons.find((r) => r.label === reason);
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
              <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  Package already picked up — CRITICAL
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Cancelling after pickup is a serious violation. You will receive a penalty of GHS 15,
                  a 24-hour suspension, and your account will be flagged for investigation.
                  The package must be returned to the pickup location.
                </p>
              </div>
            </div>
          )}

          {!isPostPickup && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Cancellation consequences escalate
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  1st in 30 days: Warning only · 2nd: GHS 5 fee · 3rd: GHS 10 + 2hr suspension · 4th+: GHS 20 + 24hr suspension + account review
                </p>
              </div>
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
                  key={r.label}
                  type="button"
                  onClick={() => { setReason(r.label); setError(''); }}
                  disabled={loading}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    reason === r.label
                      ? 'bg-red-50 border-red-300 text-red-700 border'
                      : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Consequence preview for selected reason */}
          {selectedReason && (
            <div className={`rounded-xl border p-3 flex items-start gap-2.5 ${SEVERITY_COLORS[selectedReason.severity]}`}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold">Consequence for this reason:</p>
                <p className="text-xs mt-0.5">{selectedReason.consequence}</p>
              </div>
            </div>
          )}

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
