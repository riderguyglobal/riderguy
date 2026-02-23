'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import { Spinner } from '@riderguy/ui';

// ============================================================
// Payment Verification — Bolt/Uber-style callback page
// ============================================================

type VerificationState = 'verifying' | 'success' | 'failed';

export default function PaymentPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const orderId = params.id;

  const [state, setState] = useState<VerificationState>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reference) {
      verifyPayment(reference);
    } else {
      router.replace(`/dashboard/orders/${orderId}/confirmation`);
    }
  }, [reference]);

  async function verifyPayment(ref: string) {
    try {
      const api = getApiClient();
      const { data } = await api.get(`/payments/verify/${ref}`);
      if (data.data?.status === 'success') {
        setState('success');
        setTimeout(() => { router.replace(`/dashboard/orders/${orderId}/confirmation`); }, 2000);
      } else {
        setState('failed');
        setError('Payment was not successful. You can retry from the order page.');
      }
    } catch {
      setState('failed');
      setError('Unable to verify payment. Please check your order page for status.');
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4 dash-page-enter">
      <div className="w-full max-w-sm">
        {state === 'verifying' && (
          <div className="flex flex-col items-center gap-5 py-12">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50">
                <Spinner className="h-8 w-8 text-brand-500" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-brand-200 tracking-pulse-ring" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-surface-900">Verifying Payment</p>
              <p className="mt-1 text-sm text-surface-500">Please wait while we confirm your payment.</p>
            </div>
          </div>
        )}

        {state === 'success' && (
          <div className="flex flex-col items-center gap-5 py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-50 auth-scale-in">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-accent-700">Payment Successful!</p>
              <p className="mt-1 text-sm text-surface-500">Redirecting to your order...</p>
            </div>
            <div className="mt-2 h-1 w-32 rounded-full bg-surface-100 overflow-hidden">
              <div className="h-full bg-accent-500 progress-fill" />
            </div>
          </div>
        )}

        {state === 'failed' && (
          <div className="flex flex-col items-center gap-5 py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 auth-scale-in">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-700">Payment Failed</p>
              <p className="mt-1 text-sm text-surface-500">{error}</p>
            </div>
            <div className="mt-3 flex gap-3 w-full">
              <button
                className="flex-1 rounded-xl bg-surface-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-surface-800 active:scale-[0.98]"
                onClick={() => router.push(`/dashboard/orders/${orderId}/confirmation`)}
              >
                View Order
              </button>
              <button
                className="flex-1 rounded-xl border border-surface-200 px-4 py-3 text-sm font-semibold text-surface-700 transition-all hover:bg-surface-50 active:scale-[0.98]"
                onClick={() => router.push('/dashboard')}
              >
                Go Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
