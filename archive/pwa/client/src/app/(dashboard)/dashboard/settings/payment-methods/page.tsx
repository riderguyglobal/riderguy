'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@riderguy/utils';
import {
  ArrowLeft,
  Wallet,
  Smartphone,
  CreditCard,
  Banknote,
  Check,
  ChevronRight,
  Plus,
} from 'lucide-react';

const STORAGE_KEY = 'riderguy:default_payment';

const METHODS = [
  {
    key: 'WALLET',
    label: 'RiderGuy Wallet',
    sublabel: 'Pay instantly from your balance',
    icon: Wallet,
    iconBg: 'bg-surface-900',
  },
  {
    key: 'MOBILE_MONEY',
    label: 'Mobile Money',
    sublabel: 'MTN, Telecel, AirtelTigo',
    icon: Smartphone,
    iconBg: 'bg-yellow-400',
  },
  {
    key: 'CARD',
    label: 'Debit / Credit Card',
    sublabel: 'Visa, Mastercard via Paystack',
    icon: CreditCard,
    iconBg: 'bg-blue-500',
  },
  {
    key: 'CASH',
    label: 'Cash on Pickup',
    sublabel: 'Pay the rider directly',
    icon: Banknote,
    iconBg: 'bg-brand-500',
  },
] as const;

type Method = (typeof METHODS)[number]['key'];

export default function PaymentMethodsPage() {
  const router  = useRouter();
  const { api } = useAuth();
  const [defaultMethod, setDefaultMethod] = useState<Method>('WALLET');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Method | null;
    if (stored) setDefaultMethod(stored);
  }, []);

  function handleSelect(key: Method) {
    setDefaultMethod(key);
    localStorage.setItem(STORAGE_KEY, key);
  }

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await api!.get('/wallets');
      return res.data.data ?? { balance: 0, currency: 'GHS' };
    },
    enabled: !!api,
    staleTime: 30_000,
  });

  const balance = Number(wallet?.balance ?? 0);

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Top bar ────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 bg-surface-50"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button
          onClick={() => router.back()}
          className="map-btn bg-white !shadow-none shadow-card"
        >
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <p className="flex-1 text-[17px] font-bold text-surface-900">Payment Methods</p>
      </div>

      <div className="px-5 pb-10 space-y-4">

        {/* ── Default method selector ──────────────── */}
        <div>
          <p className="section-label mb-3">Default payment method</p>
          <div className="bg-white rounded-2xl overflow-hidden shadow-card">
            {METHODS.map((m, i) => {
              const Icon    = m.icon;
              const active  = defaultMethod === m.key;
              const isWallet = m.key === 'WALLET';
              return (
                <button
                  key={m.key}
                  onClick={() => handleSelect(m.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-surface-50 ${
                    i > 0 ? 'border-t border-surface-50' : ''
                  }`}
                >
                  <div className={`h-10 w-10 rounded-xl ${m.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-surface-900">{m.label}</p>
                    <p className="text-[12px] text-surface-400 mt-0.5">
                      {isWallet && balance > 0
                        ? `Balance: ${formatCurrency(balance)}`
                        : m.sublabel}
                    </p>
                  </div>
                  <div className={[
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150',
                    active ? 'border-surface-900 bg-surface-900' : 'border-surface-200',
                  ].join(' ')}>
                    {active && <Check className="h-3 w-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-surface-400 mt-2 px-1">
            This will be pre-selected when you place an order.
          </p>
        </div>

        {/* ── Wallet top-up shortcut ───────────────── */}
        <div>
          <p className="section-label mb-3">RiderGuy Wallet</p>
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="h-10 w-10 rounded-xl bg-surface-900 flex items-center justify-center flex-shrink-0">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-surface-900">Available Balance</p>
                <p className="text-[22px] font-extrabold text-surface-900 mt-0.5">
                  {formatCurrency(balance)}
                </p>
              </div>
            </div>
            <div className="border-t border-surface-50">
              <button
                onClick={() => router.push('/dashboard/wallet/add-funds')}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-surface-50 transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-4 w-4 text-brand-600" />
                </div>
                <p className="flex-1 text-[15px] font-semibold text-brand-600">Add Funds</p>
                <ChevronRight className="h-4 w-4 text-surface-300" />
              </button>
              <button
                onClick={() => router.push('/dashboard/wallet')}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-t border-surface-50 active:bg-surface-50 transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-4 w-4 text-surface-600" />
                </div>
                <p className="flex-1 text-[15px] font-semibold text-surface-700">View Transactions</p>
                <ChevronRight className="h-4 w-4 text-surface-300" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
