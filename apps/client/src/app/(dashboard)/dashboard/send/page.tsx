'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL, MAPBOX_TOKEN, PACKAGE_TYPES } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import {
  ArrowLeft,
  MapPin,
  Package,
  Navigation,
  Search,
  X,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowRight,
  CreditCard,
  Smartphone,
  Banknote,
  Check,
} from 'lucide-react';

const STEP_LABELS = ['Pickup', 'Dropoff', 'Package', 'Review'];

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

export default function SendPackagePage() {
  const router = useRouter();
  const { api } = useAuth();
  const [step, setStep] = useState(0);
  const [pickup, setPickup] = useState<LocationData>(emptyLocation());
  const [dropoff, setDropoff] = useState<LocationData>(emptyLocation());
  const [packageType, setPackageType] = useState('SMALL_PARCEL');
  const [packageDescription, setPackageDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('MOBILE_MONEY');
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Geocoding
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ place_name: string; center: [number, number] }>>([]);
  const [searching, setSearching] = useState(false);
  const [searchTarget, setSearchTarget] = useState<'pickup' | 'dropoff'>('pickup');
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const searchPlaces = useCallback(async (query: string) => {
    if (!query || query.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=GH&limit=5&types=address,poi,place`
      );
      const json = await res.json();
      setSearchResults(json.features?.map((f: { place_name: string; center: [number, number] }) => ({
        place_name: f.place_name,
        center: f.center,
      })) || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchPlaces(searchQuery), 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, searchPlaces]);

  const selectPlace = (place: { place_name: string; center: [number, number] }) => {
    const setter = searchTarget === 'pickup' ? setPickup : setDropoff;
    setter((prev) => ({ ...prev, address: place.place_name, coordinates: place.center }));
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const useCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const [lng, lat] = [pos.coords.longitude, pos.coords.latitude];
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`
          );
          const json = await res.json();
          const name = json.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          const setter = searchTarget === 'pickup' ? setPickup : setDropoff;
          setter((prev) => ({ ...prev, address: name, coordinates: [lng, lat] }));
        } catch { /* fallback ignored */ }
        setShowSearch(false);
      },
      () => setError('Could not get your location'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Estimate price
  useEffect(() => {
    if (!pickup.coordinates || !dropoff.coordinates || !api) return;
    const [lng1, lat1] = pickup.coordinates;
    const [lng2, lat2] = dropoff.coordinates;
    api.post(`${API_BASE_URL}/orders/estimate`, {
      pickupLatitude: lat1, pickupLongitude: lng1,
      dropoffLatitude: lat2, dropoffLongitude: lng2,
      packageType,
    }).then((res) => {
      setEstimatedPrice(res.data.data?.totalPrice ?? null);
    }).catch(() => setEstimatedPrice(null));
  }, [pickup.coordinates, dropoff.coordinates, packageType, api]);

  const handleSubmit = async () => {
    if (!api || !pickup.coordinates || !dropoff.coordinates) return;
    setSubmitting(true);
    setError('');
    try {
      const body = {
        pickupAddress: pickup.address,
        pickupLatitude: pickup.coordinates[1],
        pickupLongitude: pickup.coordinates[0],
        pickupContactName: pickup.contactName,
        pickupContactPhone: pickup.contactPhone,
        pickupInstructions: pickup.notes,
        dropoffAddress: dropoff.address,
        dropoffLatitude: dropoff.coordinates[1],
        dropoffLongitude: dropoff.coordinates[0],
        dropoffContactName: dropoff.contactName,
        dropoffContactPhone: dropoff.contactPhone,
        dropoffInstructions: dropoff.notes,
        packageType,
        packageDescription,
        paymentMethod,
      };
      const res = await api.post(`${API_BASE_URL}/orders`, body);
      const orderId = res.data.data?.id;
      router.replace(orderId ? `/dashboard/orders/${orderId}/tracking` : '/dashboard/orders');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return !!pickup.address && !!pickup.coordinates;
    if (step === 1) return !!dropoff.address && !!dropoff.coordinates;
    if (step === 2) return !!packageType;
    return true;
  };

  // ── Search overlay ──
  if (showSearch) {
    return (
      <div className="fixed inset-0 z-50 bg-white animate-slide-up">
        <div className="safe-area-top" />
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-100">
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }} className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center btn-press">
            <ArrowLeft className="h-5 w-5 text-surface-900" />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for an address..."
              className="w-full pl-10 pr-8 h-12 bg-surface-100 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-surface-900/10 transition-all"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-surface-400" />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-3">
          <button onClick={useCurrentLocation} className="w-full flex items-center gap-3 py-3 px-3 rounded-2xl hover:bg-surface-50 transition-colors group">
            <div className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center shrink-0 group-hover:bg-surface-200">
              <Navigation className="h-4 w-4 text-brand-500" />
            </div>
            <span className="text-sm font-semibold text-brand-600">Use current location</span>
          </button>
        </div>

        {searching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-surface-400 animate-spin" />
          </div>
        )}

        <div className="px-4 space-y-0.5">
          {searchResults.map((place, i) => (
            <button
              key={i}
              onClick={() => selectPlace(place)}
              className="w-full flex items-start gap-3 py-3 px-3 rounded-2xl hover:bg-surface-50 transition-colors text-left btn-press"
            >
              <div className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-surface-500" />
              </div>
              <span className="text-sm text-surface-700 leading-snug">{place.place_name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => step > 0 ? setStep(step - 1) : router.back()} className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center btn-press">
            <ArrowLeft className="h-5 w-5 text-surface-900" />
          </button>
          <h1 className="text-[17px] font-bold text-surface-900">Send Package</h1>
        </div>
        {/* Step indicator — clean progress bar */}
        <div className="px-4 pb-3 flex items-center gap-1.5">
          {STEP_LABELS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={label} className="flex-1">
                <div className={`h-1 rounded-full transition-all duration-500 ${
                  done ? 'bg-surface-900' : active ? 'bg-surface-400' : 'bg-surface-200'
                }`} />
                <p className={`text-[10px] font-medium text-center mt-1.5 ${
                  done || active ? 'text-surface-900' : 'text-surface-400'
                }`}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-6 space-y-5">
        {error && (
          <div className="p-3.5 rounded-xl bg-danger-50 flex items-start gap-2.5 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        {/* ── Step 0: Pickup ── */}
        {step === 0 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <h2 className="text-lg font-bold text-surface-900">Pickup Location</h2>
              <p className="text-sm text-surface-400 mt-0.5">Where should the rider collect the package?</p>
            </div>

            <button
              onClick={() => { setSearchTarget('pickup'); setShowSearch(true); }}
              className="w-full flex items-center gap-3 h-14 px-4 bg-surface-100 rounded-xl text-left group hover:bg-surface-200/70 transition-colors btn-press"
            >
              <div className="h-3 w-3 rounded-full bg-surface-900 shrink-0" />
              <div className="flex-1 min-w-0">
                {pickup.address ? (
                  <p className="text-sm text-surface-900 font-medium truncate">{pickup.address}</p>
                ) : (
                  <p className="text-sm text-surface-400">Search for pickup address</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-surface-300" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-surface-500">Contact Name</label>
                <input value={pickup.contactName} onChange={(e) => setPickup({ ...pickup, contactName: e.target.value })} placeholder="Sender name"
                  className="input-uber" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-surface-500">Phone</label>
                <input value={pickup.contactPhone} onChange={(e) => setPickup({ ...pickup, contactPhone: e.target.value })} placeholder="024 XXX XXXX"
                  className="input-uber" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-500">Pickup Notes (optional)</label>
              <textarea value={pickup.notes} onChange={(e) => setPickup({ ...pickup, notes: e.target.value })} placeholder="e.g. Gate code, floor number..." rows={2}
                className="w-full rounded-xl bg-surface-100 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-surface-900/10 transition-all resize-none" />
            </div>
          </div>
        )}

        {/* ── Step 1: Dropoff ── */}
        {step === 1 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <h2 className="text-lg font-bold text-surface-900">Dropoff Location</h2>
              <p className="text-sm text-surface-400 mt-0.5">Where should the package be delivered?</p>
            </div>

            <button
              onClick={() => { setSearchTarget('dropoff'); setShowSearch(true); }}
              className="w-full flex items-center gap-3 h-14 px-4 bg-surface-100 rounded-xl text-left group hover:bg-surface-200/70 transition-colors btn-press"
            >
              <div className="h-3 w-3 rounded-full bg-surface-900 ring-2 ring-surface-300 shrink-0" />
              <div className="flex-1 min-w-0">
                {dropoff.address ? (
                  <p className="text-sm text-surface-900 font-medium truncate">{dropoff.address}</p>
                ) : (
                  <p className="text-sm text-surface-400">Search for delivery address</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-surface-300" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-surface-500">Recipient Name</label>
                <input value={dropoff.contactName} onChange={(e) => setDropoff({ ...dropoff, contactName: e.target.value })} placeholder="Recipient name"
                  className="input-uber" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-surface-500">Phone</label>
                <input value={dropoff.contactPhone} onChange={(e) => setDropoff({ ...dropoff, contactPhone: e.target.value })} placeholder="024 XXX XXXX"
                  className="input-uber" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-500">Delivery Notes (optional)</label>
              <textarea value={dropoff.notes} onChange={(e) => setDropoff({ ...dropoff, notes: e.target.value })} placeholder="e.g. Leave at reception..." rows={2}
                className="w-full rounded-xl bg-surface-100 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-surface-900/10 transition-all resize-none" />
            </div>
          </div>
        )}

        {/* ── Step 2: Package Details — Uber-style list selection ── */}
        {step === 2 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="text-lg font-bold text-surface-900">What are you sending?</h2>
              <p className="text-sm text-surface-400 mt-0.5">Select your package type</p>
            </div>

            <div className="space-y-2">
              {PACKAGE_TYPES.map(({ value, label, emoji }) => {
                const selected = packageType === value;
                return (
                  <button
                    key={value}
                    onClick={() => setPackageType(value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all btn-press ${
                      selected
                        ? 'bg-surface-100 ring-2 ring-surface-900'
                        : 'bg-white hover:bg-surface-50'
                    }`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className={`text-sm font-semibold flex-1 ${selected ? 'text-surface-900' : 'text-surface-700'}`}>
                      {label}
                    </span>
                    {selected && (
                      <div className="h-6 w-6 rounded-full bg-surface-900 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-500">Description (optional)</label>
              <textarea
                value={packageDescription}
                onChange={(e) => setPackageDescription(e.target.value)}
                placeholder="Brief description of the package..."
                rows={2}
                className="w-full rounded-xl bg-surface-100 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-surface-900/10 transition-all resize-none"
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="text-lg font-bold text-surface-900">Review & Confirm</h2>

            {/* Route summary — Uber-style dots */}
            <div className="p-4 rounded-2xl bg-surface-50 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 pt-1.5">
                  <div className="h-3 w-3 rounded-full bg-surface-900" />
                  <div className="w-0.5 h-8 bg-surface-300 rounded-full" />
                  <div className="h-3 w-3 rounded-full bg-surface-900 ring-2 ring-surface-300" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Pickup</p>
                    <p className="text-sm text-surface-900 font-medium truncate">{pickup.address}</p>
                    {pickup.contactName && <p className="text-xs text-surface-500">{pickup.contactName} · {pickup.contactPhone}</p>}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Dropoff</p>
                    <p className="text-sm text-surface-900 font-medium truncate">{dropoff.address}</p>
                    {dropoff.contactName && <p className="text-xs text-surface-500">{dropoff.contactName} · {dropoff.contactPhone}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Package info */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-50">
              <span className="text-2xl">{PACKAGE_TYPES.find((p) => p.value === packageType)?.emoji || '📦'}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-surface-900">
                  {PACKAGE_TYPES.find((p) => p.value === packageType)?.label}
                </p>
                {packageDescription && <p className="text-xs text-surface-400 truncate max-w-[220px]">{packageDescription}</p>}
              </div>
            </div>

            {/* Payment — Uber-style row */}
            <div className="p-4 rounded-2xl bg-surface-50">
              <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-3">Payment Method</p>
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
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center gap-1.5 btn-press ${
                        active
                          ? 'bg-surface-900 text-white'
                          : 'bg-white text-surface-600 hover:bg-surface-100'
                      }`}
                    >
                      <m.icon className={`h-5 w-5 ${active ? 'text-white' : 'text-surface-400'}`} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price */}
            {estimatedPrice !== null && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-900 text-white">
                <div>
                  <p className="text-xs font-medium text-white/60">Estimated Price</p>
                  <p className="text-2xl font-bold mt-0.5">{formatCurrency(estimatedPrice)}</p>
                </div>
                <Package className="h-8 w-8 text-white/20" />
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 h-13 rounded-xl border border-surface-200 text-surface-600 font-semibold text-sm hover:bg-surface-50 transition-all btn-press flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 h-13 rounded-xl bg-surface-900 text-white font-semibold text-sm hover:bg-surface-800 transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-13 rounded-xl bg-surface-900 text-white font-semibold text-sm hover:bg-surface-800 transition-all btn-press disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Confirm & Send</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
