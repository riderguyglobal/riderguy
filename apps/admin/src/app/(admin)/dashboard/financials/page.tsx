'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Spinner,
  Separator,
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
type WithdrawalFilter = 'all' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
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

export default function FinancialsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawalFilter, setWithdrawalFilter] = useState<WithdrawalFilter>('PENDING');
  const [wPage, setWPage] = useState(1);
  const [wTotalPages, setWTotalPages] = useState(1);
  const [tPage, setTPage] = useState(1);
  const [tTotalPages, setTTotalPages] = useState(1);
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get('/payments/admin/stats');
      setStats(data.data);
    } catch {
      /* */
    }
  }, []);

  const fetchWithdrawals = useCallback(
    async (p = 1) => {
      try {
        const api = getApiClient();
        const params: Record<string, unknown> = { page: p, limit: 20 };
        if (withdrawalFilter !== 'all') params.status = withdrawalFilter;
        const { data } = await api.get('/payments/admin/withdrawals', { params });
        setWithdrawals(data.data ?? []);
        setWTotalPages(data.pagination?.totalPages ?? 1);
      } catch {
        /* */
      }
    },
    [withdrawalFilter],
  );

  const fetchTransactions = useCallback(
    async (p = 1) => {
      try {
        const api = getApiClient();
        const params: Record<string, unknown> = { page: p, limit: 20 };
        if (txTypeFilter) params.type = txTypeFilter;
        const { data } = await api.get('/payments/admin/transactions', { params });
        setTransactions(data.data ?? []);
        setTTotalPages(data.pagination?.totalPages ?? 1);
      } catch {
        /* */
      }
    },
    [txTypeFilter],
  );

  useEffect(() => {
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'payouts') fetchWithdrawals(wPage);
  }, [activeTab, wPage, fetchWithdrawals]);

  useEffect(() => {
    if (activeTab === 'transactions') fetchTransactions(tPage);
  }, [activeTab, tPage, fetchTransactions]);

  // ── Actions ──
  async function approveWithdrawal(id: string) {
    setActionLoading(id);
    try {
      const api = getApiClient();
      await api.post(`/payments/admin/withdrawals/${id}/approve`);
      fetchWithdrawals(wPage);
      fetchStats();
    } catch {
      /* */
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectWithdrawal(id: string) {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setActionLoading(id);
    try {
      const api = getApiClient();
      await api.post(`/payments/admin/withdrawals/${id}/reject`, { reason });
      fetchWithdrawals(wPage);
      fetchStats();
    } catch {
      /* */
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Financials</h1>
        <p className="text-sm text-gray-500">Revenue, payouts, and transaction ledger</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b">
        {[
          { key: 'overview' as Tab, label: 'Overview' },
          { key: 'payouts' as Tab, label: `Payouts ${stats?.pendingWithdrawals ? `(${stats.pendingWithdrawals})` : ''}` },
          { key: 'transactions' as Tab, label: 'Transactions' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(key)}
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
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.pendingWithdrawals}
                </p>
                <p className="text-xs text-gray-400">
                  Awaiting approval
                </p>
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
                <p className="text-xs text-gray-400">
                  {stats.completedWithdrawals} completed
                </p>
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
                    <span className="font-medium">GH₵{stats.totalWithdrawalAmount.toLocaleString()}</span>
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
                    <span className="font-semibold text-brand-600">
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
          <div className="flex gap-2 flex-wrap">
            {(['all', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as WithdrawalFilter[]).map((f) => (
              <button
                key={f}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  withdrawalFilter === f
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => {
                  setWithdrawalFilter(f);
                  setWPage(1);
                }}
              >
                {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Withdrawal list */}
          <Card>
            <CardContent className="pt-4">
              {withdrawals.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  No withdrawals found
                </p>
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
                                    className="bg-green-600 hover:bg-green-700 text-xs h-7"
                                    disabled={actionLoading === w.id}
                                    onClick={() => approveWithdrawal(w.id)}
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
                                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
                                    disabled={actionLoading === w.id}
                                    onClick={() => rejectWithdrawal(w.id)}
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
              {wTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={wPage <= 1}
                    onClick={() => setWPage((p) => p - 1)}
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
                    onClick={() => setWPage((p) => p + 1)}
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
          <div className="flex gap-2 flex-wrap">
            <button
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                !txTypeFilter
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              onClick={() => {
                setTxTypeFilter('');
                setTPage(1);
              }}
            >
              All
            </button>
            {['DELIVERY_EARNING', 'TIP', 'WITHDRAWAL', 'COMMISSION_DEDUCTION', 'REFUND'].map((t) => (
              <button
                key={t}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  txTypeFilter === t
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => {
                  setTxTypeFilter(t);
                  setTPage(1);
                }}
              >
                {TX_TYPE_LABELS[t] ?? t}
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="pt-4">
              {transactions.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  No transactions found
                </p>
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
                              <p className="font-medium text-gray-800 text-xs">
                                {tx.wallet.user.firstName} {tx.wallet.user.lastName}
                              </p>
                              <p className="text-[10px] text-gray-400">{tx.wallet.user.email}</p>
                            </td>
                            <td className="py-2 pr-4">
                              <Badge className="bg-gray-100 text-gray-700 border-0 text-xs">
                                {TX_TYPE_LABELS[tx.type] ?? tx.type}
                              </Badge>
                            </td>
                            <td className={`py-2 pr-4 font-semibold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                              {isDebit ? '' : '+'}GH₵{Math.abs(tx.amount).toLocaleString()}
                            </td>
                            <td className="py-2 pr-4 text-gray-600">
                              GH₵{tx.balanceAfter.toLocaleString()}
                            </td>
                            <td className="py-2 pr-4 text-xs text-gray-500 max-w-[200px] truncate">
                              {tx.description}
                            </td>
                            <td className="py-2 text-xs text-gray-500 whitespace-nowrap">
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

              {tTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={tPage <= 1}
                    onClick={() => setTPage((p) => p - 1)}
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
                    onClick={() => setTPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
