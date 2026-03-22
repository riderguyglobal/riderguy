'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@riderguy/auth';
import {
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Ban,
  ChevronRight,
  Loader2,
  Scale,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

interface CancellationRecord {
  id: string;
  category: string;
  reason: string;
  severity: string;
  penaltyAmount: number | string;
  penaltyApplied: boolean;
  suspensionHours: number;
  suspensionApplied: boolean;
  requiresInvestigation: boolean;
  cancellationsInWindow: number;
  createdAt: string;
  order: { orderNumber: string };
  appeal: { id: string; status: string } | null;
}

interface CancellationData {
  totalCancellations: number;
  suspendedUntil: string | null;
  records: CancellationRecord[];
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  WARNING: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Warning' },
  MINOR: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', label: 'Minor' },
  MODERATE: { bg: 'bg-red-50 border-red-200', text: 'text-red-600', label: 'Moderate' },
  SEVERE: { bg: 'bg-red-100 border-red-300', text: 'text-red-700', label: 'Severe' },
  CRITICAL: { bg: 'bg-red-200 border-red-400', text: 'text-red-800', label: 'Critical' },
};

const APPEAL_STATUS_STYLES: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  PENDING: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Appeal Pending', color: 'text-amber-600' },
  UNDER_REVIEW: { icon: <Scale className="h-3.5 w-3.5" />, label: 'Under Review', color: 'text-blue-600' },
  APPROVED: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Appeal Approved', color: 'text-green-600' },
  PARTIALLY_APPROVED: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Partially Approved', color: 'text-teal-600' },
  DENIED: { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Appeal Denied', color: 'text-red-600' },
};

export default function CancellationHistoryPage() {
  const { api } = useAuth();
  const [data, setData] = useState<CancellationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [appealModal, setAppealModal] = useState<string | null>(null);
  const [appealStatement, setAppealStatement] = useState('');
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealError, setAppealError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/riders/cancellations');
      setData(res.data.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAppeal = async () => {
    if (!appealModal || !appealStatement.trim()) return;
    setAppealLoading(true);
    setAppealError('');
    try {
      await api.post(`/riders/cancellations/${appealModal}/appeal`, {
        statement: appealStatement.trim(),
      });
      setAppealModal(null);
      setAppealStatement('');
      fetchData(); // Refresh
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setAppealError(
        axiosErr?.response?.data?.error?.message
        || (err instanceof Error ? err.message : 'Failed to submit appeal'),
      );
    } finally {
      setAppealLoading(false);
    }
  };

  const suspendedUntil = data?.suspendedUntil ? new Date(data.suspendedUntil) : null;
  const isSuspended = suspendedUntil && suspendedUntil > new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard/settings" className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Cancellation History</h1>
            <p className="text-xs text-gray-500">
              {data ? `${data.totalCancellations} total cancellations` : 'Loading…'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Suspension banner */}
        {isSuspended && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <Ban className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Account Suspended</p>
              <p className="text-xs text-red-600 mt-1">
                You are suspended until{' '}
                {suspendedUntil!.toLocaleDateString('en-GH', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
                . You cannot accept new orders during this period.
              </p>
            </div>
          </div>
        )}

        {/* Escalation info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-1">How consequences escalate (30-day window)</p>
          <div className="text-xs text-blue-700 space-y-0.5">
            <p>• 1st cancellation: Warning only</p>
            <p>• 2nd: GHS 5 penalty</p>
            <p>• 3rd: GHS 10 + 2hr suspension</p>
            <p>• 4th+: GHS 20 + 24hr suspension + account review</p>
            <p>• After pickup: GHS 15 + 24hr suspension + investigation</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !data?.records.length ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">No cancellations yet</p>
            <p className="text-xs text-gray-400 mt-1">Keep up the great work!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.records.map((record) => {
              const sevKey = record.severity in SEVERITY_STYLES ? record.severity : 'WARNING';
              const sev = SEVERITY_STYLES[sevKey]!;
              const penalty = Number(record.penaltyAmount);
              const hasAppeal = !!record.appeal;
              const canAppeal = !hasAppeal && (record.severity !== 'WARNING');
              const appealStatus = record.appeal ? APPEAL_STATUS_STYLES[record.appeal.status] : null;

              return (
                <div key={record.id} className={`rounded-2xl border p-4 ${sev.bg}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase ${sev.text}`}>{sev.label}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{record.order.orderNumber}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{record.reason}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(record.createdAt).toLocaleDateString('en-GH', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {record.severity !== 'WARNING' && (
                      <div className="text-right shrink-0">
                        {penalty > 0 && (
                          <p className="text-sm font-bold text-red-600">
                            −GHS {penalty.toFixed(2)}
                          </p>
                        )}
                        {record.suspensionHours > 0 && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 justify-end mt-0.5">
                            <Clock className="h-3 w-3" />
                            {record.suspensionHours}hr suspension
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Investigation flag */}
                  {record.requiresInvestigation && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700 font-medium">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Under investigation
                    </div>
                  )}

                  {/* Appeal status */}
                  {appealStatus && (
                    <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${appealStatus.color}`}>
                      {appealStatus.icon}
                      {appealStatus.label}
                    </div>
                  )}

                  {/* Appeal button */}
                  {canAppeal && (
                    <button
                      onClick={() => setAppealModal(record.id)}
                      className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/80 border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-gray-400" />
                        Appeal this decision
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Appeal Modal */}
      {appealModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !appealLoading && setAppealModal(null)} />
          <div className="relative w-full max-w-md mx-4 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Submit Appeal</h3>
                {!appealLoading && (
                  <button onClick={() => setAppealModal(null)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100">
                    <XCircle className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">You have 48 hours from the cancellation to appeal. Explain your situation clearly.</p>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={appealStatement}
                onChange={(e) => setAppealStatement(e.target.value)}
                placeholder="Explain why this penalty should be reviewed…"
                maxLength={1000}
                disabled={appealLoading}
                className="w-full min-h-[120px] p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {appealError && (
                <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {appealError}
                </div>
              )}
            </div>
            <div className="p-5 pt-0 flex gap-3">
              <button
                onClick={() => { setAppealModal(null); setAppealStatement(''); setAppealError(''); }}
                disabled={appealLoading}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAppeal}
                disabled={appealLoading || !appealStatement.trim()}
                className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {appealLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : 'Submit Appeal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
