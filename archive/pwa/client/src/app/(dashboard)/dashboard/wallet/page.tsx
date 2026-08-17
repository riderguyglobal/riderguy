'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@riderguy/utils';
import { Skeleton } from '@riderguy/ui';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  CreditCard,
  Wallet,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceType?: string;
  createdAt: string;
}

function txIcon(type: string, amount: number) {
  if (amount > 0) return ArrowDownLeft;
  if (type === 'WITHDRAWAL') return ArrowUpRight;
  if (type === 'ORDER_PAYMENT' || type === 'PAYMENT') return Package;
  return CreditCard;
}

function txIconBg(type: string, amount: number) {
  if (amount > 0) return 'bg-brand-100';
  if (type === 'WITHDRAWAL') return 'bg-surface-200';
  return 'bg-surface-100';
}

function txIconColor(type: string, amount: number) {
  if (amount > 0) return 'text-brand-600';
  if (type === 'WITHDRAWAL') return 'text-surface-600';
  return 'text-surface-500';
}

function groupByDate(txs: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  txs.forEach(tx => {
    const d   = new Date(tx.createdAt);
    const now = new Date();
    let key: string;
    if (d.toDateString() === now.toDateString()) {
      key = 'Today';
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = d.toLocaleDateString([], { month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
      }
    }
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(tx);
  });
  return groups;
}

export default function WalletPage() {
  const router    = useRouter();
  const { api }   = useAuth();
  const [hideBalance, setHideBalance] = useState(false);

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await api!.get('/wallets');
      return res.data.data ?? { balance: 0, currency: 'GHS' };
    },
    enabled: !!api,
    staleTime: 30_000,
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: async () => {
      const res = await api!.get('/wallets/transactions', { params: { limit: 50 } });
      return (res.data.data ?? []) as Transaction[];
    },
    enabled: !!api,
    staleTime: 30_000,
  });

  const balance  = Number(wallet?.balance ?? 0);
  const currency = wallet?.currency ?? 'GHS';
  const grouped  = txData ? groupByDate(txData) : {};
  const isEmpty  = !txData?.length;

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Wallet card ──────────────────────────────── */}
      <div
        className="wallet-card mx-5 mt-0 px-6 py-7"
        style={{ marginTop: 'calc(env(safe-area-inset-top,0px) + 16px)' }}
      >
        {/* Top row */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-white/50 font-medium leading-none">RiderGuy Wallet</p>
              <p className="text-[13px] text-white/80 font-semibold">{currency}</p>
            </div>
          </div>
          <button
            onClick={() => setHideBalance(h => !h)}
            className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"
          >
            {hideBalance ? <EyeOff className="h-4 w-4 text-white/60" /> : <Eye className="h-4 w-4 text-white/60" />}
          </button>
        </div>

        {/* Balance */}
        <div>
          <p className="text-[13px] text-white/50 font-medium mb-1">Available balance</p>
          {walletLoading ? (
            <div className="h-10 w-40 bg-white/10 rounded-xl animate-pulse" />
          ) : (
            <p className="text-[38px] font-extrabold text-white leading-none tracking-tight">
              {hideBalance ? '••••••' : formatCurrency(balance)}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => router.push('/dashboard/wallet/add-funds')}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-white text-surface-900 text-[14px] font-bold btn-press"
          >
            <Plus className="h-4 w-4" /> Add Funds
          </button>
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-white/15 text-white text-[14px] font-semibold btn-press"
          >
            <Package className="h-4 w-4" /> Pay for Order
          </button>
        </div>
      </div>

      {/* ── Transactions ─────────────────────────────── */}
      <div className="mt-5 mx-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-surface-900">Transactions</h2>
        </div>

        {(walletLoading || txLoading) ? (
          <div className="bg-white rounded-2xl overflow-hidden divide-y divide-surface-100">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="bg-white rounded-2xl py-12 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
              <CreditCard className="h-6 w-6 text-surface-300" />
            </div>
            <p className="text-[14px] font-semibold text-surface-700">No transactions yet</p>
            <p className="text-[12px] text-surface-400 mt-1">Add funds to get started</p>
            <button
              onClick={() => router.push('/dashboard/wallet/add-funds')}
              className="mt-4 btn-primary inline-flex px-8"
              style={{ height: 48, fontSize: 14 }}
            >
              <Plus className="h-4 w-4" /> Add Funds
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([date, txs]) => (
              <div key={date}>
                <p className="section-label mb-2 px-1">{date}</p>
                <div className="bg-white rounded-2xl overflow-hidden divide-y divide-surface-100">
                  {txs.map(tx => {
                    const isCredit  = tx.amount > 0;
                    const Icon      = txIcon(tx.type, tx.amount);
                    const iconBg    = txIconBg(tx.type, tx.amount);
                    const iconColor = txIconColor(tx.type, tx.amount);
                    return (
                      <div key={tx.id} className="tx-row px-4">
                        {/* Icon */}
                        <div className={`tx-icon ${iconBg}`}>
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                        </div>

                        {/* Description */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-surface-900 truncate leading-tight">
                            {tx.description || tx.type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[12px] text-surface-400 mt-0.5">
                            {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            Bal: {formatCurrency(tx.balanceAfter)}
                          </p>
                        </div>

                        {/* Amount */}
                        <p className={isCredit ? 'tx-amount-credit' : 'tx-amount-debit'}>
                          {isCredit ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
