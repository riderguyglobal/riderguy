'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import {
  Button,
  Input,
  Label,
  Spinner,
} from '@riderguy/ui';

// ============================================================
// Send Package — Bolt/Uber-inspired delivery request flow
// ============================================================

const PACKAGE_TYPES = [
  {
    value: 'DOCUMENT', label: 'Document', desc: 'Letters, contracts, forms',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#0ea5e9' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill={active ? 'rgba(14,165,233,0.08)' : 'none'} />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    value: 'SMALL_PARCEL', label: 'Small Parcel', desc: 'Under 5 kg',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#0ea5e9' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" fill={active ? 'rgba(14,165,233,0.08)' : 'none'} />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    value: 'MEDIUM_PARCEL', label: 'Medium Parcel', desc: '5–15 kg',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#0ea5e9' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" fill={active ? 'rgba(14,165,233,0.08)' : 'none'} />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
        <path d="M16.5 9.4l-9-5.19" />
      </svg>
    ),
  },
  {
    value: 'LARGE_PARCEL', label: 'Large Parcel', desc: '15–30 kg',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#0ea5e9' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="6" width="22" height="14" rx="2" fill={active ? 'rgba(14,165,233,0.08)' : 'none'} />
        <path d="M1 10h22" />
      </svg>
    ),
  },
  {
    value: 'FOOD', label: 'Food', desc: 'Hot or cold meals',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#0ea5e9' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" fill={active ? 'rgba(14,165,233,0.08)' : 'none'} />
        <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
  {
    value: 'FRAGILE', label: 'Fragile', desc: 'Handle with care',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#f59e0b' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill={active ? 'rgba(245,158,11,0.08)' : 'none'} />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    value: 'HIGH_VALUE', label: 'High Value', desc: 'Electronics, jewelry',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#8b5cf6' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill={active ? 'rgba(139,92,246,0.08)' : 'none'} />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
] as const;

const PAYMENT_METHODS = [
  {
    value: 'CASH', label: 'Cash on Delivery', desc: 'Pay rider on delivery',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#22c55e' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" fill={active ? 'rgba(34,197,94,0.08)' : 'none'} />
        <circle cx="12" cy="12" r="3" /><path d="M1 10h2M21 10h2" />
      </svg>
    ),
  },
  {
    value: 'CARD', label: 'Card Payment', desc: 'Debit or credit card',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0ea5e9' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" fill={active ? 'rgba(14,165,233,0.08)' : 'none'} />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    value: 'MOBILE_MONEY', label: 'Mobile Money', desc: 'MTN, Vodafone, AirtelTigo',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#8b5cf6' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" fill={active ? 'rgba(139,92,246,0.08)' : 'none'} />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
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
        // Silent fail
      }
    },
    [],
  );

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

      if (paymentMethod === 'CARD' || paymentMethod === 'MOBILE_MONEY') {
        try {
          const callbackUrl = `${window.location.origin}/dashboard/orders/${orderId}/payment`;
          const payRes = await api.post('/payments/initialize', {
            orderId,
            callbackUrl,
          });
          window.location.href = payRes.data.data.authorizationUrl;
          return;
        } catch {
          router.push(`/dashboard/orders/${orderId}/confirmation`);
          return;
        }
      }

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

  const steps: { key: Step; label: string }[] = [
    { key: 'pickup', label: 'Pickup' },
    { key: 'dropoff', label: 'Dropoff' },
    { key: 'package', label: 'Package' },
    { key: 'review', label: 'Review' },
  ];
  const currentStepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="dash-page-enter pb-44">
      {/* ── Header ── */}
      <div className="sticky top-[3.5rem] z-30 bg-white/80 backdrop-blur-lg border-b border-surface-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (currentStepIdx > 0 ? setStep(steps[currentStepIdx - 1]!.key) : router.back())}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-50 transition-colors hover:bg-surface-100 active:scale-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-surface-900">Send a Package</h1>
          </div>
          <span className="text-xs font-medium text-surface-400">Step {currentStepIdx + 1}/4</span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex gap-1.5">
          {steps.map((s, i) => (
            <div key={s.key} className="flex-1 h-1 rounded-full bg-surface-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  i <= currentStepIdx ? 'bg-brand-500' : 'bg-transparent'
                }`}
                style={{ width: i <= currentStepIdx ? '100%' : '0%' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Pickup Step ── */}
      {step === 'pickup' && (
        <div className="p-4 space-y-4 dash-page-enter">
          {/* Route preview card */}
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className="h-3 w-3 rounded-full border-2 border-brand-500 bg-white" />
                <div className="w-0.5 flex-1 bg-surface-200 my-1" />
                <div className="h-3 w-3 rounded-full bg-surface-200" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Pickup address"
                    value={pickupAddress}
                    onChange={(e) => {
                      setPickupAddress(e.target.value);
                      setPickupLat(null);
                      setPickupLng(null);
                    }}
                    className="border-0 bg-surface-50 rounded-xl pl-3 pr-8 text-sm font-medium placeholder:text-surface-400"
                  />
                  {pickupLat && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  {showPickupSuggestions && pickupSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-surface-100 bg-white shadow-elevated overflow-hidden">
                      {pickupSuggestions.map((s) => (
                        <button
                          key={s.id}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-50 transition-colors border-b border-surface-50 last:border-0"
                          onClick={() => selectSuggestion(s, 'pickup')}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-surface-900 truncate">{s.text}</p>
                            <p className="text-xs text-surface-400 truncate">{s.placeName}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-surface-50 px-3 py-2.5 text-sm text-surface-400">
                  {dropoffAddress || 'Dropoff address (next step)'}
                </div>
              </div>
            </div>
          </div>

          {/* Contact details */}
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4 space-y-3">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Pickup Contact</p>
            <div>
              <Label className="text-xs text-surface-500">Name (optional)</Label>
              <Input
                placeholder="Who to contact at pickup"
                value={pickupContactName}
                onChange={(e) => setPickupContactName(e.target.value)}
                className="mt-1 rounded-xl border-surface-200 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-surface-500">Phone (optional)</Label>
              <Input
                placeholder="+233..."
                onChange={(e) => setPickupContactPhone(e.target.value)}
                className="mt-1 rounded-xl border-surface-200 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-surface-500">Instructions (optional)</Label>
              <Input
                placeholder="e.g., Ring the bell, office on 3rd floor"
                value={pickupInstructions}
                onChange={(e) => setPickupInstructions(e.target.value)}
                className="mt-1 rounded-xl border-surface-200 text-sm"
              />
            </div>
          </div>

          {/* Continue button */}
          <div className="fixed bottom-16 left-0 right-0 z-30 bg-gradient-to-t from-white via-white/95 to-transparent pt-6 pb-4 px-4">
            <Button
              className="w-full bg-brand-500 hover:bg-brand-600 rounded-xl py-3 text-sm font-semibold shadow-card"
              disabled={!pickupAddress || !pickupLat}
              onClick={() => setStep('dropoff')}
            >
              Continue to Dropoff
            </Button>
          </div>
        </div>
      )}

      {/* ── Dropoff Step ── */}
      {step === 'dropoff' && (
        <div className="p-4 space-y-4 dash-page-enter">
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className="h-3 w-3 rounded-full bg-brand-500" />
                <div className="w-0.5 flex-1 bg-surface-200 my-1" />
                <div className="h-3 w-3 rounded-full border-2 border-accent-500 bg-white" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="rounded-xl bg-surface-50 px-3 py-2.5 text-sm text-surface-700 font-medium truncate">
                  {pickupAddress}
                </div>
                <div className="relative">
                  <Input
                    placeholder="Dropoff address"
                    value={dropoffAddress}
                    onChange={(e) => {
                      setDropoffAddress(e.target.value);
                      setDropoffLat(null);
                      setDropoffLng(null);
                    }}
                    className="border-0 bg-surface-50 rounded-xl pl-3 pr-8 text-sm font-medium placeholder:text-surface-400"
                  />
                  {dropoffLat && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-surface-100 bg-white shadow-elevated overflow-hidden">
                      {dropoffSuggestions.map((s) => (
                        <button
                          key={s.id}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-50 transition-colors border-b border-surface-50 last:border-0"
                          onClick={() => selectSuggestion(s, 'dropoff')}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-surface-900 truncate">{s.text}</p>
                            <p className="text-xs text-surface-400 truncate">{s.placeName}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4 space-y-3">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Recipient Details</p>
            <div>
              <Label className="text-xs text-surface-500">Name (optional)</Label>
              <Input
                placeholder="Who to deliver to"
                value={dropoffContactName}
                onChange={(e) => setDropoffContactName(e.target.value)}
                className="mt-1 rounded-xl border-surface-200 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-surface-500">Phone (optional)</Label>
              <Input
                placeholder="+233..."
                onChange={(e) => setDropoffContactPhone(e.target.value)}
                className="mt-1 rounded-xl border-surface-200 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-surface-500">Instructions (optional)</Label>
              <Input
                placeholder="e.g., Leave with security, apartment 12B"
                value={dropoffInstructions}
                onChange={(e) => setDropoffInstructions(e.target.value)}
                className="mt-1 rounded-xl border-surface-200 text-sm"
              />
            </div>
          </div>

          <div className="fixed bottom-16 left-0 right-0 z-30 bg-gradient-to-t from-white via-white/95 to-transparent pt-6 pb-4 px-4">
            <Button
              className="w-full bg-brand-500 hover:bg-brand-600 rounded-xl py-3 text-sm font-semibold shadow-card"
              disabled={!dropoffAddress || !dropoffLat}
              onClick={() => setStep('package')}
            >
              Continue to Package Details
            </Button>
          </div>
        </div>
      )}

      {/* ── Package Step ── */}
      {step === 'package' && (
        <div className="p-4 space-y-5 dash-page-enter">
          {/* Package type grid */}
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">What are you sending?</p>
            <div className="grid grid-cols-2 gap-2.5 dash-stagger-in">
              {PACKAGE_TYPES.map((pt) => {
                const isActive = packageType === pt.value;
                return (
                  <button
                    key={pt.value}
                    onClick={() => setPackageType(pt.value)}
                    className={`relative flex flex-col items-start gap-2 rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.97] ${
                      isActive
                        ? 'border-brand-500 bg-brand-50/50 shadow-card'
                        : 'border-surface-100 bg-white hover:border-surface-200'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-2.5 right-2.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#0ea5e9" stroke="white" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" /><polyline points="16 9 10 15 8 13" />
                        </svg>
                      </div>
                    )}
                    {pt.icon(isActive)}
                    <div>
                      <p className={`text-sm font-semibold ${isActive ? 'text-brand-700' : 'text-surface-900'}`}>{pt.label}</p>
                      <p className="text-[11px] text-surface-400 mt-0.5">{pt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
            <Label className="text-xs text-surface-500">Description (optional)</Label>
            <Input
              placeholder="Describe your package..."
              value={packageDescription}
              onChange={(e) => setPackageDescription(e.target.value)}
              className="mt-1.5 rounded-xl border-surface-200 text-sm"
            />
          </div>

          {/* Payment method */}
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Payment Method</p>
            <div className="space-y-2.5 dash-stagger-in">
              {PAYMENT_METHODS.map((pm) => {
                const isActive = paymentMethod === pm.value;
                return (
                  <button
                    key={pm.value}
                    onClick={() => setPaymentMethod(pm.value)}
                    className={`flex w-full items-center gap-3.5 rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
                      isActive
                        ? 'border-brand-500 bg-brand-50/50 shadow-card'
                        : 'border-surface-100 bg-white hover:border-surface-200'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? 'bg-brand-50' : 'bg-surface-50'}`}>
                      {pm.icon(isActive)}
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-semibold ${isActive ? 'text-brand-700' : 'text-surface-900'}`}>{pm.label}</p>
                      <p className="text-xs text-surface-400">{pm.desc}</p>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      isActive ? 'border-brand-500' : 'border-surface-200'
                    }`}>
                      {isActive && <div className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="fixed bottom-16 left-0 right-0 z-30 bg-gradient-to-t from-white via-white/95 to-transparent pt-6 pb-4 px-4">
            <Button
              className="w-full bg-brand-500 hover:bg-brand-600 rounded-xl py-3 text-sm font-semibold shadow-card"
              onClick={() => setStep('review')}
            >
              Review Order
            </Button>
          </div>
        </div>
      )}

      {/* ── Review Step ── */}
      {step === 'review' && (
        <div className="p-4 space-y-4 dash-page-enter">
          {/* Route summary */}
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-4">Route</p>
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full border-2 border-brand-500 bg-white" />
                <div className="w-0.5 flex-1 border-l-2 border-dashed border-surface-200 my-1" />
                <div className="h-3 w-3 rounded-full bg-accent-500" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-surface-400 uppercase">Pickup</p>
                  <p className="text-sm font-medium text-surface-900 mt-0.5">{pickupAddress}</p>
                  {pickupContactName && <p className="text-xs text-surface-400 mt-0.5">{pickupContactName}</p>}
                </div>
                {estimate && (
                  <div className="flex items-center gap-2 text-xs text-surface-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    <span>{estimate.distanceKm.toFixed(1)} km</span>
                    <span>·</span>
                    <span>~{estimate.estimatedDurationMinutes} min</span>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold text-surface-400 uppercase">Dropoff</p>
                  <p className="text-sm font-medium text-surface-900 mt-0.5">{dropoffAddress}</p>
                  {dropoffContactName && <p className="text-xs text-surface-400 mt-0.5">{dropoffContactName}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Package & Payment summary */}
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4 space-y-3">
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-surface-400">Package</span>
              <div className="flex items-center gap-2">
                {PACKAGE_TYPES.find((p) => p.value === packageType)?.icon(true)}
                <span className="text-sm font-medium text-surface-900">{PACKAGE_TYPES.find((p) => p.value === packageType)?.label}</span>
              </div>
            </div>
            <div className="h-px bg-surface-100" />
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-surface-400">Payment</span>
              <div className="flex items-center gap-2">
                {PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.icon(true)}
                <span className="text-sm font-medium text-surface-900">{PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label}</span>
              </div>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Price Breakdown</p>
            {estimating ? (
              <div className="flex items-center justify-center py-6">
                <Spinner className="h-6 w-6 text-brand-500" />
              </div>
            ) : estimate ? (
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">Base fare</span>
                  <span className="text-surface-900 font-medium">GH₵{estimate.baseFare.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">Distance ({estimate.distanceKm.toFixed(1)} km)</span>
                  <span className="text-surface-900 font-medium">GH₵{estimate.distanceCharge.toLocaleString()}</span>
                </div>
                {estimate.surgeMultiplier > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-600">Surge ({estimate.surgeMultiplier}×)</span>
                    <span className="text-amber-600 font-medium">Applied</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">Service fee</span>
                  <span className="text-surface-900 font-medium">GH₵{estimate.serviceFee.toLocaleString()}</span>
                </div>
                <div className="h-px bg-surface-100 my-1" />
                <div className="flex justify-between text-base font-bold">
                  <span className="text-surface-900">Total</span>
                  <span className="text-brand-600">GH₵{estimate.totalPrice.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-surface-400 text-center py-4">Unable to calculate price</p>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {error}
            </div>
          )}

          {/* Confirm button */}
          <div className="fixed bottom-16 left-0 right-0 z-30 bg-gradient-to-t from-white via-white/95 to-transparent pt-6 pb-4 px-4">
            <Button
              className="w-full bg-surface-900 hover:bg-surface-800 rounded-xl py-3.5 text-sm font-bold shadow-elevated"
              disabled={submitting || estimating || !estimate}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                `Confirm · GH₵${estimate?.totalPrice.toLocaleString() ?? '...'}`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
