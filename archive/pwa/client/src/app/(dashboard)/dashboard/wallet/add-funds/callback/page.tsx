'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@riderguy/utils';
import { CheckCircle, XCircle, Loader2, Wallet } from 'lucide-react';

type State = 'verifying' | 'success' | 'failed';

export default function AddFundsCallbackPage() {
  const router       = useRouter();
  const params       = useSearchParams();
  const { api }      = useAuth();
  const queryClient  = useQueryClient();
  const [state, setState]   = useState<State>('verifying');
  const [amount, setAmount] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState('');

  const reference = params?.get('reference') ?? params?.get('trxref');

  useEffect(() => {
    if (!api || !reference) {
      setState('failed');
      setErrMsg('No payment reference found.');
      return;
    }

    let cancelled = false;

    api
      .get(`/wallets/fund/verify/${reference}`)
      .then(res => {
        if (cancelled) return;
        const data = res.data.data;
        setAmount(data?.amount ?? null);
        setState('success');
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ?? 'Payment verification failed.';
        setErrMsg(msg);
        setState('failed');
      });

    return () => { cancelled = true; };
  }, [api, reference, queryClient]);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-8 animate-page-enter">
      {state === 'verifying' && (
        <div className="flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full bg-surface-100 flex items-center justify-center mb-5">
            <Loader2 className="h-9 w-9 text-surface-400 animate-spin" />
          </div>
          <p className="text-[18px] font-bold text-surface-900 mb-1">Confirming payment…</p>
          <p className="text-[14px] text-surface-400">Please wait while we verify your transaction.</p>
        </div>
      )}

      {state === 'success' && (
        <div className="flex flex-col items-center text-center animate-scale-in-spring">
          <div className="h-20 w-20 rounded-full bg-brand-500 flex items-center justify-center mb-5">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <p className="text-[22px] font-extrabold text-surface-900 mb-1">Funds Added!</p>
          {amount != null && (
            <p className="text-[15px] text-surface-500 mb-6">
              {formatCurrency(amount)} has been added to your wallet.
            </p>
          )}
          <div className="w-full space-y-2.5">
            <button
              onClick={() => router.replace('/dashboard/wallet')}
              className="btn-primary brand"
            >
              <Wallet className="h-5 w-5" /> View Wallet
            </button>
            <button
              onClick={() => router.replace('/dashboard')}
              className="w-full h-12 rounded-2xl bg-surface-100 text-surface-700 font-semibold text-[14px] flex items-center justify-center btn-press"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {state === 'failed' && (
        <div className="flex flex-col items-center text-center animate-scale-in">
          <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center mb-5">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <p className="text-[22px] font-extrabold text-surface-900 mb-1">Payment Failed</p>
          <p className="text-[14px] text-surface-400 mb-6 leading-snug">
            {errMsg || 'Your payment could not be verified. No money has been deducted.'}
          </p>
          <div className="w-full space-y-2.5">
            <button
              onClick={() => router.replace('/dashboard/wallet/add-funds')}
              className="btn-primary"
            >
              Try Again
            </button>
            <button
              onClick={() => router.replace('/dashboard/wallet')}
              className="w-full h-12 rounded-2xl bg-surface-100 text-surface-700 font-semibold text-[14px] flex items-center justify-center btn-press"
            >
              Back to Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
