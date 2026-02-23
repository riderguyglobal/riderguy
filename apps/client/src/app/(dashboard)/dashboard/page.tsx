'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import { Badge, Button, Spinner } from '@riderguy/ui';

// ============================================================
// Client Dashboard Home — Bolt / Uber inspired
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

const ACTIVE_STATUSES = ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'];

// Simulated nearby rider positions for the map
const NEARBY_RIDERS = [
  { id: 1, x: 22, y: 35, angle: 45 },
  { id: 2, x: 65, y: 20, angle: -30 },
  { id: 3, x: 45, y: 60, angle: 120 },
  { id: 4, x: 78, y: 55, angle: -90 },
  { id: 5, x: 30, y: 75, angle: 60 },
];

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalPrice: number;
  createdAt: string;
  packageType?: string;
}

// SVG inline icons
function MapPinIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PackageIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function ClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ArrowRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function MotorcycleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.5 16a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM4.5 16a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM17 11l-2-4h-3V5h4l2.7 5.4M7.5 18.5h9M2 18.5h2.5M10 5H6l-3 7h5.3" />
    </svg>
  );
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get('/orders', { params: { limit: 8 } });
      setRecentOrders(data.data ?? []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeOrders = recentOrders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const pastOrders = recentOrders.filter((o) => !ACTIVE_STATUSES.includes(o.status)).slice(0, 3);

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
      {/* ── Hero Map Section ── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-surface-100 to-surface-50" style={{ height: '280px' }}>
        {/* Simulated map grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />

        {/* Simulated street lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 280" fill="none">
          {/* Major roads */}
          <line x1="0" y1="140" x2="400" y2="140" stroke="rgba(148,163,184,0.25)" strokeWidth="8" />
          <line x1="200" y1="0" x2="200" y2="280" stroke="rgba(148,163,184,0.25)" strokeWidth="8" />
          <line x1="0" y1="80" x2="300" y2="80" stroke="rgba(148,163,184,0.15)" strokeWidth="4" />
          <line x1="100" y1="0" x2="100" y2="280" stroke="rgba(148,163,184,0.15)" strokeWidth="4" />
          <line x1="300" y1="0" x2="300" y2="200" stroke="rgba(148,163,184,0.15)" strokeWidth="4" />
          <line x1="50" y1="200" x2="350" y2="200" stroke="rgba(148,163,184,0.15)" strokeWidth="4" />
        </svg>

        {/* Center dot — user location */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="relative">
            <div className="h-4 w-4 rounded-full bg-brand-500 border-2 border-white shadow-lg tracking-pulse-ring" />
            <div className="absolute -inset-3 rounded-full bg-brand-500/10" />
          </div>
        </div>

        {/* Nearby rider pins */}
        {NEARBY_RIDERS.map((rider) => (
          <div
            key={rider.id}
            className="absolute rider-pin-bounce"
            style={{
              left: `${rider.x}%`,
              top: `${rider.y}%`,
              animationDelay: `${rider.id * 0.3}s`,
            }}
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-surface-900 shadow-lg border-2 border-white" style={{ transform: `rotate(${rider.angle}deg)` }}>
              <MotorcycleIcon className="text-brand-400" />
            </div>
          </div>
        ))}

        {/* Riders available badge */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-md px-3 py-1.5 shadow-card border border-surface-100">
            <div className="h-2 w-2 rounded-full bg-accent-500 dash-pulse-dot" />
            <span className="text-xs font-semibold text-surface-700">5 riders nearby</span>
          </div>
        </div>

        {/* Greeting overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-50 via-surface-50/80 to-transparent pt-12 pb-4 px-5">
          <p className="text-surface-500 text-sm">{greeting()},</p>
          <h1 className="text-xl font-bold text-surface-900">{user?.firstName}</h1>
        </div>
      </div>

      {/* ── Bolt-style "Where are you sending?" Search Bar ── */}
      <div className="px-4 -mt-1">
        <button
          onClick={() => router.push('/dashboard/send')}
          className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 shadow-card border border-surface-100 transition-all active:scale-[0.98] hover:shadow-card-hover"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <SearchIcon className="text-brand-500" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-surface-900">Where are you sending?</p>
            <p className="text-xs text-surface-400 mt-0.5">Enter pickup & dropoff address</p>
          </div>
          <ArrowRightIcon className="text-surface-300" />
        </button>
      </div>

      {/* ── Quick Actions ── */}
      <div className="px-4 mt-5">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => router.push('/dashboard/send')}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 shadow-card border border-surface-100 transition-all active:scale-95"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
              <PackageIcon className="text-brand-500" />
            </div>
            <span className="text-xs font-medium text-surface-700">Send</span>
          </button>

          <button
            onClick={() => router.push('/dashboard/orders')}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 shadow-card border border-surface-100 transition-all active:scale-95"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50">
              <ClockIcon className="text-purple-500 !w-5 !h-5" />
            </div>
            <span className="text-xs font-medium text-surface-700">History</span>
          </button>

          <button
            onClick={() => router.push('/dashboard/settings')}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 shadow-card border border-surface-100 transition-all active:scale-95"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50">
              <svg className="text-accent-500" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="text-xs font-medium text-surface-700">Account</span>
          </button>
        </div>
      </div>

      {/* ── Active Deliveries ── */}
      {activeOrders.length > 0 && (
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-brand-500 dash-pulse-dot" />
              <h2 className="text-sm font-bold text-surface-900">Active Deliveries</h2>
            </div>
            <span className="text-xs font-medium text-brand-500 bg-brand-50 px-2 py-0.5 rounded-full">{activeOrders.length}</span>
          </div>
          <div className="space-y-3 dash-stagger-in">
            {activeOrders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || { label: order.status, color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' };
              return (
                <button
                  key={order.id}
                  onClick={() => router.push(`/dashboard/orders/${order.id}/confirmation`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 shadow-card border border-surface-100 transition-all active:scale-[0.98] hover:shadow-card-hover text-left"
                >
                  {/* Route indicator */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="h-2.5 w-2.5 rounded-full border-2 border-brand-500 bg-white" />
                    <div className="w-0.5 h-6 bg-surface-200 rounded-full" />
                    <div className="h-2.5 w-2.5 rounded-full bg-accent-500" />
                  </div>

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-surface-900">{order.orderNumber}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 truncate">{order.pickupAddress}</p>
                    <p className="text-xs text-surface-400 truncate mt-0.5">{order.dropoffAddress}</p>
                  </div>

                  {/* Price + arrow */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-bold text-surface-900">GH₵{order.totalPrice.toLocaleString()}</span>
                    <ArrowRightIcon className="text-surface-300" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent Orders ── */}
      <div className="px-4 mt-6 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-surface-900">Recent Orders</h2>
          {recentOrders.length > 0 && (
            <button
              onClick={() => router.push('/dashboard/orders')}
              className="text-xs font-medium text-brand-500 hover:text-brand-600"
            >
              See all
            </button>
          )}
        </div>

        {pastOrders.length === 0 && activeOrders.length === 0 ? (
          <div className="rounded-2xl bg-white border border-dashed border-surface-200 p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-50">
              <PackageIcon className="text-surface-300" />
            </div>
            <p className="text-sm font-medium text-surface-500">No orders yet</p>
            <p className="text-xs text-surface-400 mt-1">Send your first package to get started</p>
            <Button
              className="mt-4 bg-brand-500 hover:bg-brand-600"
              size="sm"
              onClick={() => router.push('/dashboard/send')}
            >
              Send a Package
            </Button>
          </div>
        ) : pastOrders.length === 0 ? null : (
          <div className="space-y-2 dash-stagger-in">
            {pastOrders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || { label: order.status, color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' };
              return (
                <button
                  key={order.id}
                  onClick={() => router.push(`/dashboard/orders/${order.id}/confirmation`)}
                  className="flex w-full items-center gap-3 rounded-xl bg-white p-3 border border-surface-100 transition-all active:scale-[0.98] text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-50 shrink-0">
                    <PackageIcon className="text-surface-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-surface-900">{order.orderNumber}</p>
                      <Badge className={`${cfg.bg} ${cfg.color} border-0 text-[10px] px-1.5 py-0`}>{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-surface-400 truncate mt-0.5">
                      {order.pickupAddress} → {order.dropoffAddress}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-surface-700 shrink-0">
                    GH₵{order.totalPrice.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
