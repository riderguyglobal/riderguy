'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import { Button, Spinner, Textarea } from '@riderguy/ui';

// ============================================================
// Rate Delivery — Bolt/Uber-style post-delivery rating
// ============================================================

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" className={className} fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : '#d1d5db'} strokeWidth="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalPrice: number;
  currency: string;
  deliveredAt?: string;
  rating?: number;
  review?: string;
  rider?: {
    user: { firstName: string; lastName: string };
    averageRating: number;
    totalDeliveries: number;
  };
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
const TIP_PRESETS = [0, 100, 200, 500, 1000];

export default function RateDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [tipAmount, setTipAmount] = useState(0);

  const fetchOrder = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get(`/orders/${orderId}`);
      setOrder(data.data);
      if (data.data.rating) {
        setRating(data.data.rating);
        setReview(data.data.review ?? '');
        setSubmitted(true);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  async function handleSubmitRating() {
    if (rating === 0) { alert('Please select a star rating.'); return; }
    setSubmitting(true);
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/rate`, {
        rating,
        review: review.trim() || undefined,
        tipAmount: tipAmount > 0 ? tipAmount : undefined,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response: { data: { error?: string } } }).response?.data?.error
        : 'Failed to submit rating';
      alert(msg || 'Failed to submit rating');
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-50 mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        </div>
        <p className="text-sm font-medium text-surface-700">Order not found</p>
        <Button className="mt-4 bg-brand-500 hover:bg-brand-600 rounded-xl" size="sm" onClick={() => router.push('/dashboard/orders')}>Back to Orders</Button>
      </div>
    );
  }

  if (order.status !== 'DELIVERED') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <p className="text-sm text-surface-500">This order has not been delivered yet.</p>
        <Button className="mt-4 bg-brand-500 hover:bg-brand-600 rounded-xl" size="sm" onClick={() => router.push(`/dashboard/orders/${orderId}/confirmation`)}>Back to Order</Button>
      </div>
    );
  }

  // ── Thank You Screen ──
  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 dash-page-enter">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-50 auth-scale-in">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-surface-900">Thank You!</h2>
          <p className="mt-2 text-sm text-surface-500">Your feedback helps us improve the delivery experience.</p>

          <div className="mt-5 flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIcon key={star} filled={star <= rating} className={star <= rating ? 'star-pop' : ''} />
            ))}
          </div>
          <p className="mt-1 text-sm font-medium text-surface-600">{RATING_LABELS[rating]}</p>

          {review && (
            <p className="mt-3 rounded-xl bg-surface-50 px-4 py-3 text-sm text-surface-600 italic">&ldquo;{review}&rdquo;</p>
          )}

          {tipAmount > 0 && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-accent-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              GH₵{tipAmount.toLocaleString()} tip sent to rider
            </div>
          )}

          <div className="mt-6 space-y-3 w-full max-w-xs mx-auto">
            <button className="w-full rounded-xl bg-surface-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-surface-800 active:scale-[0.98]" onClick={() => router.push('/dashboard/send')}>
              Send Another Package
            </button>
            <button className="w-full rounded-xl border border-surface-200 px-4 py-3 text-sm font-semibold text-surface-700 transition-all hover:bg-surface-50 active:scale-[0.98]" onClick={() => router.push('/dashboard/orders')}>
              View My Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 dash-page-enter">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-surface-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/dashboard/orders/${orderId}/confirmation`)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <p className="text-sm font-bold text-surface-900">Rate Your Delivery</p>
            <p className="text-[11px] text-surface-400">{order.orderNumber}</p>
          </div>
        </div>
      </div>

      {/* ── Rider Card ── */}
      {order.rider && (
        <div className="px-4 mt-5">
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700 ring-2 ring-brand-100">
              {order.rider.user.firstName[0]}{order.rider.user.lastName[0]}
            </div>
            <p className="mt-3 text-base font-bold text-surface-900">
              {order.rider.user.firstName} {order.rider.user.lastName}
            </p>
            <div className="flex items-center justify-center gap-3 text-xs text-surface-400 mt-1">
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                {order.rider.averageRating.toFixed(1)}
              </span>
              <span>{order.rider.totalDeliveries} trips</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Star Rating ── */}
      <div className="px-4 mt-5">
        <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-6 text-center">
          <p className="text-sm font-medium text-surface-700 mb-5">How was your delivery experience?</p>
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className={`transition-transform active:scale-90 ${star <= (hoverRating || rating) ? 'scale-110' : 'scale-100 hover:scale-105'}`}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <StarIcon filled={star <= (hoverRating || rating)} className={star <= rating ? 'star-pop' : ''} />
              </button>
            ))}
          </div>
          {(hoverRating || rating) > 0 && (
            <p className="mt-3 text-sm font-semibold text-surface-600">{RATING_LABELS[hoverRating || rating]}</p>
          )}
        </div>
      </div>

      {/* ── Review ── */}
      <div className="px-4 mt-4">
        <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Review (optional)</p>
          <Textarea
            placeholder="Tell us about your experience..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
            maxLength={500}
            className="rounded-xl border-surface-200 text-sm resize-none"
          />
          <p className="mt-1 text-right text-[11px] text-surface-300">{review.length}/500</p>
        </div>
      </div>

      {/* ── Tip ── */}
      <div className="px-4 mt-4">
        <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Say thanks with a tip</p>
          <p className="text-[11px] text-surface-400 mt-0.5 mb-3">100% of tips go directly to your rider.</p>
          <div className="flex flex-wrap gap-2">
            {TIP_PRESETS.map((amount) => (
              <button
                key={amount}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                  tipAmount === amount
                    ? 'bg-brand-500 text-white shadow-card'
                    : 'bg-surface-50 text-surface-600 border border-surface-100 hover:border-surface-200'
                }`}
                onClick={() => setTipAmount(amount)}
              >
                {amount === 0 ? 'No tip' : `GH₵${amount.toLocaleString()}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Submit ── */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-gradient-to-t from-white via-white/95 to-transparent pt-6 pb-4 px-4">
        <button
          className="w-full rounded-xl bg-surface-900 py-3.5 text-sm font-bold text-white transition-all hover:bg-surface-800 active:scale-[0.98] disabled:opacity-40 shadow-elevated"
          disabled={submitting || rating === 0}
          onClick={handleSubmitRating}
        >
          {submitting ? <Spinner className="h-4 w-4 mx-auto" /> : 'Submit Rating'}
        </button>
      </div>
    </div>
  );
}
