'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@riderguy/utils';
import { LocationCard } from '@/components/location-card';
import { SegmentedControl } from '@/components/segmented-control';
import type { LocationValue } from '@/components/location-input';
import { reverseGeocodeAddress } from '@/hooks/use-autocomplete';
import { ArrowLeft, Loader2, AlertCircle, Send } from 'lucide-react';
import dynamic from 'next/dynamic';

const ClientMap = dynamic(() => import('@/components/client-map'), { ssr: false });

const PAYMENT_TABS = [
  { key: 'CASH',         label: 'Cash'   },
  { key: 'MOBILE_MONEY', label: 'MoMo'   },
  { key: 'WALLET',       label: 'Wallet' },
];

export default function QuickSendPage() {
  const router = useRouter();
  const { api } = useAuth();

  const [pickup,         setPickup]         = useState<LocationValue>({ address: '', coordinates: null });
  const [dropoff,        setDropoff]        = useState<LocationValue>({ address: '', coordinates: null });
  const [locatingPickup, setLocatingPickup] = useState(true);
  const [paymentMethod,  setPaymentMethod]  = useState('CASH');
  const [estimate,       setEstimate]       = useState<{
    totalPrice: number;
    distanceKm: number;
    estimatedDurationMinutes: number;
  } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const dropoffRef       = useRef<HTMLInputElement>(null);
  const estimateAbortRef = useRef<AbortController>();

  // Wallet balance — shown as hint when Wallet payment tab is active
  const { data: walletData } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: async () => {
      const res = await api!.get('/wallets');
      return res.data.data ?? { balance: 0 };
    },
    enabled: !!api,
    staleTime: 60_000,
  });
  const walletBalance = walletData?.balance ?? 0;

  // Auto-detect pickup location on mount
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
          setTimeout(() => dropoffRef.current?.focus(), 200);
        }
      },
      () => {
        setLocatingPickup(false);
        setError('Location permission denied — tap pickup to set manually');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  // Auto-focus dropoff once pickup is resolved
  useEffect(() => {
    if (pickup.coordinates && !dropoff.coordinates) dropoffRef.current?.focus();
  }, [pickup.coordinates, dropoff.coordinates]);

  // Price estimation — debounced via AbortController
  useEffect(() => {
    if (!pickup.coordinates || !dropoff.coordinates || !api) {
      setEstimate(null);
      return;
    }
    estimateAbortRef.current?.abort();
    const controller = new AbortController();
    estimateAbortRef.current = controller;
    setEstimating(true);
    setError('');

    const [lng1, lat1] = pickup.coordinates;
    const [lng2, lat2] = dropoff.coordinates;

    api.post(
      '/orders/estimate',
      { pickupLatitude: lat1, pickupLongitude: lng1,
        dropoffLatitude: lat2, dropoffLongitude: lng2,
        packageType: 'SMALL_PARCEL', paymentMethod },
      { signal: controller.signal },
    )
      .then(res  => { setEstimate(res.data.data ?? null); setError(''); })
      .catch(err => {
        if (err?.code !== 'ERR_CANCELED')
          setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Could not estimate price');
      })
      .finally(() => setEstimating(false));

    return () => controller.abort();
  }, [pickup.coordinates, dropoff.coordinates, paymentMethod, api]);

  // Submit quick order
  const handleSend = useCallback(async () => {
    if (!api || !pickup.coordinates || !dropoff.coordinates || !estimate || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/orders', {
        pickupAddress:    pickup.address,
        pickupLatitude:   pickup.coordinates[1],
        pickupLongitude:  pickup.coordinates[0],
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
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }, [api, pickup, dropoff, estimate, paymentMethod, submitting, router]);

  const canSend = !!pickup.coordinates && !!dropoff.coordinates && !!estimate && !submitting;

  return (
    <div className="relative w-full" style={{ height: '100dvh' }}>

      {/* Full-screen map background */}
      <div className="absolute inset-0">
        <ClientMap />
      </div>

      {/* Floating top bar */}
      <div className="map-top-bar">
        <button onClick={() => router.back()} className="map-btn">
          <ArrowLeft className="h-5 w-5 text-surface-700" />
        </button>
        <span className="text-[16px] font-bold text-surface-900">Quick Send</span>
        <button
          onClick={() => router.push('/dashboard/send')}
          className="text-[13px] font-semibold text-brand-500"
        >
          More options
        </button>
      </div>

      {/* Bottom panel */}
      <div
        className="absolute left-0 right-0 bottom-0 bg-white"
        style={{
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.12), 0 -1px 4px rgba(0,0,0,0.06)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        }}
      >
        <div className="drag-handle" />

        <div className="px-5 space-y-4 mt-1">

          {/* Location card or loading skeleton */}
          {locatingPickup ? (
            <div className="location-card">
              <div className="flex items-center gap-3 py-3">
                <Loader2 className="h-4 w-4 text-brand-500 animate-spin flex-shrink-0" />
                <span className="text-[15px] text-surface-400">Detecting your location...</span>
              </div>
            </div>
          ) : (
            <LocationCard
              pickup={pickup}
              dropoff={dropoff}
              onPickupChange={setPickup}
              onDropoffChange={setDropoff}
              dropoffRef={dropoffRef}
              dropoffAutoFocus={!!pickup.coordinates}
            />
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-2xl bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-600 leading-snug">{error}</p>
            </div>
          )}

          {/* Payment method — 3-tab segmented control */}
          <SegmentedControl
            tabs={PAYMENT_TABS}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />

          {/* Wallet balance hint */}
          {paymentMethod === 'WALLET' && (
            <p className="text-[12px] text-surface-400 -mt-1">
              {walletBalance > 0
                ? <>Balance: <span className="font-semibold text-surface-700">{formatCurrency(walletBalance)}</span></>
                : 'No wallet balance — add funds first'}
            </p>
          )}

          {/* Price estimate row */}
          <div className="flex items-center justify-between" style={{ minHeight: 36 }}>
            {estimating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-brand-500 animate-spin" />
                <span className="text-[13px] text-surface-400">Calculating price...</span>
              </div>
            ) : estimate ? (
              <>
                <p className="text-[12px] text-surface-400">
                  {estimate.distanceKm?.toFixed(1)} km · ~{estimate.estimatedDurationMinutes} min
                </p>
                <p className="text-[24px] font-extrabold text-surface-900 leading-none">
                  {formatCurrency(estimate.totalPrice)}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-surface-400">
                {!pickup.coordinates
                  ? 'Set your location to begin'
                  : !dropoff.coordinates
                  ? 'Enter a destination to see price'
                  : 'Waiting for estimate...'}
              </p>
            )}
          </div>

          {/* Send Now CTA */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="btn-primary brand"
          >
            {submitting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Creating delivery...</>
            ) : estimate ? (
              <><Send className="h-5 w-5" /> Send Now · {formatCurrency(estimate.totalPrice)}</>
            ) : (
              <><Send className="h-5 w-5" /> Send Now</>
            )}
          </button>

        </div>
      </div>

    </div>
  );
}
