'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL, MAPBOX_TOKEN, PACKAGE_TYPES, DEFAULT_CENTER } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import { Button, Input, Label, Textarea, StepIndicator } from '@riderguy/ui';
import {
  ArrowLeft,
  MapPin,
  Package,
  CreditCard,
  CheckCircle,
  Navigation,
  Search,
  X,
  AlertCircle,
  Loader2,
  Phone,
  User,
  Clock,
  ChevronRight,
} from 'lucide-react';

const STEPS = [{ label: 'Pickup' }, { label: 'Dropoff' }, { label: 'Package' }, { label: 'Review' }];

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

  // Estimate price when both locations are set
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

  // Search overlay
  if (showSearch) {
    return (
      <div className="fixed inset-0 z-50 bg-white animate-fade-in">
        <div className="safe-area-top" />
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-100">
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }} className="h-9 w-9 rounded-full bg-surface-100 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-surface-600" />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for an address..."
              className="w-full pl-10 pr-8 py-2.5 bg-surface-50 rounded-xl border border-surface-200 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-surface-400" />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-3">
          <button onClick={useCurrentLocation} className="w-full flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-surface-50 transition-colors">
            <div className="h-8 w-8 rounded-full bg-brand-50 flex items-center justify-center">
              <Navigation className="h-4 w-4 text-brand-500" />
            </div>
            <span className="text-sm font-medium text-brand-600">Use current location</span>
          </button>
        </div>

        {searching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-surface-400 animate-spin" />
          </div>
        )}

        <div className="px-4 space-y-1">
          {searchResults.map((place, i) => (
            <button
              key={i}
              onClick={() => selectPlace(place)}
              className="w-full flex items-start gap-3 py-3 px-3 rounded-xl hover:bg-surface-50 transition-colors text-left"
            >
              <MapPin className="h-4 w-4 text-surface-400 mt-0.5 shrink-0" />
              <span className="text-sm text-surface-700 leading-tight">{place.place_name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => step > 0 ? setStep(step - 1) : router.back()} className="h-9 w-9 rounded-full bg-surface-100 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-surface-600" />
          </button>
          <h1 className="text-lg font-bold text-surface-900">Send Package</h1>
        </div>
        <div className="px-4 pb-3">
          <StepIndicator steps={STEPS} currentStep={step} />
        </div>
      </div>

      <div className="px-4 py-6 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-danger-50 border border-danger-100 flex items-start gap-2 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        {/* Step 0: Pickup */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-surface-900">Pickup Location</h2>
              <p className="text-xs text-surface-400">Where should the rider collect the package?</p>
            </div>

            <button
              onClick={() => { setSearchTarget('pickup'); setShowSearch(true); }}
              className="w-full card-interactive flex items-center gap-3 p-4 text-left"
            >
              <div className="h-8 w-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                {pickup.address ? (
                  <p className="text-sm text-surface-900 truncate">{pickup.address}</p>
                ) : (
                  <p className="text-sm text-surface-400">Search for pickup address</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-surface-300" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-surface-600 text-xs">Contact Name</Label>
                <Input value={pickup.contactName} onChange={(e) => setPickup({ ...pickup, contactName: e.target.value })} placeholder="Sender name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-surface-600 text-xs">Phone</Label>
                <Input value={pickup.contactPhone} onChange={(e) => setPickup({ ...pickup, contactPhone: e.target.value })} placeholder="024 XXX XXXX" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-surface-600 text-xs">Pickup Notes (optional)</Label>
              <Textarea value={pickup.notes} onChange={(e) => setPickup({ ...pickup, notes: e.target.value })} placeholder="e.g. Gate code, floor number..." rows={2} />
            </div>
          </div>
        )}

        {/* Step 1: Dropoff */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-surface-900">Dropoff Location</h2>
              <p className="text-xs text-surface-400">Where should the package be delivered?</p>
            </div>

            <button
              onClick={() => { setSearchTarget('dropoff'); setShowSearch(true); }}
              className="w-full card-interactive flex items-center gap-3 p-4 text-left"
            >
              <div className="h-8 w-8 rounded-full bg-accent-50 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-accent-500" />
              </div>
              <div className="flex-1 min-w-0">
                {dropoff.address ? (
                  <p className="text-sm text-surface-900 truncate">{dropoff.address}</p>
                ) : (
                  <p className="text-sm text-surface-400">Search for delivery address</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-surface-300" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-surface-600 text-xs">Recipient Name</Label>
                <Input value={dropoff.contactName} onChange={(e) => setDropoff({ ...dropoff, contactName: e.target.value })} placeholder="Recipient name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-surface-600 text-xs">Phone</Label>
                <Input value={dropoff.contactPhone} onChange={(e) => setDropoff({ ...dropoff, contactPhone: e.target.value })} placeholder="024 XXX XXXX" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-surface-600 text-xs">Delivery Notes (optional)</Label>
              <Textarea value={dropoff.notes} onChange={(e) => setDropoff({ ...dropoff, notes: e.target.value })} placeholder="e.g. Leave at reception..." rows={2} />
            </div>
          </div>
        )}

        {/* Step 2: Package Details */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-surface-900">Package Details</h2>
              <p className="text-xs text-surface-400">What are you sending?</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PACKAGE_TYPES.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  onClick={() => setPackageType(value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    packageType === value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-surface-200 bg-white hover:border-surface-300'
                  }`}
                >
                  <span className="text-xl">{emoji}</span>
                  <p className={`text-sm font-medium mt-1 ${packageType === value ? 'text-brand-600' : 'text-surface-700'}`}>
                    {label}
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-surface-600 text-xs">Description (optional)</Label>
              <Textarea
                value={packageDescription}
                onChange={(e) => setPackageDescription(e.target.value)}
                placeholder="Brief description of the package..."
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-base font-bold text-surface-900">Review & Confirm</h2>

            {/* Route summary */}
            <div className="card-elevated p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="h-3 w-3 rounded-full bg-brand-500" />
                  <div className="w-0.5 h-8 bg-surface-200" />
                  <div className="h-3 w-3 rounded-full bg-accent-500" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-surface-400">Pickup</p>
                    <p className="text-sm text-surface-900 font-medium truncate">{pickup.address}</p>
                    {pickup.contactName && <p className="text-xs text-surface-500">{pickup.contactName} · {pickup.contactPhone}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">Dropoff</p>
                    <p className="text-sm text-surface-900 font-medium truncate">{dropoff.address}</p>
                    {dropoff.contactName && <p className="text-xs text-surface-500">{dropoff.contactName} · {dropoff.contactPhone}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Package info */}
            <div className="card-elevated p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center text-xl">
                  {PACKAGE_TYPES.find((p) => p.value === packageType)?.emoji || '📦'}
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-900">
                    {PACKAGE_TYPES.find((p) => p.value === packageType)?.label}
                  </p>
                  {packageDescription && <p className="text-xs text-surface-400 truncate max-w-[200px]">{packageDescription}</p>}
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="card-elevated p-4">
              <p className="text-xs text-surface-400 mb-2">Payment Method</p>
              <div className="flex gap-2">
                {[
                  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
                  { value: 'CASH', label: 'Cash' },
                  { value: 'CARD', label: 'Card' },
                ].map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                      paymentMethod === m.value
                        ? 'border-brand-500 bg-brand-50 text-brand-600'
                        : 'border-surface-200 text-surface-600 hover:border-surface-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            {estimatedPrice !== null && (
              <div className="card-elevated p-4 bg-accent-50 border-accent-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-accent-700">Estimated Price</span>
                  <span className="text-xl font-bold text-accent-700">{formatCurrency(estimatedPrice)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button
              size="xl"
              variant="outline"
              className="flex-1 border-surface-200 text-surface-600"
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              size="xl"
              className="flex-1 bg-brand-500 hover:bg-brand-600"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Continue
            </Button>
          ) : (
            <Button
              size="xl"
              className="flex-1 bg-accent-500 hover:bg-accent-600"
              onClick={handleSubmit}
              loading={submitting}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm & Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
