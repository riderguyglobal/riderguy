'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Spinner,
} from '@riderguy/ui';
import { API_BASE_URL } from '@/lib/constants';

// ─── Vehicle types ──────────────────────────────────────────

const VEHICLE_TYPES = [
  { value: 'BICYCLE', label: 'Bicycle', icon: '🚲' },
  { value: 'MOTORCYCLE', label: 'Motorcycle', icon: '🏍️' },
  { value: 'CAR', label: 'Car', icon: '🚗' },
  { value: 'VAN', label: 'Van', icon: '🚐' },
  { value: 'TRUCK', label: 'Truck', icon: '🚛' },
] as const;

// ─── Component ──────────────────────────────────────────────

export default function VehicleRegistrationPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [vehicleType, setVehicleType] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [plateNumber, setPlateNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validation
      if (!vehicleType) {
        setError('Please select a vehicle type.');
        return;
      }
      if (!make.trim()) {
        setError('Please enter the vehicle make.');
        return;
      }
      if (!model.trim()) {
        setError('Please enter the vehicle model.');
        return;
      }
      if (!plateNumber.trim()) {
        setError('Please enter the plate/license number.');
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        const body: Record<string, unknown> = {
          type: vehicleType,
          make: make.trim(),
          model: model.trim(),
          plateNumber: plateNumber.trim().toUpperCase(),
        };

        if (year) body.year = parseInt(year);
        if (color.trim()) body.color = color.trim();

        const res = await fetch(`${API_BASE_URL}/riders/vehicles`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(
            json?.error?.message ?? 'Registration failed. Please try again.',
          );
        }

        setSuccess(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Registration failed.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [vehicleType, make, model, year, color, plateNumber, accessToken],
  );

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/onboarding')}
          className="mb-3 flex items-center gap-1 text-sm text-brand-500 hover:underline"
        >
          ← Back to checklist
        </button>
        <h1 className="text-xl font-bold text-gray-900">Register Your Vehicle</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your vehicle details to get started with deliveries.
        </p>
      </div>

      {/* Success state */}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-green-600"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-800">
            Vehicle Registered!
          </h3>
          <p className="mt-1 text-sm text-green-600">
            Your vehicle has been added to your profile.
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push('/dashboard/onboarding')}
          >
            Back to Checklist
          </Button>
        </div>
      )}

      {/* Form */}
      {!success && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              {/* Vehicle type selector */}
              <div>
                <Label className="mb-2 block">Vehicle Type *</Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {VEHICLE_TYPES.map((vt) => (
                    <button
                      key={vt.value}
                      type="button"
                      onClick={() => setVehicleType(vt.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                        vehicleType === vt.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{vt.icon}</span>
                      <span className="text-xs font-medium">{vt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Make & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="make">Make *</Label>
                  <Input
                    id="make"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="e.g. Honda"
                    required
                    disabled={submitting}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. CB125"
                    required
                    disabled={submitting}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Year & Color */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="year">Year (optional)</Label>
                  <Input
                    id="year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="e.g. 2022"
                    min={1990}
                    max={new Date().getFullYear() + 1}
                    disabled={submitting}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="color">Color (optional)</Label>
                  <Input
                    id="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Red"
                    disabled={submitting}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Plate Number */}
              <div>
                <Label htmlFor="plateNumber">Plate / License Number *</Label>
                <Input
                  id="plateNumber"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="e.g. ABC-123-GP"
                  required
                  disabled={submitting}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Enter the registration number exactly as it appears on your number plate.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" /> Registering…
                  </span>
                ) : (
                  'Register Vehicle'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
