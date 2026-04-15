'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, ShieldAlert, Info, CheckCircle } from 'lucide-react';

interface RiderCancelModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  /** Called for post-pickup cancellation — requests authorization from client */
  onRequestCancel?: (reason: string) => Promise<void>;
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
  { label: 'Pickup too far / distance incorrect', consequence: 'Warning recorded. Route distance reviewed.', severity: 'low' },
  { label: 'Accepted by mistake', consequence: 'Warning recorded. Avoid repeated accidental accepts.', severity: 'low' },
  { label: 'Client added extra requirements', consequence: 'Warning recorded. May require details.', severity: 'low' },
  { label: 'Other', consequence: 'Reviewed by admin. Penalty depends on frequency.', severity: 'medium' },
];

const POST_PICKUP_REASONS: CancelReason[] = [
  { label: 'Vehicle breakdown / accident', consequence: 'Penalty likely: GHS 15 + investigation. Package must be returned.', severity: 'critical' },
  { label: 'Personal emergency', consequence: 'Penalty: GHS 15 + investigation. Package must be returned.', severity: 'critical' },
  { label: 'Package damaged in transit', consequence: 'Investigation required. You may be liable for package value.', severity: 'critical' },
  { label: 'Road inaccessible', consequence: 'Penalty: GHS 15 + suspension. Location reviewed.', severity: 'critical' },
  { label: 'Extreme weather conditions', consequence: 'Investigation required. Package must be returned.', severity: 'critical' },
  { label: 'Prohibited contents discovered', consequence: 'Investigation required. Report to authorities if dangerous.', severity: 'critical' },
  { label: 'Recipient unreachable / refuses delivery', consequence: 'Penalty: GHS 15 + investigation. Package must be returned.', severity: 'critical' },
  { label: 'Wrong address / address does not exist', consequence: 'Penalty: GHS 15 + investigation. Location reviewed.', severity: 'critical' },
  { label: 'Other', consequence: 'Penalty: GHS 15 + 24hr suspension + admin investigation.', severity: 'critical' },
];

const SEVERITY_COLORS = {
  low: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  medium: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30',
  critical: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/40',
} as const;

export function RiderCancelModal({
  open,
  onClose,
  onConfirm,
  onRequestCancel,
  status,
  orderNumber,
}: RiderCancelModalProps) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestSent, setRequestSent] = useState(false);

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
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    window.addEventListener('popstate', handlePop);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('popstate', handlePop);
      window.removeEventListener('keydown', handleKey);
      if (pushed) history.back();
    };
  }, [open, onClose, loading]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setReason('');
      setCustomReason('');
      setError('');
      setLoading(false);
      setRequestSent(false);
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
      if (isPostPickup && onRequestCancel) {
        await onRequestCancel(effectiveReason.trim());
        setRequestSent(true);
        setLoading(false);
      } else {
        await onConfirm(effectiveReason.trim());
      }
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
      <div className="relative w-full max-w-md mx-4 bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-themed">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-primary">
                Cancel Delivery
              </h3>
              <p className="text-xs text-subtle">
                Order {orderNumber}
              </p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-hover-themed transition-colors"
            >
              <X className="h-4 w-4 text-muted" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Post-pickup warning */}
          {isPostPickup && !requestSent && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Package already picked up — Client Authorization Required
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                  Since you have the client&apos;s package, you cannot cancel directly.
                  The client must authorize this cancellation to ensure their package is safely returned.
                  You will receive a GHS 15 penalty, 24-hour suspension, and account investigation.
                </p>
              </div>
            </div>
          )}

          {!isPostPickup && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Cancellation consequences escalate
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-1">
                  1st in 30 days: Warning only · 2nd: GHS 5 fee · 3rd: GHS 10 + 2hr suspension · 4th+: GHS 20 + 24hr suspension + account review
                </p>
              </div>
            </div>
          )}

          {/* Reason selection */}
          <div>
            <p className="text-sm font-medium text-secondary mb-2">
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
                      ? 'bg-red-500/10 border-red-400 dark:border-red-500/40 text-red-600 dark:text-red-400 border'
                      : 'bg-card border border-themed text-secondary hover:bg-hover-themed'
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
                className="w-full min-h-[80px] p-3 rounded-xl bg-card border border-themed text-primary placeholder:text-subtle text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Request sent success message */}
          {requestSent && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Cancellation request sent
                </p>
                <p className="text-xs text-green-600 dark:text-green-400/80 mt-1">
                  The client has been notified and has 30 minutes to respond.
                  You will be notified when they authorize or deny the request.
                  Please wait for their response before taking any action.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-3">
          {requestSent ? (
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-xl bg-surface-800 dark:bg-surface-200 text-white dark:text-surface-900 font-semibold text-sm hover:opacity-90 transition-all btn-press"
            >
              Got It
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 h-12 rounded-xl border border-themed text-secondary font-medium text-sm hover:bg-hover-themed disabled:opacity-50 transition-all btn-press"
              >
                Keep Delivering
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || !effectiveReason.trim()}
                className={`flex-1 h-12 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 btn-press flex items-center justify-center gap-2 ${
                  isPostPickup
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {isPostPickup ? 'Requesting…' : 'Cancelling…'}
                  </>
                ) : isPostPickup ? (
                  'Request Cancellation'
                ) : (
                  'Cancel Delivery'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
