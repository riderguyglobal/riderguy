'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import { Button, Spinner } from '@riderguy/ui';

// ============================================================
// Orders — Bolt/Uber-inspired order history
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PENDING:           { label: 'Pending',    color: 'text-amber-700',  bg: 'bg-amber-50',  dot: 'bg-amber-500' },
  SEARCHING_RIDER:   { label: 'Searching',  color: 'text-amber-700',  bg: 'bg-amber-50',  dot: 'bg-amber-500' },
  ASSIGNED:          { label: 'Assigned',   color: 'text-blue-700',   bg: 'bg-blue-50',   dot: 'bg-blue-500' },
  PICKUP_EN_ROUTE:   { label: 'En Route',   color: 'text-blue-700',   bg: 'bg-blue-50',   dot: 'bg-blue-500' },
  AT_PICKUP:         { label: 'At Pickup',  color: 'text-indigo-700', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  PICKED_UP:         { label: 'Picked Up',  color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  IN_TRANSIT:        { label: 'In Transit', color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  AT_DROPOFF:        { label: 'At Dropoff', color: 'text-teal-700',   bg: 'bg-teal-50',   dot: 'bg-teal-500' },
  DELIVERED:         { label: 'Delivered',  color: 'text-green-700',  bg: 'bg-green-50',  dot: 'bg-green-500' },
  FAILED:            { label: 'Failed',     color: 'text-red-700',    bg: 'bg-red-50',    dot: 'bg-red-500' },
  CANCELLED_BY_CLIENT: { label: 'Cancelled', color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' },
  CANCELLED_BY_RIDER:  { label: 'Cancelled', color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' },
  CANCELLED_BY_ADMIN:  { label: 'Cancelled', color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' },
};

function PackageTypeIcon({ type, className = '' }: { type: string; className?: string }) {
  const color = '#64748b';
  switch (type) {
    case 'DOCUMENT':
      return (<svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>);
    case 'FOOD':
      return (<svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>);
    case 'FRAGILE':
      return (<svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>);
    case 'HIGH_VALUE':
      return (<svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>);
    default:
      return (<svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>);
  }
}

type FilterTab = 'all' | 'active' | 'completed';

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  totalPrice: number;
  currency: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  paymentMethod: string;
  createdAt: string;
  deliveredAt?: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const api = getApiClient();
      const { data } = await api.get('/orders', { params: { page, limit: 20 } });
      setOrders(data.data);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  const TERMINAL = ['DELIVERED', 'FAILED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'];
  const filteredOrders = orders.filter((o) => {
    if (tab === 'active') return !TERMINAL.includes(o.status);
    if (tab === 'completed') return TERMINAL.includes(o.status);
    return true;
  });

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active', count: orders.filter((o) => !TERMINAL.includes(o.status)).length },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="dash-page-enter pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-900">My Orders</h1>
        <button
          onClick={() => router.push('/dashboard/send')}
          className="flex items-center gap-1.5 rounded-full bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-brand-600 active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Order
        </button>
      </div>

      {/* Filter tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 rounded-2xl bg-surface-100/80 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                tab === t.key
                  ? 'bg-white text-surface-900 shadow-card'
                  : 'text-surface-400 hover:text-surface-600'
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  tab === t.key ? 'bg-brand-500 text-white' : 'bg-surface-200 text-surface-500'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-50">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-surface-700">No orders yet</p>
          <p className="mt-1 text-xs text-surface-400">Send your first package to get started!</p>
          <Button
            className="mt-5 bg-brand-500 hover:bg-brand-600 rounded-xl"
            size="sm"
            onClick={() => router.push('/dashboard/send')}
          >
            Send a Package
          </Button>
        </div>
      ) : (
        <div className="px-4 space-y-2.5 dash-stagger-in">
          {filteredOrders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] || { label: order.status, color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' };
            const isActive = !TERMINAL.includes(order.status);
            return (
              <button
                key={order.id}
                onClick={() => router.push(`/dashboard/orders/${order.id}/confirmation`)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 border border-surface-100 shadow-card transition-all active:scale-[0.98] hover:shadow-card-hover text-left"
              >
                {/* Package icon */}
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${isActive ? 'bg-brand-50' : 'bg-surface-50'}`}>
                  <PackageTypeIcon type={order.packageType} />
                </div>

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-surface-900">{order.orderNumber}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-surface-500">
                    {/* Route dots */}
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="h-1.5 w-1.5 rounded-full border border-brand-500" />
                      <div className="w-3 h-px bg-surface-300" />
                      <div className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                    </div>
                    <span className="truncate">{order.pickupAddress.split(',')[0]}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    <span className="truncate">{order.dropoffAddress.split(',')[0]}</span>
                  </div>
                  <p className="text-[10px] text-surface-400 mt-1">
                    {new Date(order.createdAt).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {order.distanceKm > 0 && ` · ${order.distanceKm.toFixed(1)} km`}
                  </p>
                </div>

                {/* Price */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-sm font-bold text-surface-900">GH₵{order.totalPrice.toLocaleString()}</span>
                  <svg className="mt-1 text-surface-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4 pb-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-200 text-surface-500 transition-all hover:bg-surface-50 disabled:opacity-30"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span className="text-xs font-medium text-surface-500">{page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-200 text-surface-500 transition-all hover:bg-surface-50 disabled:opacity-30"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
