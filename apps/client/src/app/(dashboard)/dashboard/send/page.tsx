'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
} from '@riderguy/ui';

// ============================================================
// Delivery Request Page — Client creates a new delivery order
// Form: pickup → dropoff → package type → price estimate → confirm
// ============================================================

const PACKAGE_TYPES = [
  { value: 'DOCUMENT', label: 'Document', icon: '📄', desc: 'Letters, contracts, forms' },
  { value: 'SMALL_PARCEL', label: 'Small Parcel', icon: '📦', desc: 'Under 5kg' },
  { value: 'MEDIUM_PARCEL', label: 'Medium Parcel', icon: '📦', desc: '5–15kg' },
  { value: 'LARGE_PARCEL', label: 'Large Parcel', icon: '📦', desc: '15–30kg' },
  { value: 'FOOD', label: 'Food', icon: '🍔', desc: 'Hot or cold meals' },
  { value: 'FRAGILE', label: 'Fragile', icon: '🥚', desc: 'Handle with care' },
  { value: 'HIGH_VALUE', label: 'High Value', icon: '💎', desc: 'Electronics, jewelry' },
] as const;

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash on Delivery', icon: '💵' },
  { value: 'CARD', label: 'Card Payment', icon: '💳' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: '📱' },
] as const;

interface AddressSuggestion {
  id: string;
  text: string;
  placeName: string;
  latitude: number;
  longitude: number;
}

interface PriceEstimate {
  distanceKm: number;
  estimatedDurationMinutes: number;
  baseFare: number;
  distanceCharge: number;
  surgeMultiplier: number;
  serviceFee: number;
  totalPrice: number;
  currency: string;
}

type Step = 'pickup' | 'dropoff' | 'package' | 'review';

export default function SendPackagePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('pickup');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pickup
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [pickupContactName, setPickupContactName] = useState('');
  const [pickupContactPhone, setPickupContactPhone] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<AddressSuggestion[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);

  // Dropoff
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [dropoffContactName, setDropoffContactName] = useState('');
  const [dropoffContactPhone, setDropoffContactPhone] = useState('');
  const [dropoffInstructions, setDropoffInstructions] = useState('');
  const [dropoffSuggestions, setDropoffSuggestions] = useState<AddressSuggestion[]>([]);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);

  // Package
  const [packageType, setPackageType] = useState<string>('SMALL_PARCEL');
  const [packageDescription, setPackageDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  // Estimate
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  // ── Address autocomplete ──
  const fetchSuggestions = useCallback(
    async (query: string, type: 'pickup' | 'dropoff') => {
      if (query.length < 3) {
        type === 'pickup' ? setPickupSuggestions([]) : setDropoffSuggestions([]);
        return;
      }
      try {
        const api = getApiClient();
        const { data } = await api.get('/orders/autocomplete', { params: { q: query } });
        const suggestions = data.data || [];
        if (type === 'pickup') {
          setPickupSuggestions(suggestions);
          setShowPickupSuggestions(true);
        } else {
          setDropoffSuggestions(suggestions);
          setShowDropoffSuggestions(true);
        }
      } catch {
        // Silent fail for autocomplete
      }
    },
    [],
  );

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'pickup' && pickupAddress.length >= 3 && !pickupLat) {
        fetchSuggestions(pickupAddress, 'pickup');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pickupAddress, step, pickupLat, fetchSuggestions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'dropoff' && dropoffAddress.length >= 3 && !dropoffLat) {
        fetchSuggestions(dropoffAddress, 'dropoff');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [dropoffAddress, step, dropoffLat, fetchSuggestions]);

  // ── Get price estimate when all locations are set ──
  useEffect(() => {
    if (step === 'review' && pickupLat && pickupLng && dropoffLat && dropoffLng) {
      fetchEstimate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function fetchEstimate() {
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) return;
    setEstimating(true);
    try {
      const api = getApiClient();
      const { data } = await api.post('/orders/estimate', {
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        dropoffLatitude: dropoffLat,
        dropoffLongitude: dropoffLng,
        packageType,
      });
      setEstimate(data.data);
    } catch {
      setError('Failed to get price estimate');
    } finally {
      setEstimating(false);
    }
  }

  // ── Submit order ──
  async function handleSubmit() {
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) return;
    setSubmitting(true);
    setError(null);
    try {
      const api = getApiClient();
      const { data } = await api.post('/orders', {
        pickupAddress,
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        pickupContactName: pickupContactName || undefined,
        pickupContactPhone: pickupContactPhone || undefined,
        pickupInstructions: pickupInstructions || undefined,
        dropoffAddress,
        dropoffLatitude: dropoffLat,
        dropoffLongitude: dropoffLng,
        dropoffContactName: dropoffContactName || undefined,
        dropoffContactPhone: dropoffContactPhone || undefined,
        dropoffInstructions: dropoffInstructions || undefined,
        packageType,
        packageDescription: packageDescription || undefined,
        paymentMethod,
      });

      const orderId = data.data.id;

      // For card / mobile money payments, initialise Paystack
      if (paymentMethod === 'CARD' || paymentMethod === 'MOBILE_MONEY') {
        try {
          const callbackUrl = `${window.location.origin}/dashboard/orders/${orderId}/payment`;
          const payRes = await api.post('/payments/initialize', {
            orderId,
            callbackUrl,
          });
          // Redirect to Paystack checkout
          window.location.href = payRes.data.data.authorizationUrl;
          return;
        } catch {
          // If payment init fails, still go to confirmation (payment can be retried)
          router.push(`/dashboard/orders/${orderId}/confirmation`);
          return;
        }
      }

      // For cash / wallet — go straight to confirmation
      router.push(`/dashboard/orders/${orderId}/confirmation`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  function selectSuggestion(suggestion: AddressSuggestion, type: 'pickup' | 'dropoff') {
    if (type === 'pickup') {
      setPickupAddress(suggestion.placeName);
      setPickupLat(suggestion.latitude);
      setPickupLng(suggestion.longitude);
      setShowPickupSuggestions(false);
    } else {
      setDropoffAddress(suggestion.placeName);
      setDropoffLat(suggestion.latitude);
      setDropoffLng(suggestion.longitude);
      setShowDropoffSuggestions(false);
    }
  }

  const steps: { key: Step; label: string; number: number }[] = [
    { key: 'pickup', label: 'Pickup', number: 1 },
    { key: 'dropoff', label: 'Dropoff', number: 2 },
    { key: 'package', label: 'Package', number: 3 },
    { key: 'review', label: 'Review', number: 4 },
  ];

  const currentStepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="mb-2 text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">Send a Package</h1>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                i <= currentStepIdx
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s.number}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 transition-colors ${
                  i < currentStepIdx ? 'bg-brand-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Pickup Step ── */}
      {step === 'pickup' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pickup Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Label htmlFor="pickupAddress">Address *</Label>
                <Input
                  id="pickupAddress"
                  placeholder="Enter pickup address..."
                  value={pickupAddress}
                  onChange={(e) => {
                    setPickupAddress(e.target.value);
                    setPickupLat(null);
                    setPickupLng(null);
                  }}
                />
                {pickupLat && (
                  <p className="mt-1 text-xs text-green-600">✓ Location confirmed</p>
                )}
                {showPickupSuggestions && pickupSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-white shadow-lg">
                    {pickupSuggestions.map((s) => (
                      <button
                        key={s.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => selectSuggestion(s, 'pickup')}
                      >
                        <p className="font-medium text-gray-900">{s.text}</p>
                        <p className="text-xs text-gray-500">{s.placeName}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="pickupContact">Contact Name (optional)</Label>
                <Input
                  id="pickupContact"
                  placeholder="Who to contact at pickup"
                  value={pickupContactName}
                  onChange={(e) => setPickupContactName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="pickupPhone">Contact Phone (optional)</Label>
                <Input
                  id="pickupPhone"
                  placeholder="+234..."
                  value={pickupContactPhone}
                  onChange={(e) => setPickupContactPhone(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="pickupInstructions">Instructions (optional)</Label>
                <Input
                  id="pickupInstructions"
                  placeholder="e.g., Ring the bell, office on 3rd floor"
                  value={pickupInstructions}
                  onChange={(e) => setPickupInstructions(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            disabled={!pickupAddress || !pickupLat}
            onClick={() => setStep('dropoff')}
          >
            Continue to Dropoff →
          </Button>
        </div>
      )}

      {/* ── Dropoff Step ── */}
      {step === 'dropoff' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dropoff Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Label htmlFor="dropoffAddress">Address *</Label>
                <Input
                  id="dropoffAddress"
                  placeholder="Enter dropoff address..."
                  value={dropoffAddress}
                  onChange={(e) => {
                    setDropoffAddress(e.target.value);
                    setDropoffLat(null);
                    setDropoffLng(null);
                  }}
                />
                {dropoffLat && (
                  <p className="mt-1 text-xs text-green-600">✓ Location confirmed</p>
                )}
                {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-white shadow-lg">
                    {dropoffSuggestions.map((s) => (
                      <button
                        key={s.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => selectSuggestion(s, 'dropoff')}
                      >
                        <p className="font-medium text-gray-900">{s.text}</p>
                        <p className="text-xs text-gray-500">{s.placeName}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="dropoffContact">Recipient Name (optional)</Label>
                <Input
                  id="dropoffContact"
                  placeholder="Who to deliver to"
                  value={dropoffContactName}
                  onChange={(e) => setDropoffContactName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="dropoffPhone">Recipient Phone (optional)</Label>
                <Input
                  id="dropoffPhone"
                  placeholder="+234..."
                  value={dropoffContactPhone}
                  onChange={(e) => setDropoffContactPhone(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="dropoffInstructions">Instructions (optional)</Label>
                <Input
                  id="dropoffInstructions"
                  placeholder="e.g., Leave with security, apartment 12B"
                  value={dropoffInstructions}
                  onChange={(e) => setDropoffInstructions(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep('pickup')}>
              ← Back
            </Button>
            <Button
              className="flex-1"
              disabled={!dropoffAddress || !dropoffLat}
              onClick={() => setStep('package')}
            >
              Continue →
            </Button>
          </div>
        </div>
      )}

      {/* ── Package Step ── */}
      {step === 'package' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Package Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Package Type *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PACKAGE_TYPES.map((pt) => (
                    <button
                      key={pt.value}
                      onClick={() => setPackageType(pt.value)}
                      className={`rounded-lg border-2 p-3 text-left transition-colors ${
                        packageType === pt.value
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{pt.icon}</span>
                      <p className="mt-1 text-sm font-medium text-gray-900">{pt.label}</p>
                      <p className="text-xs text-gray-500">{pt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="packageDesc">Description (optional)</Label>
                <Input
                  id="packageDesc"
                  placeholder="Describe your package..."
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    onClick={() => setPaymentMethod(pm.value)}
                    className={`flex w-full items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                      paymentMethod === pm.value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg">{pm.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{pm.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep('dropoff')}>
              ← Back
            </Button>
            <Button className="flex-1" onClick={() => setStep('review')}>
              Review Order →
            </Button>
          </div>
        </div>
      )}

      {/* ── Review Step ── */}
      {step === 'review' && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pickup */}
              <div className="flex gap-3">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400">Pickup</p>
                  <p className="text-sm text-gray-900">{pickupAddress}</p>
                  {pickupContactName && (
                    <p className="text-xs text-gray-500">{pickupContactName}</p>
                  )}
                </div>
              </div>

              {/* Connector */}
              <div className="ml-3 border-l-2 border-dashed border-gray-200 py-1 pl-6">
                <p className="text-xs text-gray-400">
                  {estimate
                    ? `${estimate.distanceKm.toFixed(1)} km • ~${estimate.estimatedDurationMinutes} min`
                    : 'Calculating...'}
                </p>
              </div>

              {/* Dropoff */}
              <div className="flex gap-3">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400">Dropoff</p>
                  <p className="text-sm text-gray-900">{dropoffAddress}</p>
                  {dropoffContactName && (
                    <p className="text-xs text-gray-500">{dropoffContactName}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Package & Payment */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-sm text-gray-500">Package</span>
                <span className="text-sm font-medium text-gray-900">
                  {PACKAGE_TYPES.find((p) => p.value === packageType)?.icon}{' '}
                  {PACKAGE_TYPES.find((p) => p.value === packageType)?.label}
                </span>
              </div>
              <div className="flex items-center justify-between border-b py-3">
                <span className="text-sm text-gray-500">Payment</span>
                <span className="text-sm font-medium text-gray-900">
                  {PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.icon}{' '}
                  {PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Price Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Price Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {estimating ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner className="h-6 w-6 text-brand-500" />
                </div>
              ) : estimate ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Base fare</span>
                    <span className="text-gray-900">₦{estimate.baseFare.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Distance ({estimate.distanceKm.toFixed(1)} km)</span>
                    <span className="text-gray-900">₦{estimate.distanceCharge.toLocaleString()}</span>
                  </div>
                  {estimate.surgeMultiplier > 1 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-500">Surge ({estimate.surgeMultiplier}×)</span>
                      <span className="text-orange-500">Applied</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Service fee</span>
                    <span className="text-gray-900">₦{estimate.serviceFee.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-brand-600">₦{estimate.totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Unable to calculate price</p>
              )}
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep('package')}>
              ← Back
            </Button>
            <Button
              className="flex-1"
              disabled={submitting || estimating || !estimate}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                `Confirm • ₦${estimate?.totalPrice.toLocaleString() ?? '...'}`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
