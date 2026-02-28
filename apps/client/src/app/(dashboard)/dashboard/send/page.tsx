'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { PACKAGE_TYPES, MAPBOX_TOKEN, DEFAULT_CENTER } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import {
  ArrowLeft,
  MapPin,
  X,
  AlertCircle,
  Loader2,
  ChevronDown,
  CreditCard,
  Smartphone,
  Banknote,
  Send,
  Check,
  Crosshair,
  Camera,
  Trash2,
  Search,
} from 'lucide-react';

// Compact package types — the 4 most common for in-town delivery
const QUICK_PACKAGES = PACKAGE_TYPES.filter((p) =>
  ['SMALL_PARCEL', 'DOCUMENT', 'FOOD', 'FRAGILE'].includes(p.value)
);

interface MapboxFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface LocationData {
  address: string;
  coordinates: [number, number] | null;
  contactName: string;
  contactPhone: string;
  notes: string;
}

const emptyLocation = (): LocationData => ({
  address: '',
  coordinates: null,
  contactName: '',
  contactPhone: '',
  notes: '',
});

// ── Mapbox autocomplete hook — calls Mapbox Geocoding API directly from client ──
function useMapboxAutocomplete() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapboxFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2 || !MAPBOX_TOKEN) {
      setResults([]);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const encoded = encodeURIComponent(q);
      const proximity = `${DEFAULT_CENTER[0]},${DEFAULT_CENTER[1]}`;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&country=gh&limit=5&types=address,poi,place,locality,neighborhood&autocomplete=true&proximity=${proximity}`;
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();
      setResults(data.features || []);
    } catch {
      if (!ctrl.signal.aborted) setResults([]);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  const onChange = useCallback((value: string) => {
    setQuery(value);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (value.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(() => search(value), 300);
  }, [search]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setOpen(false);
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); abortRef.current?.abort(); };
  }, []);

  return { query, setQuery, results, loading, open, setOpen, onChange, clear };
}

// ── Reverse geocode using Mapbox directly ──
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!MAPBOX_TOKEN) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,place&limit=1`
    );
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    return data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// ── File to base64 ──
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SendPackagePage() {
  const router = useRouter();
  const { api } = useAuth();
  const [pickup, setPickup] = useState<LocationData>(emptyLocation());
  const [dropoff, setDropoff] = useState<LocationData>(emptyLocation());
  const [packageType, setPackageType] = useState('SMALL_PARCEL');
  const [paymentMethod, setPaymentMethod] = useState('MOBILE_MONEY');
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [locatingPickup, setLocatingPickup] = useState(false);
  const [locatingDropoff, setLocatingDropoff] = useState(false);

  // File uploads
  const [packagePhotos, setPackagePhotos] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickupAC = useMapboxAutocomplete();
  const dropoffAC = useMapboxAutocomplete();
  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);
  const pickupWrapRef = useRef<HTMLDivElement>(null);
  const dropoffWrapRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickupWrapRef.current && !pickupWrapRef.current.contains(e.target as Node)) {
        pickupAC.setOpen(false);
      }
      if (dropoffWrapRef.current && !dropoffWrapRef.current.contains(e.target as Node)) {
        dropoffAC.setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickupAC, dropoffAC]);

  const selectPickupPlace = (feature: MapboxFeature) => {
    setPickup((prev) => ({ ...prev, address: feature.place_name, coordinates: feature.center }));
    pickupAC.setQuery(feature.place_name);
    pickupAC.setOpen(false);
    if (!dropoff.coordinates) setTimeout(() => dropoffRef.current?.focus(), 100);
  };

  const selectDropoffPlace = (feature: MapboxFeature) => {
    setDropoff((prev) => ({ ...prev, address: feature.place_name, coordinates: feature.center }));
    dropoffAC.setQuery(feature.place_name);
    dropoffAC.setOpen(false);
  };

  const handlePickupInputChange = (value: string) => {
    pickupAC.onChange(value);
    // If the user edits the text after selecting, clear coordinates
    if (pickup.coordinates) {
      setPickup((prev) => ({ ...prev, address: value, coordinates: null }));
    }
  };

  const handleDropoffInputChange = (value: string) => {
    dropoffAC.onChange(value);
    if (dropoff.coordinates) {
      setDropoff((prev) => ({ ...prev, address: value, coordinates: null }));
    }
  };

  const useCurrentLocation = async (target: 'pickup' | 'dropoff') => {
    const setLocating = target === 'pickup' ? setLocatingPickup : setLocatingDropoff;
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const [lng, lat] = [pos.coords.longitude, pos.coords.latitude];
        const name = await reverseGeocode(lat, lng);
        const setter = target === 'pickup' ? setPickup : setDropoff;
        const ac = target === 'pickup' ? pickupAC : dropoffAC;
        setter((prev) => ({ ...prev, address: name, coordinates: [lng, lat] }));
        ac.setQuery(name);
        ac.setOpen(false);
        setLocating(false);
        if (target === 'pickup' && !dropoff.coordinates) {
          setTimeout(() => dropoffRef.current?.focus(), 100);
        }
      },
      () => { setError('Could not get your location'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Photo handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxPhotos = 3;
    const remaining = maxPhotos - packagePhotos.length;
    if (remaining <= 0) return;

    const validFiles = files.slice(0, remaining).filter(f => {
      const isValid = f.type.startsWith('image/') || f.type.startsWith('video/');
      const isSmallEnough = f.type.startsWith('video/') ? f.size <= 25 * 1024 * 1024 : f.size <= 10 * 1024 * 1024;
      return isValid && isSmallEnough;
    });

    const newPhotos = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPackagePhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPackagePhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index]!.preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Upload photos before order creation
  const uploadPackagePhotos = async (): Promise<string[]> => {
    if (!api || packagePhotos.length === 0) return [];
    const urls: string[] = [];
    for (const { file } of packagePhotos) {
      try {
        const base64 = await fileToBase64(file);
        const res = await api.post('/orders/upload-photo', {
          fileData: base64,
          fileName: file.name,
          mimeType: file.type,
        });
        if (res.data?.data?.url) urls.push(res.data.data.url);
      } catch {
        // Skip failed uploads silently
      }
    }
    return urls;
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => { packagePhotos.forEach(p => URL.revokeObjectURL(p.preview)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Estimate price when both addresses + packageType are set
  useEffect(() => {
    if (!pickup.coordinates || !dropoff.coordinates || !api) return;
    setEstimating(true);
    const [lng1, lat1] = pickup.coordinates;
    const [lng2, lat2] = dropoff.coordinates;
    api.post('/orders/estimate', {
      pickupLatitude: lat1, pickupLongitude: lng1,
      dropoffLatitude: lat2, dropoffLongitude: lng2,
      packageType,
    }).then((res) => {
      setEstimatedPrice(res.data.data?.totalPrice ?? null);
    }).catch(() => setEstimatedPrice(null))
    .finally(() => setEstimating(false));
  }, [pickup.coordinates, dropoff.coordinates, packageType, api]);

  const canSubmit = !!pickup.address && !!pickup.coordinates && !!dropoff.address && !!dropoff.coordinates;

  const handleSubmit = async () => {
    if (!api || !canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      // Upload package photos first
      const photoUrls = await uploadPackagePhotos();

      const body: Record<string, unknown> = {
        pickupAddress: pickup.address,
        pickupLatitude: pickup.coordinates![1],
        pickupLongitude: pickup.coordinates![0],
        dropoffAddress: dropoff.address,
        dropoffLatitude: dropoff.coordinates![1],
        dropoffLongitude: dropoff.coordinates![0],
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

      const res = await api.post('/orders', body);
      const orderId = res.data.data?.id;

      // For non-cash orders, redirect to payment page first
      if (orderId && paymentMethod !== 'CASH') {
        router.replace(`/dashboard/orders/${orderId}/payment`);
      } else {
        router.replace(orderId ? `/dashboard/orders/${orderId}/tracking` : '/dashboard/orders');
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to create order.');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter flex flex-col">
      {/* Header */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center btn-press">
            <ArrowLeft className="h-5 w-5 text-surface-900" />
          </button>
          <h1 className="text-[17px] font-bold text-surface-900">Send Package</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-5">
        {error && (
          <div className="p-3.5 rounded-xl bg-danger-50 flex items-start gap-2.5 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        {/* ── Route: Pickup → Dropoff with Mapbox autocomplete ── */}
        <div className="relative">
          <div className="flex items-start gap-3">
            {/* Dot connector */}
            <div className="flex flex-col items-center pt-4 shrink-0">
              <div className="h-3 w-3 rounded-full bg-brand-500" />
              <div className="w-0.5 h-10 bg-surface-200 rounded-full" />
              <div className="h-3 w-3 rounded-full bg-surface-900 ring-2 ring-surface-300" />
            </div>

            {/* Address inputs with inline suggestions */}
            <div className="flex-1 space-y-2">
              {/* Pickup input */}
              <div ref={pickupWrapRef} className="relative">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
                    <input
                      ref={pickupRef}
                      value={pickupAC.query}
                      onChange={(e) => handlePickupInputChange(e.target.value)}
                      onFocus={() => { if (pickupAC.query.length >= 2) pickupAC.setOpen(true); }}
                      placeholder="Search pickup location"
                      className="w-full h-12 pl-10 pr-9 bg-surface-50 border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                    {pickup.coordinates && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-500" />
                    )}
                    {pickupAC.loading && !pickup.coordinates && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 animate-spin" />
                    )}
                    {pickupAC.query && !pickup.coordinates && !pickupAC.loading && (
                      <button onClick={() => { pickupAC.clear(); setPickup(emptyLocation()); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="h-4 w-4 text-surface-400" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => useCurrentLocation('pickup')}
                    disabled={locatingPickup}
                    className="h-12 w-12 shrink-0 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center hover:bg-brand-100 transition-colors btn-press disabled:opacity-50"
                    title="Use current location"
                  >
                    {locatingPickup ? (
                      <Loader2 className="h-4 w-4 text-brand-500 animate-spin" />
                    ) : (
                      <Crosshair className="h-4 w-4 text-brand-500" />
                    )}
                  </button>
                </div>

                {/* Pickup suggestions dropdown */}
                {pickupAC.open && pickupAC.results.length > 0 && (
                  <div className="absolute top-full left-0 right-12 mt-1.5 bg-white rounded-2xl border border-surface-200 shadow-xl z-30 max-h-64 overflow-y-auto">
                    {pickupAC.results.map((feature) => {
                      const parts = feature.place_name.split(', ');
                      const primary = parts[0] || feature.place_name;
                      const secondary = parts.length > 1 ? parts.slice(1).join(', ') : '';
                      return (
                        <button
                          key={feature.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPickupPlace(feature)}
                          className="w-full flex items-start gap-3 py-3 px-3.5 hover:bg-surface-50 transition-colors text-left first:rounded-t-2xl last:rounded-b-2xl border-b border-surface-100 last:border-0"
                        >
                          <div className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0 mt-0.5">
                            <MapPin className="h-4 w-4 text-surface-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-900 truncate">{primary}</p>
                            {secondary && (
                              <p className="text-xs text-surface-400 truncate mt-0.5">{secondary}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dropoff input */}
              <div ref={dropoffWrapRef} className="relative">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
                    <input
                      ref={dropoffRef}
                      value={dropoffAC.query}
                      onChange={(e) => handleDropoffInputChange(e.target.value)}
                      onFocus={() => { if (dropoffAC.query.length >= 2) dropoffAC.setOpen(true); }}
                      placeholder="Search delivery location"
                      className="w-full h-12 pl-10 pr-9 bg-surface-50 border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                    {dropoff.coordinates && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-500" />
                    )}
                    {dropoffAC.loading && !dropoff.coordinates && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 animate-spin" />
                    )}
                    {dropoffAC.query && !dropoff.coordinates && !dropoffAC.loading && (
                      <button onClick={() => { dropoffAC.clear(); setDropoff(emptyLocation()); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="h-4 w-4 text-surface-400" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => useCurrentLocation('dropoff')}
                    disabled={locatingDropoff}
                    className="h-12 w-12 shrink-0 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center hover:bg-brand-100 transition-colors btn-press disabled:opacity-50"
                    title="Use current location"
                  >
                    {locatingDropoff ? (
                      <Loader2 className="h-4 w-4 text-brand-500 animate-spin" />
                    ) : (
                      <Crosshair className="h-4 w-4 text-brand-500" />
                    )}
                  </button>
                </div>

                {/* Dropoff suggestions dropdown */}
                {dropoffAC.open && dropoffAC.results.length > 0 && (
                  <div className="absolute top-full left-0 right-12 mt-1.5 bg-white rounded-2xl border border-surface-200 shadow-xl z-30 max-h-64 overflow-y-auto">
                    {dropoffAC.results.map((feature) => {
                      const parts = feature.place_name.split(', ');
                      const primary = parts[0] || feature.place_name;
                      const secondary = parts.length > 1 ? parts.slice(1).join(', ') : '';
                      return (
                        <button
                          key={feature.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectDropoffPlace(feature)}
                          className="w-full flex items-start gap-3 py-3 px-3.5 hover:bg-surface-50 transition-colors text-left first:rounded-t-2xl last:rounded-b-2xl border-b border-surface-100 last:border-0"
                        >
                          <div className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0 mt-0.5">
                            <MapPin className="h-4 w-4 text-surface-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-900 truncate">{primary}</p>
                            {secondary && (
                              <p className="text-xs text-surface-400 truncate mt-0.5">{secondary}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Package type — compact horizontal pills ── */}
        <div>
          <p className="text-xs font-semibold text-surface-500 mb-2.5">What are you sending?</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {QUICK_PACKAGES.map(({ value, label, emoji }) => {
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
            {/* "More" pill for less common types */}
            {!QUICK_PACKAGES.find((p) => p.value === packageType) && (
              <span className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-surface-900 text-white">
                {PACKAGE_TYPES.find((p) => p.value === packageType)?.emoji} {PACKAGE_TYPES.find((p) => p.value === packageType)?.label}
              </span>
            )}
            <button
              onClick={() => {
                // Cycle through remaining types not in QUICK_PACKAGES
                const otherTypes = PACKAGE_TYPES.filter((p) => !QUICK_PACKAGES.find((q) => q.value === p.value));
                const currentIdx = otherTypes.findIndex((p) => p.value === packageType);
                const next = otherTypes[(currentIdx + 1) % otherTypes.length];
                if (next) setPackageType(next.value);
              }}
              className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-full text-xs font-medium text-surface-400 bg-surface-50 hover:bg-surface-100 transition-colors btn-press"
            >
              More
            </button>
          </div>
        </div>

        {/* ── Payment method — compact row ── */}
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

        {/* ── Optional details (collapsible) ── */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between py-2 text-sm font-medium text-surface-400 hover:text-surface-600 transition-colors"
        >
          <span>Add details (optional)</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
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
                  className="input-uber text-sm"
                />
                <input
                  value={pickup.contactPhone}
                  onChange={(e) => setPickup({ ...pickup, contactPhone: e.target.value })}
                  placeholder="Phone"
                  className="input-uber text-sm"
                />
              </div>
              <input
                value={pickup.notes}
                onChange={(e) => setPickup({ ...pickup, notes: e.target.value })}
                placeholder="Pickup notes (gate code, floor...)"
                className="input-uber text-sm w-full"
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
                  className="input-uber text-sm"
                />
                <input
                  value={dropoff.contactPhone}
                  onChange={(e) => setDropoff({ ...dropoff, contactPhone: e.target.value })}
                  placeholder="Phone"
                  className="input-uber text-sm"
                />
              </div>
              <input
                value={dropoff.notes}
                onChange={(e) => setDropoff({ ...dropoff, notes: e.target.value })}
                placeholder="Delivery notes (leave at reception...)"
                className="input-uber text-sm w-full"
              />
            </div>

            {/* ── Package photos / videos ── */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-surface-500">Package photos</p>
              <p className="text-xs text-surface-400 -mt-1">Add up to 3 photos or short videos of your package</p>

              <div className="flex gap-2.5 flex-wrap">
                {/* Photo previews */}
                {packagePhotos.map((photo, idx) => (
                  <div key={idx} className="relative h-20 w-20 rounded-xl overflow-hidden border border-surface-200 group">
                    {photo.file.type.startsWith('video/') ? (
                      <video src={photo.preview} className="h-full w-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.preview} alt={`Package ${idx + 1}`} className="h-full w-full object-cover" />
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

                {/* Add photo button */}
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

      {/* ── Bottom bar: Price + Send ── */}
      <div className="sticky bottom-0 bg-white border-t border-surface-100 safe-area-bottom">
        <div className="px-5 py-4 flex items-center gap-4">
          {/* Price */}
          <div className="flex-1 min-w-0">
            {estimating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-surface-400 animate-spin" />
                <span className="text-sm text-surface-400">Estimating...</span>
              </div>
            ) : estimatedPrice !== null ? (
              <div>
                <p className="text-[11px] text-surface-400 font-medium">Estimated</p>
                <p className="text-xl font-bold text-surface-900">{formatCurrency(estimatedPrice)}</p>
              </div>
            ) : (
              <p className="text-sm text-surface-400">Enter both addresses</p>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="h-12 px-8 rounded-full bg-surface-900 text-white font-semibold text-sm hover:bg-surface-800 transition-all btn-press disabled:opacity-40 flex items-center gap-2"
          >
            {submitting ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
