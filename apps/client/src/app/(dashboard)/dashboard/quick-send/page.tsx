'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { formatCurrency } from '@riderguy/utils';
import { LocationInput, type LocationValue } from '@/components/location-input';
import { reverseGeocodeAddress } from '@/hooks/use-autocomplete';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Crosshair,
  MapPin,
  Send,
  Banknote,
  Smartphone,
} from 'lucide-react';

export default function QuickSendPage() {
  const router = useRouter();
  const { api } = useAuth();

  // ── State ──
  const [pickup, setPickup] = useState<LocationValue>({ address: '', coordinates: null });
  const [dropoff, setDropoff] = useState<LocationValue>({ address: '', coordinates: null });
  const [locatingPickup, setLocatingPickup] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [estimate, setEstimate] = useState<{
    totalPrice: number;
    distanceKm: number;
    estimatedDurationMinutes: number;
  } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dropoffRef = useRef<HTMLInputElement>(null);
  const estimateAbortRef = useRef<AbortController>();

  // ── Auto-detect pickup on mount ──
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocatingPickup(false);
      return;
    }
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
        setError('Location permission denied — tap the pickup field to set manually');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // ── Auto-focus dropoff once pickup is set ──
  useEffect(() => {
    if (pickup.coordinates && !dropoff.coordinates) {
      dropoffRef.current?.focus();
    }
  }, [pickup.coordinates, dropoff.coordinates]);

  // ── Price estimation ──
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

    api
      .post(
        '/orders/estimate',
        {
          pickupLatitude: lat1,
          pickupLongitude: lng1,
          dropoffLatitude: lat2,
          dropoffLongitude: lng2,
          packageType: 'SMALL_PARCEL',
          paymentMethod,
        },
        { signal: controller.signal },
      )
      .then((res) => {
        setEstimate(res.data.data ?? null);
        setError('');
      })
      .catch((err) => {
        if (err?.code !== 'ERR_CANCELED') {
          const msg =
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            'Could not estimate price';
          setError(msg);
        }
      })
      .finally(() => setEstimating(false));

    return () => controller.abort();
  }, [pickup.coordinates, dropoff.coordinates, paymentMethod, api]);

  // ── Submit quick order ──
  const handleSend = useCallback(async () => {
    if (!api || !pickup.coordinates || !dropoff.coordinates || !estimate || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await api.post('/orders', {
        pickupAddress: pickup.address,
        pickupLatitude: pickup.coordinates[1],
        pickupLongitude: pickup.coordinates[0],
        dropoffAddress: dropoff.address,
        dropoffLatitude: dropoff.coordinates[1],
        dropoffLongitude: dropoff.coordinates[0],
        packageType: 'SMALL_PARCEL',
        paymentMethod,
        estimatedTotalPrice: estimate.totalPrice,
      });
      const orderId = res.data.data?.id;
      router.replace(orderId ? `/dashboard/orders/${orderId}/tracking` : '/dashboard/orders');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to create order');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [api, pickup, dropoff, estimate, paymentMethod, submitting, router]);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center btn-press"
          >
            <ArrowLeft className="h-5 w-5 text-surface-900" />
          </button>
          <h1 className="text-[17px] font-bold text-surface-900">Quick Send</h1>
        </div>
      </div>

      <div className="flex-1 px-5 pt-5 pb-40 space-y-4">
        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-danger-50 flex items-start gap-2.5 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        {/* Pickup — auto-detected */}
        <div>
          <p className="text-xs font-semibold text-surface-400 mb-1.5 flex items-center gap-1">
            <Crosshair className="h-3 w-3" /> Your location
          </p>
          {locatingPickup ? (
            <div className="h-12 flex items-center gap-2 px-4 bg-surface-50 rounded-xl">
              <Loader2 className="h-4 w-4 text-brand-500 animate-spin" />
              <span className="text-sm text-surface-500">Detecting your location...</span>
            </div>
          ) : (
            <LocationInput
              value={pickup}
              onChange={setPickup}
              placeholder="Search pickup location"
              showCurrentLocation
            />
          )}
        </div>

        {/* Dropoff — where are you sending? */}
        <div>
          <p className="text-xs font-semibold text-surface-400 mb-1.5 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Where are you sending?
          </p>
          <LocationInput
            value={dropoff}
            onChange={setDropoff}
            placeholder="Enter destination address"
            inputRef={dropoffRef}
            autoFocus={!!pickup.coordinates}
          />
        </div>

        {/* Payment toggle — simple 2-option */}
        <div className="flex gap-2">
          {[
            { value: 'CASH', label: 'Cash', icon: Banknote },
            { value: 'MOBILE_MONEY', label: 'MoMo', icon: Smartphone },
          ].map((m) => {
            const active = paymentMethod === m.value;
            return (
              <button
                key={m.value}
                onClick={() => setPaymentMethod(m.value)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 btn-press ${
                  active
                    ? 'bg-surface-900 text-white'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                <m.icon className={`h-4 w-4 ${active ? 'text-white' : 'text-surface-400'}`} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Need more options? Link to full Send form */}
        <button
          onClick={() => router.push('/dashboard/send')}
          className="w-full text-center text-xs text-surface-400 hover:text-brand-500 transition-colors py-2"
        >
          Need more options? Use detailed send →
        </button>
      </div>

      {/* ── Bottom bar: Price + Send button ── */}
      <div className="fixed bottom-0 left-0 right-0 safe-area-bottom bg-white border-t border-surface-100 px-5 py-4 z-30">
        {estimating ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
            <span className="text-sm text-surface-500">Getting price...</span>
          </div>
        ) : estimate ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-surface-400">
                  {estimate.distanceKm?.toFixed?.(1) ?? '—'} km · ~{estimate.estimatedDurationMinutes ?? '—'} min
                </p>
                <p className="text-xs text-surface-400">Small Parcel · {paymentMethod === 'CASH' ? 'Cash' : 'MoMo'}</p>
              </div>
              <p className="text-2xl font-extrabold text-surface-900">
                {formatCurrency(estimate.totalPrice)}
              </p>
            </div>
            <button
              onClick={handleSend}
              disabled={submitting}
              className="w-full h-14 rounded-2xl bg-surface-900 text-white font-bold text-base flex items-center justify-center gap-2 btn-press hover:bg-surface-800 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating delivery...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send Now · {formatCurrency(estimate.totalPrice)}
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="py-3 text-center">
            <p className="text-sm text-surface-400">
              {pickup.coordinates ? 'Enter destination to see price' : 'Set your location to begin'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
