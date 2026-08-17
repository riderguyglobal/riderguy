'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Button, Input } from '@riderguy/ui';
import { ArrowLeft, Car, CheckCircle, AlertCircle } from 'lucide-react';
import { VehicleType } from '@riderguy/types';

const VEHICLE_TYPES: { value: VehicleType; label: string; icon: string }[] = [
  { value: 'MOTORCYCLE' as VehicleType, label: 'Motorcycle', icon: '🏍️' },
  { value: 'BICYCLE' as VehicleType, label: 'Bicycle', icon: '🚲' },
  { value: 'CAR' as VehicleType, label: 'Cart', icon: '🛒' },
  { value: 'VAN' as VehicleType, label: 'Van', icon: '🚐' },
];

export default function VehiclePage() {
  const router = useRouter();
  const { api } = useAuth();
  const [vehicleType, setVehicleType] = useState<string>('MOTORCYCLE');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [color, setColor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [existing, setExisting] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    api.get('/riders/vehicles').then((res) => {
      const vehicles = res.data.data ?? [];
      if (vehicles.length > 0) {
        const v = vehicles[0];
        setVehicleId(v.id);
        setVehicleType(v.type);
        setMake(v.make ?? '');
        setModel(v.model ?? '');
        setYear(v.year?.toString() ?? '');
        setPlateNumber(v.plateNumber ?? '');
        setColor(v.color ?? '');
        setExisting(true);
      }
    }).catch(() => {});
  }, [api]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!make.trim() || !model.trim() || !plateNumber.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body = {
        type: vehicleType,
        make: make.trim(),
        model: model.trim(),
        year: year ? parseInt(year) : undefined,
        plateNumber: plateNumber.trim().toUpperCase(),
        color: color.trim() || undefined,
      };

      if (existing && vehicleId) {
        await api?.patch(`/riders/vehicles/${vehicleId}`, body);
      } else {
        await api?.post('/riders/vehicles', body);
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save vehicle');
    } finally {
      setSubmitting(false);
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
        <h2 className="text-2xl font-extrabold text-primary mb-2 tracking-tight">Vehicle Saved!</h2>
        <p className="text-muted mb-8">Now upload photos of your vehicle.</p>
        <div className="flex gap-3 w-full max-w-xs">
          <Button variant="outline" className="flex-1 border-themed-strong text-secondary rounded-xl btn-press" onClick={() => router.push('/dashboard/onboarding')}>
            Back
          </Button>
          <Button className="flex-1 gradient-brand text-white shadow-lg glow-brand btn-press rounded-xl font-semibold" onClick={() => router.push('/dashboard/onboarding/vehicle-photos')}>
            Upload Photos
          </Button>
        </div>
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
          <h1 className="text-lg font-bold text-primary tracking-tight">Vehicle Registration</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-5">
        {error && (
          <div className="p-3.5 rounded-2xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2 animate-shake backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
            <p className="text-xs text-danger-300">{error}</p>
          </div>
        )}

        {/* Vehicle type */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-2.5">Vehicle Type</label>
          <div className="grid grid-cols-2 gap-2.5">
            {VEHICLE_TYPES.map(({ value, label, icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => setVehicleType(value)}
                className={`p-3.5 rounded-2xl border text-left transition-all btn-press ${
                  vehicleType === value
                    ? 'border-brand-500/50 bg-brand-500/10 shadow-[0_0_20px_rgba(34,197,94,0.1)]'
                    : 'border-themed bg-hover-themed hover:bg-active-themed'
                }`}
              >
                <span className="text-2xl">{icon}</span>
                <p className={`text-sm font-semibold mt-1.5 ${vehicleType === value ? 'text-brand-400' : 'text-primary'}`}>{label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1.5 font-medium">Make *</label>
            <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Honda" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5 font-medium">Model *</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="CBR 150" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1.5 font-medium">Year</label>
            <Input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2023" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5 font-medium">Color</label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Black" className="bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5 font-medium">Plate Number *</label>
          <Input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="GR-1234-24" className="bg-card border-themed-strong text-primary placeholder:text-subtle uppercase rounded-xl h-12 focus:border-brand-500/50 focus:ring-brand-500/20" />
        </div>

        <Button type="submit" size="xl" className="w-full gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold" loading={submitting}>
          {existing ? 'Update Vehicle' : 'Register Vehicle'}
        </Button>
      </form>
    </div>
  );
}
