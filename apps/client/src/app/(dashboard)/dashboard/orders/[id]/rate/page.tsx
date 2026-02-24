'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { Button, Textarea } from '@riderguy/ui';
import { Star, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

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
        <CheckCircle className="h-16 w-16 text-accent-500 mb-4" />
        <h2 className="text-xl font-bold text-surface-900 mb-2">Thank you!</h2>
        <p className="text-surface-500 mb-8">Your feedback helps improve our service.</p>
        <Button className="bg-brand-500 hover:bg-brand-600" onClick={() => router.replace('/dashboard')}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">
      {/* Header */}
      <div className="safe-area-top border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="h-9 w-9 rounded-full bg-surface-100 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-surface-600" />
          </button>
          <h1 className="text-lg font-bold text-surface-900">Rate Delivery</h1>
        </div>
      </div>

      <div className="px-6 py-8 space-y-6 max-w-md mx-auto">
        {error && (
          <div className="p-3 rounded-xl bg-danger-50 border border-danger-100 flex items-start gap-2 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        {/* Stars */}
        <div className="text-center">
          <p className="text-sm text-surface-500 mb-3">How was your delivery?</p>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`h-10 w-10 transition-colors ${
                    star <= (hovered || rating)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-surface-200'
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-surface-500 mt-2 animate-fade-in">
              {rating <= 2 ? 'We\'re sorry about that' : rating <= 3 ? 'Thanks for the feedback' : rating === 4 ? 'Great!' : 'Excellent!'}
            </p>
          )}
        </div>

        {/* Review */}
        <div className="space-y-2">
          <p className="text-sm text-surface-600 font-medium">Leave a review (optional)</p>
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Tell us about your experience..."
            rows={3}
          />
        </div>

        {/* Tip */}
        <div className="space-y-2">
          <p className="text-sm text-surface-600 font-medium">Add a tip for your rider</p>
          <div className="flex gap-2">
            {TIP_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => setTip(amount)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  tip === amount
                    ? 'border-brand-500 bg-brand-50 text-brand-600'
                    : 'border-surface-200 text-surface-600 hover:border-surface-300'
                }`}
              >
                {amount === 0 ? 'None' : `GH₵${amount}`}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="xl"
          className="w-full bg-brand-500 hover:bg-brand-600"
          onClick={handleSubmit}
          loading={submitting}
          disabled={rating === 0}
        >
          Submit Rating
        </Button>
      </div>
    </div>
  );
}
