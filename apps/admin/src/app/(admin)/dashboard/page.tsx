'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@riderguy/ui';
import { useAuth } from '@riderguy/auth';
import { getApiClient } from '@riderguy/auth';

interface DashboardStats {
  riders: { total: number; active: number; online: number; pendingApplications: number };
  clients: { total: number };
  orders: { today: number; thisWeek: number; thisMonth: number; total: number; activeDeliveries: number; deliveredToday: number };
  revenue: { today: number; thisMonth: number; total: number };
  pendingWithdrawals: number;
  activeZones: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 0 }).format(amount);
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get('/admin/dashboard-stats');
      setStats(data.data);
      setError('');
    } catch {
      setError('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error || 'No data available'}</p>
        <button onClick={fetchStats} className="text-brand-500 underline text-sm">Retry</button>
      </div>
    );
  }

  const kpiCards = [
    { title: 'Online Riders', value: stats.riders.online.toString(), desc: `${stats.riders.active} activated / ${stats.riders.total} total`, icon: '🛵', color: 'bg-green-50 text-green-700' },
    { title: 'Orders Today', value: stats.orders.today.toString(), desc: `${stats.orders.deliveredToday} delivered`, icon: '📦', color: 'bg-blue-50 text-blue-700' },
    { title: 'Revenue Today', value: formatCurrency(stats.revenue.today), desc: `${formatCurrency(stats.revenue.thisMonth)} this month`, icon: '💰', color: 'bg-emerald-50 text-emerald-700' },
    { title: 'Active Deliveries', value: stats.orders.activeDeliveries.toString(), desc: 'In progress now', icon: '🚀', color: 'bg-orange-50 text-orange-700' },
  ];

  const secondaryCards = [
    { title: 'Pending Applications', value: stats.riders.pendingApplications, icon: '📋' },
    { title: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: '🏦' },
    { title: 'Total Clients', value: stats.clients.total, icon: '👥' },
    { title: 'Active Zones', value: stats.activeZones, icon: '📍' },
    { title: 'Orders This Week', value: stats.orders.thisWeek, icon: '📊' },
    { title: 'All-Time Revenue', value: formatCurrency(stats.revenue.total), icon: '💎' },
  ];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Real-time platform overview</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span>🔄</span> Refresh
        </button>
      </div>

      {/* Primary KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {card.title}
                </CardTitle>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg ${card.color}`}>
                  {card.icon}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              <p className="mt-1 text-xs text-gray-400">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {secondaryCards.map((card) => (
          <Card key={card.title} className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">{card.icon}</span>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">{card.title}</p>
                <p className="text-lg font-bold text-gray-900">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.riders.pendingApplications > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-amber-900">
                    {stats.riders.pendingApplications} pending application{stats.riders.pendingApplications !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-amber-700">Rider documents need review</p>
                </div>
                <a href="/dashboard/riders" className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
                  Review
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {stats.pendingWithdrawals > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-blue-900">
                    {stats.pendingWithdrawals} pending withdrawal{stats.pendingWithdrawals !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-blue-700">Payouts waiting for approval</p>
                </div>
                <a href="/dashboard/financials" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  Review
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Analytics</p>
                <p className="text-xs text-gray-500">View charts and trends</p>
              </div>
              <a href="/dashboard/analytics" className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900">
                View
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
