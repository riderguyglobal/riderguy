'use client';

import { useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@riderguy/ui';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Home,
  Briefcase,
  X,
  Loader2,
  Check,
} from 'lucide-react';

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
  Home:   Home,
  Office: Briefcase,
  Work:   Briefcase,
};

const LABEL_PRESETS = ['Home', 'Office', 'Gym', 'School'];

export default function SavedAddressesPage() {
  const router       = useRouter();
  const { api }      = useAuth();
  const queryClient  = useQueryClient();

  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form,      setForm]      = useState<AddressForm>(EMPTY_FORM);
  const [deletingId,setDeletingId]= useState<string | null>(null);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['saved-addresses'],
    queryFn: async () => {
      const res = await api!.get('/saved-addresses');
      return (res.data.data ?? []) as SavedAddress[];
    },
    enabled: !!api,
  });

  const createMutation = useMutation({
    mutationFn: (data: AddressForm) => api!.post('/saved-addresses', data),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['saved-addresses'] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AddressForm> }) =>
      api!.patch(`/saved-addresses/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['saved-addresses'] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api!.delete(`/saved-addresses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['saved-addresses'] }); setDeletingId(null); },
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(addr: SavedAddress) {
    setEditingId(addr.id);
    setForm({
      label:        addr.label,
      address:      addr.address,
      latitude:     addr.latitude,
      longitude:    addr.longitude,
      instructions: addr.instructions ?? '',
      isDefault:    addr.isDefault,
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim() || !form.address.trim()) return;
    if (editingId) updateMutation.mutate({ id: editingId, data: form });
    else           createMutation.mutate(form);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-surface-50 sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-white shadow-card">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <p className="flex-1 text-[17px] font-bold text-surface-900">Saved Addresses</p>
        {!showForm && (
          <button
            onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}
            className="h-9 w-9 rounded-full bg-surface-900 flex items-center justify-center active:scale-90 transition-all"
          >
            <Plus className="h-4 w-4 text-white" />
          </button>
        )}
      </div>

      <div className="px-5 pb-10 space-y-4">

        {/* ── Form ─────────────────────────────────── */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-slide-down">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-50">
              <p className="text-[15px] font-bold text-surface-900">
                {editingId ? 'Edit Address' : 'New Address'}
              </p>
              <button onClick={resetForm} className="h-7 w-7 rounded-full bg-surface-100 flex items-center justify-center active:scale-90 transition-all">
                <X className="h-3.5 w-3.5 text-surface-600" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3">
              {/* Label presets */}
              <div className="flex gap-2 flex-wrap">
                {LABEL_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, label: preset }))}
                    className={[
                      'h-8 px-3 rounded-full text-[13px] font-semibold transition-all active:scale-95',
                      form.label === preset
                        ? 'bg-surface-900 text-white'
                        : 'bg-surface-100 text-surface-600',
                    ].join(' ')}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Label (e.g. Home, Mom's house)"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                maxLength={50}
                className="input-field !h-12"
              />
              <input
                type="text"
                placeholder="Full address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                maxLength={500}
                className="input-field !h-12"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Latitude"
                  value={form.latitude || ''}
                  onChange={e => setForm(f => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))}
                  className="input-field !h-12"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Longitude"
                  value={form.longitude || ''}
                  onChange={e => setForm(f => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))}
                  className="input-field !h-12"
                />
              </div>
              <input
                type="text"
                placeholder="Delivery instructions (optional)"
                value={form.instructions}
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                maxLength={500}
                className="input-field !h-12"
              />

              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isDefault: !f.isDefault }))}
                className={[
                  'w-full flex items-center gap-3 h-12 px-4 rounded-2xl transition-all',
                  form.isDefault ? 'bg-surface-900' : 'bg-surface-100',
                ].join(' ')}
              >
                <div className={[
                  'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
                  form.isDefault ? 'border-white bg-white' : 'border-surface-300',
                ].join(' ')}>
                  {form.isDefault && <Check className="h-3 w-3 text-surface-900" />}
                </div>
                <p className={`text-[14px] font-semibold ${form.isDefault ? 'text-white' : 'text-surface-700'}`}>
                  Set as default address
                </p>
              </button>

              <button
                type="submit"
                disabled={isSaving || !form.label.trim() || !form.address.trim()}
                className="btn-primary brand"
              >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : editingId ? 'Update Address' : 'Save Address'}
              </button>
            </form>
          </div>
        )}

        {/* ── List ─────────────────────────────────── */}
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-surface-50">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !(addresses?.length) ? (
          <div className="bg-white rounded-2xl shadow-card py-14 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
              <MapPin className="h-6 w-6 text-surface-300" />
            </div>
            <p className="text-[15px] font-bold text-surface-700">No saved addresses</p>
            <p className="text-[13px] text-surface-400 mt-1 max-w-[220px] leading-snug">
              Save your frequent spots for faster booking.
            </p>
            <button
              onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}
              className="mt-5 btn-primary inline-flex px-8"
              style={{ height: 48, fontSize: 14, width: 'auto' }}
            >
              <Plus className="h-4 w-4" /> Add first address
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-surface-50">
            {(addresses ?? []).map(addr => {
              const Icon = LABEL_ICONS[addr.label] ?? MapPin;
              return (
                <div key={addr.id} className="flex items-start gap-3 px-4 py-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    addr.isDefault ? 'bg-brand-500' : 'bg-surface-100'
                  }`}>
                    <Icon className={`h-4 w-4 ${addr.isDefault ? 'text-white' : 'text-surface-500'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-surface-900">{addr.label}</p>
                      {addr.isDefault && (
                        <span className="h-4 px-1.5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-surface-500 mt-0.5 line-clamp-2">
                      {addr.address}
                    </p>
                    {addr.instructions && (
                      <p className="text-[11px] text-surface-400 mt-1">
                        {addr.instructions}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => startEdit(addr)}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-surface-400 active:bg-surface-100 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {deletingId === addr.id ? (
                      <>
                        <button
                          onClick={() => deleteMutation.mutate(addr.id)}
                          disabled={deleteMutation.isPending}
                          className="h-8 px-2 rounded-xl flex items-center justify-center bg-red-50 text-red-500 text-[12px] font-bold active:scale-95 transition-all"
                        >
                          {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Delete'}
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="h-8 w-8 rounded-xl flex items-center justify-center text-surface-400 active:bg-surface-100 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeletingId(addr.id)}
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-surface-400 active:bg-red-50 active:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
