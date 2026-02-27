'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMentorship } from '@/hooks/use-mentorship';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Star,
  XCircle,
  Send,
  Loader2,
  MessageSquare,
} from 'lucide-react';

export default function MentorshipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    currentMentorship,
    checkIns,
    loading,
    fetchMentorship,
    fetchCheckIns,
    updateStatus,
    addCheckIn,
  } = useMentorship();

  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [statusAction, setStatusAction] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchMentorship(id);
      fetchCheckIns(id);
    }
  }, [id, fetchMentorship, fetchCheckIns]);

  const handleStatusChange = async (newStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {
    if (!id) return;
    setStatusAction(newStatus);
    try {
      await updateStatus(id, newStatus);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusAction(null);
    }
  };

  const handleCheckIn = async () => {
    if (!id || !note.trim()) return;
    setSubmitting(true);
    try {
      await addCheckIn(id, note.trim(), rating);
      setNote('');
      setRating(undefined);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to add check-in');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !currentMentorship) {
    return (
      <div className="min-h-[100dvh] bg-page flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!currentMentorship) {
    return (
      <div className="min-h-[100dvh] bg-page flex flex-col items-center justify-center text-center px-4">
        <p className="text-muted">Mentorship not found</p>
        <Link href="/dashboard/community/mentorship" className="text-brand-400 text-sm mt-2">
          Back to Mentorship
        </Link>
      </div>
    );
  }

  const m = currentMentorship;
  const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    PENDING: { color: 'text-amber-400', bg: 'bg-amber-400/10', icon: <Clock className="h-4 w-4" /> },
    ACTIVE: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: <CheckCircle className="h-4 w-4" /> },
    COMPLETED: { color: 'text-brand-400', bg: 'bg-brand-400/10', icon: <Star className="h-4 w-4" /> },
    CANCELLED: { color: 'text-subtle', bg: 'bg-surface-500/10', icon: <XCircle className="h-4 w-4" /> },
  };
  const sc = (statusConfig[m.status] ?? statusConfig.PENDING)!;

  return (
    <div className="min-h-[100dvh] bg-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-nav backdrop-blur-xl border-b border-themed">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <Link
              href="/dashboard/community/mentorship"
              className="p-2 -ml-2 text-muted hover:text-secondary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold text-primary">Mentorship</h1>
            <div className="w-9" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Mentor & Mentee */}
        <div className="p-4 rounded-2xl bg-hover-themed border border-themed">
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${sc.color} ${sc.bg}`}>
              {sc.icon}
              {m.status}
            </span>
            {m.zone && (
              <span className="text-[10px] text-subtle bg-card px-2 py-1 rounded-full">
                {m.zone.name}
              </span>
            )}
          </div>

          {/* Mentor */}
          {m.mentor && (
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
                {m.mentor.user?.avatarUrl ? (
                  <img src={m.mentor.user.avatarUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <span className="text-brand-400 font-bold text-sm">
                    {m.mentor.user?.firstName?.charAt(0) || '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-primary text-sm font-semibold">
                  {m.mentor.user?.firstName} {m.mentor.user?.lastName}
                </p>
                <p className="text-xs text-muted">
                  Mentor — Level {m.mentor.currentLevel} • {m.mentor.totalDeliveries} deliveries
                </p>
              </div>
            </div>
          )}

          {/* Mentee */}
          {m.mentee && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                {m.mentee.user?.avatarUrl ? (
                  <img src={m.mentee.user.avatarUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <span className="text-emerald-400 font-bold text-sm">
                    {m.mentee.user?.firstName?.charAt(0) || '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-primary text-sm font-semibold">
                  {m.mentee.user?.firstName} {m.mentee.user?.lastName}
                </p>
                <p className="text-xs text-muted">
                  Mentee — Level {m.mentee.currentLevel} • {m.mentee.totalDeliveries} deliveries
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {m.status === 'PENDING' && (
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange('ACTIVE')}
              disabled={!!statusAction}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              {statusAction === 'ACTIVE' ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Accept'}
            </button>
            <button
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={!!statusAction}
              className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 font-medium text-sm active:scale-[0.98] disabled:opacity-50"
            >
              {statusAction === 'CANCELLED' ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Decline'}
            </button>
          </div>
        )}
        {m.status === 'ACTIVE' && (
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange('COMPLETED')}
              disabled={!!statusAction}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white font-medium text-sm shadow-lg shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              {statusAction === 'COMPLETED' ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Mark Complete'}
            </button>
            <button
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={!!statusAction}
              className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 font-medium text-sm active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Check-ins */}
        <div>
          <h2 className="text-primary font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-brand-400" />
            Check-ins
          </h2>

          {/* Add check-in (only active) */}
          {m.status === 'ACTIVE' && (
            <div className="mb-4 p-4 rounded-2xl bg-hover-themed border border-themed">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="How did it go? Write a check-in note..."
                className="w-full bg-transparent text-primary text-sm placeholder:text-subtle resize-none outline-none min-h-[80px]"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRating(rating === r ? undefined : r)}
                      className={`p-1 transition-colors ${
                        rating && r <= rating ? 'text-amber-400' : 'text-subtle'
                      }`}
                    >
                      <Star className="h-4 w-4" fill={rating && r <= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleCheckIn}
                  disabled={submitting || !note.trim()}
                  className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium disabled:opacity-50 active:scale-[0.98]"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Check-in list */}
          {checkIns.length === 0 ? (
            <p className="text-subtle text-sm text-center py-8">No check-ins yet</p>
          ) : (
            <div className="space-y-2">
              {checkIns.map((ci) => (
                <div
                  key={ci.id}
                  className="p-3 rounded-xl bg-hover-themed border border-themed"
                >
                  <p className="text-secondary text-sm leading-relaxed">{ci.note}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-subtle">
                    {ci.rating && (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <Star className="h-3 w-3" fill="currentColor" />
                        {ci.rating}/5
                      </span>
                    )}
                    <span>{formatTime(ci.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
