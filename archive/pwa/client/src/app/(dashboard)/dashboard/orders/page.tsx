'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { StatusBadge } from '@/components/status-badge';
import { OrderProgressBar } from '@/components/order-progress-bar';
import { SegmentedControl } from '@/components/segmented-control';
import type { Order } from '@riderguy/types';
import { Skeleton } from '@riderguy/ui';
import {
  Package,
  MapPin,
  Send,
  Navigation,
  Search,
  X,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

const ACTIVE_STATUSES = 'PENDING,SEARCHING_RIDER,ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF';
const CANCELLED_STATUSES = 'CANCELLED_BY_CLIENT,CANCELLED_BY_RIDER,CANCELLED_BY_ADMIN,FAILED';

const TABS = [
  { key: 'all',       label: 'All'       },
  { key: 'active',    label: 'Active'    },
  { key: 'completed', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const router  = useRouter();
  const { api } = useAuth();
  const [tab, setTab] = useState('all');

  // ── Search state ─────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult,  setSearchResult]  = useState<Order | null>(null);
  const [searchError,   setSearchError]   = useState('');
  const [searched,      setSearched]      = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['orders', tab],
    queryFn: async () => {
      const params: Record<string, string> = { sort: '-createdAt', limit: '50' };
      if (tab === 'active')    params.status = ACTIVE_STATUSES;
      if (tab === 'completed') params.status = 'DELIVERED';
      if (tab === 'cancelled') params.status = CANCELLED_STATUSES;
      const res = await api!.get('/orders', { params });
      return res.data.data ?? [];
    },
    enabled: !!api,
  });

  async function handleSearch() {
    const q = searchQuery.trim().toUpperCase().replace(/^#/, '');
    if (!q || !api) return;
    setSearchLoading(true);
    setSearchError('');
    setSearchResult(null);
    setSearched(true);
    try {
      const res = await api.get('/orders', { params: { orderNumber: q, limit: '1' } });
      const list: Order[] = res.data.data ?? [];
      if (list.length > 0) {
        setSearchResult(list[0]!);
      } else {
        setSearchError('No order found with that number. Double-check and try again.');
      }
    } catch {
      setSearchError('Could not look up the order. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResult(null);
    setSearchError('');
    setSearched(false);
    inputRef.current?.focus();
  }

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">

      {/* Header */}
      <div
        className="bg-white sticky top-0 z-20 px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 16px)', paddingBottom: 0 }}
      >
        <h1 className="text-[22px] font-bold text-surface-900 mb-3">Orders</h1>

        {/* ── Search bar ── */}
        <div className="mb-3">
          <div className="flex items-center gap-2 h-11 px-3 rounded-2xl bg-surface-50 border border-surface-100">
            <Search className="h-4 w-4 text-surface-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (!e.target.value) { setSearchResult(null); setSearchError(''); setSearched(false); }
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Track by order number (e.g. RG-2026-XXXX)"
              autoCapitalize="characters"
              autoComplete="off"
              className="flex-1 bg-transparent text-[13px] text-surface-800 placeholder:text-surface-300 outline-none uppercase tracking-wide"
            />
            {searchQuery ? (
              <button onClick={clearSearch} className="flex-shrink-0">
                <X className="h-4 w-4 text-surface-400" />
              </button>
            ) : null}
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || searchLoading}
              className="flex-shrink-0 h-7 px-3 rounded-xl bg-[#0AB957] text-white text-[11px] font-bold disabled:opacity-40 transition-opacity"
            >
              {searchLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Find'}
            </button>
          </div>

          {/* Search result */}
          {searched && !searchLoading && (
            <div className="mt-2">
              {searchError ? (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-600 leading-snug">{searchError}</p>
                </div>
              ) : searchResult ? (
                <SearchResultCard order={searchResult} onNavigate={router.push} />
              ) : null}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <SegmentedControl
          tabs={TABS}
          value={tab}
          onChange={v => { setTab(v); setSearchQuery(''); setSearchResult(null); setSearchError(''); setSearched(false); }}
          className="mb-4"
        />
      </div>

      {/* List */}
      <div className="px-5 pb-6 space-y-2 mt-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[80px] w-full rounded-2xl" />
          ))
        ) : !orders?.length ? (
          <div className="py-16 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
              <Package className="h-6 w-6 text-surface-300" />
            </div>
            <p className="text-[14px] font-semibold text-surface-700">No orders found</p>
            <p className="text-[12px] text-surface-400 mt-1">
              {tab === 'all' ? 'Send your first package!' : `No ${TABS.find(t => t.key === tab)?.label.toLowerCase()} orders`}
            </p>
            {tab === 'all' && (
              <button
                onClick={() => router.push('/dashboard/send')}
                className="mt-5 btn-primary inline-flex px-8"
                style={{ height: 48, fontSize: 14 }}
              >
                <Send className="h-3.5 w-3.5" /> Send Package
              </button>
            )}
          </div>
        ) : (
          orders.map(order => {
            const cfg      = ORDER_STATUS_CONFIG[order.status];
            const isActive = cfg?.isActive ?? false;

            return (
              <button
                key={order.id}
                onClick={() => router.push(
                  isActive
                    ? `/dashboard/orders/${order.id}/tracking`
                    : `/dashboard/orders/${order.id}`
                )}
                className="w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl active:bg-surface-50 transition-colors text-left group"
              >
                <div className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center flex-shrink-0 mt-0.5 group-active:bg-surface-200 transition-colors">
                  {isActive
                    ? <Navigation className="h-4 w-4 text-brand-500" />
                    : <Package    className="h-4 w-4 text-surface-400" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-[14px] font-bold text-surface-900">
                      #{order.id.slice(-6).toUpperCase()}
                    </p>
                    <StatusBadge status={order.status} />
                  </div>

                  <p className="text-[13px] text-surface-500 truncate flex items-center gap-1 leading-tight">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {order.dropoffAddress || 'Delivery'}
                  </p>

                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[11px] text-surface-400">
                      {timeAgo(new Date(order.createdAt))}
                    </p>
                    {order.totalPrice ? (
                      <p className="text-[13px] font-bold text-surface-900">
                        {formatCurrency(order.totalPrice)}
                      </p>
                    ) : null}
                  </div>

                  {isActive && (
                    <OrderProgressBar status={order.status} className="mt-2.5" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

    </div>
  );
}

// ── Search result card ─────────────────────────────────

function SearchResultCard({ order, onNavigate }: { order: Order; onNavigate: (href: string) => void }) {
  const cfg      = ORDER_STATUS_CONFIG[order.status];
  const isActive = cfg?.isActive ?? false;
  const href     = isActive
    ? `/dashboard/orders/${order.id}/tracking`
    : `/dashboard/orders/${order.id}`;

  return (
    <div
      className="rounded-2xl bg-white overflow-hidden"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)' }}
    >
      {/* Top accent */}
      <div className="h-1 w-full" style={{ background: isActive ? '#0AB957' : '#E5E7EB' }} />

      <div className="px-4 py-3.5 space-y-2.5">
        {/* Order number + badge */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Order found</p>
            <p className="text-[15px] font-black text-surface-900 mt-0.5">
              {(order as any).orderNumber ? `#${(order as any).orderNumber}` : `#${order.id.slice(-6).toUpperCase()}`}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Route */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="mt-1 h-2 w-2 rounded-full bg-[#0AB957] flex-shrink-0" />
            <p className="text-[12px] text-surface-600 leading-snug line-clamp-1">{order.pickupAddress || '—'}</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-1 h-2 w-2 rounded-full bg-surface-400 flex-shrink-0" />
            <p className="text-[12px] text-surface-600 leading-snug line-clamp-1">{order.dropoffAddress || '—'}</p>
          </div>
        </div>

        {/* Progress bar if active */}
        {isActive && <OrderProgressBar status={order.status} />}

        {/* Status description */}
        {cfg?.description && (
          <p className="text-[11px] text-surface-400 leading-snug">{cfg.description}</p>
        )}

        {/* CTA */}
        <button
          onClick={() => onNavigate(href)}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-bold text-white transition-opacity active:opacity-80"
          style={{ background: isActive ? '#0AB957' : '#111827' }}
        >
          {isActive ? <Navigation className="h-4 w-4" /> : <Package className="h-4 w-4" />}
          {isActive ? 'Track Live' : 'View Order'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
