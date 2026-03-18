'use client';

import { useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@riderguy/ui';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  MapPin,
  Plus,
  Star,
  Pencil,
  Trash2,
  Home,
  Briefcase,
  X,
  Loader2,
  Navigation,
} from 'lucide-react';

// ── Types ──

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  instructions: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface AddressForm {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  instructions: string;
  isDefault: boolean;
}

const EMPTY_FORM: AddressForm = {
  label: '',
  address: '',
  latitude: 0,
  longitude: 0,
  instructions: '',
  isDefault: false,
};

const LABEL_ICONS: Record<string, typeof MapPin> = {
  Home: Home,
  Office: Briefcase,
  Work: Briefcase,
};

// ── Component ──

export default function SavedAddressesPage() {
  const router = useRouter();
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Queries ──

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['saved-addresses'],
    queryFn: async () => {
      const res = await api!.get('/saved-addresses');
      return (res.data.data ?? []) as SavedAddress[];
    },
    enabled: !!api,
  });

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async (data: AddressForm) => {
      await api!.post('/saved-addresses', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-addresses'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AddressForm> }) => {
      await api!.patch(`/saved-addresses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-addresses'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api!.delete(`/saved-addresses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-addresses'] });
      setDeletingId(null);
    },
  });

  // ── Helpers ──

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(addr: SavedAddress) {
    setEditingId(addr.id);
    setForm({
      label: addr.label,
      address: addr.address,
      latitude: addr.latitude,
      longitude: addr.longitude,
      instructions: addr.instructions ?? '',
      isDefault: addr.isDefault,
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim() || !form.address.trim()) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1 -ml-1">
              <ChevronLeft className="h-5 w-5 text-surface-600" />
            </button>
            <h1 className="text-xl font-bold text-surface-900">Saved Addresses</h1>
          </div>
          {!showForm && (
            <button
              onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}
              className="flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-600"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="px-5 py-4 border-b border-surface-100 bg-surface-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-surface-900">
              {editingId ? 'Edit Address' : 'New Address'}
            </h2>
            <button onClick={resetForm} className="p-1">
              <X className="h-4 w-4 text-surface-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Quick label buttons */}
            <div className="flex gap-2">
              {['Home', 'Office', 'Gym', 'School'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, label: preset }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    form.label === preset
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'border-surface-200 text-surface-600'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Label (e.g., Home, Mom's house)"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              maxLength={50}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            <input
              type="text"
              placeholder="Full address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              maxLength={500}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.\-]*"
                placeholder="Latitude"
                value={form.latitude || ''}
                onChange={(e) => setForm((f) => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.\-]*"
                placeholder="Longitude"
                value={form.longitude || ''}
                onChange={(e) => setForm((f) => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>

            <input
              type="text"
              placeholder="Delivery instructions (optional)"
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              maxLength={500}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-surface-600">Set as default address</span>
            </label>

            <button
              type="submit"
              disabled={isSaving || !form.label.trim() || !form.address.trim()}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Update Address' : 'Save Address'}
            </button>
          </form>
        </div>
      )}

      {/* List */}
      <div className="px-5 py-3">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (addresses ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
              <MapPin className="h-7 w-7 text-surface-300" />
            </div>
            <p className="text-surface-500 font-medium">No saved addresses</p>
            <p className="text-surface-400 text-sm mt-1">
              Save your frequent locations for faster delivery booking
            </p>
            <button
              onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Add your first address
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {(addresses ?? []).map((addr) => {
              const Icon = LABEL_ICONS[addr.label] ?? MapPin;
              return (
                <div
                  key={addr.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100"
                >
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    addr.isDefault
                      ? 'bg-brand-100'
                      : 'bg-surface-100'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      addr.isDefault ? 'text-brand-500' : 'text-surface-400'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-surface-900">
                        {addr.label}
                      </p>
                      {addr.isDefault && (
                        <span className="text-[10px] font-bold text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">
                      {addr.address}
                    </p>
                    {addr.instructions && (
                      <p className="text-[10px] text-surface-400 mt-1 italic">
                        📋 {addr.instructions}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(addr)}
                      className="p-1.5 text-surface-400 hover:text-brand-500 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deletingId === addr.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteMutation.mutate(addr.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-red-500 hover:text-red-600 transition-colors"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="p-1.5 text-surface-400 hover:text-surface-600 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(addr.id)}
                        className="p-1.5 text-surface-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
