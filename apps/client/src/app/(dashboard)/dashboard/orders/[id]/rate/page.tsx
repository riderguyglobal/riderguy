'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { Star, ArrowLeft, CheckCircle, AlertCircle, Sparkles, Heart } from 'lucide-react';

const TIP_OPTIONS = [0, 2, 5, 10];

export default function RatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [review, setReview] = useState('');
  const [tip, setTip] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!api || rating === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post(`${API_BASE_URL}/orders/${id}/rate`, {
        rating,
        review: review.trim() || undefined,
        tip: tip > 0 ? tip : undefined,
      });
      setSubmitted(true);
    } catch {
      setError('Failed to submit rating.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white px-6 text-center animate-scale-in">
        <div className="relative inline-flex mb-5">
          <div className="absolute inset-0 bg-accent-500/20 rounded-full blur-2xl scale-150 animate-ping-soft" />
          <div className="relative h-18 w-18 rounded-full bg-accent-50 flex items-center justify-center">
            <CheckCircle className="h-9 w-9 text-accent-500" />
          </div>
        </div>
        <h2 className="text-xl font-extrabold text-surface-900 mb-2">Thank you!</h2>
        <p className="text-surface-500 text-sm mb-8">Your feedback helps improve our service.</p>
        <button
          onClick={() => router.replace('/dashboard')}
          className="h-13 px-8 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand btn-press inline-flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" /> Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white/80 backdrop-blur-xl border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center btn-press">
            <ArrowLeft className="h-5 w-5 text-surface-600" />
          </button>
          <h1 className="text-lg font-extrabold text-surface-900">Rate Delivery</h1>
        </div>
      </div>

      <div className="px-6 py-8 space-y-6 max-w-md mx-auto">
        {error && (
          <div className="p-3.5 rounded-2xl bg-danger-50 border border-danger-100 flex items-start gap-2.5 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        {/* Stars */}
        <div className="text-center py-4">
          <div className="relative inline-flex mb-4">
            <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-2xl scale-150" />
            <div className="relative h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Star className="h-7 w-7 text-amber-400" />
            </div>
          </div>
          <p className="text-sm font-semibold text-surface-600 mb-4">How was your delivery?</p>
          <div className="flex items-center justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="transition-all duration-200 hover:scale-125 active:scale-95 btn-press"
              >
                <Star
                  className={`h-11 w-11 transition-all duration-200 ${
                    star <= (hovered || rating)
                      ? 'text-amber-400 fill-amber-400 drop-shadow-lg'
                      : 'text-surface-200'
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-surface-500 mt-3 font-medium animate-scale-in">
              {rating <= 2 ? "We're sorry about that" : rating <= 3 ? 'Thanks for the feedback' : rating === 4 ? 'Great!' : 'Excellent!'}
            </p>
          )}
        </div>

        {/* Review */}
        <div className="space-y-2">
          <label className="text-sm text-surface-700 font-semibold">Leave a review (optional)</label>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Tell us about your experience..."
            rows={3}
            className="w-full rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none"
          />
        </div>

        {/* Tip */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-brand-500" />
            <label className="text-sm text-surface-700 font-semibold">Add a tip for your rider</label>
          </div>
          <div className="flex gap-2">
            {TIP_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => setTip(amount)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all btn-press ${
                  tip === amount
                    ? 'border-brand-500 bg-brand-50 text-brand-600 shadow-md'
                    : 'border-surface-200 text-surface-600 hover:border-surface-300'
                }`}
              >
                {amount === 0 ? 'None' : `GH₵${amount}`}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full h-13 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand hover:shadow-lg transition-all btn-press disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Sparkles className="h-4 w-4" /> Submit Rating</>
          )}
        </button>
      </div>
    </div>
  );
}
