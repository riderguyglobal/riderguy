'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Spinner,
} from '@riderguy/ui';
import { API_BASE_URL } from '@/lib/constants';

// ─── Photo positions ────────────────────────────────────────

const POSITIONS = [
  { key: 'front', label: 'Front', icon: '🔼', description: 'Front view of the vehicle' },
  { key: 'back', label: 'Back', icon: '🔽', description: 'Rear view with plate visible' },
  { key: 'left', label: 'Left Side', icon: '◀️', description: 'Left side profile' },
  { key: 'right', label: 'Right Side', icon: '▶️', description: 'Right side profile' },
] as const;

type Position = (typeof POSITIONS)[number]['key'];

interface VehicleData {
  id: string;
  make: string;
  model: string;
  plateNumber: string;
  photoFrontUrl: string | null;
  photoBackUrl: string | null;
  photoLeftUrl: string | null;
  photoRightUrl: string | null;
}

// ─── Component ──────────────────────────────────────────────

export default function VehiclePhotosPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [activePosition, setActivePosition] = useState<Position | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch vehicles ────────────────────────────────────────
  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/riders/vehicles`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) throw new Error('Failed to load vehicles');

      const json = await res.json();
      const list = json.data as VehicleData[];
      setVehicles(list);
      if (list.length > 0) setSelectedVehicle(list[0]!);
    } catch {
      setError('Could not load your vehicles. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchVehicles();
  }, [fetchVehicles]);

  // ── Get photo URL for a position ──────────────────────────
  const getPhotoUrl = (vehicle: VehicleData, position: Position): string | null => {
    const map: Record<Position, string | null> = {
      front: vehicle.photoFrontUrl,
      back: vehicle.photoBackUrl,
      left: vehicle.photoLeftUrl,
      right: vehicle.photoRightUrl,
    };
    return map[position];
  };

  // ── Handle file selection + upload ────────────────────────
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedVehicle || !activePosition) return;

      if (file.size > 10 * 1024 * 1024) {
        setError('File is too large. Maximum size is 10MB.');
        return;
      }

      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('position', activePosition);

        const res = await fetch(
          `${API_BASE_URL}/riders/vehicles/${selectedVehicle.id}/photos`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          },
        );

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error?.message ?? 'Upload failed');
        }

        // Refresh vehicles to get updated photo URLs
        await fetchVehicles();
        setActivePosition(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Upload failed. Please try again.',
        );
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [selectedVehicle, activePosition, accessToken, fetchVehicles],
  );

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  // ── No vehicles registered ────────────────────────────────
  if (vehicles.length === 0) {
    return (
      <div className="p-4">
        <button
          onClick={() => router.push('/dashboard/onboarding')}
          className="mb-3 flex items-center gap-1 text-sm text-brand-500 hover:underline"
        >
          ← Back to checklist
        </button>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm text-amber-800">
            You need to register a vehicle first before uploading photos.
          </p>
          <Button
            className="mt-3"
            onClick={() => router.push('/dashboard/onboarding/vehicle')}
          >
            Register Vehicle
          </Button>
        </div>
      </div>
    );
  }

  const completedPhotos = selectedVehicle
    ? POSITIONS.filter((p) => getPhotoUrl(selectedVehicle, p.key)).length
    : 0;

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
        <h1 className="text-xl font-bold text-gray-900">Vehicle Photos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload photos of your vehicle from all four angles.
        </p>
      </div>

      {/* Vehicle selector (if multiple) */}
      {vehicles.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVehicle(v)}
              className={`flex-shrink-0 rounded-lg border-2 px-3 py-2 text-sm transition-all ${
                selectedVehicle?.id === v.id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200'
              }`}
            >
              {v.make} {v.model} — {v.plateNumber}
            </button>
          ))}
        </div>
      )}

      {/* Progress */}
      {selectedVehicle && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <span>{completedPhotos}/4 photos uploaded</span>
          {completedPhotos === 4 && (
            <Badge className="bg-green-100 text-green-700">Complete</Badge>
          )}
        </div>
      )}

      {/* Photo grid */}
      {selectedVehicle && (
        <div className="grid grid-cols-2 gap-3">
          {POSITIONS.map((pos) => {
            const photoUrl = getPhotoUrl(selectedVehicle, pos.key);
            const isActive = activePosition === pos.key;

            return (
              <Card
                key={pos.key}
                className={`overflow-hidden transition-all ${
                  isActive ? 'ring-2 ring-brand-400' : ''
                }`}
              >
                <CardContent className="p-0">
                  {photoUrl ? (
                    <div className="group relative aspect-square">
                      <Image
                        src={photoUrl}
                        alt={`${pos.label} view`}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white"
                          onClick={() => {
                            setActivePosition(pos.key);
                            fileInputRef.current?.click();
                          }}
                        >
                          Replace
                        </Button>
                      </div>
                      {/* Label */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-2">
                        <span className="text-xs font-medium text-white">
                          {pos.icon} {pos.label}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActivePosition(pos.key);
                        fileInputRef.current?.click();
                      }}
                      disabled={uploading}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-gray-50 transition-colors hover:bg-gray-100"
                    >
                      <span className="text-3xl">{pos.icon}</span>
                      <span className="text-xs font-medium text-gray-600">
                        {pos.label}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Tap to upload
                      </span>
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void handleFileChange(e)}
        className="hidden"
      />

      {/* Uploading indicator */}
      {uploading && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-brand-600">
          <Spinner className="h-4 w-4" />
          Uploading photo…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Done button */}
      <Button
        className="mt-6 w-full"
        variant={completedPhotos === 4 ? 'default' : 'outline'}
        onClick={() => router.push('/dashboard/onboarding')}
      >
        {completedPhotos === 4 ? 'Done — Back to Checklist' : 'Skip for Now'}
      </Button>
    </div>
  );
}
