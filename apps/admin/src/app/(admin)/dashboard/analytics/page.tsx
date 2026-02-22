'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@riderguy/auth';
import { Card, CardContent, Button, Spinner } from '@riderguy/ui';

// ─── Types ──────────────────────────────────────────────────

interface DailyData {
  date: string;
  orders: number;
  deliveries: number;
  revenue: number;
  commission: number;
  newRiders: number;
  newClients: number;
  withdrawals: number;
}

interface AnalyticsResponse {
  daily: DailyData[];
  summary: {
    totalOrders: number;
    totalDeliveries: number;
    totalRevenue: number;
    totalCommission: number;
    totalNewRiders: number;
    totalNewClients: number;
    totalWithdrawals: number;
  };
  completionRate: number;
}

// ─── Helpers ────────────────────────────────────────────────

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

/** Simple CSS bar chart */
function BarChart({
  data,
  getValue,
  label,
  color,
  formatValue,
}: {
  data: DailyData[];
  getValue: (d: DailyData) => number;
  label: string;
  color: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...data.map(getValue), 1);
  const fmt = formatValue ?? ((v: number) => String(v));

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-gray-700">{label}</p>
      <div className="flex items-end gap-[3px]" style={{ height: 160 }}>
        {data.map((d) => {
          const val = getValue(d);
          const h = Math.max((val / max) * 100, 2);
          return (
            <div
              key={d.date}
              className="group relative flex-1 min-w-0"
              title={`${fmtDate(d.date)}: ${fmt(val)}`}
            >
              <div
                className={`w-full rounded-t-sm transition-opacity ${color}`}
                style={{ height: `${h}%` }}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white shadow-lg z-10">
                {fmtDate(d.date)}: {fmt(val)}
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels — show first, middle, last */}
      {data.length > 0 && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">{fmtDate(data[0]!.date)}</span>
          {data.length > 2 && (
            <span className="text-[10px] text-gray-400">{fmtDate(data[Math.floor(data.length / 2)]!.date)}</span>
          )}
          <span className="text-[10px] text-gray-400">{fmtDate(data[data.length - 1]!.date)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const api = getApiClient();
      const { data } = await api.get(`/admin/analytics?days=${days}`);
      setAnalytics(data.data);
      setError('');
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const timeRanges = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
    { label: '1 year', value: 365 },
  ];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">Platform performance over time.</p>
        </div>

        {/* Time range picker */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {timeRanges.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${days === r.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={fetchAnalytics}>Retry</Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      )}

      {!loading && analytics && (
        <>
          {/* Summary cards */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: 'Orders', value: analytics.summary.totalOrders.toLocaleString() },
              { label: 'Deliveries', value: analytics.summary.totalDeliveries.toLocaleString() },
              { label: 'Completion', value: `${analytics.completionRate}%` },
              { label: 'Revenue', value: fmtCurrency(analytics.summary.totalRevenue) },
              { label: 'Commission', value: fmtCurrency(analytics.summary.totalCommission) },
              { label: 'New Riders', value: analytics.summary.totalNewRiders.toLocaleString() },
              { label: 'New Clients', value: analytics.summary.totalNewClients.toLocaleString() },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-medium text-gray-400 uppercase">{s.label}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <BarChart
                  data={analytics.daily}
                  getValue={(d) => d.orders}
                  label="Orders"
                  color="bg-brand-500"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <BarChart
                  data={analytics.daily}
                  getValue={(d) => d.deliveries}
                  label="Deliveries"
                  color="bg-green-500"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <BarChart
                  data={analytics.daily}
                  getValue={(d) => d.revenue}
                  label="Revenue"
                  color="bg-indigo-500"
                  formatValue={fmtCurrency}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <BarChart
                  data={analytics.daily}
                  getValue={(d) => d.commission}
                  label="Commission"
                  color="bg-amber-500"
                  formatValue={fmtCurrency}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <BarChart
                  data={analytics.daily}
                  getValue={(d) => d.newRiders}
                  label="New Riders"
                  color="bg-cyan-500"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <BarChart
                  data={analytics.daily}
                  getValue={(d) => d.newClients}
                  label="New Clients"
                  color="bg-emerald-500"
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
