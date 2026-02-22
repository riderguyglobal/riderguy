'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import { Card, CardContent, Spinner } from '@riderguy/ui';

// ============================================================
// Payment Verification Page
//
// This is the Paystack callback URL. After the client pays on
// Paystack's checkout, they are redirected here with a
// `reference` query param. We verify the payment and redirect
// to the order confirmation page.
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
      // No reference — redirect to confirmation
      router.replace(`/dashboard/orders/${orderId}/confirmation`);
    }
  }, [reference]);

  async function verifyPayment(ref: string) {
    try {
      const api = getApiClient();
      const { data } = await api.get(`/payments/verify/${ref}`);
      if (data.data?.status === 'success') {
        setState('success');
        // Auto-redirect after a short delay
        setTimeout(() => {
          router.replace(`/dashboard/orders/${orderId}/confirmation`);
        }, 2000);
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {state === 'verifying' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Spinner className="h-10 w-10 text-brand-500" />
              <p className="text-lg font-semibold text-gray-900">Verifying Payment...</p>
              <p className="text-center text-sm text-gray-500">
                Please wait while we confirm your payment.
              </p>
            </div>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-green-700">Payment Successful!</p>
              <p className="text-center text-sm text-gray-500">
                Your payment has been confirmed. Redirecting to your order...
              </p>
            </div>
          )}

          {state === 'failed' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-red-700">Payment Failed</p>
              <p className="text-center text-sm text-gray-500">{error}</p>
              <div className="mt-4 flex gap-3">
                <button
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                  onClick={() => router.push(`/dashboard/orders/${orderId}/confirmation`)}
                >
                  View Order
                </button>
                <button
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => router.push('/dashboard')}
                >
                  Go Home
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
