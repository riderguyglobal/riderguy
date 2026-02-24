'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@riderguy/ui';
import {
  Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, DollarSign,
  Building2, Smartphone, ChevronRight, Clock, CheckCircle, XCircle,
  AlertCircle
} from 'lucide-react';
import type { Wallet as WalletType, Transaction, Withdrawal } from '@riderguy/types';

type WithdrawMethod = 'BANK_TRANSFER' | 'MOBILE_MONEY';

export default function EarningsPage() {
  const { api } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Withdrawal modal state
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wStep, setWStep] = useState(0); // 0=method, 1=details, 2=amount, 3=confirm
  const [wMethod, setWMethod] = useState<WithdrawMethod>('MOBILE_MONEY');
  const [wAmount, setWAmount] = useState('');
  const [wAccountNumber, setWAccountNumber] = useState('');
  const [wAccountName, setWAccountName] = useState('');
  const [wBankCode, setWBankCode] = useState('');
  const [wSubmitting, setWSubmitting] = useState(false);
  const [wError, setWError] = useState('');
  const [wSuccess, setWSuccess] = useState(false);
  const [banks, setBanks] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    if (!api) return;
    Promise.all([
      api.get(`${API_BASE_URL}/wallets`),
      api.get(`${API_BASE_URL}/wallets/transactions?limit=20`),
    ])
      .then(([wRes, tRes]) => {
        setWallet(wRes.data.data);
        setTransactions(tRes.data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  const openWithdraw = async () => {
    setShowWithdraw(true);
    setWStep(0);
    setWError('');
    setWSuccess(false);
    setWAmount('');
    setWAccountNumber('');
    setWAccountName('');
    setWBankCode('');

    // Fetch banks
    if (banks.length === 0) {
      try {
        const res = await api?.get(`${API_BASE_URL}/payments/banks`);
        setBanks(res?.data.data ?? []);
      } catch {}
    }
  };

  const resolveAccount = async () => {
    if (!api || !wAccountNumber || (!wBankCode && wMethod === 'BANK_TRANSFER')) {
      setWError('Fill in all fields');
      return;
    }
    setWSubmitting(true);
    setWError('');
    try {
      const res = await api.post(`${API_BASE_URL}/payments/resolve-account`, {
        accountNumber: wAccountNumber,
        bankCode: wBankCode || undefined,
      });
      setWAccountName(res.data.data?.accountName ?? '');
      setWStep(2);
    } catch {
      setWError('Could not verify account');
    } finally {
      setWSubmitting(false);
    }
  };

  const submitWithdrawal = async () => {
    const amount = parseFloat(wAmount);
    if (!amount || amount < 5) {
      setWError('Minimum withdrawal is GH₵5');
      return;
    }
    if (wallet && amount > wallet.balance) {
      setWError('Insufficient balance');
      return;
    }
    setWSubmitting(true);
    setWError('');
    try {
      await api?.post(`${API_BASE_URL}/wallets/withdraw`, {
        amount,
        method: wMethod,
        accountNumber: wAccountNumber,
        accountName: wAccountName,
        bankCode: wBankCode || undefined,
      });
      setWSuccess(true);
      // Refresh wallet
      const wRes = await api?.get(`${API_BASE_URL}/wallets`);
      setWallet(wRes?.data.data ?? null);
    } catch (err: unknown) {
      setWError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setWSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-surface-950">
        <div className="animate-spin-slow"><Wallet className="h-8 w-8 text-brand-400" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-24 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-surface-950 px-5 py-4">
        <h1 className="text-xl font-bold text-white">Earnings</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Wallet card */}
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-5 shadow-lg shadow-brand-500/20">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-white/70">Available Balance</p>
            <Wallet className="h-5 w-5 text-white/50" />
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {formatCurrency(wallet?.balance ?? 0)}
          </p>
          <p className="text-sm text-white/60 mb-5">
            Total earned: {formatCurrency(wallet?.totalEarned ?? 0)}
          </p>
          <Button
            onClick={openWithdraw}
            className="w-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border-0"
            size="lg"
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Withdraw Funds
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-2xl p-4">
            <TrendingUp className="h-5 w-5 text-accent-400 mb-2" />
            <p className="text-lg font-bold text-white">{formatCurrency(wallet?.totalEarned ?? 0)}</p>
            <p className="text-xs text-surface-400">Total Earnings</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <ArrowUpRight className="h-5 w-5 text-amber-400 mb-2" />
            <p className="text-lg font-bold text-white">{formatCurrency(wallet?.totalWithdrawn ?? 0)}</p>
            <p className="text-xs text-surface-400">Withdrawn</p>
          </div>
        </div>

        {/* Transaction history */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="py-10 text-center">
              <DollarSign className="h-10 w-10 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400 text-sm">No transactions yet</p>
            </div>
          ) : (
            transactions.map((tx) => {
              const isCredit = tx.type === 'DELIVERY_EARNING' || tx.type === 'TIP' || tx.type === 'BONUS' || tx.type === 'DEPOSIT' || tx.type === 'REFERRAL_COMMISSION' || tx.type === 'REFUND';
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                    isCredit ? 'bg-accent-500/10' : 'bg-amber-500/10'
                  }`}>
                    {isCredit
                      ? <ArrowDownLeft className="h-4 w-4 text-accent-400" />
                      : <ArrowUpRight className="h-4 w-4 text-amber-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{tx.description ?? tx.type}</p>
                    <p className="text-xs text-surface-500">{timeAgo(new Date(tx.createdAt))}</p>
                  </div>
                  <p className={`text-sm font-semibold ${isCredit ? 'text-accent-400' : 'text-white'}`}>
                    {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Withdrawal dialog */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="bg-surface-900 border-surface-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {wSuccess ? 'Withdrawal Submitted' : 'Withdraw Funds'}
            </DialogTitle>
          </DialogHeader>

          {wSuccess ? (
            <div className="py-6 text-center">
              <CheckCircle className="h-14 w-14 text-accent-400 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">Request submitted!</p>
              <p className="text-surface-400 text-sm">Your withdrawal is being processed.</p>
              <Button className="mt-6 bg-brand-500 hover:bg-brand-600" onClick={() => setShowWithdraw(false)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="py-2 space-y-4">
              {wError && (
                <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-danger-300">{wError}</p>
                </div>
              )}

              {wStep === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-surface-300">Choose withdrawal method</p>
                  {([
                    { method: 'MOBILE_MONEY' as WithdrawMethod, label: 'Mobile Money', icon: Smartphone, desc: 'MoMo, Vodafone Cash, AirtelTigo' },
                    { method: 'BANK_TRANSFER' as WithdrawMethod, label: 'Bank Transfer', icon: Building2, desc: 'Transfer to bank account' },
                  ]).map(({ method, label, icon: Icon, desc }) => (
                    <button
                      key={method}
                      onClick={() => { setWMethod(method); setWStep(1); }}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                        wMethod === method ? 'border-brand-500 bg-brand-500/10' : 'border-surface-700 bg-surface-800 hover:bg-surface-700'
                      }`}
                    >
                      <Icon className="h-5 w-5 text-brand-400" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">{label}</p>
                        <p className="text-xs text-surface-400">{desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-surface-500 ml-auto" />
                    </button>
                  ))}
                </div>
              )}

              {wStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-surface-300">Enter account details</p>
                  {wMethod === 'BANK_TRANSFER' && (
                    <div>
                      <label className="block text-xs text-surface-400 mb-1.5">Bank</label>
                      <select
                        value={wBankCode}
                        onChange={(e) => setWBankCode(e.target.value)}
                        className="w-full py-3 px-4 rounded-xl bg-surface-800 border border-surface-700 text-white outline-none focus:border-brand-500 appearance-none"
                      >
                        <option value="">Select bank</option>
                        {banks.map((b) => (
                          <option key={b.code} value={b.code}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-surface-400 mb-1.5">
                      {wMethod === 'MOBILE_MONEY' ? 'Phone Number' : 'Account Number'}
                    </label>
                    <Input
                      value={wAccountNumber}
                      onChange={(e) => setWAccountNumber(e.target.value)}
                      placeholder={wMethod === 'MOBILE_MONEY' ? '024XXXXXXX' : 'Enter account number'}
                      className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-surface-700 text-surface-300" onClick={() => setWStep(0)}>
                      Back
                    </Button>
                    <Button className="flex-1 bg-brand-500 hover:bg-brand-600" onClick={resolveAccount} loading={wSubmitting}>
                      Verify
                    </Button>
                  </div>
                </div>
              )}

              {wStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/20">
                    <p className="text-xs text-surface-400">Account verified</p>
                    <p className="text-sm font-medium text-white">{wAccountName}</p>
                    <p className="text-xs text-surface-400">{wAccountNumber}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-surface-400 mb-1.5">Amount (GH₵)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={wAmount}
                      onChange={(e) => setWAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-surface-800 border-surface-700 text-white text-xl font-bold placeholder:text-surface-500"
                    />
                    <p className="text-xs text-surface-400 mt-1">
                      Available: {formatCurrency(wallet?.balance ?? 0)} · Min: GH₵5
                    </p>
                  </div>
                  {/* Quick amounts */}
                  <div className="flex gap-2">
                    {[50, 100, 200].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setWAmount(String(amt))}
                        className="flex-1 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white hover:bg-surface-700"
                      >
                        GH₵{amt}
                      </button>
                    ))}
                    <button
                      onClick={() => setWAmount(String(wallet?.balance ?? 0))}
                      className="flex-1 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-brand-400 hover:bg-surface-700"
                    >
                      All
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-surface-700 text-surface-300" onClick={() => setWStep(1)}>
                      Back
                    </Button>
                    <Button className="flex-1 bg-accent-500 hover:bg-accent-600" onClick={submitWithdrawal} loading={wSubmitting}>
                      Withdraw
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
