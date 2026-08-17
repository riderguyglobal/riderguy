'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Button } from '@riderguy/ui';
import { ArrowLeft, Camera, X, CheckCircle, AlertCircle, ImageIcon } from 'lucide-react';

const PHOTO_ANGLES = [
  { key: 'front', label: 'Front View' },
  { key: 'back', label: 'Back View' },
  { key: 'left', label: 'Left Side' },
  { key: 'right', label: 'Right Side' },
];

export default function VehiclePhotosPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeAngle, setActiveAngle] = useState('');

  useEffect(() => {
    if (!api) return;
    api.get('/riders/vehicles').then((res) => {
      const vehicles = res.data.data ?? [];
      if (vehicles.length > 0) setVehicleId(vehicles[0].id);
    }).catch(() => {});
  }, [api]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAngle) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => ({ ...prev, [activeAngle]: reader.result as string }));
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePhoto = (angle: string) => {
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[angle];
      return next;
    });
  };

  const uploadAll = async () => {
    if (!api || !vehicleId) {
      setError('No vehicle found. Register a vehicle first.');
      return;
    }
    const filled = Object.keys(photos);
    if (filled.length === 0) {
      setError('Add at least one photo');
      return;
    }

    setUploading(true);
    setError('');

    try {
      for (const angle of filled) {
        const photoUrl = photos[angle];
        if (!photoUrl) continue;
        const res = await fetch(photoUrl);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append('file', blob, `vehicle-${angle}.jpg`);
        formData.append('angle', angle);

        await api.post(`/riders/vehicles/${vehicleId}/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setSuccess(true);
    } catch {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-page px-6 text-center animate-scale-in">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-accent-500/20 animate-ping" />
          <div className="relative h-20 w-20 rounded-full gradient-accent flex items-center justify-center shadow-xl glow-accent">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-primary mb-2 tracking-tight">Photos Uploaded!</h2>
        <p className="text-muted mb-8">Your vehicle photos are being reviewed.</p>
        <Button className="gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold px-8" onClick={() => router.push('/dashboard/onboarding')}>
          Back to Onboarding
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-10 animate-page-enter bg-page">
      {/* Header */}
      <div className="safe-area-top bg-nav backdrop-blur-xl sticky top-0 z-20 border-b border-themed">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/dashboard/onboarding')} className="h-9 w-9 rounded-xl bg-skeleton border border-themed-strong flex items-center justify-center btn-press">
            <ArrowLeft className="h-5 w-5 text-secondary" />
          </button>
          <h1 className="text-lg font-bold text-primary tracking-tight">Vehicle Photos</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        <p className="text-sm text-muted">Take clear photos of your vehicle from all angles.</p>

        {error && (
          <div className="p-3.5 rounded-2xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2 animate-shake backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
            <p className="text-xs text-danger-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {PHOTO_ANGLES.map(({ key, label }, idx) => (
            <div key={key} className="relative animate-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
              {photos[key] ? (
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-themed">
                  <img src={photos[key]} alt={label} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(key)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center btn-press"
                  >
                    <X className="h-4 w-4 text-primary" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent py-2.5 px-3">
                    <p className="text-xs text-primary font-semibold">{label}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setActiveAngle(key);
                    setTimeout(() => fileRef.current?.click(), 50);
                  }}
                  className="w-full aspect-square rounded-2xl border-2 border-dashed border-themed-strong flex flex-col items-center justify-center gap-2 hover:border-brand-500/30 hover:bg-brand-500/[0.03] transition-all bg-hover-themed btn-press"
                >
                  <div className="h-10 w-10 rounded-xl bg-skeleton flex items-center justify-center">
                    <Camera className="h-5 w-5 text-subtle" />
                  </div>
                  <span className="text-xs text-muted font-medium">{label}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />

        <Button
          size="xl"
          className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold"
          onClick={uploadAll}
          loading={uploading}
          disabled={Object.keys(photos).length === 0}
        >
          Upload {Object.keys(photos).length} Photo{Object.keys(photos).length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}
