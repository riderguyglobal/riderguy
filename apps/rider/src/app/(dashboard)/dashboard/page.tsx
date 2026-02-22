'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import { Badge, Button, Spinner, Switch } from '@riderguy/ui';
import { useRiderAvailability } from '@/hooks/use-rider-availability';

// ============================================================
// Rider Dashboard Home — Bolt/Uber-inspired design
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  ASSIGNED: { label: 'Assigned', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  PICKUP_EN_ROUTE: { label: 'En Route', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  AT_PICKUP: { label: 'At Pickup', color: 'text-indigo-700', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  PICKED_UP: { label: 'Picked Up', color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  IN_TRANSIT: { label: 'In Transit', color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  AT_DROPOFF: { label: 'At Dropoff', color: 'text-teal-700', bg: 'bg-teal-50', dot: 'bg-teal-500' },
};

interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalPrice: number;
  serviceFee: number;
  distanceKm?: number;
  estimatedDurationMinutes?: number;
}

interface WalletData {
  balance: number;
  totalEarned: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    isOnline,
    toggling: togglingAvailability,
    toggleAvailability,
    loading: availabilityLoading,
  } = useRiderAvailability();

  const fetchData = useCallback(async () => {
    const api = getApiClient();
    const results = await Promise.allSettled([
      api.get('/orders', { params: { limit: 10 } }),
      api.get('/orders/available'),
      api.get('/wallets'),
    ]);

    if (results[0].status === 'fulfilled') {
      const active = (results[0].value.data.data ?? []).filter((o: ActiveOrder) =>
        ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(o.status)
      );
      setActiveOrders(active);
    }
    if (results[1].status === 'fulfilled') {
      setAvailableCount((results[1].value.data.data ?? []).length);
    }
    if (results[2].status === 'fulfilled') {
      setWallet(results[2].value.data.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  return (
    <div className="dash-page-enter">
      {/* ── Hero Section with Go Online Toggle ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-surface-900 via-surface-800 to-brand-900 px-5 pt-5 pb-8">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />

        <div className="relative z-10">
          {/* Greeting */}
          <p className="text-surface-400 text-sm">
            {greeting()},
          </p>
          <h1 className="text-xl font-bold text-white mt-0.5">
            {user?.firstName} {user?.lastName}
          </h1>

          {/* ── Go Online / Offline Toggle — Bolt style ── */}
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${isOnline ? 'bg-accent-400 dash-pulse-dot' : 'bg-surface-500'}`} />
              <div>
                <p className="text-white font-semibold text-sm">
                  {togglingAvailability ? 'Updating...' : isOnline ? "You're Online" : "You're Offline"}
                </p>
                <p className="text-surface-400 text-xs mt-0.5">
                  {isOnline ? 'Receiving delivery requests' : 'Go online to start earning'}
                </p>
              </div>
            </div>
            <Switch
              checked={isOnline}
              disabled={togglingAvailability || availabilityLoading}
              onCheckedChange={() => toggleAvailability()}
              className="data-[state=checked]:bg-accent-500"
            />
          </div>
        </div>
      </div>

      {/* ── Quick Stats — Uber-style horizontal cards ── */}
      <div className="px-4 -mt-4 relative z-20">
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => router.push('/dashboard/jobs')}
            className="rounded-2xl bg-white p-3.5 shadow-card hover:shadow-card-hover transition-all active:scale-[0.97] text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
              </svg>
            </div>
            <p className="text-xl font-bold text-surface-900 mt-2">{availableCount}</p>
            <p className="text-[10px] text-surface-400 font-medium mt-0.5">Jobs nearby</p>
          </button>

          <button
            onClick={() => activeOrders.length > 0 && activeOrders[0] ? router.push(`/dashboard/jobs/${activeOrders[0].id}`) : null}
            className="rounded-2xl bg-white p-3.5 shadow-card hover:shadow-card-hover transition-all active:scale-[0.97] text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-xl font-bold text-surface-900 mt-2">{activeOrders.length}</p>
            <p className="text-[10px] text-surface-400 font-medium mt-0.5">Active now</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/earnings')}
            className="rounded-2xl bg-white p-3.5 shadow-card hover:shadow-card-hover transition-all active:scale-[0.97] text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <p className="text-xl font-bold text-accent-600 mt-2">
              GH₵{wallet?.balance?.toLocaleString() ?? '0'}
            </p>
            <p className="text-[10px] text-surface-400 font-medium mt-0.5">Balance</p>
          </button>
        </div>
      </div>

      {/* ── Active Deliveries ── */}
      {activeOrders.length > 0 && (
        <div className="px-4 mt-6 dash-stagger-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-surface-900">Active Deliveries</h2>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
              {activeOrders.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {activeOrders.map((order) => {
              const config = STATUS_CONFIG[order.status] || { label: order.status, color: 'text-surface-600', bg: 'bg-surface-50', dot: 'bg-surface-400' };
              const earnings = order.totalPrice - (order.serviceFee ?? 0);
              return (
                <button
                  key={order.id}
                  onClick={() => router.push(`/dashboard/jobs/${order.id}`)}
                  className="w-full rounded-2xl bg-white p-4 shadow-card hover:shadow-card-hover transition-all active:scale-[0.98] text-left"
                >
                  {/* Status bar */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                      <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                    </div>
                    <span className="text-xs text-surface-400 font-mono">#{order.orderNumber}</span>
                  </div>

                  {/* Route */}
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="h-2 w-2 rounded-full bg-accent-500 ring-2 ring-accent-100" />
                      <div className="w-0.5 flex-1 bg-surface-200 my-1" />
                      <div className="h-2 w-2 rounded-full bg-danger-500 ring-2 ring-danger-100" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-800 truncate">{order.pickupAddress}</p>
                      <div className="h-3" />
                      <p className="text-sm text-surface-800 truncate">{order.dropoffAddress}</p>
                    </div>
                    <div className="flex flex-col items-end justify-center">
                      <p className="text-base font-bold text-accent-600">GH₵{earnings.toLocaleString()}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-surface-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => router.push('/dashboard/jobs')}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card hover:shadow-card-hover transition-all active:scale-[0.97]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold text-surface-900">Find Jobs</p>
              <p className="text-[10px] text-surface-400">{availableCount} available</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/earnings')}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card hover:shadow-card-hover transition-all active:scale-[0.97]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 010-4h14v4" />
                <path d="M3 5v14a2 2 0 002 2h16v-5" />
                <circle cx="18" cy="14" r="2" />
              </svg>
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold text-surface-900">Earnings</p>
              <p className="text-[10px] text-surface-400">View wallet</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/onboarding')}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card hover:shadow-card-hover transition-all active:scale-[0.97]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 14l2 2 4-4" />
              </svg>
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold text-surface-900">Profile</p>
              <p className="text-[10px] text-surface-400">Documents</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/settings')}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card hover:shadow-card-hover transition-all active:scale-[0.97]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100 flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold text-surface-900">Settings</p>
              <p className="text-[10px] text-surface-400">Account</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Empty State / CTA ── */}
      {activeOrders.length === 0 && (
        <div className="px-4 mt-6 mb-4">
          <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 p-5 text-center border border-brand-100/50">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-card mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-surface-900 mt-3">
              {isOnline ? 'Waiting for orders' : 'Ready to ride?'}
            </h3>
            <p className="text-sm text-surface-500 mt-1">
              {isOnline
                ? 'New delivery requests will appear here automatically.'
                : 'Go online to start receiving delivery requests.'}
            </p>
            {!isOnline && (
              <Button
                className="mt-4 bg-brand-500 hover:bg-brand-600 rounded-xl px-8"
                disabled={togglingAvailability}
                onClick={() => toggleAvailability()}
              >
                Go Online
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
