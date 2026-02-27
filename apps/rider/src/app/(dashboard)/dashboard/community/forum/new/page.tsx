'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForum } from '@/hooks/use-community';
import { ArrowLeft, Plus, X, BarChart3 } from 'lucide-react';

const CATEGORIES = [
  'GENERAL',
  'TIPS_AND_TRICKS',
  'ROUTES',
  'EARNINGS',
  'SAFETY',
  'VEHICLE_MAINTENANCE',
  'MEETUPS',
  'FEATURE_REQUESTS',
  'OFF_TOPIC',
];

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: '💬 General',
  TIPS_AND_TRICKS: '💡 Tips & Tricks',
  ROUTES: '🗺️ Routes',
  EARNINGS: '💰 Earnings',
  SAFETY: '🛡️ Safety',
  VEHICLE_MAINTENANCE: '🔧 Vehicle',
  MEETUPS: '🤝 Meetups',
  FEATURE_REQUESTS: '✨ Features',
  OFF_TOPIC: '🎯 Off Topic',
};

export default function NewForumPostPage() {
  const router = useRouter();
  const { createPost } = useForum();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addPollOption = useCallback(() => {
    if (pollOptions.length < 6) {
      setPollOptions(prev => [...prev, '']);
    }
  }, [pollOptions.length]);

  const updatePollOption = useCallback((index: number, value: string) => {
    setPollOptions(prev => prev.map((opt, i) => (i === index ? value : opt)));
  }, []);

  const removePollOption = useCallback((index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(prev => prev.filter((_, i) => i !== index));
    }
  }, [pollOptions.length]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!body.trim()) { setError('Body is required'); return; }
    if (showPoll) {
      if (!pollQuestion.trim()) { setError('Poll question is required'); return; }
      const validOpts = pollOptions.filter(o => o.trim());
      if (validOpts.length < 2) { setError('Poll needs at least 2 options'); return; }
    }

    setSubmitting(true);
    setError('');
    try {
      const post = await createPost({
        title: title.trim(),
        body: body.trim(),
        category,
        ...(showPoll
          ? {
            poll: {
              question: pollQuestion.trim(),
              options: pollOptions.filter(o => o.trim()),
            },
          }
          : {}),
      });
      if (post) {
        router.push(`/dashboard/community/forum/${post.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  }, [title, body, category, showPoll, pollQuestion, pollOptions, createPost, router]);

  return (
    <div className="min-h-[100dvh] bg-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-nav backdrop-blur-xl border-b border-themed">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-muted hover:text-secondary">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-primary">New Post</h1>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !body.trim()}
              className="text-sm font-semibold text-brand-400 disabled:text-subtle px-2 py-1"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {/* Category selector */}
        <div>
          <label className="text-xs text-muted font-medium mb-2 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  category === cat
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                    : 'bg-card text-muted border border-themed hover:bg-active-themed'
                }`}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Post title..."
            maxLength={200}
            className="w-full bg-transparent text-lg font-semibold text-primary placeholder:text-subtle focus:outline-none"
          />
        </div>

        {/* Body */}
        <div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="What's on your mind?"
            rows={6}
            className="w-full bg-hover-themed border border-themed rounded-xl px-4 py-3 text-sm text-primary placeholder:text-subtle focus:outline-none focus:border-brand-500/50 resize-none"
          />
        </div>

        {/* Poll toggle */}
        {!showPoll ? (
          <button
            onClick={() => setShowPoll(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/15 transition-colors"
          >
            <BarChart3 className="h-4 w-4" /> Add a Poll
          </button>
        ) : (
          <div className="p-4 rounded-2xl bg-purple-500/[0.06] border border-purple-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-primary font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-400" /> Poll
              </h4>
              <button onClick={() => setShowPoll(false)} className="text-subtle hover:text-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value)}
              placeholder="Ask a question..."
              className="w-full bg-card border border-themed rounded-lg px-3 py-2 text-sm text-primary placeholder:text-subtle focus:outline-none focus:border-purple-500/50"
            />

            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={e => updatePollOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 bg-card border border-themed rounded-lg px-3 py-2 text-sm text-primary placeholder:text-subtle focus:outline-none focus:border-purple-500/50"
                />
                {pollOptions.length > 2 && (
                  <button onClick={() => removePollOption(i)} className="text-subtle hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

            {pollOptions.length < 6 && (
              <button
                onClick={addPollOption}
                className="flex items-center gap-1 text-purple-400 text-xs font-medium"
              >
                <Plus className="h-3 w-3" /> Add option
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
