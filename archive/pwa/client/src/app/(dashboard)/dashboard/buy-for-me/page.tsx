'use client';

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { formatCurrency } from '@riderguy/utils';
import {
  useAutocomplete,
  reverseGeocodeAddress,
  splitPlaceName,
  type SearchSuggestion,
} from '@/hooks/use-autocomplete';
import type { LocationValue } from '@/components/location-input';
import {
  ArrowLeft,
  MapPin,
  ShoppingBag,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Send,
  Wallet,
  Banknote,
  Smartphone,
  CreditCard,
  X,
  Crosshair,
  CheckCircle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  notes: string;
}

const PAYMENT_OPTIONS = [
  { key: 'MOBILE_MONEY', label: 'MoMo',   icon: Smartphone  },
  { key: 'CASH',         label: 'Cash',   icon: Banknote    },
  { key: 'CARD',         label: 'Card',   icon: CreditCard  },
  { key: 'WALLET',       label: 'Wallet', icon: Wallet      },
] as const;

type PaymentMethod = (typeof PAYMENT_OPTIONS)[number]['key'];

// ── Location row sub-component ─────────────────────────

interface LocationRowProps {
  label: string;
  labelColor: string;
  dotColor: string;
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  placeholder: string;
  autoDetect?: boolean;
  locating?: boolean;
  onRedetect?: () => void;
}

function LocationRow({
  label, labelColor, dotColor,
  value, onChange, placeholder,
  autoDetect, locating, onRedetect,
}: LocationRowProps) {
  const ac = useAutocomplete();
  const inputId = useId();
  const [focused, setFocused] = useState(false);

  const handleQueryChange = (text: string) => {
    ac.onChange(text);
    if (value.coordinates) onChange({ address: text, coordinates: null });
  };

  const handleSelect = async (s: SearchSuggestion) => {
    ac.setQuery(s.placeName);
    ac.setOpen(false);
    const place = await ac.retrieve(s);
    if (place) {
      onChange({ address: place.fullAddress, coordinates: [place.longitude, place.latitude] });
      ac.setQuery(place.fullAddress);
    } else {
      onChange({ address: s.placeName, coordinates: null });
    }
  };

  const handleClear = () => {
    ac.clear();
    onChange({ address: '', coordinates: null });
  };

  // Sync external address into autocomplete input
  useEffect(() => {
    if (value.address && !ac.query) ac.setQuery(value.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.address]);

  return (
    <div className="relative">
      <div
        className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
          focused ? 'bg-surface-50' : 'bg-white'
        }`}
        style={{ border: focused ? '1.5px solid #0AB957' : '1.5px solid transparent' }}
      >
        {/* Dot indicator */}
        <div className="mt-[14px] flex-shrink-0">
          <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[8.5px] font-bold uppercase tracking-widest leading-none mb-[5px] ${labelColor}`}>
            {label}
          </p>
          {locating ? (
            <div className="flex items-center gap-2 h-5">
              <Loader2 className="h-3.5 w-3.5 text-surface-400 animate-spin" />
              <span className="text-[12px] text-surface-400">Detecting location…</span>
            </div>
          ) : (
            <input
              id={inputId}
              value={ac.query || value.address}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => {
                setFocused(true);
                if (ac.query.length >= 2 && !value.coordinates) ac.setOpen(true);
              }}
              onBlur={() => setFocused(false)}
              placeholder={placeholder}
              className="w-full bg-transparent text-[13px] text-surface-900 placeholder:text-surface-400 outline-none leading-tight"
            />
          )}
        </div>

        {/* Right actions */}
        {autoDetect && onRedetect && !locating && (
          <button
            onClick={onRedetect}
            className="mt-1.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-100 active:bg-surface-200 transition-colors"
            aria-label="Re-detect location"
          >
            <Crosshair className="h-3.5 w-3.5 text-surface-500" />
          </button>
        )}
        {!autoDetect && value.coordinates && (
          <button
            onClick={handleClear}
            className="mt-1.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-100 active:bg-surface-200 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-surface-500" />
          </button>
        )}
        {(ac.loading || ac.retrieving) && (
          <Loader2 className="mt-2 h-4 w-4 flex-shrink-0 text-surface-400 animate-spin" />
        )}
      </div>

      {/* Autocomplete dropdown */}
      {ac.open && ac.results.length > 0 && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 overflow-y-auto rounded-2xl border border-surface-100 bg-white shadow-xl"
          style={{ maxHeight: 220, top: '100%' }}
        >
          {ac.results.map(s => {
            const { primary, secondary } = splitPlaceName(s.placeName);
            return (
              <button
                key={s.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="flex w-full items-start gap-3 border-b border-surface-50 px-4 py-2.5 text-left last:border-0 hover:bg-surface-50 active:bg-surface-100"
              >
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-surface-100">
                  <MapPin className="h-3 w-3 text-surface-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[12px] font-semibold text-surface-900">{primary}</p>
                  {secondary && (
                    <p className="truncate text-[10px] text-surface-400 mt-0.5">{secondary}</p>
                  )}
                </div>
              </button>
            );
          })}
          <div className="border-t border-surface-50 py-1.5 text-center">
            <span className="text-[8px] text-surface-300">Powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Item row ───────────────────────────────────────────

interface ItemRowProps {
  item: ShoppingItem;
  onUpdate: (id: string, field: keyof ShoppingItem, value: string | number) => void;
  onRemove: (id: string) => void;
  index: number;
}

function ItemRow({ item, onUpdate, onRemove, index }: ItemRowProps) {
  return (
    <div className="flex items-start gap-2.5 py-3 border-b border-surface-50 last:border-0">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 mt-2">
        <span className="text-[10px] font-bold text-white">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <input
          type="text"
          value={item.name}
          onChange={e => onUpdate(item.id, 'name', e.target.value)}
          placeholder="Item name (e.g. Bread, Rice, Medicine)"
          className="w-full bg-transparent text-[13px] font-semibold text-surface-900 placeholder:text-surface-400 placeholder:font-normal outline-none border-b border-surface-100 pb-1 focus:border-brand-400 transition-colors"
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-surface-100 px-2 py-1">
            <button
              onClick={() => onUpdate(item.id, 'quantity', Math.max(1, item.quantity - 1))}
              className="h-5 w-5 rounded-full bg-white flex items-center justify-center text-surface-600 font-bold text-sm active:scale-90 transition-all"
            >
              −
            </button>
            <span className="text-[13px] font-bold text-surface-900 min-w-[20px] text-center">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdate(item.id, 'quantity', item.quantity + 1)}
              className="h-5 w-5 rounded-full bg-white flex items-center justify-center text-surface-600 font-bold text-sm active:scale-90 transition-all"
            >
              +
            </button>
          </div>
          <input
            type="text"
            value={item.notes}
            onChange={e => onUpdate(item.id, 'notes', e.target.value)}
            placeholder="Specific brand/size (optional)"
            className="flex-1 bg-transparent text-[11px] text-surface-500 placeholder:text-surface-300 outline-none"
          />
        </div>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-xl text-surface-300 active:bg-red-50 active:text-red-400 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────

export default function BuyForMePage() {
  const router    = useRouter();
  const { api }   = useAuth();

  // Location state
  const [shopLocation,      setShopLocation]      = useState<LocationValue>({ address: '', coordinates: null });
  const [deliveryLocation,  setDeliveryLocation]  = useState<LocationValue>({ address: '', coordinates: null });
  const [locatingPickup,    setLocatingPickup]    = useState(true);

  // Items state
  const [items, setItems] = useState<ShoppingItem[]>([
    { id: crypto.randomUUID(), name: '', quantity: 1, notes: '' },
  ]);

  // Order options
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MOBILE_MONEY');
  const [riderNotes,    setRiderNotes]    = useState('');
  const [showNotes,     setShowNotes]     = useState(false);

  // Estimate & submit state
  const [estimate,     setEstimate]     = useState<{ totalPrice: number; distanceKm: number; estimatedDurationMinutes: number } | null>(null);
  const [estimating,   setEstimating]   = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');
  const [submitted,    setSubmitted]    = useState<string | null>(null);

  const estimateAbortRef = useRef<AbortController>();

  // Auto-detect current location as default delivery location
  useEffect(() => {
    if (!navigator.geolocation) { setLocatingPickup(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const address = await reverseGeocodeAddress(latitude, longitude);
          setDeliveryLocation({ address, coordinates: [longitude, latitude] });
        } catch { /* silent fail */ }
        finally { setLocatingPickup(false); }
      },
      () => { setLocatingPickup(false); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  const redetectDelivery = () => {
    setLocatingPickup(true);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const address = await reverseGeocodeAddress(latitude, longitude);
          setDeliveryLocation({ address, coordinates: [longitude, latitude] });
        } catch { /* silent */ }
        finally { setLocatingPickup(false); }
      },
      () => setLocatingPickup(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  // Price estimate whenever both locations are set
  useEffect(() => {
    if (!shopLocation.coordinates || !deliveryLocation.coordinates || !api) {
      setEstimate(null);
      return;
    }
    estimateAbortRef.current?.abort();
    const ctrl = new AbortController();
    estimateAbortRef.current = ctrl;
    setEstimating(true);
    setError('');

    const [lng1, lat1] = shopLocation.coordinates;
    const [lng2, lat2] = deliveryLocation.coordinates;

    api.post('/orders/estimate', {
      pickupLatitude:   lat1, pickupLongitude:   lng1,
      dropoffLatitude:  lat2, dropoffLongitude:  lng2,
      packageType: 'SMALL_PARCEL', paymentMethod,
    }, { signal: ctrl.signal })
      .then(res  => { setEstimate(res.data.data ?? null); setError(''); })
      .catch(err => {
        if (err?.code !== 'ERR_CANCELED')
          setError(err?.response?.data?.error?.message ?? 'Could not estimate price.');
      })
      .finally(() => setEstimating(false));

    return () => ctrl.abort();
  }, [shopLocation.coordinates, deliveryLocation.coordinates, paymentMethod, api]);

  // Item management
  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', quantity: 1, notes: '' },
    ]);
  };

  const updateItem = (id: string, field: keyof ShoppingItem, value: string | number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item,
    ));
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return; // keep at least one row
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Validation
  const hasValidItems = items.some(i => i.name.trim().length > 0);
  const canSubmit = (
    !!shopLocation.coordinates &&
    !!deliveryLocation.coordinates &&
    hasValidItems &&
    !!estimate &&
    !submitting
  );

  // Build items note string
  const buildItemsList = () => {
    const validItems = items.filter(i => i.name.trim());
    return validItems.map(i => {
      const qty   = i.quantity > 1 ? `x${i.quantity}` : '';
      const notes = i.notes.trim() ? ` (${i.notes.trim()})` : '';
      return `${i.name.trim()}${qty}${notes}`;
    }).join(', ');
  };

  // Submit order
  const handleSubmit = useCallback(async () => {
    if (!api || !shopLocation.coordinates || !deliveryLocation.coordinates || !estimate || submitting) return;
    setSubmitting(true);
    setError('');

    const itemsList = buildItemsList();
    const notesParts: string[] = [`BUY FOR ME: ${itemsList}`];
    if (riderNotes.trim()) notesParts.push(`Rider notes: ${riderNotes.trim()}`);

    try {
      const res = await api.post('/orders', {
        pickupAddress:    shopLocation.address,
        pickupLatitude:   shopLocation.coordinates[1],
        pickupLongitude:  shopLocation.coordinates[0],
        dropoffAddress:   deliveryLocation.address,
        dropoffLatitude:  deliveryLocation.coordinates[1],
        dropoffLongitude: deliveryLocation.coordinates[0],
        packageType:      'SMALL_PARCEL',
        paymentMethod,
        notes:            notesParts.join(' | '),
        estimatedTotalPrice: estimate.totalPrice,
      });
      const orderId = res.data.data?.id;
      setSubmitted(orderId ?? null);
      if (orderId) {
        router.replace(`/dashboard/orders/${orderId}/tracking`);
      } else {
        router.replace('/dashboard/orders');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to place order. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, shopLocation, deliveryLocation, estimate, paymentMethod, riderNotes, submitting]);

  // ── Success redirect guard ─────────────────────────
  if (submitted) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white px-8 text-center">
        <div className="h-16 w-16 rounded-full bg-brand-500 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-white" />
        </div>
        <p className="text-[18px] font-bold text-surface-900">Order Placed!</p>
        <p className="text-[13px] text-surface-400 mt-1">Connecting you with a rider…</p>
        <Loader2 className="mt-4 h-5 w-5 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-white sticky top-0 z-30 flex items-center gap-3 px-4 border-b border-surface-50"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-surface-100 !shadow-none">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <div className="flex-1">
          <p className="text-[17px] font-bold text-surface-900">Buy For Me</p>
          <p className="text-[11px] text-surface-400 mt-0.5">Tell us what to buy and we'll handle it</p>
        </div>
        <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center">
          <ShoppingBag className="h-5 w-5 text-amber-600" />
        </div>
      </div>

      <div className="px-4 pb-40 pt-4 space-y-4">

        {/* ── Step 1: Locations ──────────────────── */}
        <div className="bg-white rounded-2xl shadow-card px-4 py-3 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 mb-2">
            Step 1 — Locations
          </p>

          {/* Shop location */}
          <LocationRow
            label="Shop / Buy From"
            labelColor="text-amber-600"
            dotColor="bg-amber-500"
            value={shopLocation}
            onChange={setShopLocation}
            placeholder="Where should we go to buy? (Shop, Market, etc.)"
          />

          {/* Connector */}
          <div className="flex items-center gap-2 px-3 py-0.5">
            <div className="ml-[4.5px] h-5 border-l-[1.5px] border-dashed border-surface-200" />
          </div>

          {/* Delivery location */}
          <LocationRow
            label="Deliver To"
            labelColor="text-brand-600"
            dotColor="bg-brand-500"
            value={deliveryLocation}
            onChange={setDeliveryLocation}
            placeholder="Your address or destination"
            autoDetect
            locating={locatingPickup}
            onRedetect={redetectDelivery}
          />
        </div>

        {/* ── Step 2: Shopping list ──────────────── */}
        <div className="bg-white rounded-2xl shadow-card px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400">
              Step 2 — Shopping List
            </p>
            <span className="text-[11px] font-semibold text-surface-400">
              {items.filter(i => i.name.trim()).length} item{items.filter(i => i.name.trim()).length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Items */}
          <div>
            {items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                index={index}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            ))}
          </div>

          {/* Add item button */}
          <button
            onClick={addItem}
            className="mt-3 w-full flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-surface-200 text-[13px] font-semibold text-surface-400 active:border-brand-400 active:text-brand-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add another item
          </button>
        </div>

        {/* ── Step 3: Payment ──────────────────── */}
        <div className="bg-white rounded-2xl shadow-card px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 mb-3">
            Step 3 — Payment
          </p>
          <div className="grid grid-cols-4 gap-2">
            {PAYMENT_OPTIONS.map(({ key, label, icon: Icon }) => {
              const active = paymentMethod === key;
              return (
                <button
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  className={[
                    'flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all active:scale-95',
                    active
                      ? 'bg-surface-900 text-white'
                      : 'bg-surface-100 text-surface-500',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                  <span className={`text-[10px] font-bold ${active ? 'text-white' : 'text-surface-600'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Step 4: Notes (optional, expandable) ─── */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <button
            onClick={() => setShowNotes(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-surface-50 transition-colors"
          >
            <p className="flex-1 text-[13px] font-semibold text-surface-700">
              Notes for rider (optional)
            </p>
            {showNotes
              ? <ChevronUp className="h-4 w-4 text-surface-400" />
              : <ChevronDown className="h-4 w-4 text-surface-400" />
            }
          </button>
          {showNotes && (
            <div className="px-4 pb-4">
              <textarea
                value={riderNotes}
                onChange={e => setRiderNotes(e.target.value)}
                placeholder="e.g. Please buy the medium-sized one. Call me if unsure."
                rows={3}
                maxLength={300}
                className="input-field !h-auto py-3 resize-none text-[13px]"
              />
              <p className="mt-1.5 text-right text-[10px] text-surface-300">{riderNotes.length}/300</p>
            </div>
          )}
        </div>

        {/* ── Error ────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-red-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <p className="text-[13px] leading-snug text-red-600">{error}</p>
          </div>
        )}

      </div>

      {/* ── Floating order bar ───────────────────── */}
      <div
        className="fixed left-0 right-0 z-50 px-4 transition-all"
        style={{ bottom: 'calc(62px + env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            boxShadow: canSubmit ? '0 6px 24px rgba(217,119,6,0.40)' : 'none',
          }}
        >
          <div className="flex items-center gap-2.5">
            {submitting || estimating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            <span className="text-[15px] font-black">
              {estimating
                ? 'Calculating…'
                : submitting
                ? 'Placing order…'
                : !shopLocation.coordinates || !deliveryLocation.coordinates
                ? 'Set both locations'
                : !hasValidItems
                ? 'Add at least one item'
                : 'Place Order'
              }
            </span>
          </div>
          {estimate && !estimating && (
            <div className="text-right">
              <p className="text-[18px] font-black leading-none">{formatCurrency(estimate.totalPrice)}</p>
              <p className="mt-0.5 text-[10px] text-white/70">
                {estimate.distanceKm?.toFixed(1)} km · ~{estimate.estimatedDurationMinutes} min
              </p>
            </div>
          )}
        </button>
      </div>

    </div>
  );
}
