'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@riderguy/auth';
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
      api.get('/wallets'),
      api.get('/wallets/transactions', { params: { limit: 20 } }),
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
        const res = await api?.get('/payments/banks');
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
      const res = await api.post('/payments/resolve-account', {
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
      await api?.post('/wallets/withdraw', {
        amount,
        method: wMethod,
        accountNumber: wAccountNumber,
        accountName: wAccountName,
        bankCode: wBankCode || undefined,
      });
      setWSuccess(true);
      // Refresh wallet
      const wRes = await api?.get('/wallets');
      setWallet(wRes?.data.data ?? null);
    } catch (err: unknown) {
      setWError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setWSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-page">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-xl scale-150 animate-pulse" />
          <div className="animate-spin-slow"><Wallet className="h-8 w-8 text-brand-400" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-24 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-nav backdrop-blur-xl px-5 pt-4 pb-3">
        <h1 className="text-xl font-bold text-primary">Earnings</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Premium wallet card */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 gradient-brand animate-gradient opacity-90" />
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-black/10 translate-y-1/3 -translate-x-1/4 blur-xl" />
          </div>
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-white/70 font-medium">Available Balance</p>
              <Wallet className="h-5 w-5 text-white/40" />
            </div>
            <p className="text-4xl font-extrabold text-white mb-1 tabular-nums tracking-tight">
              {formatCurrency(wallet?.balance ?? 0)}
            </p>
            <p className="text-sm text-white/50 mb-6">
              Total earned: <span className="text-white/70 font-medium">{formatCurrency(wallet?.totalEarned ?? 0)}</span>
            </p>
            <Button
              onClick={openWithdraw}
              className="w-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm border border-themed font-semibold rounded-xl"
              size="lg"
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Withdraw Funds
            </Button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-elevated rounded-2xl p-4">
            <div className="h-9 w-9 rounded-xl bg-accent-500/10 flex items-center justify-center mb-3">
              <TrendingUp className="h-4.5 w-4.5 text-accent-400" />
            </div>
            <p className="text-lg font-bold text-primary tabular-nums">{formatCurrency(wallet?.totalEarned ?? 0)}</p>
            <p className="text-xs text-subtle mt-0.5">Total Earnings</p>
          </div>
          <div className="glass-elevated rounded-2xl p-4">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
              <ArrowUpRight className="h-4.5 w-4.5 text-amber-400" />
            </div>
            <p className="text-lg font-bold text-primary tabular-nums">{formatCurrency(wallet?.totalWithdrawn ?? 0)}</p>
            <p className="text-xs text-subtle mt-0.5">Withdrawn</p>
          </div>
        </div>

        {/* Transaction history */}
        <div className="glass-elevated rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-themed">
            <h3 className="text-sm font-semibold text-primary">Recent Transactions</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="relative inline-flex mb-3">
                <div className="absolute inset-0 rounded-full bg-surface-500/10 blur-xl scale-150" />
                <div className="relative h-12 w-12 rounded-xl glass flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-subtle" />
                </div>
              </div>
              <p className="text-muted text-sm font-medium">No transactions yet</p>
              <p className="text-subtle text-xs mt-1">Complete deliveries to start earning</p>
            </div>
          ) : (
            transactions.map((tx, idx) => {
              const isCredit = tx.type === 'DELIVERY_EARNING' || tx.type === 'TIP' || tx.type === 'BONUS' || tx.type === 'DEPOSIT' || tx.type === 'REFERRAL_COMMISSION' || tx.type === 'REFUND';
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 px-4 py-3.5 border-b border-themed-subtle last:border-b-0 animate-slide-up"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCredit ? 'bg-accent-500/10' : 'bg-amber-500/10'
                  }`}>
                    {isCredit
                      ? <ArrowDownLeft className="h-4 w-4 text-accent-400" />
                      : <ArrowUpRight className="h-4 w-4 text-amber-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary font-medium truncate">{tx.description ?? tx.type}</p>
                    <p className="text-[10px] text-subtle">{timeAgo(new Date(tx.createdAt))}</p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${isCredit ? 'text-accent-400' : 'text-primary'}`}>
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
        <DialogContent className="bg-card-strong border-themed-strong max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary">
              {wSuccess ? 'Withdrawal Submitted' : 'Withdraw Funds'}
            </DialogTitle>
          </DialogHeader>

          {wSuccess ? (
            <div className="py-6 text-center">
              <div className="relative inline-flex mb-4">
                <div className="absolute inset-0 rounded-full bg-accent-500/20 blur-xl scale-[2] animate-pulse" />
                <div className="relative h-16 w-16 rounded-full bg-accent-500/15 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-accent-400" />
                </div>
              </div>
              <p className="text-primary font-semibold mb-1">Request submitted!</p>
              <p className="text-muted text-sm">Your withdrawal is being processed.</p>
              <Button className="mt-6 gradient-brand text-white rounded-xl font-semibold" onClick={() => setShowWithdraw(false)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="py-2 space-y-4">
              {wError && (
                <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2 animate-shake">
                  <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-danger-300">{wError}</p>
                </div>
              )}

              {wStep === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-secondary">Choose withdrawal method</p>
                  {([
                    { method: 'MOBILE_MONEY' as WithdrawMethod, label: 'Mobile Money', icon: Smartphone, desc: 'MoMo, Vodafone Cash, AirtelTigo' },
                    { method: 'BANK_TRANSFER' as WithdrawMethod, label: 'Bank Transfer', icon: Building2, desc: 'Transfer to bank account' },
                  ]).map(({ method, label, icon: Icon, desc }) => (
                    <button
                      key={method}
                      onClick={() => { setWMethod(method); setWStep(1); }}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all btn-press ${
                        wMethod === method ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10' : 'border-themed-strong bg-hover-themed hover:bg-skeleton'
                      }`}
                    >
                      <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-brand-400" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-primary">{label}</p>
                        <p className="text-xs text-subtle">{desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-subtle" />
                    </button>
                  ))}
                </div>
              )}

              {wStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-secondary">Enter account details</p>
                  {wMethod === 'BANK_TRANSFER' && (
                    <div>
                      <label className="block text-xs text-muted mb-1.5">Bank</label>
                      <select
                        value={wBankCode}
                        onChange={(e) => setWBankCode(e.target.value)}
                        className="w-full py-3 px-4 rounded-xl bg-card border border-themed-strong text-primary outline-none focus:border-brand-500 appearance-none transition-colors"
                      >
                        <option value="">Select bank</option>
                        {banks.map((b) => (
                          <option key={b.code} value={b.code}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-muted mb-1.5">
                      {wMethod === 'MOBILE_MONEY' ? 'Phone Number' : 'Account Number'}
                    </label>
                    <Input
                      value={wAccountNumber}
                      onChange={(e) => setWAccountNumber(e.target.value)}
                      placeholder={wMethod === 'MOBILE_MONEY' ? '024XXXXXXX' : 'Enter account number'}
                      className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-themed text-secondary rounded-xl" onClick={() => setWStep(0)}>
                      Back
                    </Button>
                    <Button className="flex-1 gradient-brand text-white rounded-xl font-semibold" onClick={resolveAccount} loading={wSubmitting}>
                      Verify
                    </Button>
                  </div>
                </div>
              )}

              {wStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/20">
                    <p className="text-xs text-muted">Account verified</p>
                    <p className="text-sm font-semibold text-primary">{wAccountName}</p>
                    <p className="text-xs text-subtle">{wAccountNumber}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1.5">Amount (GH₵)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={wAmount}
                      onChange={(e) => setWAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-card border-themed-strong text-primary text-xl font-bold placeholder:text-subtle rounded-xl"
                    />
                    <p className="text-xs text-subtle mt-1">
                      Available: {formatCurrency(wallet?.balance ?? 0)} · Min: GH₵5
                    </p>
                  </div>
                  {/* Quick amounts */}
                  <div className="flex gap-2">
                    {[50, 100, 200].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setWAmount(String(amt))}
                        className="flex-1 py-2.5 rounded-xl bg-card border border-themed-strong text-sm text-primary font-medium hover:bg-active-themed transition-colors btn-press"
                      >
                        GH₵{amt}
                      </button>
                    ))}
                    <button
                      onClick={() => setWAmount(String(wallet?.balance ?? 0))}
                      className="flex-1 py-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-sm text-brand-400 font-medium hover:bg-brand-500/20 transition-colors btn-press"
                    >
                      All
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-themed text-secondary rounded-xl" onClick={() => setWStep(1)}>
                      Back
                    </Button>
                    <Button className="flex-1 gradient-accent text-white rounded-xl font-semibold shadow-lg shadow-accent-500/20" onClick={submitWithdrawal} loading={wSubmitting}>
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
