'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useForum } from '@/hooks/use-community';
import type { ForumPost, ForumComment, PollData } from '@/hooks/use-community';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Flag,
  MoreVertical,
  Share2,
  Trash2,
  Lock,
} from 'lucide-react';

export default function ForumPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params?.postId as string;
  const { user } = useAuth();
  const { getPost, getComments, addComment, vote, voteComment, votePoll, deletePost: removePost } = useForum();

  const [post, setPost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch post and comments
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, c] = await Promise.all([
          getPost(postId),
          getComments(postId),
        ]);
        if (p) setPost(p);
        setComments(c);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, getPost, getComments]);

  const handleVotePost = useCallback(async (value: number) => {
    if (!post) return;
    const result = await vote(post.id, value);
    if (result) {
      setPost(prev => prev ? {
        ...prev,
        userVote: result.value,
        upvotes: prev.upvotes + (result.value === 1 ? 1 : 0) - ((prev.userVote ?? 0) === 1 ? 1 : 0),
        downvotes: prev.downvotes + (result.value === -1 ? 1 : 0) - ((prev.userVote ?? 0) === -1 ? 1 : 0),
        score: prev.score + result.value - (prev.userVote ?? 0),
      } : prev);
    }
  }, [post, vote]);

  const handleComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const c = await addComment(postId, text, replyTo?.id);
      if (c) {
        if (replyTo) {
          // Add as nested reply
          setComments(prev => prev.map(comment => {
            if (comment.id === replyTo.id) {
              return { ...comment, replies: [...(comment.replies ?? []), c] };
            }
            return comment;
          }));
        } else {
          setComments(prev => [...prev, { ...c, replies: [] }]);
        }
        setCommentText('');
        setReplyTo(null);
        setPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [commentText, submitting, postId, replyTo, addComment]);

  const handlePollVote = useCallback(async (optionId: string) => {
    const result = await votePoll(optionId);
    if (result && post) {
      setPost(prev => prev ? { ...prev, poll: result } : prev);
    }
  }, [votePoll, post]);

  const handleDelete = useCallback(async () => {
    if (!post || !confirm('Delete this post?')) return;
    await removePost(post.id);
    router.push('/dashboard/community');
  }, [post, removePost, router]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-page flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-[100dvh] bg-page flex flex-col items-center justify-center">
        <p className="text-muted">Post not found</p>
        <button onClick={() => router.back()} className="text-brand-400 text-sm mt-2">Go back</button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-page flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-nav backdrop-blur-xl border-b border-themed">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-muted hover:text-secondary">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-muted font-medium">Post</span>
            {post.isOwner && (
              <button onClick={handleDelete} className="p-2 -mr-2 text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {!post.isOwner && <div className="w-9" />}
          </div>
        </div>
      </div>

      {/* Post content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          {/* Category & Badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-skeleton text-muted font-medium">
              {post.category}
            </span>
            {post.isPinned && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">📌 Pinned</span>
            )}
            {post.isLocked && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium flex items-center gap-0.5">
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold text-primary leading-tight">{post.title}</h1>

          {/* Author & meta */}
          <div className="flex items-center gap-2 mt-3">
            <div className="h-7 w-7 rounded-full bg-surface-700 flex items-center justify-center">
              {post.author.avatarUrl ? (
                <img src={post.author.avatarUrl} className="h-full w-full rounded-full object-cover" alt="" />
              ) : (
                <span className="text-[10px] font-bold text-secondary">{post.author.firstName.charAt(0)}</span>
              )}
            </div>
            <span className="text-sm text-secondary">{post.author.firstName} {post.author.lastName}</span>
            <span className="text-subtle">•</span>
            <span className="text-xs text-subtle">{formatTime(post.createdAt)}</span>
          </div>

          {/* Body */}
          <div className="mt-4 text-secondary text-sm leading-relaxed whitespace-pre-wrap">{post.body}</div>

          {/* Poll */}
          {post.poll && <PollComponent poll={post.poll} onVote={handlePollVote} />}

          {/* Vote & stats bar */}
          <div className="flex items-center gap-4 mt-5 py-3 border-t border-b border-themed">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleVotePost(1)}
                className={`p-1.5 rounded-lg ${post.userVote === 1 ? 'bg-brand-500/20 text-brand-400' : 'text-subtle hover:text-secondary'}`}
              >
                ▲
              </button>
              <span className={`text-sm font-bold min-w-[24px] text-center ${post.score > 0 ? 'text-brand-400' : post.score < 0 ? 'text-red-400' : 'text-muted'}`}>
                {post.score}
              </span>
              <button
                onClick={() => handleVotePost(-1)}
                className={`p-1.5 rounded-lg ${post.userVote === -1 ? 'bg-red-500/20 text-red-400' : 'text-subtle hover:text-secondary'}`}
              >
                ▼
              </button>
            </div>
            <span className="text-xs text-subtle flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> {post.commentCount} comments
            </span>
            <span className="text-xs text-subtle">👁 {post.viewCount} views</span>
          </div>

          {/* Comments */}
          <div className="mt-4">
            <h3 className="text-primary font-semibold text-sm mb-3">Comments</h3>
            {comments.length === 0 ? (
              <p className="text-subtle text-sm py-4">No comments yet. Be the first!</p>
            ) : (
              <div className="space-y-3">
                {comments.map(comment => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    currentUserId={user?.id}
                    onReply={(id, name) => setReplyTo({ id, name })}
                    onVote={voteComment}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comment input */}
      {!post.isLocked && (
        <div className="sticky bottom-0 bg-page border-t border-themed pb-[env(safe-area-inset-bottom)]">
          {replyTo && (
            <div className="px-4 pt-2 flex items-center gap-2">
              <span className="text-xs text-muted">
                Replying to <span className="text-brand-400">{replyTo.name}</span>
              </span>
              <button onClick={() => setReplyTo(null)} className="text-subtle text-xs">✕</button>
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-3">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleComment()}
              placeholder={replyTo ? `Reply to ${replyTo.name}...` : 'Write a comment...'}
              className="flex-1 bg-skeleton border border-themed-strong rounded-full px-4 py-2.5 text-sm text-primary placeholder:text-subtle focus:outline-none focus:border-brand-500/50"
            />
            <button
              onClick={handleComment}
              disabled={!commentText.trim() || submitting}
              className="h-10 w-10 rounded-full bg-brand-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/30 disabled:opacity-40 transition-all btn-press"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────── Poll Component ──────

function PollComponent({ poll, onVote }: { poll: PollData; onVote: (optionId: string) => void }) {
  const hasVoted = poll.options.some(o => o.userVoted);

  return (
    <div className="mt-4 p-4 rounded-2xl bg-purple-500/[0.06] border border-purple-500/20">
      <h4 className="text-primary font-semibold text-sm mb-3">📊 {poll.question}</h4>
      <div className="space-y-2">
        {poll.options.map(option => {
          const pct = option.percentage ?? (poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0);
          return (
            <button
              key={option.id}
              onClick={() => !poll.isExpired && onVote(option.id)}
              disabled={poll.isExpired}
              className="w-full text-left relative overflow-hidden rounded-xl p-3"
            >
              {/* Fill bar */}
              <div
                className={`absolute inset-0 transition-all ${option.userVoted ? 'bg-brand-500/20' : 'bg-card'}`}
                style={{ width: hasVoted ? `${pct}%` : '100%' }}
              />
              <div className="relative flex items-center justify-between">
                <span className={`text-sm ${option.userVoted ? 'text-brand-400 font-medium' : 'text-secondary'}`}>
                  {option.userVoted && '✓ '}{option.text}
                </span>
                {hasVoted && (
                  <span className="text-xs text-muted font-medium">{pct}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-subtle mt-2">
        {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
        {poll.isExpired && ' • Poll ended'}
        {poll.expiresAt && !poll.isExpired && ` • Ends ${formatTime(poll.expiresAt)}`}
      </p>
    </div>
  );
}

// ────── Comment Card ──────

function CommentCard({
  comment,
  currentUserId,
  onReply,
  onVote,
  depth = 0,
}: {
  comment: ForumComment;
  currentUserId?: string;
  onReply: (id: string, name: string) => void;
  onVote: (commentId: string, value: number) => Promise<any>;
  depth?: number;
}) {
  const [localVote, setLocalVote] = useState(comment.userVote);
  const [score, setScore] = useState(comment.score);

  const handleVote = async (value: number) => {
    const result = await onVote(comment.id, value);
    if (result) {
      const oldVote = localVote ?? 0;
      setLocalVote(result.value);
      setScore(prev => prev + result.value - oldVote);
    }
  };

  return (
    <div className={`${depth > 0 ? 'ml-6 pl-3 border-l border-themed' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="h-6 w-6 rounded-full bg-surface-700 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-bold text-secondary">{comment.author.firstName.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary font-medium">{comment.author.firstName}</span>
            <span className="text-[10px] text-subtle">{formatTime(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-secondary mt-0.5">{comment.body}</p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-0.5">
              <button onClick={() => handleVote(1)} className={`text-xs ${localVote === 1 ? 'text-brand-400' : 'text-subtle'}`}>▲</button>
              <span className={`text-[10px] font-bold ${score > 0 ? 'text-brand-400' : score < 0 ? 'text-red-400' : 'text-subtle'}`}>{score}</span>
              <button onClick={() => handleVote(-1)} className={`text-xs ${localVote === -1 ? 'text-red-400' : 'text-subtle'}`}>▼</button>
            </div>
            {depth === 0 && (
              <button
                onClick={() => onReply(comment.id, comment.author.firstName)}
                className="text-[10px] text-subtle hover:text-brand-400"
              >
                Reply
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map(reply => (
            <CommentCard
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onVote={onVote}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────── Utility ──────

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
