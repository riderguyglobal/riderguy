'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { formatCurrency } from '@riderguy/utils';
import { PACKAGE_TYPES, SCHEDULE_TYPES } from '@/lib/constants';
import { LocationInput, type LocationValue } from '@/components/location-input';
import { PriceBreakdown, type PriceEstimate } from '@/components/price-breakdown';
import { OrderConfirmation } from '@/components/order-confirmation';
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
} from 'lucide-react';

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
  const [showAllPackages, setShowAllPackages] = useState(false);

  // ── Estimate state ──
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  // ── Submission state ──
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // ── Optional details ──
  const [showDetails, setShowDetails] = useState(false);
  const [packagePhotos, setPackagePhotos] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(packagePhotos);
  photosRef.current = packagePhotos;

  // ── Location handlers ──

  const handlePickupChange = (loc: LocationValue) => {
    setPickup((prev) => ({ ...prev, location: loc }));
    if (loc.coordinates && !dropoff.location.coordinates) {
      setTimeout(() => dropoffInputRef.current?.focus(), 100);
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

  // ── Price estimation ──

  useEffect(() => {
    if (!pickup.location.coordinates || !dropoff.location.coordinates || !api) {
      setEstimate(null);
      return;
    }

    const controller = new AbortController();
    setEstimating(true);
    setError('');

    const [lng1, lat1] = pickup.location.coordinates;
    const [lng2, lat2] = dropoff.location.coordinates;

    const body: Record<string, unknown> = {
      pickupLatitude: lat1,
      pickupLongitude: lng1,
      dropoffLatitude: lat2,
      dropoffLongitude: lng2,
      packageType,
    };

    // Include additional stops count
    const validStops = additionalStops.filter((s) => s.coordinates);
    if (validStops.length > 0) {
      body.additionalStops = validStops.length;
    }

    // Include schedule type
    if (scheduleType !== 'NOW') {
      body.scheduleType = scheduleType;
    }

    api
      .post('/orders/estimate', body, { signal: controller.signal })
      .then((res) => {
        setEstimate(res.data.data ?? null);
      })
      .catch((err) => {
        if (err?.code !== 'ERR_CANCELED') {
          setEstimate(null);
        }
      })
      .finally(() => setEstimating(false));

    return () => controller.abort();
  }, [
    pickup.location.coordinates,
    dropoff.location.coordinates,
    packageType,
    scheduleType,
    additionalStops,
    api,
  ]);

  // ── Upload photos ──

  const uploadPackagePhotos = async (): Promise<string[]> => {
    if (!api || packagePhotos.length === 0) return [];
    const urls: string[] = [];
    for (const { file } of packagePhotos) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/orders/upload-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.data?.url) urls.push(res.data.data.url);
      } catch {
        // Skip failed uploads
      }
    }
    return urls;
  };

  // ── Can submit? ──

  const canSubmit =
    !!pickup.location.address &&
    !!pickup.location.coordinates &&
    !!dropoff.location.address &&
    !!dropoff.location.coordinates &&
    !!estimate;

  // ── Submit handler ──

  const handleConfirm = useCallback(async (): Promise<string | null> => {
    if (!api || !canSubmit) return null;
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
      };

      if (photoUrls.length > 0) body.packagePhotoUrl = photoUrls[0];
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
      if (scheduleType !== 'NOW' && scheduleType !== 'SAME_DAY') {
        body.isScheduled = true;
      }

      const res = await api.post('/orders', body);
      const orderId = res.data.data?.id;

      if (orderId && paymentMethod !== 'CASH') {
        router.replace(`/dashboard/orders/${orderId}/payment`);
      } else {
        router.replace(orderId ? `/dashboard/orders/${orderId}/tracking` : '/dashboard/orders');
      }

      return orderId ?? null;
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to create order.');
      setError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, canSubmit, pickup, dropoff, packageType, paymentMethod, additionalStops, scheduleType, packagePhotos]);

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
          <RoutePreviewMap
            pickupCoords={pickup.location.coordinates as [number, number] | null}
            dropoffCoords={dropoff.location.coordinates as [number, number] | null}
            className="h-[180px]"
          />
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
            Section 5: Optional Details (collapsible)
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
                  value={pickup.contactPhone}
                  onChange={(e) => setPickup({ ...pickup, contactPhone: e.target.value })}
                  placeholder="Phone"
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
                  value={dropoff.contactPhone}
                  onChange={(e) => setDropoff({ ...dropoff, contactPhone: e.target.value })}
                  placeholder="Phone"
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
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-black/50 text-white flex items-center justify-center md:hidden"
                    >
                      <X className="h-3 w-3" />
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
          ═══════════════════════════════════════════ */}
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
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
