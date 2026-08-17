'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@riderguy/utils';
import {
  ArrowLeft,
  Wallet,
  Smartphone,
  CreditCard,
  ChevronRight,
  Shield,
  Loader2,
} from 'lucide-react';

const PRESETS = [20, 50, 100, 200, 500];

const METHODS = [
  {
    key: 'MOBILE_MONEY',
    label: 'Mobile Money',
    sublabel: 'MTN, Telecel, AirtelTigo',
    icon: Smartphone,
  },
  {
    key: 'CARD',
    label: 'Debit / Credit Card',
    sublabel: 'Visa, Mastercard',
    icon: CreditCard,
  },
] as const;

type Method = (typeof METHODS)[number]['key'];

export default function AddFundsPage() {
  const router        = useRouter();
  const { api }       = useAuth();
  const [rawAmount, setRawAmount] = useState('');
  const [method, setMethod]       = useState<Method>('MOBILE_MONEY');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await api!.get('/wallets');
      return res.data.data ?? { balance: 0, currency: 'GHS' };
    },
    enabled: !!api,
    staleTime: 30_000,
  });

  const balance  = Number(wallet?.balance ?? 0);
  const currency = wallet?.currency ?? 'GHS';

  const numericAmount = parseFloat(rawAmount.replace(/[^0-9.]/g, '')) || 0;
  const isValid = numericAmount >= 1;

  // Focus input on mount for immediate entry
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleAmountInput(val: string) {
    // Strip non-numeric except single decimal
    const cleaned = val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setRawAmount(cleaned);
    setError(null);
  }

  function handlePreset(amount: number) {
    setRawAmount(String(amount));
    setError(null);
  }

  async function handleProceed() {
    if (!isValid) {
      setError('Please enter an amount of at least GHS 1.');
      return;
    }
    if (!api) return;

    setLoading(true);
    setError(null);

    try {
      const callbackUrl = `${window.location.origin}/dashboard/wallet/add-funds/callback`;
      const res = await api.post('/wallets/fund', {
        amount: numericAmount,
        method,
        callbackUrl,
      });

      const { authorizationUrl } = res.data.data;
      if (authorizationUrl) {
        window.location.href = authorizationUrl;
      } else {
        setError('Unable to initiate payment. Please try again.');
        setLoading(false);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Something went wrong. Please try again.';
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col animate-page-enter">

      {/* ── Top bar ────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 bg-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button
          onClick={() => router.back()}
          className="map-btn bg-surface-100 !shadow-none"
        >
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <div className="flex-1">
          <p className="text-[17px] font-bold text-surface-900">Add Funds</p>
        </div>
      </div>

      {/* ── Wallet balance peek ─────────────────── */}
      <div className="mx-5 mb-6">
        <div className="rounded-2xl bg-surface-50 flex items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 rounded-xl bg-surface-900 flex items-center justify-center flex-shrink-0">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-surface-400">Current Balance</p>
            <p className="text-[17px] font-extrabold text-surface-900">{formatCurrency(balance)}</p>
          </div>
          <p className="text-[12px] font-semibold text-surface-400">{currency}</p>
        </div>
      </div>

      {/* ── Amount entry ────────────────────────── */}
      <div className="flex-1 px-5">
        <p className="text-[13px] font-bold uppercase tracking-wide text-surface-400 mb-3">
          Amount to add
        </p>

        {/* Big number input */}
        <div
          className="flex items-center justify-center gap-2 mb-5 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          <span className="text-[28px] font-bold text-surface-500 mt-1">GHS</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={rawAmount}
            onChange={e => handleAmountInput(e.target.value)}
            className="text-[52px] font-extrabold text-surface-900 bg-transparent outline-none text-center w-full tracking-tight"
            style={{ caretColor: 'rgb(34 197 94)' }}
          />
        </div>

        {/* Preset chips */}
        <div className="flex gap-2 mb-7 flex-wrap">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={[
                'h-9 px-4 rounded-full text-[13px] font-bold transition-all duration-150 active:scale-95',
                numericAmount === p
                  ? 'bg-surface-900 text-white'
                  : 'bg-surface-100 text-surface-700 hover:bg-surface-200',
              ].join(' ')}
            >
              +{p}
            </button>
          ))}
        </div>

        {/* ── Payment method ──────────────────────── */}
        <p className="text-[13px] font-bold uppercase tracking-wide text-surface-400 mb-3">
          Pay with
        </p>
        <div className="space-y-2 mb-6">
          {METHODS.map(m => {
            const Icon    = m.icon;
            const active  = method === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-150 active:scale-[0.99] text-left',
                  active
                    ? 'bg-surface-900 text-white'
                    : 'bg-surface-50 text-surface-900 hover:bg-surface-100',
                ].join(' ')}
              >
                <div className={[
                  'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  active ? 'bg-white/15' : 'bg-white shadow-card',
                ].join(' ')}>
                  <Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-surface-600'}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-[15px] font-bold ${active ? 'text-white' : 'text-surface-900'}`}>
                    {m.label}
                  </p>
                  <p className={`text-[12px] mt-0.5 ${active ? 'text-white/60' : 'text-surface-400'}`}>
                    {m.sublabel}
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  active ? 'border-white bg-white' : 'border-surface-300'
                }`}>
                  {active && <div className="w-2.5 h-2.5 rounded-full bg-surface-900" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-[13px] font-semibold text-red-600">
            {error}
          </div>
        )}

        {/* Summary row */}
        {isValid && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-surface-50 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-surface-500">You will add</p>
            <p className="text-[17px] font-extrabold text-surface-900">
              {formatCurrency(numericAmount)}
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom CTA ──────────────────────────── */}
      <div
        className="px-5 pt-3 bg-white"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)' }}
      >
        {/* Security note */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <Shield className="h-3.5 w-3.5 text-surface-400" />
          <p className="text-[12px] text-surface-400 font-medium">
            Secured by Paystack · 256-bit SSL
          </p>
        </div>

        <button
          onClick={handleProceed}
          disabled={!isValid || loading}
          className="btn-primary brand"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {isValid ? `Add ${formatCurrency(numericAmount)} to Wallet` : 'Add Funds'}
              {!loading && <ChevronRight className="h-5 w-5" />}
            </>
          )}
        </button>
      </div>

    </div>
  );
}
