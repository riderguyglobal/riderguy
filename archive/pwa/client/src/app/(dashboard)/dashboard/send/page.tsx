'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { formatCurrency, haversineDistance } from '@riderguy/utils';
import { PACKAGE_TYPES, SCHEDULE_TYPES, MAX_SERVICE_DISTANCE_KM } from '@/lib/constants';
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
  Send,
  Camera,
  Trash2,
  Plus,
  Zap,
  Tag,
  Weight,
  Clock,
  Users,
  WifiOff,
} from 'lucide-react';

function haversineKm(a: [number, number], b: [number, number]): number {
  return haversineDistance(a[1], a[0], b[1], b[0]);
}

const RoutePreviewMap = dynamic(() => import('@/components/route-preview-map'), { ssr: false });

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

const QUICK_PACKAGES = PACKAGE_TYPES.filter(p =>
  ['SMALL_PARCEL', 'DOCUMENT', 'FOOD', 'FRAGILE'].includes(p.value),
);

const MAX_ADDITIONAL_STOPS = 3;

const PAYMENT_TABS = [
  { key: 'MOBILE_MONEY', label: 'MoMo'   },
  { key: 'CASH',         label: 'Cash'   },
  { key: 'CARD',         label: 'Card'   },
  { key: 'WALLET',       label: 'Wallet' },
];

function computeScheduledAt(scheduleType: string, time: string): Date | null {
  if (scheduleType === 'NOW') return null;
  const parts  = time.split(':').map(Number);
  const hours  = parts[0] ?? 9;
  const minutes = parts[1] ?? 0;
  const date   = new Date();

  if (scheduleType === 'SAME_DAY') {
    date.setHours(hours, minutes, 0, 0);
    if (date.getTime() <= Date.now()) return new Date(Date.now() + 30 * 60 * 1000);
    return date;
  }
  if (scheduleType === 'NEXT_DAY' || scheduleType === 'RECURRING') {
    date.setDate(date.getDate() + 1);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
  return null;
}

export default function SendPackagePage() {
  const router    = useRouter();
  const { api }   = useAuth();

  // ── Form state ──────────────────────────────────────
  const [pickup,          setPickup]          = useState<LocationData>(emptyLocationData());
  const [dropoff,         setDropoff]         = useState<LocationData>(emptyLocationData());
  const [additionalStops, setAdditionalStops] = useState<LocationValue[]>([]);
  const [packageType,     setPackageType]     = useState('SMALL_PARCEL');
  const [paymentMethod,   setPaymentMethod]   = useState('MOBILE_MONEY');
  const [scheduleType,    setScheduleType]    = useState('NOW');
  const [scheduledTime,   setScheduledTime]   = useState('09:00');
  const [isExpress,       setIsExpress]       = useState(false);
  const [packageWeightKg, setPackageWeightKg] = useState<number | undefined>(undefined);
  const [promoCode,       setPromoCode]       = useState('');
  const [showAllPackages, setShowAllPackages] = useState(false);
  const [keyboardOpen,    setKeyboardOpen]    = useState(false);

  // ── Nearby riders ────────────────────────────────────
  const { riders: nearbyRiders, count: nearbyRiderCount } = useNearbyRiders({
    coordinates: pickup.location.coordinates,
    radiusKm: 5,
    intervalMs: 15_000,
    enabled: !!pickup.location.coordinates,
  });

  // ── iOS keyboard detection ────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // ── Estimate state ────────────────────────────────────
  const [estimate,   setEstimate]   = useState<PriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const estimatedAtRef = useRef<number>(0);

  // ── Submission state ──────────────────────────────────
  const [submitting,       setSubmitting]       = useState(false);
  const submittingRef      = useRef(false);
  const [error,            setError]            = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // ── Optional details ──────────────────────────────────
  const [showDetails,      setShowDetails]      = useState(false);
  const [showWhenDropdown, setShowWhenDropdown] = useState(false);
  const [showPayDropdown,  setShowPayDropdown]  = useState(false);
  const [packagePhotos, setPackagePhotos] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const photosRef       = useRef(packagePhotos);
  photosRef.current     = packagePhotos;

  // ── Online/offline ────────────────────────────────────
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Location handlers ─────────────────────────────────
  const handlePickupChange = (loc: LocationValue) => {
    setPickup(prev => ({ ...prev, location: loc }));
    if (loc.coordinates && !dropoff.location.coordinates) {
      setTimeout(() => {
        dropoffInputRef.current?.focus();
        dropoffInputRef.current?.classList.add('ring-2', 'ring-brand-400');
        setTimeout(() => dropoffInputRef.current?.classList.remove('ring-2', 'ring-brand-400'), 1500);
      }, 100);
    }
  };

  const handleDropoffChange = (loc: LocationValue) =>
    setDropoff(prev => ({ ...prev, location: loc }));

  // ── Multi-stop handlers ───────────────────────────────
  const addStop    = () => {
    if (additionalStops.length < MAX_ADDITIONAL_STOPS)
      setAdditionalStops(prev => [...prev, { address: '', coordinates: null }]);
  };
  const updateStop = (i: number, loc: LocationValue) =>
    setAdditionalStops(prev => { const u = [...prev]; u[i] = loc; return u; });
  const removeStop = (i: number) =>
    setAdditionalStops(prev => prev.filter((_, idx) => idx !== i));

  // ── Photo handling ────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files     = Array.from(e.target.files || []);
    const remaining = 3 - packagePhotos.length;
    if (remaining <= 0) return;
    const valid = files.slice(0, remaining).filter(f => {
      const ok  = f.type.startsWith('image/') || f.type.startsWith('video/');
      const max = f.type.startsWith('video/') ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
      return ok && f.size <= max;
    });
    setPackagePhotos(prev => [...prev, ...valid.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
    e.target.value = '';
  };

  const removePhoto = (i: number) =>
    setPackagePhotos(prev => {
      const u = [...prev];
      URL.revokeObjectURL(u[i]!.preview);
      u.splice(i, 1);
      return u;
    });

  useEffect(() => () => { photosRef.current.forEach(p => URL.revokeObjectURL(p.preview)); }, []);

  // ── Price estimation (debounced 400ms) ────────────────
  const estimateTimerRef  = useRef<ReturnType<typeof setTimeout>>();
  const estimateAbortRef  = useRef<AbortController>();
  const [distanceWarning, setDistanceWarning] = useState('');

  useEffect(() => {
    if (!pickup.location.coordinates || !dropoff.location.coordinates || !api) {
      setEstimate(null);
      setDistanceWarning('');
      return;
    }
    const dist = haversineKm(pickup.location.coordinates, dropoff.location.coordinates);
    if (dist > MAX_SERVICE_DISTANCE_KM) {
      setEstimate(null);
      setDistanceWarning(`Distance is ~${Math.round(dist)} km. Our service covers up to ${MAX_SERVICE_DISTANCE_KM} km.`);
      return;
    }
    setDistanceWarning('');

    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    estimateAbortRef.current?.abort();
    const controller = new AbortController();
    estimateAbortRef.current = controller;
    setEstimating(true);

    const fire = () => {
      const [lng1, lat1] = pickup.location.coordinates!;
      const [lng2, lat2] = dropoff.location.coordinates!;
      const body: Record<string, unknown> = {
        pickupLatitude: lat1, pickupLongitude: lng1,
        dropoffLatitude: lat2, dropoffLongitude: lng2,
        packageType, paymentMethod,
      };
      const validStops = additionalStops.filter(s => s.coordinates);
      if (validStops.length > 0) {
        body.additionalStops = validStops.length;
        body.stops = validStops.map(s => ({ type: 'DROPOFF', latitude: s.coordinates![1], longitude: s.coordinates![0] }));
      }
      if (scheduleType !== 'NOW') body.scheduleType = scheduleType;
      const at = computeScheduledAt(scheduleType, scheduledTime);
      if (at) body.scheduledAt = at.toISOString();
      if (isExpress)                          body.isExpress         = true;
      if (packageWeightKg && packageWeightKg > 0) body.packageWeightKg = packageWeightKg;
      if (promoCode.trim())                   body.promoCode         = promoCode.trim().toUpperCase();

      api.post('/orders/estimate', body, { signal: controller.signal })
        .then(res => { setEstimate(res.data.data ?? null); estimatedAtRef.current = Date.now(); setError(''); })
        .catch(err => {
          if (err?.code !== 'ERR_CANCELED') {
            setEstimate(null);
            setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Could not get price estimate.');
          }
        })
        .finally(() => setEstimating(false));
    };

    estimateTimerRef.current = setTimeout(fire, 400);
    return () => { if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current); controller.abort(); };
  }, [pickup.location.coordinates, dropoff.location.coordinates, packageType, paymentMethod,
      scheduleType, scheduledTime, additionalStops, isExpress, packageWeightKg, promoCode, api]);

  // ── Photo upload ──────────────────────────────────────
  const uploadPackagePhotos = async (): Promise<string[]> => {
    if (!api || packagePhotos.length === 0) return [];
    const urls: string[] = [];
    const failed: string[] = [];
    for (const { file } of packagePhotos) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const ac    = new AbortController();
        const timer = setTimeout(() => ac.abort(), 30_000);
        try {
          const res = await api.post('/orders/upload-photo', fd, { headers: { 'Content-Type': 'multipart/form-data' }, signal: ac.signal });
          if (res.data?.data?.url) urls.push(res.data.data.url); else failed.push(file.name);
        } finally { clearTimeout(timer); }
      } catch { failed.push(file.name); }
    }
    if (failed.length > 0 && urls.length === 0) throw new Error(`All ${failed.length} photo upload(s) failed: ${failed.join(', ')}.`);
    if (failed.length > 0) setError(`${failed.length} photo(s) failed (${failed.join(', ')}) — continuing with ${urls.length}.`);
    return urls;
  };

  // ── Can submit? ───────────────────────────────────────
  const canSubmit =
    !!api && isOnline &&
    !!pickup.location.address  && !!pickup.location.coordinates &&
    !!dropoff.location.address && !!dropoff.location.coordinates &&
    !!estimate && !distanceWarning;

  // ── Submit handler ────────────────────────────────────
  const handleConfirm = useCallback(async (): Promise<string | null> => {
    if (!api || !canSubmit || submittingRef.current) return null;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');

    const submitAbort = new AbortController();
    const submitTimer = setTimeout(() => submitAbort.abort(), 60_000);

    try {
      const photoUrls = await uploadPackagePhotos();

      let confirmedEstimate = estimate;
      if (estimatedAtRef.current && Date.now() - estimatedAtRef.current > 120_000) {
        try {
          const rb: Record<string, unknown> = {
            pickupLatitude:  pickup.location.coordinates![1], pickupLongitude:  pickup.location.coordinates![0],
            dropoffLatitude: dropoff.location.coordinates![1], dropoffLongitude: dropoff.location.coordinates![0],
            packageType, paymentMethod,
          };
          const vs = additionalStops.filter(s => s.coordinates);
          if (vs.length > 0) {
            rb.additionalStops = vs.length;
            rb.stops = vs.map(s => ({ type: 'DROPOFF', latitude: s.coordinates![1], longitude: s.coordinates![0] }));
          }
          if (scheduleType !== 'NOW') rb.scheduleType = scheduleType;
          const at = computeScheduledAt(scheduleType, scheduledTime);
          if (at) rb.scheduledAt = at.toISOString();
          if (isExpress)                              rb.isExpress         = true;
          if (packageWeightKg && packageWeightKg > 0) rb.packageWeightKg = packageWeightKg;
          if (promoCode.trim())                       rb.promoCode         = promoCode.trim().toUpperCase();

          const res = await api.post('/orders/estimate', rb, { signal: submitAbort.signal });
          confirmedEstimate = res.data?.data ?? null;
          if (confirmedEstimate) { setEstimate(confirmedEstimate); estimatedAtRef.current = Date.now(); }
        } catch { /* non-fatal — server validates ±15% */ }
      }

      const body: Record<string, unknown> = {
        pickupAddress:    pickup.location.address,  pickupLatitude:   pickup.location.coordinates![1], pickupLongitude:  pickup.location.coordinates![0],
        dropoffAddress:   dropoff.location.address, dropoffLatitude:  dropoff.location.coordinates![1], dropoffLongitude: dropoff.location.coordinates![0],
        packageType, paymentMethod,
        estimatedTotalPrice: confirmedEstimate?.totalPrice,
      };

      if (isExpress)                              body.isExpress         = true;
      if (packageWeightKg && packageWeightKg > 0) body.packageWeightKg = packageWeightKg;
      if (promoCode.trim())                       body.promoCode         = promoCode.trim().toUpperCase();
      if (photoUrls.length > 0)                   body.packagePhotoUrl   = photoUrls.join(',');
      if (pickup.contactName)   body.pickupContactName   = pickup.contactName;
      if (pickup.contactPhone)  body.pickupContactPhone  = pickup.contactPhone;
      if (pickup.notes)         body.pickupInstructions  = pickup.notes;
      if (dropoff.contactName)  body.dropoffContactName  = dropoff.contactName;
      if (dropoff.contactPhone) body.dropoffContactPhone = dropoff.contactPhone;
      if (dropoff.notes)        body.dropoffInstructions = dropoff.notes;

      const validStops = additionalStops.filter(s => s.coordinates && s.address);
      if (validStops.length > 0)
        body.stops = validStops.map((s, i) => ({ type: 'DROPOFF', sequence: i + 1, address: s.address, latitude: s.coordinates![1], longitude: s.coordinates![0] }));

      if (scheduleType !== 'NOW') {
        body.scheduleType = scheduleType;
        const at = computeScheduledAt(scheduleType, scheduledTime);
        if (at) { body.isScheduled = true; body.scheduledAt = at.toISOString(); }
      }

      const res     = await api.post('/orders', body, { signal: submitAbort.signal });
      const orderId = res.data.data?.id;
      router.replace(orderId ? `/dashboard/orders/${orderId}/tracking` : '/dashboard/orders');
      return orderId ?? null;
    } catch (err: any) {
      setError(
        err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED'
          ? 'Request timed out. Check your connection and try again.'
          : err?.response?.data?.error?.message || err?.response?.data?.message || (err instanceof Error ? err.message : 'Failed to create order.'),
      );
      return null;
    } finally {
      clearTimeout(submitTimer);
      submittingRef.current = false;
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, canSubmit, pickup, dropoff, packageType, paymentMethod, additionalStops, scheduleType, scheduledTime, estimate, packagePhotos, isExpress, packageWeightKg, promoCode]);

  // ── Render ────────────────────────────────────────────

  const pkgList = showAllPackages ? PACKAGE_TYPES : QUICK_PACKAGES;

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter flex flex-col">

      {/* Top bar */}
      <div
        className="bg-white sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button
          onClick={() => router.back()}
          className="map-btn bg-surface-100 !shadow-none"
        >
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <h1 className="text-[17px] font-bold text-surface-900 flex-1">Send Package</h1>
        {nearbyRiderCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50">
            <Users className="h-3.5 w-3.5 text-brand-600" />
            <span className="text-[12px] font-semibold text-brand-700">{nearbyRiderCount} nearby</span>
          </div>
        )}
      </div>

      <div className="flex-1 px-5 pb-24 space-y-4">

        {/* Offline banner */}
        {!isOnline && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-surface-100">
            <WifiOff className="h-4 w-4 text-surface-500 flex-shrink-0" />
            <p className="text-[13px] font-medium text-surface-600">You're offline — reconnect to send packages.</p>
          </div>
        )}

        {/* Error banner */}
        {error && !showConfirmation && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-600 leading-snug">{error}</p>
          </div>
        )}

        {/* ── Section: Route ───────────────────────────── */}
        <div>
          <div className="relative flex items-start gap-3">
            {/* Dot connector */}
            <div className="flex flex-col items-center pt-5 flex-shrink-0">
              <span className="dot-pickup" />
              <div className="w-px bg-surface-200 flex-1 my-1.5" style={{ minHeight: 28 }} />
              {additionalStops.map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="dot-stop" />
                  <div className="w-px bg-surface-200 my-1.5" style={{ height: 28 }} />
                </div>
              ))}
              <span className="dot-dropoff" />
            </div>

            {/* Inputs */}
            <div className="flex-1 space-y-2 min-w-0">
              <LocationInput
                value={pickup.location}
                onChange={handlePickupChange}
                placeholder="Pickup location"
                showCurrentLocation
              />
              {additionalStops.map((stop, i) => (
                <div key={i} className="relative">
                  <LocationInput
                    value={stop}
                    onChange={loc => updateStop(i, loc)}
                    placeholder={`Stop ${i + 1}`}
                  />
                  <button
                    onClick={() => removeStop(i)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-surface-200 flex items-center justify-center z-10"
                  >
                    <X className="h-3 w-3 text-surface-500" />
                  </button>
                </div>
              ))}
              <LocationInput
                value={dropoff.location}
                onChange={handleDropoffChange}
                placeholder="Delivery location"
                inputRef={dropoffInputRef}
              />
            </div>
          </div>

          {/* Add stop */}
          {additionalStops.length < MAX_ADDITIONAL_STOPS && (
            <button
              onClick={addStop}
              className="mt-2.5 ml-8 flex items-center gap-1.5 text-[12px] font-semibold text-brand-500"
            >
              <Plus className="h-3.5 w-3.5" /> Add stop
              <span className="text-surface-400 font-normal">(+GH₵3 each)</span>
            </button>
          )}
        </div>

        {/* Route preview map + availability */}
        {(pickup.location.coordinates || dropoff.location.coordinates) && (
          <div className="space-y-2">
            <RoutePreviewMap
              pickupCoords={pickup.location.coordinates as [number, number] | null}
              dropoffCoords={dropoff.location.coordinates as [number, number] | null}
              nearbyRiders={nearbyRiders}
              className="h-[160px] rounded-2xl overflow-hidden"
            />
            {pickup.location.coordinates && nearbyRiderCount === 0 && (
              <p className="text-[12px] text-amber-600 font-medium px-1">
                No riders nearby right now. Your order will be queued.
              </p>
            )}
          </div>
        )}

        {/* Distance warning */}
        {distanceWarning && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-700 leading-snug">{distanceWarning}</p>
          </div>
        )}

        {/* ── Section: Package ─────────────────────────── */}
        <div>
          <p className="section-label mb-2">What are you sending?</p>
          <div className="grid grid-cols-4 gap-2">
            {pkgList.map(({ value, label, emoji }) => {
              const active = packageType === value;
              return (
                <button
                  key={value}
                  onClick={() => setPackageType(value)}
                  className={`package-tile ${active ? 'package-tile-active' : 'package-tile-inactive'}`}
                >
                  <span className="text-lg">{emoji}</span>
                  <span className="text-[10px] font-semibold leading-tight text-center px-1">{label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowAllPackages(!showAllPackages)}
            className="mt-2 flex items-center gap-1 text-[12px] font-medium text-surface-400"
          >
            {showAllPackages ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</> : <><ChevronDown className="h-3.5 w-3.5" /> More types</>}
          </button>
        </div>

        {/* ── Section: When ────────────────────────────── */}
        <div>
          <p className="section-label mb-2">When?</p>
          <button
            onClick={() => { setShowWhenDropdown(!showWhenDropdown); setShowPayDropdown(false); }}
            className="w-full flex items-center gap-3 px-4 h-14 bg-surface-50 rounded-2xl transition-all btn-press"
          >
            <Clock className="h-4 w-4 text-surface-400 flex-shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-[11px] text-surface-400 leading-none mb-0.5">Schedule</p>
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-surface-900">
                  {SCHEDULE_TYPES.find(s => s.value === scheduleType)?.label ?? 'Now'}
                </p>
                {isExpress && (
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">
                    <Zap className="h-2.5 w-2.5" /> Express
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform duration-200 ${showWhenDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showWhenDropdown && (
            <div className="mt-1 bg-white rounded-2xl shadow-card overflow-hidden border border-surface-100">
              {SCHEDULE_TYPES.map((s, i) => {
                const active = scheduleType === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setScheduleType(s.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${i > 0 ? 'border-t border-surface-50' : ''} ${active ? 'bg-surface-900' : 'hover:bg-surface-50'}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-[14px] font-semibold ${active ? 'text-white' : 'text-surface-900'}`}>{s.label}</p>
                        {s.discount && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${active ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-600'}`}>
                            {s.discount}
                          </span>
                        )}
                      </div>
                      <p className={`text-[12px] mt-0.5 ${active ? 'text-surface-300' : 'text-surface-400'}`}>{s.description}</p>
                    </div>
                    {active && <div className="h-2 w-2 rounded-full bg-brand-400 flex-shrink-0" />}
                  </button>
                );
              })}

              {/* Time picker (when not NOW) */}
              {scheduleType !== 'NOW' && (
                <div className="flex items-center gap-3 mx-3 mb-3 mt-1 px-4 h-12 bg-surface-50 rounded-xl border-t border-surface-50">
                  <p className="text-[13px] text-surface-500 flex-1">
                    {scheduleType === 'SAME_DAY' ? 'Pickup time today' : scheduleType === 'NEXT_DAY' ? 'Pickup time tomorrow' : 'First pickup time'}
                  </p>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="bg-transparent text-[14px] font-semibold text-surface-800 outline-none"
                  />
                </div>
              )}

              {/* Express Delivery */}
              <div className="border-t border-surface-100">
                <button
                  onClick={() => setIsExpress(!isExpress)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors ${isExpress ? 'bg-brand-50' : 'hover:bg-surface-50'}`}
                >
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isExpress ? 'bg-brand-500' : 'bg-surface-100'}`}>
                    <Zap className={`h-4 w-4 ${isExpress ? 'text-white' : 'text-surface-500'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-[14px] font-semibold ${isExpress ? 'text-brand-700' : 'text-surface-800'}`}>Express Delivery</p>
                    <p className="text-[11px] text-surface-400">Priority pickup · 50% faster</p>
                  </div>
                  <div className={`h-6 w-11 rounded-full flex items-center transition-colors flex-shrink-0 ${isExpress ? 'bg-brand-500 justify-end' : 'bg-surface-200 justify-start'}`}>
                    <div className="h-5 w-5 rounded-full bg-white shadow-sm mx-0.5" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {scheduleType === 'SAME_DAY' && !showWhenDropdown && (() => {
            const [h, m] = scheduledTime.split(':').map(Number);
            const sel = new Date();
            sel.setHours(h ?? 9, m ?? 0, 0, 0);
            return sel.getTime() <= Date.now();
          })() && (
            <p className="text-[11px] text-amber-600 px-1 mt-1">
              Selected time has passed. Delivery will be scheduled ~30 min from now.
            </p>
          )}
          {isExpress && (estimate as any)?.expressIgnored && (
            <p className="text-[11px] text-amber-600 px-1 mt-1">Express not available for distances over 15 km. Standard delivery applies.</p>
          )}
        </div>

        {/* ── Section: Payment ─────────────────────────── */}
        <div>
          <p className="section-label mb-2">Pay with</p>
          <button
            onClick={() => { setShowPayDropdown(!showPayDropdown); setShowWhenDropdown(false); }}
            className="w-full flex items-center gap-3 px-4 h-14 bg-surface-50 rounded-2xl transition-all btn-press"
          >
            <div className="flex-1 text-left">
              <p className="text-[11px] text-surface-400 leading-none mb-0.5">Payment method</p>
              <p className="text-[14px] font-semibold text-surface-900">
                {PAYMENT_TABS.find(t => t.key === paymentMethod)?.label ?? 'MoMo'}
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform duration-200 ${showPayDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showPayDropdown && (
            <div className="mt-1 bg-white rounded-2xl shadow-card overflow-hidden border border-surface-100">
              {PAYMENT_TABS.map((t, i) => {
                const active = paymentMethod === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => { setPaymentMethod(t.key); setShowPayDropdown(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${i > 0 ? 'border-t border-surface-50' : ''} ${active ? 'bg-surface-900' : 'hover:bg-surface-50'}`}
                  >
                    <p className={`flex-1 text-[14px] font-semibold ${active ? 'text-white' : 'text-surface-900'}`}>{t.label}</p>
                    {active && <div className="h-2 w-2 rounded-full bg-brand-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Section: Optional Details ─────────────────── */}
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full py-1"
          >
            <p className="section-label">Optional Details</p>
            <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
          </button>

          {showDetails && (
            <div className="space-y-5 mt-4">

              {/* Weight */}
              <div className="flex items-center gap-3 px-4 h-14 bg-surface-50 rounded-2xl">
                <Weight className="h-4 w-4 text-surface-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] font-medium text-surface-400 leading-none mb-0.5">Weight (kg)</p>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    value={packageWeightKg ?? ''}
                    onChange={e => {
                      const v = e.target.value ? parseFloat(e.target.value) : undefined;
                      if (v !== undefined && v > 30) return;
                      setPackageWeightKg(v && v > 0 ? v : undefined);
                    }}
                    placeholder="Optional"
                    className="w-full bg-transparent text-[14px] text-surface-800 font-medium outline-none placeholder:text-surface-300"
                  />
                </div>
                {packageWeightKg && packageWeightKg > 20 && (
                  <span className="badge badge-cancelled text-[10px]">Heavy</span>
                )}
                {packageWeightKg && packageWeightKg > 5 && packageWeightKg <= 20 && (
                  <span className="badge badge-pending text-[10px]">+surcharge</span>
                )}
              </div>

              {/* Promo code */}
              <div className="space-y-1">
                <div className="flex items-center gap-3 px-4 h-14 bg-surface-50 rounded-2xl">
                  <Tag className="h-4 w-4 text-surface-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Promo code"
                    maxLength={20}
                    autoComplete="off"
                    autoCapitalize="characters"
                    className="flex-1 bg-transparent text-[14px] text-surface-800 font-semibold outline-none placeholder:text-surface-300 uppercase tracking-wider"
                  />
                  {promoCode && (estimate as any)?.promoDiscount > 0 && !(estimate as any)?.promoError && (
                    <span className="badge badge-delivered text-[10px]">Applied</span>
                  )}
                </div>
                {promoCode && (estimate as any)?.promoError && (
                  <p className="text-[11px] text-red-500 px-1">{(estimate as any).promoError}</p>
                )}
              </div>

              {/* Pickup details */}
              <div className="space-y-2.5">
                <p className="text-[13px] font-semibold text-surface-600">Pickup details</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={pickup.contactName}
                    onChange={e => setPickup({ ...pickup, contactName: e.target.value })}
                    placeholder="Sender name"
                    className="input-field !h-12 !text-[14px]"
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={pickup.contactPhone}
                    onChange={e => setPickup({ ...pickup, contactPhone: e.target.value.replace(/[^\d+\s()-]/g, '') })}
                    placeholder="0XX XXX XXXX"
                    maxLength={15}
                    className="input-field !h-12 !text-[14px]"
                  />
                </div>
                <input
                  value={pickup.notes}
                  onChange={e => setPickup({ ...pickup, notes: e.target.value })}
                  placeholder="Pickup notes (gate code, floor...)"
                  className="input-field !h-12 !text-[14px] w-full"
                />
              </div>

              {/* Dropoff details */}
              <div className="space-y-2.5">
                <p className="text-[13px] font-semibold text-surface-600">Delivery details</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={dropoff.contactName}
                    onChange={e => setDropoff({ ...dropoff, contactName: e.target.value })}
                    placeholder="Recipient name"
                    className="input-field !h-12 !text-[14px]"
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={dropoff.contactPhone}
                    onChange={e => setDropoff({ ...dropoff, contactPhone: e.target.value.replace(/[^\d+\s()-]/g, '') })}
                    placeholder="0XX XXX XXXX"
                    maxLength={15}
                    className="input-field !h-12 !text-[14px]"
                  />
                </div>
                <input
                  value={dropoff.notes}
                  onChange={e => setDropoff({ ...dropoff, notes: e.target.value })}
                  placeholder="Delivery notes (leave at reception...)"
                  className="input-field !h-12 !text-[14px] w-full"
                />
              </div>

              {/* Package photos */}
              <div className="space-y-2.5">
                <p className="text-[13px] font-semibold text-surface-600">Package photos</p>
                <div className="flex gap-2.5 flex-wrap">
                  {packagePhotos.map((photo, idx) => (
                    <div key={idx} className="relative h-20 w-20 rounded-2xl overflow-hidden bg-surface-100">
                      {photo.file.type.startsWith('video/') ? (
                        <video src={photo.preview} className="h-full w-full object-cover" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.preview} alt={`Package ${idx + 1}`} className="h-full w-full object-cover" />
                      )}
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {packagePhotos.length < 3 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-20 w-20 rounded-2xl border-2 border-dashed border-surface-200 flex flex-col items-center justify-center gap-1 text-surface-400 hover:border-brand-400 hover:text-brand-500 transition-all btn-press"
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

      </div>

      {/* Bottom bar */}
      {!keyboardOpen && (
        <div
          className="fixed bottom-0 inset-x-0 bg-white z-30 px-5 pt-4"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 12px)',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.06)',
          }}
        >
          {/* Price summary */}
          <div className="flex items-center gap-4 mb-3">
            {estimating ? (
              <div className="flex items-center gap-2 flex-1">
                <Loader2 className="h-4 w-4 text-surface-400 animate-spin" />
                <span className="text-[13px] text-surface-400">Calculating price...</span>
              </div>
            ) : estimate ? (
              <div className="flex-1 min-w-0">
                <PriceBreakdown estimate={estimate} variant="compact" />
              </div>
            ) : (
              <p className="text-[13px] text-surface-400 flex-1">Enter both addresses to see price</p>
            )}
            {estimate && !estimating && (
              <p className="text-[22px] font-extrabold text-surface-900 flex-shrink-0 leading-none">
                {formatCurrency(estimate.totalPrice)}
              </p>
            )}
          </div>

          {/* Review CTA */}
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!canSubmit || submitting}
            className="btn-primary brand"
          >
            {submitting
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Creating order...</>
              : <><Send className="h-5 w-5" /> Review & Send</>
            }
          </button>
        </div>
      )}

      {/* Order confirmation bottom sheet */}
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
          additionalStops={additionalStops.filter(s => s.coordinates).length}
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
