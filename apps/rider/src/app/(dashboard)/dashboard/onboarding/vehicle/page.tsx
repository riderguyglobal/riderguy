'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { Button, Input } from '@riderguy/ui';
import { ArrowLeft, Car, CheckCircle, AlertCircle } from 'lucide-react';
import { VehicleType } from '@riderguy/types';

const VEHICLE_TYPES: { value: VehicleType; label: string; icon: string }[] = [
  { value: 'MOTORCYCLE' as VehicleType, label: 'Motorcycle', icon: '🏍️' },
  { value: 'BICYCLE' as VehicleType, label: 'Bicycle', icon: '🚲' },
  { value: 'CAR' as VehicleType, label: 'Car', icon: '🚗' },
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

  useEffect(() => {
    if (!api) return;
    api.get(`${API_BASE_URL}/riders/vehicles`).then((res) => {
      const vehicles = res.data.data ?? [];
      if (vehicles.length > 0) {
        const v = vehicles[0];
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

      if (existing) {
        const res = await api?.get(`${API_BASE_URL}/riders/vehicles`);
        const vid = res?.data.data?.[0]?.id;
        if (vid) await api?.patch(`${API_BASE_URL}/riders/vehicles/${vid}`, body);
      } else {
        await api?.post(`${API_BASE_URL}/riders/vehicles`, body);
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
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-surface-950 px-6 text-center animate-scale-in">
        <CheckCircle className="h-16 w-16 text-accent-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Vehicle Saved!</h2>
        <p className="text-surface-400 mb-8">Now upload photos of your vehicle.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="border-surface-700 text-surface-300" onClick={() => router.push('/dashboard/onboarding')}>
            Back
          </Button>
          <Button className="bg-brand-500 hover:bg-brand-600" onClick={() => router.push('/dashboard/onboarding/vehicle-photos')}>
            Upload Photos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-10 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-surface-950 sticky top-0 z-20 border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/dashboard/onboarding')} className="h-9 w-9 rounded-full bg-surface-800 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-surface-300" />
          </button>
          <h1 className="text-lg font-bold text-white">Vehicle Registration</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2 animate-shake">
            <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
            <p className="text-xs text-danger-300">{error}</p>
          </div>
        )}

        {/* Vehicle type */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-2">Vehicle Type</label>
          <div className="grid grid-cols-2 gap-2">
            {VEHICLE_TYPES.map(({ value, label, icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => setVehicleType(value)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  vehicleType === value
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-surface-700 bg-surface-800 hover:bg-surface-700'
                }`}
              >
                <span className="text-xl">{icon}</span>
                <p className="text-sm font-medium text-white mt-1">{label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Make *</label>
            <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Honda" className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500" />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Model *</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="CBR 150" className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Year</label>
            <Input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2023" className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500" />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Color</label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Black" className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-surface-400 mb-1.5">Plate Number *</label>
          <Input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="GR-1234-24" className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500 uppercase" />
        </div>

        <Button type="submit" size="xl" className="w-full bg-brand-500 hover:bg-brand-600" loading={submitting}>
          {existing ? 'Update Vehicle' : 'Register Vehicle'}
        </Button>
      </form>
    </div>
  );
}
