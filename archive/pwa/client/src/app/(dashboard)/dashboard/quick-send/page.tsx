'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@riderguy/utils';
import { useNearbyRiders } from '@/hooks/use-nearby-riders';
import {
  useAutocomplete,
  reverseGeocodeAddress,
  splitPlaceName,
  type SearchSuggestion,
} from '@/hooks/use-autocomplete';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import type { Order } from '@riderguy/types';
import type { LocationValue } from '@/components/location-input';
import {
  Bell,
  MapPin,
  Crosshair,
  Plus,
  ChevronRight,
  Loader2,
  AlertCircle,
  Send,
  Package,
  Menu,
  X,
  ShoppingBag,
  UtensilsCrossed,
  Shirt,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const ClientMap = dynamic(() => import('@/components/client-map'), { ssr: false });

// ── Compact location card ──────────────────────────────

interface SendLocationCardProps {
  pickup: LocationValue;
  dropoff: LocationValue;
  onDropoffChange: (v: LocationValue) => void;
  dropoffRef: React.RefObject<HTMLInputElement>;
  locatingPickup: boolean;
}

function SendLocationCard({
  pickup,
  dropoff,
  onDropoffChange,
  dropoffRef,
  locatingPickup,
}: SendLocationCardProps) {
  const ac = useAutocomplete();

  const handleQueryChange = (text: string) => {
    ac.onChange(text);
    if (dropoff.coordinates) onDropoffChange({ address: text, coordinates: null });
  };

  const selectSuggestion = async (s: SearchSuggestion) => {
    ac.setQuery(s.placeName);
    ac.setOpen(false);
    const place = await ac.retrieve(s);
    if (place) {
      onDropoffChange({ address: place.fullAddress, coordinates: [place.longitude, place.latitude] });
      ac.setQuery(place.fullAddress);
    } else {
      onDropoffChange({ address: s.placeName, coordinates: null });
    }
  };

  const handleClearDropoff = () => {
    ac.clear();
    onDropoffChange({ address: '', coordinates: null });
    dropoffRef.current?.focus();
  };

  return (
    <div className="overflow-visible">
      {/* ── Pickup row ── */}
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5">
        <MapPin className="h-[14px] w-[14px] flex-shrink-0 text-[#0AB957]" strokeWidth={2.3} />
        <div className="flex-1 min-w-0">
          <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#0AB957] leading-none mb-[3px]">
            Current Location
          </p>
          {locatingPickup ? (
            <div className="flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 text-gray-400 animate-spin" />
              <span className="text-[11px] text-gray-400">Detecting…</span>
            </div>
          ) : (
            <p className="text-[12px] font-medium text-gray-800 leading-tight truncate">
              {pickup.address || 'Set pickup location'}
            </p>
          )}
        </div>
        <button
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Re-detect location"
        >
          <Crosshair className="h-[12px] w-[12px] text-gray-500" />
        </button>
      </div>

      {/* ── Dashed connector ── */}
      <div className="mx-3 flex items-center gap-2 py-px">
        <div className="ml-[5px] h-3 border-l-[1.5px] border-dashed border-gray-300" />
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      {/* ── Dropoff row ── */}
      <div className="relative">
        <div className="flex items-center gap-2.5 px-3 pt-1.5 pb-2.5">
          <div className="h-[9px] w-[9px] flex-shrink-0 rounded-full border-[1.5px] border-gray-400 bg-white" />
          <input
            ref={dropoffRef}
            value={ac.query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={() => {
              if (ac.query.length >= 2 && !dropoff.coordinates) ac.setOpen(true);
            }}
            placeholder="Where are you sending to?"
            className="flex-1 min-w-0 bg-transparent text-[12px] text-gray-800 placeholder:text-gray-400 outline-none"
          />
          {(ac.loading || ac.retrieving) ? (
            <Loader2 className="h-3 w-3 text-gray-400 animate-spin flex-shrink-0" />
          ) : dropoff.coordinates ? (
            <button
              onClick={handleClearDropoff}
              className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-gray-100"
            >
              <X className="h-3 w-3 text-gray-500" />
            </button>
          ) : (
            <button
              onClick={() => dropoffRef.current?.focus()}
              className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-[#0AB957] active:scale-95 transition-transform"
            >
              <Plus className="h-3 w-3 text-white" />
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {ac.open && ac.results.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl" style={{ maxHeight: 240 }}>
            {ac.results.map(s => {
              const { primary, secondary } = splitPlaceName(s.placeName);
              return (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectSuggestion(s)}
                  className="flex w-full items-start gap-3 border-b border-gray-100 px-4 py-2.5 text-left last:border-0 hover:bg-gray-50 active:bg-gray-100"
                >
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <MapPin className="h-3 w-3 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[12px] font-medium text-gray-900">{primary}</p>
                    {secondary && <p className="truncate text-[10px] text-gray-500 mt-0.5">{secondary}</p>}
                  </div>
                </button>
              );
            })}
            <div className="border-t border-gray-100 py-1 text-center">
              <span className="text-[8px] text-gray-300">Powered by Google</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────

export default function QuickSendPage() {
  const router = useRouter();
  const { user, api } = useAuth();

  const [pickup,         setPickup]         = useState<LocationValue>({ address: '', coordinates: null });
  const [dropoff,        setDropoff]        = useState<LocationValue>({ address: '', coordinates: null });
  const [locatingPickup, setLocatingPickup] = useState(true);
  const [paymentMethod]                     = useState('CASH');
  const [estimate,       setEstimate]       = useState<{ totalPrice: number; distanceKm: number; estimatedDurationMinutes: number } | null>(null);
  const [estimating,     setEstimating]     = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState('');
  const [greeting,       setGreeting]       = useState('Good Morning');

  const dropoffRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const estimateAbortRef = useRef<AbortController>();

  // User info
  const firstName = user?.firstName ?? '';
  const lastName  = user?.lastName  ?? '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'there';

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening');
  }, []);

  // Nearby riders for ETA badge
  const { riders } = useNearbyRiders({ coordinates: pickup.coordinates, enabled: !!pickup.coordinates });
  const nearestEta = useMemo(() => {
    if (!riders.length) return null;
    const minDist = Math.min(...riders.map(r => r.distKm ?? Infinity));
    return isFinite(minDist) ? Math.max(1, Math.round(minDist * 2)) : null;
  }, [riders]);

  // Notifications
  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api!.get('/notifications', { params: { pageSize: '1' } });
      const all = res.data.data ?? [];
      return { unread: (all as { isRead: boolean }[]).filter(n => !n.isRead).length };
    },
    enabled: !!api,
    refetchInterval: 30_000,
  });

  // Recent orders
  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['recent-orders'],
    queryFn: async () => {
      const res = await api!.get('/orders', { params: { limit: 3, sort: '-createdAt' } });
      return res.data.data ?? [];
    },
    enabled: !!api,
  });

  const unreadCount  = notifData?.unread ?? 0;
  const recentOrders = orders?.slice(0, 3) ?? [];

  // Auto-detect pickup location
  useEffect(() => {
    if (!navigator.geolocation) { setLocatingPickup(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const address = await reverseGeocodeAddress(latitude, longitude);
          setPickup({ address, coordinates: [longitude, latitude] });
        } catch {
          setError('Could not detect your location');
        } finally {
          setLocatingPickup(false);
        }
      },
      () => {
        setLocatingPickup(false);
        setError('Location permission denied — set pickup manually');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  // Price estimation
  useEffect(() => {
    if (!pickup.coordinates || !dropoff.coordinates || !api) { setEstimate(null); return; }
    estimateAbortRef.current?.abort();
    const controller = new AbortController();
    estimateAbortRef.current = controller;
    setEstimating(true);
    setError('');

    const [lng1, lat1] = pickup.coordinates;
    const [lng2, lat2] = dropoff.coordinates;

    api.post('/orders/estimate', {
      pickupLatitude: lat1, pickupLongitude: lng1,
      dropoffLatitude: lat2, dropoffLongitude: lng2,
      packageType: 'SMALL_PARCEL', paymentMethod,
    }, { signal: controller.signal })
      .then(res  => { setEstimate(res.data.data ?? null); setError(''); })
      .catch(err => {
        if (err?.code !== 'ERR_CANCELED')
          setError(err?.response?.data?.error?.message || 'Could not estimate price');
      })
      .finally(() => setEstimating(false));

    return () => controller.abort();
  }, [pickup.coordinates, dropoff.coordinates, paymentMethod, api]);

  // Submit order
  const handleSend = useCallback(async () => {
    if (!api || !pickup.coordinates || !dropoff.coordinates || !estimate || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/orders', {
        pickupAddress:   pickup.address,
        pickupLatitude:  pickup.coordinates[1],
        pickupLongitude: pickup.coordinates[0],
        dropoffAddress:   dropoff.address,
        dropoffLatitude:  dropoff.coordinates[1],
        dropoffLongitude: dropoff.coordinates[0],
        packageType: 'SMALL_PARCEL',
        paymentMethod,
        estimatedTotalPrice: estimate.totalPrice,
      });
      const orderId = res.data.data?.id;
      router.replace(orderId ? `/dashboard/orders/${orderId}/tracking` : '/dashboard/orders');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }, [api, pickup, dropoff, estimate, paymentMethod, submitting, router]);

  const canSend = !!pickup.coordinates && !!dropoff.coordinates && !!estimate && !submitting;

  return (
    <div className="animate-page-enter min-h-[100dvh] bg-[#F4F4F4]">

      {/* ── Header ────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 bg-white border-b border-black/[0.05] px-4"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/dashboard/settings"
            className="grid h-9 w-9 place-items-center rounded-xl active:bg-gray-100 transition-colors"
          >
            <Menu className="h-5 w-5 text-gray-700" strokeWidth={1.8} />
          </Link>

          <span className="text-[20px] font-black tracking-tight text-gray-900">riderguy</span>

          <div className="flex items-center gap-2.5">
            <Link href="/dashboard/notifications" className="relative grid h-9 w-9 place-items-center rounded-xl">
              <Bell className="h-[22px] w-[22px] text-gray-700" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#0AB957] ring-[1.5px] ring-white" />
              )}
            </Link>
          </div>
        </div>
      </header>

      <div className="pb-8 pt-4">

        {/* ── Greeting ─────────────────────────────────── */}
        <section className="px-4 mb-3">
          <p className="text-[10px] text-gray-400">{greeting},</p>
          <h1 className="text-[13px] font-semibold leading-tight text-gray-900">{fullName}</h1>
        </section>

        {/* ── Location Card ─────────────────────────────── */}
        <div className="px-4">
          <div
            className="relative z-10 rounded-[16px] bg-white overflow-visible"
            style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.09)', border: '1px solid rgba(0,0,0,0.05)' }}
          >
            <SendLocationCard
              pickup={pickup}
              dropoff={dropoff}
              onDropoffChange={setDropoff}
              dropoffRef={dropoffRef}
              locatingPickup={locatingPickup}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mt-2 flex items-start gap-2.5 rounded-2xl bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-[12px] leading-snug text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* ── Map — full bleed ─────────────────────────── */}
        <section className="relative mt-2 h-[280px] overflow-hidden">
          <ClientMap pollEnabled />

          {nearestEta !== null && (
            <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-lg">
                <p className="text-[22px] font-black leading-none text-gray-900">{nearestEta}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  MIN<br />AWAY
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── Fast Safe & Reliable banner ──────────────── */}
        <section className="relative mx-4 mt-3 overflow-hidden rounded-[18px]" style={{ height: 115 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/illustrations/midsection.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Text overlay */}
          <div className="absolute inset-y-0 left-0 flex flex-col justify-center pl-4 pr-2" style={{ width: '55%' }}>
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#0AB957]/15 px-2 py-[2px] w-fit">
              <div className="h-1.5 w-1.5 rounded-full bg-[#0AB957]" />
              <span className="text-[8px] font-bold uppercase tracking-wide text-[#166534]">Trusted by thousands</span>
            </div>
            <h3 className="text-[15px] font-black leading-[1.2] text-gray-900">
              Fast, Safe &amp; Reliable
            </h3>
            <p className="mt-1 text-[10.5px] leading-snug text-gray-600">
              Your trusted delivery<br />and ride partner.
            </p>
          </div>
        </section>

        {/* ── Buy for Me ───────────────────────────────── */}
        <section className="mx-4 mt-3">
          <Link
            href="/dashboard/buy-for-me"
            className="block overflow-hidden rounded-[18px] active:scale-[0.985] transition-transform"
            style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', boxShadow: '0 6px 20px rgba(217,119,6,0.30)' }}
          >
            <div className="flex items-start gap-3 px-4 pt-4 pb-3">
              {/* Icon */}
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <ShoppingBag className="h-6 w-6 text-white" strokeWidth={1.8} />
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100">New Feature</p>
                <h3 className="text-[17px] font-black leading-tight text-white mt-0.5">Buy for Me</h3>
                <p className="text-[11px] text-amber-100 mt-0.5 leading-snug">
                  Tell us what to buy — we'll pick it up &amp; deliver to you.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 flex-shrink-0 text-white/70 mt-1" />
            </div>

            {/* Category chips */}
            <div className="flex gap-2 px-4 pb-4">
              {[
                { icon: UtensilsCrossed, label: 'Food & Drinks' },
                { icon: Shirt,           label: 'Fashion'        },
                { icon: Smartphone,      label: 'Electronics'    },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
                  <Icon className="h-3 w-3 text-white" strokeWidth={1.8} />
                  <span className="text-[9.5px] font-semibold text-white">{label}</span>
                </div>
              ))}
            </div>
          </Link>
        </section>

        {/* ── Recent Orders ─────────────────────────────── */}
        <section className="mx-4 mt-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-black text-gray-900">Recent Orders</h2>
            <Link href="/dashboard/orders" className="text-[13px] font-semibold text-[#0AB957]">
              View all
            </Link>
          </div>

          {ordersLoading ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-[74px] animate-pulse rounded-[16px] bg-white" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center rounded-[18px] bg-white py-7">
              <Package className="mb-2 h-9 w-9 text-gray-200" />
              <p className="text-[13px] font-semibold text-gray-400">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentOrders.map(order => {
                const cfg      = ORDER_STATUS_CONFIG[order.status];
                const date     = new Date(order.createdAt);
                const dateStr  = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  + ' • ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                const statusColor =
                  order.status === 'DELIVERED'  ? 'bg-[#EEF9F2] text-[#0AB957]'
                  : cfg?.isActive               ? 'bg-amber-50 text-amber-600'
                  :                               'bg-gray-100 text-gray-500';

                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center gap-3 rounded-[16px] bg-white p-4 active:bg-gray-50 transition-colors"
                    style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#EEF9F2]">
                      <Package className="h-5 w-5 text-[#0AB957]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900">
                        Order #{order.orderNumber}
                      </p>
                      <p className="mt-[2px] truncate text-[11px] text-gray-500">
                        {order.pickupAddress} → {order.dropoffAddress}
                      </p>
                      <p className="mt-[2px] text-[10px] text-gray-400">{dateStr}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      <span className={`rounded-full px-2.5 py-[3px] text-[10px] font-semibold ${statusColor}`}>
                        {cfg?.label ?? order.status}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* ── Floating Send Now bar — appears when estimate is ready ── */}
      {(estimating || estimate) && (
        <div
          className="fixed left-0 right-0 z-50 px-4 transition-all"
          style={{ bottom: 'calc(62px + env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-white disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #10B85A 0%, #018C42 100%)',
              boxShadow: '0 6px 24px rgba(0,140,66,0.40)',
            }}
          >
            <div className="flex items-center gap-2.5">
              {submitting || estimating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              <span className="text-[15px] font-black">
                {estimating ? 'Calculating…' : submitting ? 'Creating…' : 'Send Now'}
              </span>
            </div>
            {estimate && !estimating && (
              <div className="text-right">
                <p className="text-[18px] font-black leading-none">{formatCurrency(estimate.totalPrice)}</p>
                <p className="mt-0.5 text-[10px] text-white/70">
                  {estimate.distanceKm?.toFixed(1)} km · ~{estimate.estimatedDurationMinutes} min
                </p>
              </div>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
