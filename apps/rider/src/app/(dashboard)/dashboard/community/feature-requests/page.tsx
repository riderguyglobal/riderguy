'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFeatureRequests } from '@/hooks/use-feature-requests';
import type { FeatureRequest } from '@/hooks/use-feature-requests';
import {
  ArrowLeft,
  Lightbulb,
  ChevronUp,
  Plus,
  Loader2,
  CheckCircle,
  Clock,
  Code,
  Rocket,
  XCircle,
  Search,
  SortDesc,
} from 'lucide-react';

type SortMode = 'most_upvoted' | 'newest' | 'oldest';

export default function FeatureRequestsPage() {
  const { requests, loading, pagination, fetchRequests, toggleUpvote, createRequest } =
    useFeatureRequests();
  const [sort, setSort] = useState<SortMode>('most_upvoted');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchRequests({ sort });
  }, [fetchRequests, sort]);

  return (
    <div className="min-h-[100dvh] bg-[#0a0e17]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <Link href="/dashboard/community" className="p-2 -ml-2 text-surface-400 hover:text-surface-200">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold text-white">Feature Requests</h1>
            <button
              onClick={() => setShowCreate(true)}
              className="p-2 -mr-2 text-brand-400 hover:text-brand-300"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Sort */}
          <div className="flex gap-1 pb-3">
            {([
              { id: 'most_upvoted' as SortMode, label: 'Top' },
              { id: 'newest' as SortMode, label: 'New' },
              { id: 'oldest' as SortMode, label: 'Oldest' },
            ]).map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  sort === s.id
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-surface-400 hover:bg-white/[0.04]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {loading && requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
            <p className="text-surface-400 text-sm mt-3">Loading...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
              <Lightbulb className="h-8 w-8 text-brand-500" />
            </div>
            <h3 className="text-white font-semibold mb-1">No requests yet</h3>
            <p className="text-surface-400 text-sm max-w-[260px]">
              Share your ideas to make Riderguy better!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <FeatureRequestCard
                key={r.id}
                request={r}
                onUpvote={() => toggleUpvote(r.id)}
              />
            ))}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-4">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => fetchRequests({ sort, page: p })}
                    className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                      p === pagination.page
                        ? 'bg-brand-500 text-white'
                        : 'bg-white/[0.04] text-surface-400 hover:bg-white/[0.08]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Sheet */}
      {showCreate && (
        <CreateFeatureRequestSheet
          onClose={() => setShowCreate(false)}
          onCreate={createRequest}
        />
      )}
    </div>
  );
}

function FeatureRequestCard({
  request,
  onUpvote,
}: {
  request: FeatureRequest;
  onUpvote: () => void;
}) {
  const statusIcons: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    SUBMITTED: { icon: <Clock className="h-3 w-3" />, color: 'text-surface-400', bg: 'bg-surface-400/10' },
    REVIEWED: { icon: <Search className="h-3 w-3" />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    PLANNED: { icon: <CheckCircle className="h-3 w-3" />, color: 'text-brand-400', bg: 'bg-brand-400/10' },
    IN_PROGRESS: { icon: <Code className="h-3 w-3" />, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    SHIPPED: { icon: <Rocket className="h-3 w-3" />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    DECLINED: { icon: <XCircle className="h-3 w-3" />, color: 'text-red-400', bg: 'bg-red-400/10' },
  };
  const s = (statusIcons[request.status] ?? statusIcons.SUBMITTED)!;

  return (
    <div className="flex gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      {/* Upvote */}
      <button
        onClick={onUpvote}
        className={`flex flex-col items-center gap-0.5 pt-0.5 ${
          request.hasUpvoted ? 'text-brand-400' : 'text-surface-500'
        }`}
      >
        <ChevronUp className={`h-5 w-5 transition-transform ${request.hasUpvoted ? 'scale-110' : ''}`} />
        <span className="text-xs font-bold">{request.upvoteCount}</span>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${s.color} ${s.bg}`}>
            {s.icon}
            {request.status.replace('_', ' ')}
          </span>
        </div>
        <h3 className="text-white font-semibold text-sm">{request.title}</h3>
        <p className="text-surface-300 text-xs mt-1 line-clamp-2 leading-relaxed">
          {request.description}
        </p>
        {request.adminNote && (
          <p className="text-brand-400/70 text-[10px] mt-1 italic">
            Admin: {request.adminNote}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 text-[10px] text-surface-500">
          <span>{request.author.firstName} {request.author.lastName}</span>
          <span>•</span>
          <span>{formatTime(request.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function CreateFeatureRequestSheet({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string, description: string) => Promise<any>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title || !description) return;
    setSubmitting(true);
    try {
      await onCreate(title, description);
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
      <div className="w-full max-h-[80dvh] bg-[#0f1420] border-t border-white/[0.06] rounded-t-3xl overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">Suggest a Feature</h2>
            <button onClick={onClose} className="text-surface-400 text-sm">Cancel</button>
          </div>

          <input
            type="text"
            placeholder="Feature title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-surface-500 outline-none focus:border-brand-500/50"
          />
          <textarea
            placeholder="Describe your idea in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-surface-500 outline-none focus:border-brand-500/50 resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !title || description.length < 20}
            className="w-full py-3 rounded-xl bg-brand-500 text-white font-medium text-sm shadow-lg shadow-brand-500/20 disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Submit Idea'}
          </button>
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
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
