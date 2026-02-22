'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Spinner,
  Input,
  Label,
} from '@riderguy/ui';

// ============================================================
// Rider Earnings / Wallet — Sprint 6
// Shows balance, recent transactions, withdrawal history,
// and full withdrawal flow (bank selection → account verify
// → amount → confirm).
// ============================================================

interface Wallet {
  id: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  totalTips: number;
  currency: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

interface WithdrawalRecord {
  id: string;
  amount: number;
  currency: string;
  method: string;
  destination: string;
  destinationName: string;
  status: string;
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
}

interface Bank {
  name: string;
  code: string;
  type: string;
  currency: string;
}

/* ── SVG icon components for transaction types ── */
function DeliveryIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><path d="M15 5h4l3 8v5h-3M1 8h10v8H8"/></svg>; }
function TipIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>; }
function BonusIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function WithdrawIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 100 4h4v-4h-4z"/></svg>; }
function RefundIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>; }
function DefaultTxIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>; }

const TX_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  DELIVERY_EARNING: { label: 'Delivery', icon: <DeliveryIcon />, color: 'text-accent-600', bg: 'bg-accent-50' },
  TIP: { label: 'Tip', icon: <TipIcon />, color: 'text-purple-600', bg: 'bg-purple-50' },
  BONUS: { label: 'Bonus', icon: <BonusIcon />, color: 'text-warning-600', bg: 'bg-warning-50' },
  WITHDRAWAL: { label: 'Withdrawal', icon: <WithdrawIcon />, color: 'text-danger-600', bg: 'bg-danger-50' },
  REFUND: { label: 'Refund', icon: <RefundIcon />, color: 'text-orange-600', bg: 'bg-orange-50' },
  COMMISSION_DEDUCTION: { label: 'Commission', icon: <DefaultTxIcon />, color: 'text-surface-500', bg: 'bg-surface-50' },
  ADJUSTMENT: { label: 'Adjustment', icon: <DefaultTxIcon />, color: 'text-surface-600', bg: 'bg-surface-50' },
};

const WITHDRAWAL_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PENDING: { label: 'Pending', color: 'bg-warning-50 text-warning-700', dot: 'bg-warning-500' },
  PROCESSING: { label: 'Processing', color: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
  COMPLETED: { label: 'Completed', color: 'bg-accent-50 text-accent-700', dot: 'bg-accent-500' },
  FAILED: { label: 'Failed', color: 'bg-danger-50 text-danger-700', dot: 'bg-danger-500' },
  CANCELLED: { label: 'Cancelled', color: 'bg-surface-100 text-surface-600', dot: 'bg-surface-400' },
};

const MIN_WITHDRAWAL = 500;

type Tab = 'transactions' | 'withdrawals';
type WithdrawStep = 'bank' | 'account' | 'amount' | 'confirm';

export default function EarningsPage() {
  const router = useRouter();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Withdrawal modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('bank');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get('/wallets');
      setWallet(data.data);
    } catch {
      // Wallet not created yet
    }
  }, []);

  const fetchTransactions = useCallback(async (p = 1) => {
    try {
      const api = getApiClient();
      const { data } = await api.get(`/wallets/transactions?page=${p}&limit=20`);
      setTransactions(data.data ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch {
      // No transactions
    }
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get('/payments/withdrawals?limit=50');
      setWithdrawals(data.data ?? []);
    } catch {
      // No withdrawals
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchWallet(), fetchTransactions(1), fetchWithdrawals()]).finally(() =>
      setLoading(false),
    );
  }, [fetchWallet, fetchTransactions, fetchWithdrawals]);

  useEffect(() => {
    if (page > 1) fetchTransactions(page);
  }, [page, fetchTransactions]);

  // ── Bank list ──
  async function loadBanks() {
    if (banks.length > 0) return;
    try {
      const api = getApiClient();
      const { data } = await api.get('/payments/banks');
      setBanks(data.data ?? []);
    } catch {
      // Fallback empty
    }
  }

  // ── Resolve account ──
  async function resolveAccount() {
    if (!selectedBank || accountNumber.length !== 10) return;
    setResolving(true);
    setResolveError('');
    setAccountName('');
    try {
      const api = getApiClient();
      const { data } = await api.post('/payments/resolve-account', {
        accountNumber,
        bankCode: selectedBank.code,
      });
      setAccountName(data.data.accountName);
      setWithdrawStep('amount');
    } catch {
      setResolveError('Could not verify account. Please check the details.');
    } finally {
      setResolving(false);
    }
  }

  // ── Submit withdrawal ──
  async function submitWithdrawal() {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < MIN_WITHDRAWAL) return;
    if (!wallet || amount > wallet.balance) return;

    setSubmittingWithdrawal(true);
    setWithdrawError('');
    try {
      const api = getApiClient();
      await api.post('/wallets/withdraw', {
        amount,
        method: 'BANK_TRANSFER',
        destination: accountNumber,
        destinationName: accountName,
        bankCode: selectedBank?.code,
      });
      setWithdrawSuccess(true);
      // Refresh wallet + withdrawals
      fetchWallet();
      fetchWithdrawals();
    } catch (err: any) {
      setWithdrawError(
        err.response?.data?.error?.message || 'Withdrawal request failed',
      );
    } finally {
      setSubmittingWithdrawal(false);
    }
  }

  function openWithdrawModal() {
    setShowWithdrawModal(true);
    setWithdrawStep('bank');
    setSelectedBank(null);
    setAccountNumber('');
    setAccountName('');
    setBankSearch('');
    setWithdrawAmount('');
    setWithdrawError('');
    setWithdrawSuccess(false);
    loadBanks();
  }

  function closeWithdrawModal() {
    setShowWithdrawModal(false);
  }

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 dash-page-enter">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 100 4h4v-4h-4z"/></svg>
        </div>
        <h2 className="mt-3 text-base font-semibold text-surface-900">No Earnings Yet</h2>
        <p className="mt-1 text-sm text-surface-500 text-center">
          Complete your first delivery to start earning!
        </p>
        <Button
          className="mt-5 bg-surface-900 hover:bg-surface-800 rounded-xl h-12 px-8"
          onClick={() => router.push('/dashboard/jobs')}
        >
          Find Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="dash-page-enter pb-8">
      {/* ── Balance Hero ── */}
      <div className="bg-gradient-to-br from-surface-900 via-surface-800 to-brand-900 px-4 pt-6 pb-8 -mx-0">
        <p className="text-sm text-white/60">Available Balance</p>
        <p className="text-4xl font-bold text-white mt-1">
          GH₵{wallet.balance.toLocaleString()}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Earned', value: wallet.totalEarned },
            { label: 'Tips', value: wallet.totalTips ?? 0 },
            { label: 'Withdrawn', value: wallet.totalWithdrawn },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/10 backdrop-blur-sm p-3">
              <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{s.label}</p>
              <p className="text-sm font-bold text-white mt-0.5">GH₵{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Withdraw button */}
        <Button
          className="w-full mt-5 bg-white text-surface-900 hover:bg-surface-50 rounded-xl h-12 font-bold shadow-elevated"
          disabled={wallet.balance < MIN_WITHDRAWAL}
          onClick={openWithdrawModal}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 100 4h4v-4h-4z"/></svg>
          Withdraw to Bank
        </Button>
        {wallet.balance > 0 && wallet.balance < MIN_WITHDRAWAL && (
          <p className="text-[10px] text-white/40 text-center mt-2">
            Minimum withdrawal: GH₵{MIN_WITHDRAWAL.toLocaleString()}
          </p>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="px-4 pt-4">
        <div className="flex rounded-xl bg-surface-100 p-1">
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
              activeTab === 'transactions'
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-500'
            }`}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
          </button>
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all relative ${
              activeTab === 'withdrawals'
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-500'
            }`}
            onClick={() => setActiveTab('withdrawals')}
          >
            Withdrawals
            {withdrawals.filter((w) => w.status === 'PENDING').length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-500 px-1 text-[10px] font-bold text-white">
                {withdrawals.filter((w) => w.status === 'PENDING').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Transactions Tab ── */}
      {activeTab === 'transactions' && (
        <div className="px-4 pt-3">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <p className="mt-2 text-sm text-surface-500">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2 dash-stagger-in">
              {transactions.map((tx) => {
                const config = TX_TYPE_CONFIG[tx.type] ?? {
                  label: tx.type,
                  icon: <DefaultTxIcon />,
                  color: 'text-surface-600',
                  bg: 'bg-surface-50',
                };
                const isDebit = tx.amount < 0;
                return (
                  <div key={tx.id} className="flex items-center gap-3 rounded-2xl bg-white shadow-card p-3.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bg}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-900">{config.label}</p>
                      <p className="text-xs text-surface-500 truncate">{tx.description}</p>
                      <p className="text-[10px] text-surface-400">
                        {new Date(tx.createdAt).toLocaleDateString('en-GH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isDebit ? 'text-danger-600' : 'text-accent-600'}`}>
                        {isDebit ? '' : '+'}GH₵{Math.abs(tx.amount).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-surface-400">
                        Bal: GH₵{tx.balanceAfter.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-surface-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Withdrawals Tab ── */}
      {activeTab === 'withdrawals' && (
        <div className="px-4 pt-3">
          {withdrawals.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/></svg>
              </div>
              <p className="mt-2 text-sm text-surface-500">No withdrawal history</p>
            </div>
          ) : (
            <div className="space-y-2 dash-stagger-in">
              {withdrawals.map((w) => {
                const statusConf = WITHDRAWAL_STATUS_CONFIG[w.status] ?? {
                  label: w.status,
                  color: 'bg-surface-100 text-surface-600',
                  dot: 'bg-surface-400',
                };
                return (
                  <div key={w.id} className="rounded-2xl bg-white shadow-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-surface-900">
                          GH₵{w.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-surface-500 truncate mt-0.5">
                          {w.destinationName} · {w.destination}
                        </p>
                        <p className="text-[10px] text-surface-400 mt-0.5">
                          {new Date(w.createdAt).toLocaleDateString('en-GH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusConf.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusConf.dot}`} />
                        {statusConf.label}
                      </span>
                    </div>
                    {w.failureReason && (
                      <p className="mt-2 rounded-lg bg-danger-50 px-3 py-1.5 text-xs text-danger-600">
                        {w.failureReason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
           Withdrawal Modal — Bottom sheet style
         ═══════════════════════════════════════════ */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white max-h-[85vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-surface-100 px-4 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-surface-900">
                {withdrawSuccess
                  ? 'Withdrawal Requested'
                  : withdrawStep === 'bank'
                  ? 'Select Your Bank'
                  : withdrawStep === 'account'
                  ? 'Enter Account Details'
                  : withdrawStep === 'amount'
                  ? 'Enter Amount'
                  : 'Confirm Withdrawal'}
              </h3>
              <button
                onClick={closeWithdrawModal}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-100 text-surface-500 hover:bg-surface-200 transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-4">
              {/* ── Success state ── */}
              {withdrawSuccess && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-100 auth-scale-in">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p className="text-lg font-bold text-surface-900">Request Submitted!</p>
                  <p className="text-center text-sm text-surface-500">
                    Your withdrawal of GH₵{parseFloat(withdrawAmount).toLocaleString()} to{' '}
                    {accountName} is being processed.
                  </p>
                  <Button className="mt-2 bg-surface-900 hover:bg-surface-800 rounded-xl h-12 px-8" onClick={closeWithdrawModal}>
                    Done
                  </Button>
                </div>
              )}

              {/* ── Step 1: Bank Selection ── */}
              {!withdrawSuccess && withdrawStep === 'bank' && (
                <div>
                  <Input
                    placeholder="Search banks..."
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    className="mb-3 rounded-xl"
                  />
                  {banks.length === 0 ? (
                    <div className="flex justify-center py-8">
                      <Spinner className="h-6 w-6 text-brand-500" />
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                      {filteredBanks.map((bank) => (
                        <button
                          key={bank.code}
                          className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-all ${
                            selectedBank?.code === bank.code
                              ? 'bg-brand-50 text-brand-700 font-semibold ring-1 ring-brand-200'
                              : 'text-surface-700 hover:bg-surface-50'
                          }`}
                          onClick={() => {
                            setSelectedBank(bank);
                            setWithdrawStep('account');
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-100">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v4"/><path d="M12 14v4"/><path d="M16 14v4"/></svg>
                            </div>
                            {bank.name}
                          </div>
                        </button>
                      ))}
                      {filteredBanks.length === 0 && (
                        <p className="text-center text-sm text-surface-400 py-4">
                          No banks found
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 2: Account Number ── */}
              {!withdrawSuccess && withdrawStep === 'account' && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-surface-50 p-3">
                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Selected Bank</p>
                    <p className="text-sm font-semibold text-surface-900 mt-0.5">
                      {selectedBank?.name}
                    </p>
                    <button
                      className="text-xs text-brand-500 font-medium mt-1"
                      onClick={() => setWithdrawStep('bank')}
                    >
                      Change bank
                    </button>
                  </div>

                  <div>
                    <Label htmlFor="accountNumber" className="text-xs font-semibold text-surface-600">Account Number</Label>
                    <Input
                      id="accountNumber"
                      maxLength={10}
                      placeholder="0123456789"
                      className="mt-1.5 rounded-xl"
                      value={accountNumber}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '');
                        setAccountNumber(v);
                        setResolveError('');
                        setAccountName('');
                      }}
                    />
                  </div>

                  {resolveError && (
                    <p className="text-sm text-danger-600">{resolveError}</p>
                  )}

                  <Button
                    className="w-full bg-surface-900 hover:bg-surface-800 rounded-xl h-12"
                    disabled={accountNumber.length !== 10 || resolving}
                    onClick={resolveAccount}
                  >
                    {resolving ? <Spinner className="h-4 w-4" /> : 'Verify Account'}
                  </Button>
                </div>
              )}

              {/* ── Step 3: Amount ── */}
              {!withdrawSuccess && withdrawStep === 'amount' && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-accent-50 border border-accent-100 p-3">
                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Verified Account</p>
                    <p className="text-sm font-bold text-accent-700 mt-0.5">{accountName}</p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {selectedBank?.name} · {accountNumber}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="withdrawAmount" className="text-xs font-semibold text-surface-600">
                      Amount (GH₵{MIN_WITHDRAWAL.toLocaleString()} — GH₵
                      {wallet.balance.toLocaleString()})
                    </Label>
                    <Input
                      id="withdrawAmount"
                      type="number"
                      min={MIN_WITHDRAWAL}
                      max={wallet.balance}
                      placeholder={`Min GH₵${MIN_WITHDRAWAL.toLocaleString()}`}
                      className="mt-1.5 rounded-xl"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>

                  {/* Quick amount presets */}
                  <div className="flex gap-2 flex-wrap">
                    {[1000, 2000, 5000, 10000].filter((a) => a <= wallet.balance).map((a) => (
                      <button
                        key={a}
                        className={`rounded-xl border-2 px-3.5 py-1.5 text-xs font-semibold transition-all ${
                          withdrawAmount === String(a)
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-surface-200 text-surface-600 hover:border-surface-300'
                        }`}
                        onClick={() => setWithdrawAmount(String(a))}
                      >
                        GH₵{a.toLocaleString()}
                      </button>
                    ))}
                    <button
                      className="rounded-xl border-2 border-surface-200 px-3.5 py-1.5 text-xs font-semibold text-surface-600 hover:border-surface-300"
                      onClick={() => setWithdrawAmount(String(wallet.balance))}
                    >
                      All (GH₵{wallet.balance.toLocaleString()})
                    </button>
                  </div>

                  <Button
                    className="w-full bg-surface-900 hover:bg-surface-800 rounded-xl h-12"
                    disabled={
                      !withdrawAmount ||
                      parseFloat(withdrawAmount) < MIN_WITHDRAWAL ||
                      parseFloat(withdrawAmount) > wallet.balance
                    }
                    onClick={() => setWithdrawStep('confirm')}
                  >
                    Continue
                  </Button>
                </div>
              )}

              {/* ── Step 4: Confirm withdrawal ── */}
              {!withdrawSuccess && withdrawStep === 'confirm' && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-surface-50 overflow-hidden">
                    {[
                      { label: 'Bank', value: selectedBank?.name },
                      { label: 'Account', value: accountNumber },
                      { label: 'Name', value: accountName },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between px-4 py-3 border-b border-surface-100 last:border-b-0">
                        <span className="text-sm text-surface-500">{row.label}</span>
                        <span className="text-sm font-semibold text-surface-900">{row.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-3 bg-brand-50">
                      <span className="text-sm font-medium text-brand-700">Amount</span>
                      <span className="text-lg font-bold text-brand-700">
                        GH₵{parseFloat(withdrawAmount).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-surface-400 text-center">
                    Withdrawals are typically processed within 24 hours.
                  </p>

                  {withdrawError && (
                    <p className="text-sm text-danger-600 text-center">{withdrawError}</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => setWithdrawStep('amount')}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-surface-900 hover:bg-surface-800 rounded-xl h-12"
                      disabled={submittingWithdrawal}
                      onClick={submitWithdrawal}
                    >
                      {submittingWithdrawal ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        'Confirm Withdrawal'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
