'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  Separator,
  Textarea,
} from '@riderguy/ui';

// ============================================================
// Admin Financials Dashboard — Sprint 6
//
// Revenue overview, payout management, transaction ledger
// ============================================================

interface FinancialStats {
  totalRevenue: number;
  totalCommissions: number;
  pendingWithdrawals: number;
  completedWithdrawals: number;
  totalWithdrawalAmount: number;
  totalDeliveredOrders: number;
  totalPaidOrders: number;
}

interface Withdrawal {
  id: string;
  amount: number;
  currency: string;
  method: string;
  destination: string;
  destinationName: string;
  status: string;
  bankCode?: string;
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
  wallet: {
    user: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
  };
}

interface LedgerTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  wallet: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

type Tab = 'overview' | 'payouts' | 'transactions';
type WithdrawalFilter = 'all' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Rejected / refunded', color: 'bg-gray-100 text-gray-700' },
};

const TX_TYPE_LABELS: Record<string, string> = {
  DELIVERY_EARNING: 'Earning',
  TIP: 'Tip',
  BONUS: 'Bonus',
  COMMISSION_DEDUCTION: 'Commission',
  WITHDRAWAL: 'Withdrawal',
  DEPOSIT: 'Deposit',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
  PENALTY: 'Penalty',
  REFERRAL_COMMISSION: 'Referral',
};

function apiErrorDetails(error: unknown, fallback: string) {
  const candidate = error as {
    response?: {
      data?: { error?: { code?: string; message?: string } | string; message?: string };
    };
    message?: string;
  };
  const responseError = candidate.response?.data?.error;
  return {
    code: typeof responseError === 'object' ? responseError?.code : undefined,
    message:
      (typeof responseError === 'object' ? responseError?.message : responseError) ??
      candidate.response?.data?.message ??
      candidate.message ??
      fallback,
  };
}

export default function FinancialsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [withdrawalFilter, setWithdrawalFilter] = useState<WithdrawalFilter>('PENDING');
  const [wPage, setWPage] = useState(1);
  const [wTotalPages, setWTotalPages] = useState(1);
  const [tPage, setTPage] = useState(1);
  const [tTotalPages, setTTotalPages] = useState(1);
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [decisionTarget, setDecisionTarget] = useState<{
    withdrawal: Withdrawal;
    action: 'approve' | 'reject';
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const withdrawalRequestId = useRef(0);
  const transactionRequestId = useRef(0);

  function beginWithdrawalQueryChange() {
    withdrawalRequestId.current += 1;
    setWithdrawalsLoading(true);
  }

  function beginTransactionQueryChange() {
    transactionRequestId.current += 1;
    setTransactionsLoading(true);
  }

  const fetchStats = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get('/payments/admin/stats');
      setStats(data.data);
    } catch {
      setError('Financial summary could not be loaded.');
    }
  }, []);

  const fetchWithdrawals = useCallback(
    async (p = 1) => {
      const requestId = ++withdrawalRequestId.current;
      setWithdrawalsLoading(true);
      try {
        const api = getApiClient();
        const params: Record<string, unknown> = { page: p, limit: 20 };
        if (withdrawalFilter !== 'all') params.status = withdrawalFilter;
        const { data } = await api.get('/payments/admin/withdrawals', { params });
        if (requestId === withdrawalRequestId.current) {
          setWithdrawals(data.data ?? []);
          setWTotalPages(data.pagination?.totalPages ?? 1);
        }
      } catch {
        if (requestId === withdrawalRequestId.current) {
          setError('Withdrawal requests could not be loaded.');
        }
      } finally {
        if (requestId === withdrawalRequestId.current) {
          setWithdrawalsLoading(false);
        }
      }
    },
    [withdrawalFilter],
  );

  const fetchTransactions = useCallback(
    async (p = 1) => {
      const requestId = ++transactionRequestId.current;
      setTransactionsLoading(true);
      try {
        const api = getApiClient();
        const params: Record<string, unknown> = { page: p, limit: 20 };
        if (txTypeFilter) params.type = txTypeFilter;
        const { data } = await api.get('/payments/admin/transactions', { params });
        if (requestId === transactionRequestId.current) {
          setTransactions(data.data ?? []);
          setTTotalPages(data.pagination?.totalPages ?? 1);
        }
      } catch {
        if (requestId === transactionRequestId.current) {
          setError('The transaction ledger could not be loaded.');
        }
      } finally {
        if (requestId === transactionRequestId.current) {
          setTransactionsLoading(false);
        }
      }
    },
    [txTypeFilter],
  );

  useEffect(() => {
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'payouts') void fetchWithdrawals(wPage);
  }, [activeTab, wPage, fetchWithdrawals]);

  useEffect(() => {
    if (activeTab === 'transactions') void fetchTransactions(tPage);
  }, [activeTab, tPage, fetchTransactions]);

  // ── Actions ──
  async function approveWithdrawal(id: string) {
    setActionLoading(id);
    setError('');
    setNotice('');
    try {
      const api = getApiClient();
      await api.post(`/payments/admin/withdrawals/${id}/approve`);
      await Promise.all([fetchWithdrawals(wPage), fetchStats()]);
      setNotice('Withdrawal approved and queued for processing.');
      setDecisionTarget(null);
    } catch (approvalError: unknown) {
      await Promise.allSettled([fetchWithdrawals(wPage), fetchStats()]);
      const detail = apiErrorDetails(
        approvalError,
        'The payout could not be fully queued. Its current server state has been refreshed.',
      );
      setDecisionTarget(null);
      setRejectionReason('');
      setError(detail.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectWithdrawal(id: string, reason: string) {
    setActionLoading(id);
    setError('');
    setNotice('');
    try {
      const api = getApiClient();
      await api.post(`/payments/admin/withdrawals/${id}/reject`, { reason });
      await Promise.all([fetchWithdrawals(wPage), fetchStats()]);
      setNotice('Withdrawal rejected and returned to the rider wallet.');
      setDecisionTarget(null);
      setRejectionReason('');
    } catch (rejectionError: unknown) {
      await Promise.allSettled([fetchWithdrawals(wPage), fetchStats()]);
      setDecisionTarget(null);
      setRejectionReason('');
      setError(
        apiErrorDetails(
          rejectionError,
          'The withdrawal could not be rejected. Its current server state has been refreshed.',
        ).message,
      );
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="text-brand-500 h-8 w-8" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <p className="admin-kicker">Money operations</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-[#07110D]">
          Financial control
        </h1>
        <p className="mt-2 text-sm text-[#6E7A73]">
          Revenue, rider payouts, and the complete transaction ledger.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {notice}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex border-b">
        {[
          { key: 'overview' as Tab, label: 'Overview' },
          {
            key: 'payouts' as Tab,
            label: `Payouts ${stats?.pendingWithdrawals ? `(${stats.pendingWithdrawals})` : ''}`,
          },
          { key: 'transactions' as Tab, label: 'Transactions' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => {
              if (key === activeTab) return;
              if (key === 'payouts') beginWithdrawalQueryChange();
              if (key === 'transactions') beginTransactionQueryChange();
              setActiveTab(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">
                  GH₵{stats.totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">
                  {stats.totalDeliveredOrders} delivered orders
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Platform Commission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  GH₵{stats.totalCommissions.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">
                  {stats.totalRevenue > 0
                    ? `${((stats.totalCommissions / stats.totalRevenue) * 100).toFixed(1)}% of revenue`
                    : 'No revenue yet'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Pending Payouts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingWithdrawals}</p>
                <p className="text-xs text-gray-400">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">Total Paid Out</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">
                  GH₵{stats.totalWithdrawalAmount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">{stats.completedWithdrawals} completed</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Payment Collection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Delivered Orders</span>
                    <span className="font-medium">{stats.totalDeliveredOrders}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Paid (Online)</span>
                    <span className="font-medium text-green-600">{stats.totalPaidOrders}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cash / Unpaid</span>
                    <span className="font-medium text-orange-600">
                      {stats.totalDeliveredOrders - stats.totalPaidOrders}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Collection Rate</span>
                    <span className="font-semibold">
                      {stats.totalDeliveredOrders > 0
                        ? `${((stats.totalPaidOrders / stats.totalDeliveredOrders) * 100).toFixed(0)}%`
                        : '–'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Payout Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Paid Out</span>
                    <span className="font-medium">
                      GH₵{stats.totalWithdrawalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Completed Payouts</span>
                    <span className="font-medium text-green-600">{stats.completedWithdrawals}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Pending Payouts</span>
                    <span className="font-medium text-yellow-600">{stats.pendingWithdrawals}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Net Retained</span>
                    <span className="text-brand-600 font-semibold">
                      GH₵{(stats.totalRevenue - stats.totalWithdrawalAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Payouts Tab ── */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                'all',
                'PENDING',
                'PROCESSING',
                'COMPLETED',
                'FAILED',
                'CANCELLED',
              ] as WithdrawalFilter[]
            ).map((f) => (
              <button
                key={f}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  withdrawalFilter === f
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => {
                  if (withdrawalFilter === f && wPage === 1) return;
                  beginWithdrawalQueryChange();
                  setWithdrawalFilter(f);
                  setWPage(1);
                }}
              >
                {f === 'all'
                  ? 'All'
                  : f === 'CANCELLED'
                    ? 'Rejected'
                    : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Withdrawal list */}
          <Card>
            <CardContent className="pt-4" aria-busy={withdrawalsLoading}>
              {withdrawalsLoading ? (
                <div
                  role="status"
                  className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-[#6E7A73]"
                >
                  <Spinner className="text-brand-500 h-6 w-6" />
                  Loading payout requests…
                </div>
              ) : withdrawals.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No withdrawals found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-2 pr-4">Rider</th>
                        <th className="pb-2 pr-4">Amount</th>
                        <th className="pb-2 pr-4">Destination</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {withdrawals.map((w) => {
                        const badge = STATUS_BADGE[w.status] ?? {
                          label: w.status,
                          color: 'bg-gray-100 text-gray-600',
                        };
                        return (
                          <tr key={w.id} className="hover:bg-gray-50">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-gray-800">
                                {w.wallet.user.firstName} {w.wallet.user.lastName}
                              </p>
                              <p className="text-xs text-gray-400">{w.wallet.user.phone}</p>
                            </td>
                            <td className="py-3 pr-4 font-semibold">
                              GH₵{w.amount.toLocaleString()}
                            </td>
                            <td className="py-3 pr-4">
                              <p className="text-gray-700">{w.destinationName}</p>
                              <p className="text-xs text-gray-400">{w.destination}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <Badge className={`${badge.color} border-0 text-xs`}>
                                {badge.label}
                              </Badge>
                              {w.failureReason && (
                                <p className="mt-0.5 text-xs text-red-500">{w.failureReason}</p>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-xs text-gray-500">
                              {new Date(w.createdAt).toLocaleDateString('en-GH', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3">
                              {w.status === 'PENDING' && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 bg-green-600 text-xs hover:bg-green-700"
                                    disabled={actionLoading === w.id}
                                    onClick={() =>
                                      setDecisionTarget({ withdrawal: w, action: 'approve' })
                                    }
                                  >
                                    {actionLoading === w.id ? (
                                      <Spinner className="h-3 w-3" />
                                    ) : (
                                      'Approve'
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-red-200 text-xs text-red-600 hover:bg-red-50"
                                    disabled={actionLoading === w.id}
                                    onClick={() =>
                                      setDecisionTarget({ withdrawal: w, action: 'reject' })
                                    }
                                  >
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {!withdrawalsLoading && wTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={wPage <= 1}
                    onClick={() => {
                      beginWithdrawalQueryChange();
                      setWPage((p) => p - 1);
                    }}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-gray-500">
                    Page {wPage} of {wTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={wPage >= wTotalPages}
                    onClick={() => {
                      beginWithdrawalQueryChange();
                      setWPage((p) => p + 1);
                    }}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Transactions Tab ── */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Type filter */}
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                !txTypeFilter
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              onClick={() => {
                if (!txTypeFilter && tPage === 1) return;
                beginTransactionQueryChange();
                setTxTypeFilter('');
                setTPage(1);
              }}
            >
              All
            </button>
            {['DELIVERY_EARNING', 'TIP', 'WITHDRAWAL', 'COMMISSION_DEDUCTION', 'REFUND'].map(
              (t) => (
                <button
                  key={t}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    txTypeFilter === t
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    if (txTypeFilter === t && tPage === 1) return;
                    beginTransactionQueryChange();
                    setTxTypeFilter(t);
                    setTPage(1);
                  }}
                >
                  {TX_TYPE_LABELS[t] ?? t}
                </button>
              ),
            )}
          </div>

          <Card>
            <CardContent className="pt-4" aria-busy={transactionsLoading}>
              {transactionsLoading ? (
                <div
                  role="status"
                  className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-[#6E7A73]"
                >
                  <Spinner className="text-brand-500 h-6 w-6" />
                  Loading transaction ledger…
                </div>
              ) : transactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No transactions found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-2 pr-4">User</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Amount</th>
                        <th className="pb-2 pr-4">Balance After</th>
                        <th className="pb-2 pr-4">Description</th>
                        <th className="pb-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transactions.map((tx) => {
                        const isDebit = tx.amount < 0;
                        return (
                          <tr key={tx.id} className="hover:bg-gray-50">
                            <td className="py-2 pr-4">
                              <p className="text-xs font-medium text-gray-800">
                                {tx.wallet.user.firstName} {tx.wallet.user.lastName}
                              </p>
                              <p className="text-[10px] text-gray-400">{tx.wallet.user.email}</p>
                            </td>
                            <td className="py-2 pr-4">
                              <Badge className="border-0 bg-gray-100 text-xs text-gray-700">
                                {TX_TYPE_LABELS[tx.type] ?? tx.type}
                              </Badge>
                            </td>
                            <td
                              className={`py-2 pr-4 font-semibold ${isDebit ? 'text-red-600' : 'text-green-600'}`}
                            >
                              {isDebit ? '' : '+'}GH₵{Math.abs(tx.amount).toLocaleString()}
                            </td>
                            <td className="py-2 pr-4 text-gray-600">
                              GH₵{tx.balanceAfter.toLocaleString()}
                            </td>
                            <td className="max-w-[200px] truncate py-2 pr-4 text-xs text-gray-500">
                              {tx.description}
                            </td>
                            <td className="whitespace-nowrap py-2 text-xs text-gray-500">
                              {new Date(tx.createdAt).toLocaleDateString('en-GH', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!transactionsLoading && tTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={tPage <= 1}
                    onClick={() => {
                      beginTransactionQueryChange();
                      setTPage((p) => p - 1);
                    }}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-gray-500">
                    Page {tPage} of {tTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={tPage >= tTotalPages}
                    onClick={() => {
                      beginTransactionQueryChange();
                      setTPage((p) => p + 1);
                    }}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        open={Boolean(decisionTarget)}
        onOpenChange={(open) => {
          if (!open && !actionLoading) {
            setDecisionTarget(null);
            setRejectionReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionTarget?.action === 'approve'
                ? 'Approve rider withdrawal?'
                : 'Reject rider withdrawal?'}
            </DialogTitle>
            <DialogDescription>
              {decisionTarget
                ? `${decisionTarget.withdrawal.wallet.user.firstName} ${decisionTarget.withdrawal.wallet.user.lastName} requested ${new Intl.NumberFormat('en-GH', { style: 'currency', currency: decisionTarget.withdrawal.currency || 'GHS' }).format(decisionTarget.withdrawal.amount)}.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {decisionTarget?.action === 'reject' && (
            <div>
              <label
                htmlFor="withdrawal-rejection-reason"
                className="mb-1.5 block text-sm font-semibold text-[#142019]"
              >
                Reason returned to the audit trail
              </label>
              <Textarea
                id="withdrawal-rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain why this payout cannot proceed"
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(actionLoading)}
              onClick={() => {
                setDecisionTarget(null);
                setRejectionReason('');
              }}
            >
              Keep pending
            </Button>
            <Button
              disabled={
                !decisionTarget ||
                Boolean(actionLoading) ||
                (decisionTarget.action === 'reject' && rejectionReason.trim().length < 5)
              }
              className={decisionTarget?.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={() => {
                if (!decisionTarget) return;
                if (decisionTarget.action === 'approve')
                  void approveWithdrawal(decisionTarget.withdrawal.id);
                else void rejectWithdrawal(decisionTarget.withdrawal.id, rejectionReason.trim());
              }}
            >
              {actionLoading
                ? 'Applying…'
                : decisionTarget?.action === 'approve'
                  ? 'Approve payout'
                  : 'Reject & refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
