'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL, PACKAGE_TYPES } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Search,
  X,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Smartphone,
  Banknote,
  Send,
} from 'lucide-react';

// Compact package types — the 4 most common for in-town delivery
const QUICK_PACKAGES = PACKAGE_TYPES.filter((p) =>
  ['SMALL_PARCEL', 'DOCUMENT', 'FOOD', 'FRAGILE'].includes(p.value)
);

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
  const [pickup, setPickup] = useState<LocationData>(emptyLocation());
  const [dropoff, setDropoff] = useState<LocationData>(emptyLocation());
  const [packageType, setPackageType] = useState('SMALL_PARCEL');
  const [paymentMethod, setPaymentMethod] = useState('MOBILE_MONEY');
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Search overlay
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
        `${API_BASE_URL}/orders/autocomplete?q=${encodeURIComponent(query)}`
      );
      const json = await res.json();
      setSearchResults(json.data?.map((s: { placeName: string; latitude: number; longitude: number }) => ({
        place_name: s.placeName,
        center: [s.longitude, s.latitude] as [number, number],
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
            `${API_BASE_URL}/orders/reverse-geocode?latitude=${lat}&longitude=${lng}`
          );
          const json = await res.json();
          const name = json.data?.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          const setter = searchTarget === 'pickup' ? setPickup : setDropoff;
          setter((prev) => ({ ...prev, address: name, coordinates: [lng, lat] }));
        } catch { /* fallback ignored */ }
        setShowSearch(false);
      },
      () => setError('Could not get your location'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Estimate price when both addresses + packageType are set
  useEffect(() => {
    if (!pickup.coordinates || !dropoff.coordinates || !api) return;
    setEstimating(true);
    const [lng1, lat1] = pickup.coordinates;
    const [lng2, lat2] = dropoff.coordinates;
    api.post(`${API_BASE_URL}/orders/estimate`, {
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
      // Only send optional fields if filled
      if (pickup.contactName) body.pickupContactName = pickup.contactName;
      if (pickup.contactPhone) body.pickupContactPhone = pickup.contactPhone;
      if (pickup.notes) body.pickupInstructions = pickup.notes;
      if (dropoff.contactName) body.dropoffContactName = dropoff.contactName;
      if (dropoff.contactPhone) body.dropoffContactPhone = dropoff.contactPhone;
      if (dropoff.notes) body.dropoffInstructions = dropoff.notes;

      const res = await api.post(`${API_BASE_URL}/orders`, body);
      const orderId = res.data.data?.id;
      router.replace(orderId ? `/dashboard/orders/${orderId}/tracking` : '/dashboard/orders');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
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
              placeholder={searchTarget === 'pickup' ? 'Pickup address...' : 'Delivery address...'}
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

        {/* ── Route: Pickup → Dropoff (Uber-style connected dots) ── */}
        <div className="relative">
          <div className="flex items-start gap-3">
            {/* Dot connector */}
            <div className="flex flex-col items-center pt-4 shrink-0">
              <div className="h-3 w-3 rounded-full bg-surface-900" />
              <div className="w-0.5 h-10 bg-surface-200 rounded-full" />
              <div className="h-3 w-3 rounded-full bg-surface-900 ring-2 ring-surface-300" />
            </div>

            {/* Address inputs */}
            <div className="flex-1 space-y-2">
              <button
                onClick={() => { setSearchTarget('pickup'); setShowSearch(true); }}
                className="w-full flex items-center gap-2 h-12 px-4 bg-surface-100 rounded-xl text-left hover:bg-surface-200/70 transition-colors btn-press"
              >
                <div className="flex-1 min-w-0">
                  {pickup.address ? (
                    <p className="text-sm text-surface-900 font-medium truncate">{pickup.address}</p>
                  ) : (
                    <p className="text-sm text-surface-400">Pickup location</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-surface-300 shrink-0" />
              </button>

              <button
                onClick={() => { setSearchTarget('dropoff'); setShowSearch(true); }}
                className="w-full flex items-center gap-2 h-12 px-4 bg-surface-100 rounded-xl text-left hover:bg-surface-200/70 transition-colors btn-press"
              >
                <div className="flex-1 min-w-0">
                  {dropoff.address ? (
                    <p className="text-sm text-surface-900 font-medium truncate">{dropoff.address}</p>
                  ) : (
                    <p className="text-sm text-surface-400">Delivery location</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-surface-300 shrink-0" />
              </button>
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
