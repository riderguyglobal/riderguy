'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  Spinner,
  Textarea,
  Separator,
} from '@riderguy/ui';

// ============================================================
// Rate Delivery Page — Client rates rider after delivery
// ============================================================

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

export default function RateDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Rating state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [tipAmount, setTipAmount] = useState(0);

  const TIP_PRESETS = [0, 100, 200, 500, 1000];

  const fetchOrder = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get(`/orders/${orderId}`);
      setOrder(data.data);

      // Already rated
      if (data.data.rating) {
        setRating(data.data.rating);
        setReview(data.data.review ?? '');
        setSubmitted(true);
      }
    } catch {
      // Order not found
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  async function handleSubmitRating() {
    if (rating === 0) {
      alert('Please select a star rating.');
      return;
    }

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
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error?: string } } }).response?.data?.error
          : 'Failed to submit rating';
      alert(msg || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  }

  const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Order not found</p>
        <Button className="mt-4" onClick={() => router.push('/dashboard/orders')}>
          Back to Orders
        </Button>
      </div>
    );
  }

  if (order.status !== 'DELIVERED') {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">This order has not been delivered yet.</p>
        <Button
          className="mt-4"
          onClick={() => router.push(`/dashboard/orders/${orderId}/confirmation`)}
        >
          Back to Order
        </Button>
      </div>
    );
  }

  // Thank you screen after submission
  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <div className="text-center">
          <p className="text-4xl">🎉</p>
          <h2 className="mt-3 text-xl font-bold text-gray-900">Thank You!</h2>
          <p className="mt-2 text-sm text-gray-500">
            Your feedback helps us improve the delivery experience.
          </p>

          <div className="mt-4 flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-2xl ${star <= rating ? 'text-yellow-500' : 'text-gray-300'}`}
              >
                ★
              </span>
            ))}
          </div>
          <p className="mt-1 text-sm text-gray-500">{RATING_LABELS[rating]}</p>

          {review && (
            <p className="mt-3 text-sm text-gray-600 italic">"{review}"</p>
          )}

          {tipAmount > 0 && (
            <p className="mt-2 text-sm text-green-600">
              Tip: ₦{tipAmount.toLocaleString()} sent to rider
            </p>
          )}

          <div className="mt-6 space-y-2">
            <Button
              className="w-full bg-brand-500 hover:bg-brand-600"
              onClick={() => router.push('/dashboard/send')}
            >
              Send Another Package
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/dashboard/orders')}
            >
              View My Orders
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/dashboard/orders/${orderId}/confirmation`)}
          className="mb-2 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Order
        </button>
        <h1 className="text-xl font-bold text-gray-900">Rate Your Delivery</h1>
        <p className="text-sm text-gray-500">Order {order.orderNumber}</p>
      </div>

      {/* Rider card */}
      {order.rider && (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
              {order.rider.user.firstName[0]}
              {order.rider.user.lastName[0]}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {order.rider.user.firstName} {order.rider.user.lastName}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>⭐ {order.rider.averageRating.toFixed(1)}</span>
                <span>{order.rider.totalDeliveries} deliveries</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Star rating */}
      <Card className="mb-6">
        <CardContent className="pt-6 text-center">
          <p className="text-sm font-medium text-gray-700 mb-4">
            How was your delivery experience?
          </p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className={`text-4xl transition-transform hover:scale-110 ${
                  star <= (hoverRating || rating)
                    ? 'text-yellow-500'
                    : 'text-gray-300'
                }`}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                ★
              </button>
            ))}
          </div>
          {(hoverRating || rating) > 0 && (
            <p className="mt-2 text-sm font-medium text-gray-600">
              {RATING_LABELS[hoverRating || rating]}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Review */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Leave a review (optional)
          </p>
          <Textarea
            placeholder="Tell us about your experience..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <p className="mt-1 text-right text-xs text-gray-400">
            {review.length}/500
          </p>
        </CardContent>
      </Card>

      {/* Tip */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-gray-700 mb-1">
            Say thanks with a tip (optional)
          </p>
          <p className="text-xs text-gray-500 mb-3">
            100% of tips go directly to your rider.
          </p>
          <div className="flex flex-wrap gap-2">
            {TIP_PRESETS.map((amount) => (
              <button
                key={amount}
                className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors ${
                  tipAmount === amount
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => setTipAmount(amount)}
              >
                {amount === 0 ? 'No tip' : `₦${amount.toLocaleString()}`}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        className="w-full bg-brand-500 hover:bg-brand-600 text-base py-6"
        disabled={submitting || rating === 0}
        onClick={handleSubmitRating}
      >
        {submitting ? (
          <>
            <Spinner className="mr-2 h-4 w-4" />
            Submitting…
          </>
        ) : (
          'Submit Rating'
        )}
      </Button>
    </div>
  );
}
