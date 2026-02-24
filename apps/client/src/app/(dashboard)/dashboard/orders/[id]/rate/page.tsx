'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { Star, ArrowLeft, CheckCircle, AlertCircle, Heart } from 'lucide-react';

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
        <div className="h-16 w-16 rounded-full bg-accent-50 flex items-center justify-center mb-5">
          <CheckCircle className="h-8 w-8 text-accent-500" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 mb-2">Thank you!</h2>
        <p className="text-surface-500 text-sm mb-8">Your feedback helps improve our service.</p>
        <button
          onClick={() => router.replace('/dashboard')}
          className="h-13 px-8 rounded-xl bg-surface-900 text-white font-semibold text-sm btn-press inline-flex items-center gap-2 hover:bg-surface-800 transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center btn-press">
            <ArrowLeft className="h-5 w-5 text-surface-900" />
          </button>
          <h1 className="text-[17px] font-bold text-surface-900">Rate Delivery</h1>
        </div>
      </div>

      <div className="px-6 py-8 space-y-6 max-w-md mx-auto">
        {error && (
          <div className="p-3.5 rounded-xl bg-danger-50 flex items-start gap-2.5 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        {/* Stars */}
        <div className="text-center py-4">
          <p className="text-[15px] font-bold text-surface-900 mb-5">How was your delivery?</p>
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
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-surface-200'
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-surface-400 mt-3 font-medium animate-scale-in">
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
            className="w-full rounded-xl bg-surface-100 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-surface-900/10 transition-all resize-none"
          />
        </div>

        {/* Tip */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-surface-400" />
            <label className="text-sm text-surface-700 font-semibold">Add a tip for your rider</label>
          </div>
          <div className="flex gap-2">
            {TIP_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => setTip(amount)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all btn-press ${
                  tip === amount
                    ? 'bg-surface-900 text-white'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
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
          className="w-full h-13 rounded-xl bg-surface-900 text-white font-semibold text-sm hover:bg-surface-800 transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Submit Rating'
          )}
        </button>
      </div>
    </div>
  );
}
