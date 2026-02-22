'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
  Separator,
  Badge,
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

const TX_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  DELIVERY_EARNING: { label: 'Delivery', icon: '🛵', color: 'text-green-600' },
  TIP: { label: 'Tip', icon: '🎁', color: 'text-purple-600' },
  BONUS: { label: 'Bonus', icon: '⭐', color: 'text-yellow-600' },
  WITHDRAWAL: { label: 'Withdrawal', icon: '🏦', color: 'text-red-600' },
  REFUND: { label: 'Refund', icon: '↩️', color: 'text-orange-600' },
  COMMISSION_DEDUCTION: { label: 'Commission', icon: '📊', color: 'text-gray-500' },
  ADJUSTMENT: { label: 'Adjustment', icon: '📝', color: 'text-gray-600' },
};

const WITHDRAWAL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
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
      <div className="p-4 text-center">
        <p className="text-3xl mb-3">💰</p>
        <h2 className="text-lg font-semibold text-gray-900">No Earnings Yet</h2>
        <p className="mt-1 text-sm text-gray-500">
          Complete your first delivery to start earning!
        </p>
        <Button
          className="mt-4 bg-brand-500 hover:bg-brand-600"
          onClick={() => router.push('/dashboard/jobs')}
        >
          Find Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-2 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Dashboard
        </button>
        <h1 className="text-xl font-bold text-gray-900">Earnings</h1>
      </div>

      {/* Balance Card */}
      <Card className="mb-6 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
        <CardContent className="pt-6 pb-6">
          <p className="text-sm text-white/80">Available Balance</p>
          <p className="text-3xl font-bold mt-1">
            GH₵{wallet.balance.toLocaleString()}
          </p>
          <Separator className="my-4 bg-white/20" />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-white/70">Total Earned</p>
              <p className="text-sm font-semibold">
                GH₵{wallet.totalEarned.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/70">Tips</p>
              <p className="text-sm font-semibold">
                GH₵{(wallet.totalTips ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/70">Withdrawn</p>
              <p className="text-sm font-semibold">
                GH₵{wallet.totalWithdrawn.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Withdraw button */}
      <Button
        className="w-full mb-6 bg-brand-500 hover:bg-brand-600"
        disabled={wallet.balance < MIN_WITHDRAWAL}
        onClick={openWithdrawModal}
      >
        🏦 Withdraw to Bank Account
      </Button>
      {wallet.balance > 0 && wallet.balance < MIN_WITHDRAWAL && (
        <p className="text-xs text-center text-gray-400 -mt-4 mb-6">
          Minimum withdrawal: GH₵{MIN_WITHDRAWAL.toLocaleString()}
        </p>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'withdrawals'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('withdrawals')}
        >
          Withdrawals {withdrawals.filter((w) => w.status === 'PENDING').length > 0 && (
            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[10px] text-white">
              {withdrawals.filter((w) => w.status === 'PENDING').length}
            </span>
          )}
        </button>
      </div>

      {/* ── Transactions Tab ── */}
      {activeTab === 'transactions' && (
        <Card>
          <CardContent className="pt-4">
            {transactions.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">
                No transactions yet
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const config = TX_TYPE_CONFIG[tx.type] ?? {
                    label: tx.type,
                    icon: '💰',
                    color: 'text-gray-600',
                  };
                  const isDebit = tx.amount < 0;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-3">
                      <span className="text-xl">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {config.label}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {tx.description}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.createdAt).toLocaleDateString('en-GH', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-semibold ${
                            isDebit ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {isDebit ? '' : '+'}GH₵{Math.abs(tx.amount).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-400">
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
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Withdrawals Tab ── */}
      {activeTab === 'withdrawals' && (
        <Card>
          <CardContent className="pt-4">
            {withdrawals.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">
                No withdrawal history
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {withdrawals.map((w) => {
                  const statusConf = WITHDRAWAL_STATUS_CONFIG[w.status] ?? {
                    label: w.status,
                    color: 'bg-gray-100 text-gray-600',
                  };
                  return (
                    <div key={w.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            GH₵{w.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {w.destinationName} • {w.destination}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(w.createdAt).toLocaleDateString('en-GH', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Badge className={`${statusConf.color} border-0 text-xs`}>
                          {statusConf.label}
                        </Badge>
                      </div>
                      {w.failureReason && (
                        <p className="mt-1 text-xs text-red-500">
                          {w.failureReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════
           Withdrawal Modal
         ═══════════════════════════════════════════ */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white max-h-[85vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl sm:rounded-t-2xl">
              <h3 className="font-semibold text-gray-900">
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
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-4">
              {/* ── Success state ── */}
              {withdrawSuccess && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <span className="text-3xl">✅</span>
                  </div>
                  <p className="text-lg font-semibold text-green-700">Request Submitted!</p>
                  <p className="text-center text-sm text-gray-500">
                    Your withdrawal of GH₵{parseFloat(withdrawAmount).toLocaleString()} to{' '}
                    {accountName} is being processed.
                  </p>
                  <Button className="mt-2 bg-brand-500" onClick={closeWithdrawModal}>
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
                    className="mb-3"
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
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            selectedBank?.code === bank.code
                              ? 'bg-brand-50 text-brand-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            setSelectedBank(bank);
                            setWithdrawStep('account');
                          }}
                        >
                          🏦 {bank.name}
                        </button>
                      ))}
                      {filteredBanks.length === 0 && (
                        <p className="text-center text-sm text-gray-400 py-4">
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
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Selected Bank</p>
                    <p className="text-sm font-medium text-gray-800">
                      🏦 {selectedBank?.name}
                    </p>
                    <button
                      className="text-xs text-brand-500 hover:underline mt-1"
                      onClick={() => setWithdrawStep('bank')}
                    >
                      Change bank
                    </button>
                  </div>

                  <div>
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      maxLength={10}
                      placeholder="0123456789"
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
                    <p className="text-sm text-red-600">{resolveError}</p>
                  )}

                  <Button
                    className="w-full bg-brand-500 hover:bg-brand-600"
                    disabled={accountNumber.length !== 10 || resolving}
                    onClick={resolveAccount}
                  >
                    {resolving ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      'Verify Account'
                    )}
                  </Button>
                </div>
              )}

              {/* ── Step 3: Amount ── */}
              {!withdrawSuccess && withdrawStep === 'amount' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-xs text-gray-500">Verified Account</p>
                    <p className="text-sm font-semibold text-green-700">{accountName}</p>
                    <p className="text-xs text-gray-500">
                      {selectedBank?.name} • {accountNumber}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="withdrawAmount">
                      Amount (GH₵{MIN_WITHDRAWAL.toLocaleString()} — GH₵
                      {wallet.balance.toLocaleString()})
                    </Label>
                    <Input
                      id="withdrawAmount"
                      type="number"
                      min={MIN_WITHDRAWAL}
                      max={wallet.balance}
                      placeholder={`Min GH₵${MIN_WITHDRAWAL.toLocaleString()}`}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>

                  {/* Quick amount presets */}
                  <div className="flex gap-2 flex-wrap">
                    {[1000, 2000, 5000, 10000].filter((a) => a <= wallet.balance).map((a) => (
                      <button
                        key={a}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          withdrawAmount === String(a)
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                        onClick={() => setWithdrawAmount(String(a))}
                      >
                        GH₵{a.toLocaleString()}
                      </button>
                    ))}
                    <button
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300"
                      onClick={() => setWithdrawAmount(String(wallet.balance))}
                    >
                      All (GH₵{wallet.balance.toLocaleString()})
                    </button>
                  </div>

                  <Button
                    className="w-full bg-brand-500 hover:bg-brand-600"
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
                  <div className="rounded-lg border border-gray-200 divide-y">
                    <div className="flex justify-between p-3">
                      <span className="text-sm text-gray-500">Bank</span>
                      <span className="text-sm font-medium text-gray-800">
                        {selectedBank?.name}
                      </span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-sm text-gray-500">Account</span>
                      <span className="text-sm font-medium text-gray-800">
                        {accountNumber}
                      </span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-sm text-gray-500">Name</span>
                      <span className="text-sm font-medium text-gray-800">
                        {accountName}
                      </span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-sm text-gray-500">Amount</span>
                      <span className="text-base font-bold text-brand-600">
                        GH₵{parseFloat(withdrawAmount).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    Withdrawals are typically processed within 24 hours.
                  </p>

                  {withdrawError && (
                    <p className="text-sm text-red-600 text-center">{withdrawError}</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setWithdrawStep('amount')}
                    >
                      ← Back
                    </Button>
                    <Button
                      className="flex-1 bg-brand-500 hover:bg-brand-600"
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
