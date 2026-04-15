'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { formatCurrency, haversineDistance } from '@riderguy/utils';
import { PACKAGE_TYPES, SCHEDULE_TYPES } from '@/lib/constants';
import { LocationInput, type LocationValue } from '@/components/location-input';
import { PriceBreakdown, type PriceEstimate } from '@/components/price-breakdown';
import { OrderConfirmation } from '@/components/order-confirmation';
import { useNearbyRiders } from '@/hooks/use-nearby-riders';
import {
  ArrowLeft,
  X,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Smartphone,
  Banknote,
  Send,
  Camera,
  Trash2,
  Plus,
  Zap,
  Tag,
  Weight,
  Clock,
  Wallet,
  WifiOff,
  Users,
} from 'lucide-react';

/** Haversine distance (km) between two [lng, lat] coordinate pairs */
function haversineKm(a: [number, number], b: [number, number]): number {
  return haversineDistance(a[1], a[0], b[1], b[0]);
}

const MAX_SERVICE_DISTANCE_KM = 50;

// Lazy-load route preview map (SSR-unsafe)
const RoutePreviewMap = dynamic(() => import('@/components/route-preview-map'), { ssr: false });

// ── Types ───────────────────────────────────────────

interface LocationData {
  location: LocationValue;
  contactName: string;
  contactPhone: string;
  notes: string;
}

const emptyLocationData = (): LocationData => ({
  location: { address: '', coordinates: null },
  contactName: '',
  contactPhone: '',
  notes: '',
});

// Compact package types — the 4 most common
const QUICK_PACKAGES = PACKAGE_TYPES.filter((p) =>
  ['SMALL_PARCEL', 'DOCUMENT', 'FOOD', 'FRAGILE'].includes(p.value),
);

const MAX_ADDITIONAL_STOPS = 3;

/** Compute a scheduledAt Date based on schedule type and selected time */
function computeScheduledAt(scheduleType: string, time: string): Date | null {
  if (scheduleType === 'NOW') return null;
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 9;
  const minutes = parts[1] ?? 0;
  const date = new Date();

  if (scheduleType === 'SAME_DAY') {
    date.setHours(hours, minutes, 0, 0);
    // If the chosen time is already past, bump 30 min from now
    if (date.getTime() <= Date.now()) {
      return new Date(Date.now() + 30 * 60 * 1000);
    }
    return date;
  }

  if (scheduleType === 'NEXT_DAY') {
    date.setDate(date.getDate() + 1);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  if (scheduleType === 'RECURRING') {
    // First occurrence: tomorrow at selected time
    date.setDate(date.getDate() + 1);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  return null;
}


// ── Page Component ──────────────────────────────────

export default function SendPackagePage() {
  const router = useRouter();
  const { api } = useAuth();

  // ── Form state ──
  const [pickup, setPickup] = useState<LocationData>(emptyLocationData());
  const [dropoff, setDropoff] = useState<LocationData>(emptyLocationData());
  const [additionalStops, setAdditionalStops] = useState<LocationValue[]>([]);
  const [packageType, setPackageType] = useState('SMALL_PARCEL');
  const [paymentMethod, setPaymentMethod] = useState('MOBILE_MONEY');
  const [scheduleType, setScheduleType] = useState('NOW');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [isExpress, setIsExpress] = useState(false);
  const [packageWeightKg, setPackageWeightKg] = useState<number | undefined>(undefined);
  const [promoCode, setPromoCode] = useState('');
  const [showAllPackages, setShowAllPackages] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // ── Nearby riders — shows availability before booking ──
  const { riders: nearbyRiders, count: nearbyRiderCount } = useNearbyRiders({
    coordinates: pickup.location.coordinates,
    radiusKm: 5,
    intervalMs: 15_000,
    enabled: !!pickup.location.coordinates,
  });

  // ── Detect iOS virtual keyboard via visualViewport ──
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // ── Estimate state ──
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const estimatedAtRef = useRef<number>(0);

  // ── Submission state ──
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // Synchronous guard against double-tap
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // ── Optional details ──
  const [showDetails, setShowDetails] = useState(false);
  const [packagePhotos, setPackagePhotos] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(packagePhotos);
  photosRef.current = packagePhotos;

  // ── Online / offline detection (#13) ──
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Location handlers ──

  const handlePickupChange = (loc: LocationValue) => {
    setPickup((prev) => ({ ...prev, location: loc }));
    if (loc.coordinates && !dropoff.location.coordinates) {
      setTimeout(() => {
        dropoffInputRef.current?.focus();
        // Brief pulse to draw attention
        dropoffInputRef.current?.classList.add('ring-2', 'ring-brand-400');
        setTimeout(() => dropoffInputRef.current?.classList.remove('ring-2', 'ring-brand-400'), 1500);
      }, 100);
    }
  };

  const handleDropoffChange = (loc: LocationValue) => {
    setDropoff((prev) => ({ ...prev, location: loc }));
  };

  // ── Multi-stop handlers ──

  const addStop = () => {
    if (additionalStops.length >= MAX_ADDITIONAL_STOPS) return;
    setAdditionalStops((prev) => [...prev, { address: '', coordinates: null }]);
  };

  const updateStop = (index: number, loc: LocationValue) => {
    setAdditionalStops((prev) => {
      const updated = [...prev];
      updated[index] = loc;
      return updated;
    });
  };

  const removeStop = (index: number) => {
    setAdditionalStops((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Photo handling ──

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - packagePhotos.length;
    if (remaining <= 0) return;

    const validFiles = files.slice(0, remaining).filter((f) => {
      const isValid = f.type.startsWith('image/') || f.type.startsWith('video/');
      const maxSize = f.type.startsWith('video/') ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
      return isValid && f.size <= maxSize;
    });

    const newPhotos = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPackagePhotos((prev) => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPackagePhotos((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index]!.preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  // ── Price estimation (debounced) ──

  const estimateTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const estimateAbortRef = useRef<AbortController>();
  const [distanceWarning, setDistanceWarning] = useState('');

  useEffect(() => {
    if (!pickup.location.coordinates || !dropoff.location.coordinates || !api) {
      setEstimate(null);
      setDistanceWarning('');
      return;
    }

    // Service area check (#9)
    const dist = haversineKm(pickup.location.coordinates, dropoff.location.coordinates);
    if (dist > MAX_SERVICE_DISTANCE_KM) {
      setEstimate(null);
      setDistanceWarning(`Distance is ~${Math.round(dist)} km. Our service currently covers up to ${MAX_SERVICE_DISTANCE_KM} km.`);
      return;
    }
    setDistanceWarning('');

    // Debounce non-location changes (#5, #14) — 400ms
    // Location changes fire immediately for responsive UX
    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    estimateAbortRef.current?.abort();

    const controller = new AbortController();
    estimateAbortRef.current = controller;
    setEstimating(true);

    const fire = () => {
      const [lng1, lat1] = pickup.location.coordinates!;
      const [lng2, lat2] = dropoff.location.coordinates!;

      const body: Record<string, unknown> = {
        pickupLatitude: lat1,
        pickupLongitude: lng1,
        dropoffLatitude: lat2,
        dropoffLongitude: lng2,
        packageType,
        paymentMethod,
      };

      const validStops = additionalStops.filter((s) => s.coordinates);
      if (validStops.length > 0) {
        body.additionalStops = validStops.length;
        body.stops = validStops.map((s) => ({
          type: 'DROPOFF',
          latitude: s.coordinates![1],
          longitude: s.coordinates![0],
        }));
      }
      if (scheduleType !== 'NOW') body.scheduleType = scheduleType;
      const computedScheduledAt = computeScheduledAt(scheduleType, scheduledTime);
      if (computedScheduledAt) body.scheduledAt = computedScheduledAt.toISOString();
      if (isExpress) body.isExpress = true;
      if (packageWeightKg && packageWeightKg > 0) body.packageWeightKg = packageWeightKg;
      if (promoCode.trim()) body.promoCode = promoCode.trim().toUpperCase();

      api
        .post('/orders/estimate', body, { signal: controller.signal })
        .then((res) => {
          setEstimate(res.data.data ?? null);
          estimatedAtRef.current = Date.now();
          setError('');
        })
        .catch((err) => {
          if (err?.code !== 'ERR_CANCELED') {
            setEstimate(null);
            // Show estimate error to user (#8)
            const msg =
              err?.response?.data?.error?.message ||
              err?.response?.data?.message ||
              'Could not get price estimate. Please check your inputs.';
            setError(msg);
          }
        })
        .finally(() => setEstimating(false));
    };

    estimateTimerRef.current = setTimeout(fire, 400);

    return () => {
      if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
      controller.abort();
    };
  }, [
    pickup.location.coordinates,
    dropoff.location.coordinates,
    packageType,
    paymentMethod,
    scheduleType,
    scheduledTime,
    additionalStops,
    isExpress,
    packageWeightKg,
    promoCode,
    api,
  ]);

  // ── Upload photos ──

  const uploadPackagePhotos = async (): Promise<string[]> => {
    if (!api || packagePhotos.length === 0) return [];
    const urls: string[] = [];
    let failedCount = 0;
    for (const { file } of packagePhotos) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/orders/upload-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.data?.url) urls.push(res.data.data.url);
        else failedCount++;
      } catch {
        failedCount++;
      }
    }
    if (failedCount > 0 && urls.length === 0) {
      throw new Error(`All ${failedCount} photo upload(s) failed. Please try again.`);
    }
    if (failedCount > 0) {
      setError(`${failedCount} photo(s) failed to upload — continuing with ${urls.length}.`);
    }
    return urls;
  };

  // ── Can submit? ──

  const canSubmit =
    !!api &&
    isOnline &&
    !!pickup.location.address &&
    !!pickup.location.coordinates &&
    !!dropoff.location.address &&
    !!dropoff.location.coordinates &&
    !!estimate &&
    !distanceWarning;

  // ── Submit handler ──

  const handleConfirm = useCallback(async (): Promise<string | null> => {
    if (!api || !canSubmit || submittingRef.current) return null;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');

    try {
      const photoUrls = await uploadPackagePhotos();

      const body: Record<string, unknown> = {
        pickupAddress: pickup.location.address,
        pickupLatitude: pickup.location.coordinates![1],
        pickupLongitude: pickup.location.coordinates![0],
        dropoffAddress: dropoff.location.address,
        dropoffLatitude: dropoff.location.coordinates![1],
        dropoffLongitude: dropoff.location.coordinates![0],
        packageType,
        paymentMethod,
        // Send confirmed estimate so server can reject if price drifted significantly
        estimatedTotalPrice: estimate?.totalPrice,
      };

      if (isExpress) body.isExpress = true;
      if (packageWeightKg && packageWeightKg > 0) body.packageWeightKg = packageWeightKg;
      if (promoCode.trim()) body.promoCode = promoCode.trim().toUpperCase();

      if (photoUrls.length > 0) body.packagePhotoUrl = photoUrls.join(',');
      if (pickup.contactName) body.pickupContactName = pickup.contactName;
      if (pickup.contactPhone) body.pickupContactPhone = pickup.contactPhone;
      if (pickup.notes) body.pickupInstructions = pickup.notes;
      if (dropoff.contactName) body.dropoffContactName = dropoff.contactName;
      if (dropoff.contactPhone) body.dropoffContactPhone = dropoff.contactPhone;
      if (dropoff.notes) body.dropoffInstructions = dropoff.notes;

      // Multi-stop support
      const validStops = additionalStops.filter((s) => s.coordinates && s.address);
      if (validStops.length > 0) {
        body.stops = validStops.map((stop, i) => ({
          type: 'DROPOFF',
          sequence: i + 1,
          address: stop.address,
          latitude: stop.coordinates![1],
          longitude: stop.coordinates![0],
        }));
      }

      // Scheduling
      if (scheduleType !== 'NOW') {
        body.scheduleType = scheduleType;
        const scheduledAt = computeScheduledAt(scheduleType, scheduledTime);
        if (scheduledAt) {
          body.isScheduled = true;
          body.scheduledAt = scheduledAt.toISOString();
        }
      }

      const res = await api.post('/orders', body);
      const orderId = res.data.data?.id;

      // Always go to tracking — payment is collected post-delivery
      router.replace(orderId ? `/dashboard/orders/${orderId}/tracking` : '/dashboard/orders');

      return orderId ?? null;
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to create order.');
      setError(message);
      return null;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, canSubmit, pickup, dropoff, packageType, paymentMethod, additionalStops, scheduleType, scheduledTime, estimate, packagePhotos, isExpress, packageWeightKg, promoCode]);

  // ── Render ──

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter flex flex-col">
      {/* ── Header ── */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center btn-press"
          >
            <ArrowLeft className="h-5 w-5 text-surface-900" />
          </button>
          <h1 className="text-[17px] font-bold text-surface-900">Send Package</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-5 pb-32">
        {/* ── Offline banner ── */}
        {!isOnline && (
          <div className="p-3.5 rounded-xl bg-surface-100 flex items-center gap-2.5">
            <WifiOff className="h-4 w-4 text-surface-500 shrink-0" />
            <p className="text-sm font-medium text-surface-600">You&apos;re offline — reconnect to send packages.</p>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && !showConfirmation && (
          <div className="p-3.5 rounded-xl bg-danger-50 flex items-start gap-2.5 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            Section 1: Route — Pickup → Stops → Dropoff
            ═══════════════════════════════════════════ */}
        <div className="relative">
          <div className="flex items-start gap-3">
            {/* Dot connector */}
            <div className="flex flex-col items-center pt-4 shrink-0">
              {/* Pickup dot */}
              <div className="h-3 w-3 rounded-full bg-brand-500" />
              <div className="w-0.5 h-10 bg-surface-200 rounded-full" />
              {/* Additional stop dots */}
              {additionalStops.map((_, i) => (
                <div key={`dot-${i}`} className="flex flex-col items-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-amber-100" />
                  <div className="w-0.5 h-10 bg-surface-200 rounded-full" />
                </div>
              ))}
              {/* Dropoff dot */}
              <div className="h-3 w-3 rounded-full bg-surface-900 ring-2 ring-surface-300" />
            </div>

            {/* Address inputs */}
            <div className="flex-1 space-y-2">
              <LocationInput
                value={pickup.location}
                onChange={handlePickupChange}
                placeholder="Search pickup location"
                showCurrentLocation
              />

              {/* Additional stops */}
              {additionalStops.map((stop, i) => (
                <div key={i} className="relative animate-slide-up">
                  <LocationInput
                    value={stop}
                    onChange={(loc) => updateStop(i, loc)}
                    placeholder={`Stop ${i + 1}`}
                  />
                  <button
                    onClick={() => removeStop(i)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-surface-200 flex items-center justify-center hover:bg-danger-100 transition-colors z-10"
                  >
                    <X className="h-3 w-3 text-surface-500" />
                  </button>
                </div>
              ))}

              <LocationInput
                value={dropoff.location}
                onChange={handleDropoffChange}
                placeholder="Search delivery location"
                inputRef={dropoffInputRef}
              />
            </div>
          </div>

          {/* Add stop button */}
          {additionalStops.length < MAX_ADDITIONAL_STOPS && (
            <button
              onClick={addStop}
              className="mt-2 ml-6 flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors btn-press"
            >
              <Plus className="h-3.5 w-3.5" />
              Add stop (+GH₵3 each)
            </button>
          )}
        </div>

        {/* ── Route Preview Map ── */}
        {(pickup.location.coordinates || dropoff.location.coordinates) && (
          <div className="space-y-2">
            <RoutePreviewMap
              pickupCoords={pickup.location.coordinates as [number, number] | null}
              dropoffCoords={dropoff.location.coordinates as [number, number] | null}
              nearbyRiders={nearbyRiders}
              className="h-[180px]"
            />

            {/* Nearby riders availability indicator */}
            {pickup.location.coordinates && (
              <div className="flex items-center gap-2 px-1">
                <Users className="h-3.5 w-3.5 text-surface-400" />
                {nearbyRiderCount > 0 ? (
                  <p className="text-xs text-surface-500">
                    <span className="font-semibold text-brand-600">{nearbyRiderCount}</span> rider{nearbyRiderCount !== 1 ? 's' : ''} nearby
                  </p>
                ) : (
                  <p className="text-xs text-amber-600">
                    No riders nearby right now. Your order will be queued.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Distance warning */}
        {distanceWarning && (
          <div className="p-3.5 rounded-xl bg-amber-50 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">{distanceWarning}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            Section 2: Package Type — pills
            ═══════════════════════════════════════════ */}
        <div>
          <p className="text-xs font-semibold text-surface-500 mb-2.5">What are you sending?</p>
          <div className="flex gap-2 flex-wrap">
            {(showAllPackages ? PACKAGE_TYPES : QUICK_PACKAGES).map(({ value, label, emoji }) => {
              const active = packageType === value;
              return (
                <button
                  key={value}
                  onClick={() => setPackageType(value)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all btn-press ${
                    active
                      ? 'bg-surface-900 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  <span>{emoji}</span> {label}
                </button>
              );
            })}
            <button
              onClick={() => setShowAllPackages(!showAllPackages)}
              className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-full text-xs font-medium text-surface-400 bg-surface-50 hover:bg-surface-100 transition-colors btn-press"
            >
              {showAllPackages ? (
                <>Less <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>More <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            Section 3: Schedule Type
            ═══════════════════════════════════════════ */}
        <div>
          <p className="text-xs font-semibold text-surface-500 mb-2.5">When?</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {SCHEDULE_TYPES.map((s) => {
              const active = scheduleType === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setScheduleType(s.value)}
                  className={`shrink-0 flex flex-col items-center px-4 py-2 rounded-xl text-center transition-all btn-press min-w-[72px] ${
                    active
                      ? 'bg-surface-900 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  <span className="text-sm font-semibold">{s.label}</span>
                  {s.discount && (
                    <span className={`text-[10px] font-medium mt-0.5 ${active ? 'text-brand-300' : 'text-brand-500'}`}>
                      {s.discount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Time picker — shown for SAME_DAY, NEXT_DAY, RECURRING */}
          {scheduleType !== 'NOW' && (
            <>
              <div className="flex items-center gap-3 mt-3 px-4 py-2.5 bg-surface-50 rounded-xl animate-slide-up">
                <Clock className="h-4 w-4 text-surface-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-surface-500">
                    {scheduleType === 'SAME_DAY' ? 'Pickup time today' :
                     scheduleType === 'NEXT_DAY' ? 'Pickup time tomorrow' :
                     'First pickup time'}
                  </p>
                </div>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-surface-800 outline-none"
                />
              </div>
              {scheduleType === 'SAME_DAY' && (() => {
                const [h, m] = scheduledTime.split(':').map(Number);
                const selected = new Date();
                selected.setHours(h ?? 9, m ?? 0, 0, 0);
                return selected.getTime() <= Date.now();
              })() && (
                <p className="text-[11px] text-amber-600 px-1 -mt-0.5">
                  Selected time has passed. Delivery will be scheduled ~30 min from now.
                </p>
              )}
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            Section 4: Payment Method
            ═══════════════════════════════════════════ */}
        <div>
          <p className="text-xs font-semibold text-surface-500 mb-2.5">Pay with</p>
          <div className="flex gap-2">
            {[
              { value: 'MOBILE_MONEY', label: 'MoMo', icon: Smartphone },
              { value: 'CASH', label: 'Cash', icon: Banknote },
              { value: 'CARD', label: 'Card', icon: CreditCard },
              { value: 'WALLET', label: 'Wallet', icon: Wallet },
            ].map((m) => {
              const active = paymentMethod === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 btn-press ${
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
        </div>

        {/* ═══════════════════════════════════════════
            Section 5: Express, Weight & Promo
            ═══════════════════════════════════════════ */}
        <div className="space-y-3">
          {/* Express toggle */}
          <button
            onClick={() => setIsExpress(!isExpress)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all btn-press ${
              isExpress
                ? 'bg-brand-50 border-2 border-brand-500'
                : 'bg-surface-50 border-2 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Zap className={`h-4 w-4 ${isExpress ? 'text-brand-600' : 'text-surface-400'}`} />
              <div className="text-left">
                <p className={`text-sm font-semibold ${isExpress ? 'text-brand-700' : 'text-surface-700'}`}>
                  Express Delivery
                </p>
                <p className="text-[11px] text-surface-400">Priority pickup, 50% faster</p>
              </div>
            </div>
            <div className={`h-6 w-11 rounded-full transition-colors flex items-center ${
              isExpress ? 'bg-brand-500 justify-end' : 'bg-surface-300 justify-start'
            }`}>
              <div className="h-5 w-5 rounded-full bg-white shadow-sm mx-0.5" />
            </div>
          </button>
          {isExpress && estimate?.expressIgnored && (
            <p className="text-[11px] text-amber-600 px-1 -mt-1">
              Express not available for distances over 15 km. Standard delivery applies.
            </p>
          )}

          {/* Weight input */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-50 rounded-xl">
            <Weight className="h-4 w-4 text-surface-400 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-surface-500">Est. weight (kg)</p>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={packageWeightKg ?? ''}
                onChange={(e) => {
                  const v = e.target.value ? parseFloat(e.target.value) : undefined;
                  if (v !== undefined && v > 30) return; // Max 30kg (motorcycle limit)
                  setPackageWeightKg(v && v > 0 ? v : undefined);
                }}
                placeholder="Optional"
                className="w-full bg-transparent text-sm text-surface-800 font-medium outline-none placeholder:text-surface-300 mt-0.5"
              />
            </div>
            {packageWeightKg && packageWeightKg > 20 && (
              <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                Heavy
              </span>
            )}
            {packageWeightKg && packageWeightKg > 5 && packageWeightKg <= 20 && (
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                +surcharge
              </span>
            )}
          </div>
          {packageWeightKg && packageWeightKg > 20 && (
            <p className="text-[11px] text-red-600 px-1 -mt-1">
              Packages over 20 kg may require special handling. Max 30 kg for motorcycle delivery.
            </p>
          )}

          {/* Promo code input */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-50 rounded-xl">
            <Tag className="h-4 w-4 text-surface-400 shrink-0" />
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Promo code"
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
              className="flex-1 bg-transparent text-sm text-surface-800 font-semibold outline-none placeholder:text-surface-300 uppercase tracking-wider"
            />
            {promoCode && estimate?.promoDiscount && estimate.promoDiscount > 0 && !estimate.promoError && (
              <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Applied!
              </span>
            )}
          </div>
          {promoCode && estimate?.promoError && (
            <p className="text-[11px] text-red-500 px-5 -mt-1">{estimate.promoError}</p>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            Section 6: Optional Details (collapsible)
            ═══════════════════════════════════════════ */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between py-2 text-sm font-medium text-surface-400 hover:text-surface-600 transition-colors"
        >
          <span>Add details (optional)</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
          />
        </button>

        {showDetails && (
          <div className="space-y-4 animate-slide-up pb-2">
            {/* Pickup details */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-surface-500">Pickup details</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={pickup.contactName}
                  onChange={(e) => setPickup({ ...pickup, contactName: e.target.value })}
                  placeholder="Sender name"
                  className="input-uber text-sm !h-12"
                />
                <input
                  type="tel"
                  inputMode="tel"
                  value={pickup.contactPhone}
                  onChange={(e) => setPickup({ ...pickup, contactPhone: e.target.value.replace(/[^\d+\s()-]/g, '') })}
                  placeholder="0XX XXX XXXX"
                  maxLength={15}
                  className="input-uber text-sm !h-12"
                />
              </div>
              <input
                value={pickup.notes}
                onChange={(e) => setPickup({ ...pickup, notes: e.target.value })}
                placeholder="Pickup notes (gate code, floor...)"
                className="input-uber text-sm !h-12 w-full"
              />
            </div>

            {/* Dropoff details */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-surface-500">Delivery details</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={dropoff.contactName}
                  onChange={(e) => setDropoff({ ...dropoff, contactName: e.target.value })}
                  placeholder="Recipient name"
                  className="input-uber text-sm !h-12"
                />
                <input
                  type="tel"
                  inputMode="tel"
                  value={dropoff.contactPhone}
                  onChange={(e) => setDropoff({ ...dropoff, contactPhone: e.target.value.replace(/[^\d+\s()-]/g, '') })}
                  placeholder="0XX XXX XXXX"
                  maxLength={15}
                  className="input-uber text-sm !h-12"
                />
              </div>
              <input
                value={dropoff.notes}
                onChange={(e) => setDropoff({ ...dropoff, notes: e.target.value })}
                placeholder="Delivery notes (leave at reception...)"
                className="input-uber text-sm !h-12 w-full"
              />
            </div>

            {/* Package photos */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-surface-500">Package photos</p>
              <p className="text-xs text-surface-400 -mt-1">
                Add up to 3 photos or short videos of your package
              </p>

              <div className="flex gap-2.5 flex-wrap">
                {packagePhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative h-20 w-20 rounded-xl overflow-hidden border border-surface-200 group"
                  >
                    {photo.file.type.startsWith('video/') ? (
                      <video src={photo.preview} className="h-full w-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.preview}
                        alt={`Package ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center md:hidden"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {packagePhotos.length < 3 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-20 w-20 rounded-xl border-2 border-dashed border-surface-300 flex flex-col items-center justify-center gap-1 text-surface-400 hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50/30 transition-all btn-press"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Add</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          Bottom Bar: Price Summary + Review Button
          — Hidden when iOS keyboard is open to prevent floating
          ═══════════════════════════════════════════ */}
      {!keyboardOpen && (
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-surface-100 safe-area-bottom z-30">
        <div className="px-5 py-4 flex items-center gap-4">
          {/* Price summary */}
          <div className="flex-1 min-w-0">
            {estimating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-surface-400 animate-spin" />
                <span className="text-sm text-surface-400">Estimating...</span>
              </div>
            ) : estimate ? (
              <PriceBreakdown estimate={estimate} variant="compact" />
            ) : (
              <p className="text-sm text-surface-400">Enter both addresses</p>
            )}
          </div>

          {/* Review & Send button */}
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!canSubmit || submitting}
            className="h-12 px-7 rounded-full bg-surface-900 text-white font-semibold text-sm hover:bg-surface-800 transition-all btn-press disabled:opacity-40 flex items-center gap-2 shrink-0"
          >
            <Send className="h-4 w-4" />
            Review
          </button>
        </div>
      </div>
      )}

      {/* ═══════════════════════════════════════════
          Confirmation Bottom Sheet
          ═══════════════════════════════════════════ */}
      {estimate && (
        <OrderConfirmation
          open={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          estimate={estimate}
          pickup={pickup}
          dropoff={dropoff}
          packageType={packageType}
          paymentMethod={paymentMethod}
          scheduleType={scheduleType}
          additionalStops={additionalStops.filter((s) => s.coordinates).length}
          packagePhotos={packagePhotos}
          isExpress={isExpress}
          submitting={submitting}
          submitError={error}
          estimatedAt={estimatedAtRef.current}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
