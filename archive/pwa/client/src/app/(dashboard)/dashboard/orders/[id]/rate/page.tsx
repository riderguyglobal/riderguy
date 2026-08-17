'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Star, ArrowLeft, CheckCircle, Heart, Loader2 } from 'lucide-react';

const TIP_OPTIONS = [0, 2, 5, 10];

const RATING_LABELS = ['', "We'll do better", 'Below average', 'It was okay', 'Great!', 'Excellent!'];

export default function RatePage() {
  const { id }  = useParams<{ id: string }>() ?? {};
  const router  = useRouter();
  const { api } = useAuth();

  const [rating,     setRating]     = useState(0);
  const [hovered,    setHovered]    = useState(0);
  const [review,     setReview]     = useState('');
  const [tip,        setTip]        = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState('');
  const [riderInfo,  setRiderInfo]  = useState<{ id: string; name: string; avatarUrl?: string } | null>(null);
  const [favorited,  setFavorited]  = useState(false);
  const [favoriting, setFavoriting] = useState(false);

  useEffect(() => {
    if (!api || !id) return;
    api.get(`/orders/${id}`).then((res) => {
      const rider = res.data?.data?.rider;
      if (rider) {
        setRiderInfo({
          id: rider.id,
          name: [rider.user?.firstName, rider.user?.lastName].filter(Boolean).join(' ') || 'Your rider',
          avatarUrl: rider.user?.avatarUrl,
        });
      }
    }).catch(() => {});
  }, [api, id]);

  async function handleSubmit() {
    if (!api || rating === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/orders/${id}/rate`, {
        rating,
        review: review.trim() || undefined,
        tip:    tip > 0 ? tip : undefined,
      });
      setSubmitted(true);
    } catch {
      setError('Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFavorite() {
    if (!api || !riderInfo || favoriting) return;
    setFavoriting(true);
    try {
      await api.post(`/favorite-riders/${riderInfo.id}`);
      setFavorited(true);
    } catch {
      setFavorited(true); // treat duplicate as success
    } finally {
      setFavoriting(false);
    }
  }

  /* ── Success state ── */
  if (submitted) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white px-8 text-center animate-scale-in-spring">
        <div className="h-20 w-20 rounded-full bg-brand-500 flex items-center justify-center mb-5">
          <CheckCircle className="h-10 w-10 text-white" />
        </div>
        <p className="text-[22px] font-extrabold text-surface-900 mb-1">Thank you!</p>
        <p className="text-[14px] text-surface-400 mb-8 leading-snug">
          Your feedback helps us improve the service.
        </p>

        {riderInfo && !favorited && (
          <button
            onClick={handleFavorite}
            disabled={favoriting}
            className="mb-4 h-12 px-6 rounded-2xl bg-rose-50 text-rose-500 font-bold text-[14px] btn-press inline-flex items-center gap-2 disabled:opacity-50"
          >
            {favoriting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Heart className="h-4 w-4" />
            }
            {favoriting ? 'Adding…' : `Add ${riderInfo.name} to favourites`}
          </button>
        )}
        {favorited && (
          <p className="mb-4 text-[14px] font-semibold text-rose-500 flex items-center gap-1.5 animate-scale-in">
            <Heart className="h-4 w-4 fill-rose-500" /> Added to favourites!
          </p>
        )}

        <div className="w-full space-y-2.5">
          <button
            onClick={() => router.replace('/dashboard')}
            className="btn-primary brand"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  /* ── Rating form ── */
  const displayRating = hovered || rating;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col animate-page-enter">

      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 bg-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-surface-100 !shadow-none">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <p className="text-[17px] font-bold text-surface-900">Rate Delivery</p>
      </div>

      <div className="flex-1 px-5 pb-10 space-y-6">

        {/* Rider avatar + name */}
        {riderInfo && (
          <div className="flex flex-col items-center pt-2">
            <div className="h-16 w-16 rounded-2xl bg-surface-200 flex items-center justify-center overflow-hidden mb-2">
              {riderInfo.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={riderInfo.avatarUrl} alt="Rider" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[22px] font-bold text-surface-600">
                  {riderInfo.name[0]}
                </span>
              )}
            </div>
            <p className="text-[16px] font-bold text-surface-900">{riderInfo.name}</p>
            <p className="text-[13px] text-surface-400 mt-0.5">How was your delivery?</p>
          </div>
        )}

        {/* Stars */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="transition-all duration-150 active:scale-90 hover:scale-110"
            >
              <Star
                className={`h-12 w-12 transition-all duration-200 ${
                  star <= displayRating
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-surface-200'
                }`}
              />
            </button>
          ))}
        </div>

        {displayRating > 0 && (
          <p
            key={displayRating}
            className="text-[15px] font-bold text-surface-700 text-center animate-slide-from-top -mt-4"
          >
            {RATING_LABELS[displayRating]}
          </p>
        )}

        {/* Review textarea */}
        <div>
          <p className="section-label mb-2">Leave a comment (optional)</p>
          <textarea
            value={review}
            onChange={e => setReview(e.target.value)}
            placeholder="Tell us about your experience..."
            rows={3}
            className="input-field !h-auto py-3.5 resize-none"
          />
        </div>

        {/* Tip */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-rose-400" />
            <p className="section-label">Tip your rider</p>
          </div>
          <div className="flex gap-2">
            {TIP_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => setTip(amount)}
                className={[
                  'flex-1 h-12 rounded-2xl text-[14px] font-bold transition-all duration-150 active:scale-95',
                  tip === amount
                    ? 'bg-surface-900 text-white'
                    : 'bg-surface-100 text-surface-600',
                ].join(' ')}
              >
                {amount === 0 ? 'None' : `GH₵${amount}`}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-2xl bg-red-50 text-[13px] font-semibold text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="btn-primary brand"
        >
          {submitting
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : tip > 0 ? `Submit & Tip GH₵${tip}` : 'Submit Rating'
          }
        </button>
      </div>
    </div>
  );
}
