'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { PAYSTACK_PUBLIC_KEY } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import {
  ArrowLeft,
  CreditCard,
  Smartphone,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react';

// ============================================================
// Payment Page — Paystack Inline Checkout
//
// Flow:
//  1. Fetches order details
//  2. Initializes payment via POST /payments/initialize
//  3. Loads Paystack inline popup
//  4. On success → verifies → redirects to tracking
//  5. On close  → shows retry option
// ============================================================

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        currency?: string;
        channels?: string[];
        metadata?: Record<string, unknown>;
        onClose: () => void;
        callback: (response: { reference: string; status: string }) => void;
      }) => { openIframe: () => void };
    };
  }
}

type PaymentState = 'loading' | 'ready' | 'processing' | 'verifying' | 'success' | 'failed' | 'cancelled';

interface OrderData {
  id: string;
  orderNumber: string;
  totalPrice: number;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  status: string;
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api, user } = useAuth();

  const [state, setState] = useState<PaymentState>('loading');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const scriptLoaded = useRef(false);

  // Load Paystack inline script
  useEffect(() => {
    if (scriptLoaded.current) return;
    if (document.getElementById('paystack-inline-js')) {
      scriptLoaded.current = true;
      return;
    }
    const script = document.createElement('script');
    script.id = 'paystack-inline-js';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => { scriptLoaded.current = true; };
    document.head.appendChild(script);
  }, []);

  // Fetch order
  useEffect(() => {
    if (!api || !id) return;
    api.get(`/orders/${id}`)
      .then((res) => {
        const data = res.data.data;
        setOrder(data);

        // If already paid, skip to tracking
        if (data?.paymentStatus === 'COMPLETED') {
          router.replace(`/dashboard/orders/${id}/tracking`);
          return;
        }
        // If it's a cash order, skip to tracking
        if (data?.paymentMethod === 'CASH') {
          router.replace(`/dashboard/orders/${id}/tracking`);
          return;
        }

        setState('ready');
      })
      .catch(() => {
        setError('Could not load order details');
        setState('failed');
      });
  }, [api, id, router]);

  // Initialize & open Paystack
  const initiatePayment = useCallback(async () => {
    if (!api || !order || !user) return;

    setState('processing');
    setError('');

    try {
      // Initialize transaction on backend
      const callbackUrl = `${window.location.origin}/dashboard/orders/${id}/tracking`;
      const res = await api.post('/payments/initialize', {
        orderId: order.id,
        callbackUrl,
      });

      const { reference: ref, accessCode } = res.data.data;
      setReference(ref);

      // Wait for Paystack script to load
      let attempts = 0;
      while (!window.PaystackPop && attempts < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }

      if (!window.PaystackPop) {
        // Fallback: redirect to Paystack authorization URL if popup unavailable
        const authUrl = res.data.data?.authorizationUrl;
        if (authUrl) {
          window.location.href = authUrl;
          return;
        }
        throw new Error('Payment popup could not be loaded');
      }

      // Open Paystack inline popup
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: user.email || `user-${user.id}@riderguy.com`,
        amount: Math.round(order.totalPrice * 100), // pesewas
        ref,
        currency: order.currency || 'GHS',
        channels: order.paymentMethod === 'MOBILE_MONEY'
          ? ['mobile_money']
          : ['card', 'mobile_money', 'bank_transfer'],
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          custom_fields: [
            { display_name: 'Order', variable_name: 'order_number', value: order.orderNumber },
          ],
        },
        callback: (response) => {
          // Payment completed — verify
          verifyPayment(response.reference);
        },
        onClose: () => {
          setState('cancelled');
        },
      });

      handler.openIframe();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment initialization failed');
      setState('failed');
    }
  }, [api, order, user, id]);

  // Verify payment after Paystack callback
  const verifyPayment = useCallback(async (ref: string) => {
    if (!api) return;
    setState('verifying');

    try {
      const res = await api.get(`/payments/verify/${ref}`);
      if (res.data.data?.status === 'success') {
        setState('success');
        // Brief success animation before redirect
        setTimeout(() => {
          router.replace(`/dashboard/orders/${id}/tracking`);
        }, 1500);
      } else {
        setError('Payment was not successful. Please try again.');
        setState('failed');
      }
    } catch {
      setError('Could not verify payment. Please check your order status.');
      setState('failed');
    }
  }, [api, id, router]);

  // No auto-initiation — user must explicitly click "Pay Now"

  // ── Loading ──
  if (state === 'loading') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-xl scale-150 animate-pulse" />
          <div className="relative h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
          </div>
        </div>
        <p className="text-surface-500 text-sm mt-4">Loading payment details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push(`/dashboard/orders/${id}/tracking`)}
            className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center btn-press"
          >
            <ArrowLeft className="h-5 w-5 text-surface-900" />
          </button>
          <h1 className="text-[17px] font-bold text-surface-900">Complete Payment</h1>
          <div className="ml-auto flex items-center gap-1 text-accent-500">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Secure</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6">
        {/* ── Order Summary Card ── */}
        {order && (
          <div className="rounded-2xl border border-surface-100 overflow-hidden">
            <div className="px-4 py-3 bg-surface-50 border-b border-surface-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Order Summary</span>
                <span className="text-xs text-surface-400">#{order.orderNumber}</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {/* Route */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center pt-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-surface-900" />
                  <div className="w-0.5 flex-1 bg-surface-200 my-1" />
                  <div className="h-2.5 w-2.5 rounded-full bg-surface-900 ring-2 ring-surface-200" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <p className="text-[10px] font-medium text-surface-400 uppercase">Pickup</p>
                    <p className="text-sm text-surface-900 font-medium truncate">{order.pickupAddress}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-surface-400 uppercase">Dropoff</p>
                    <p className="text-sm text-surface-900 font-medium truncate">{order.dropoffAddress}</p>
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-center justify-between pt-3 border-t border-surface-100">
                <span className="text-sm text-surface-500">Total</span>
                <span className="text-2xl font-extrabold text-surface-900 tabular-nums">
                  {formatCurrency(order.totalPrice)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Payment Method Badge ── */}
        {order && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-50">
            {order.paymentMethod === 'MOBILE_MONEY' ? (
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-amber-600" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-surface-900">
                {order.paymentMethod === 'MOBILE_MONEY' ? 'Mobile Money' : 'Card Payment'}
              </p>
              <p className="text-xs text-surface-400">
                {order.paymentMethod === 'MOBILE_MONEY'
                  ? 'MTN MoMo, Vodafone Cash, AirtelTigo Money'
                  : 'Visa, Mastercard, and more'}
              </p>
            </div>
          </div>
        )}

        {/* ── Status-specific UI ── */}

        {/* Ready — Pay Now button */}
        {state === 'ready' && (
          <button
            onClick={initiatePayment}
            className="w-full h-14 rounded-2xl bg-surface-900 text-white font-bold text-base shadow-lg hover:bg-surface-800 transition-all btn-press flex items-center justify-center gap-2.5"
          >
            <CreditCard className="h-5 w-5" />
            Pay {order ? formatCurrency(order.totalPrice) : ''}
          </button>
        )}

        {/* Processing */}
        {state === 'processing' && (
          <div className="py-8 text-center animate-pulse">
            <div className="relative inline-flex mb-4">
              <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-xl scale-150" />
              <div className="relative h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
              </div>
            </div>
            <p className="text-surface-900 font-semibold">Opening payment window...</p>
            <p className="text-surface-400 text-sm mt-1">You&apos;ll be redirected to Paystack</p>
          </div>
        )}

        {/* Verifying */}
        {state === 'verifying' && (
          <div className="py-8 text-center">
            <div className="relative inline-flex mb-4">
              <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-xl scale-150 animate-pulse" />
              <div className="relative h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
                <Shield className="h-8 w-8 text-brand-500 animate-pulse" />
              </div>
            </div>
            <p className="text-surface-900 font-semibold">Verifying payment...</p>
            <p className="text-surface-400 text-sm mt-1">Please wait, this won&apos;t take long</p>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div className="py-8 text-center animate-page-enter">
            <div className="relative inline-flex mb-4">
              <div className="absolute inset-0 rounded-full bg-accent-500/20 blur-xl scale-[2] animate-pulse" />
              <div className="relative h-20 w-20 rounded-full bg-accent-500/15 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-accent-500" />
              </div>
            </div>
            <p className="text-surface-900 text-lg font-bold">Payment Successful!</p>
            <p className="text-surface-400 text-sm mt-1">Redirecting to your delivery tracking...</p>
          </div>
        )}

        {/* Failed */}
        {state === 'failed' && (
          <div className="py-6 text-center">
            <div className="relative inline-flex mb-4">
              <div className="absolute inset-0 rounded-full bg-red-500/10 blur-xl scale-150" />
              <div className="relative h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <p className="text-surface-900 font-semibold">Payment Failed</p>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            <div className="flex gap-3 mt-6 max-w-xs mx-auto">
              <button
                onClick={() => router.push(`/dashboard/orders/${id}/tracking`)}
                className="flex-1 h-12 rounded-xl border border-surface-200 text-surface-600 font-medium text-sm btn-press"
              >
                View Order
              </button>
              <button
                onClick={() => { setState('ready'); setError(''); }}
                className="flex-1 h-12 rounded-xl bg-surface-900 text-white font-semibold text-sm btn-press flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Try Again
              </button>
            </div>
          </div>
        )}

        {/* Cancelled (user closed the popup) */}
        {state === 'cancelled' && (
          <div className="py-6 text-center">
            <div className="relative inline-flex mb-4">
              <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-xl scale-150" />
              <div className="relative h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
            </div>
            <p className="text-surface-900 font-semibold">Payment Cancelled</p>
            <p className="text-surface-400 text-sm mt-1">You closed the payment window</p>
            <div className="flex gap-3 mt-6 max-w-xs mx-auto">
              <button
                onClick={() => router.push(`/dashboard/orders/${id}/tracking`)}
                className="flex-1 h-12 rounded-xl border border-surface-200 text-surface-600 font-medium text-sm btn-press"
              >
                Pay Later
              </button>
              <button
                onClick={() => { setState('ready'); setError(''); }}
                className="flex-1 h-12 rounded-xl bg-surface-900 text-white font-semibold text-sm btn-press flex items-center justify-center gap-2"
              >
                <CreditCard className="h-4 w-4" /> Retry Payment
              </button>
            </div>
          </div>
        )}

        {/* ── Security Footer ── */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <Shield className="h-4 w-4 text-surface-300" />
          <p className="text-xs text-surface-300">
            Secured by <span className="font-semibold">Paystack</span> · PCI DSS compliant
          </p>
        </div>
      </div>
    </div>
  );
}
