'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Check, Crosshair, Search, MapPin } from 'lucide-react';
import { initMapCore, type MapCoreInstance } from '@/lib/map-core';
import { MAPBOX_TOKEN, DEFAULT_CENTER } from '@/lib/constants';
import { reverseGeocode } from '@/hooks/use-mapbox-autocomplete';
import type { LocationValue } from './location-input';

interface MapPickerModalProps {
  open: boolean;
  onClose: () => void;
  onLocationPicked: (value: LocationValue) => void;
  /** Initial coordinates to center on [lng, lat] */
  initialCenter?: [number, number] | null;
}

export function MapPickerModal({
  open,
  onClose,
  onLocationPicked,
  initialCenter,
}: MapPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MapCoreInstance | null>(null);
  const [address, setAddress] = useState('');
  const [plusCode, setPlusCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; lat: number; lng: number }>>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  // Android back button trap
  useEffect(() => {
    if (!open) return;
    let pushed = true;
    history.pushState({ __backTrap: true }, '');
    const handlePop = () => { pushed = false; onClose(); };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (pushed) history.back();
    };
  }, [open, onClose]);

  // Reverse geocode on map move
  const handleReverseGeocode = useCallback(async (lng: number, lat: number) => {
    setLoading(true);
    setCenter([lng, lat]);
    try {
      const result = await reverseGeocode(lat, lng);
      setAddress(result.address);
      setPlusCode(result.plusCode?.display || '');
    } catch {
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setPlusCode('');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!open || !mapContainerRef.current) return;
    let destroyed = false;

    const startCenter = initialCenter || DEFAULT_CENTER;

    const setup = async () => {
      const core = await initMapCore({
        container: mapContainerRef.current!,
        token: MAPBOX_TOKEN,
        center: startCenter,
        zoom: 16,
        navigationControl: false,
        geolocateControl: false,
        scaleControl: false,
        buildings3D: true,
        fog: false,
      });
      if (destroyed) { core.destroy(); return; }
      coreRef.current = core;

      core.map.on('load', () => {
        if (destroyed) return;
        setMapReady(true);
        // Initial reverse geocode
        const c = core.map.getCenter();
        handleReverseGeocode(c.lng, c.lat);
      });

      // Reverse geocode on map move end (debounced)
      core.map.on('moveend', () => {
        if (destroyed) return;
        clearTimeout(reverseTimer.current);
        reverseTimer.current = setTimeout(() => {
          const c = core.map.getCenter();
          handleReverseGeocode(c.lng, c.lat);
        }, 300);
      });

      // Show "moving" state while dragging
      core.map.on('movestart', () => {
        if (destroyed) return;
        setLoading(true);
      });
    };
    setup();

    return () => {
      destroyed = true;
      clearTimeout(reverseTimer.current);
      if (coreRef.current) {
        coreRef.current.destroy();
        coreRef.current = null;
      }
      setMapReady(false);
      setAddress('');
      setPlusCode('');
      setCenter(null);
      setSearchQuery('');
      setSearchResults([]);
    };
  }, [open, initialCenter, handleReverseGeocode]);

  // Use current GPS location
  const handleGeolocate = () => {
    if (!navigator.geolocation || !coreRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coreRef.current?.map.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 17,
          duration: 1200,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // Simple search using existing API proxy
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const { tokenStorage } = await import('@riderguy/auth');
        const { API_BASE_URL } = await import('@/lib/constants');
        const token = tokenStorage.getAccessToken();
        const prox = coreRef.current
          ? coreRef.current.map.getCenter()
          : { lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] };
        const res = await fetch(
          `${API_BASE_URL}/orders/autocomplete?q=${encodeURIComponent(q)}&lat=${prox.lat}&lng=${prox.lng}`,
          {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: ctrl.signal,
          },
        );
        if (!res.ok) throw new Error();
        const json = await res.json();
        const items = (json.data ?? [])
          .filter((s: Record<string, unknown>) => s.latitude && s.longitude)
          .slice(0, 5)
          .map((s: Record<string, unknown>) => ({
            id: s.id as string,
            name: (s.placeName ?? s.text) as string,
            lat: s.latitude as number,
            lng: s.longitude as number,
          }));
        setSearchResults(items);
      } catch {
        if (!ctrl.signal.aborted) setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectSearchResult = (result: { lat: number; lng: number }) => {
    setSearchResults([]);
    setSearchQuery('');
    coreRef.current?.map.flyTo({
      center: [result.lng, result.lat],
      zoom: 17,
      duration: 1200,
    });
  };

  const handleConfirm = () => {
    if (!center || !address) return;
    onLocationPicked({
      address: plusCode ? `${address} (${plusCode})` : address,
      coordinates: center,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header with search */}
      <div className="absolute top-0 left-0 right-0 z-10 safe-top">
        <div className="flex items-center gap-2 p-3">
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center shrink-0"
          >
            <X className="h-5 w-5 text-surface-700" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search to jump to area..."
              className="w-full h-10 pl-9 pr-4 bg-white shadow-lg rounded-full text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="mx-3 bg-white rounded-2xl shadow-xl border border-surface-100 overflow-hidden">
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectSearchResult(r)}
                className="w-full flex items-center gap-3 py-3 px-4 hover:bg-surface-50 active:bg-surface-100 text-left border-b border-surface-50 last:border-0"
              >
                <MapPin className="h-4 w-4 text-brand-500 shrink-0" />
                <span className="text-sm text-surface-800 truncate">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map container — fills space above the bottom card */}
      <div className="flex-1 w-full relative">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Center pin (fixed in center of map area) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
          <div className="flex flex-col items-center">
            <div className={`transition-transform duration-200 ${loading ? '-translate-y-2 scale-110' : ''}`}>
              <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 32 20 32s20-18 20-32C40 8.954 31.046 0 20 0z" fill="#E53E3E" />
                <circle cx="20" cy="18" r="8" fill="white" />
              </svg>
            </div>
            {/* Pin shadow */}
            <div className={`w-3 h-1 rounded-full bg-black/20 transition-all duration-200 ${loading ? 'w-2 opacity-40' : 'opacity-60'}`} />
          </div>
        </div>

        {/* GPS button */}
        <button
          onClick={handleGeolocate}
          className="absolute right-4 bottom-4 z-10 h-12 w-12 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Crosshair className="h-5 w-5 text-brand-600" />
        </button>
      </div>

      {/* Bottom card with address + confirm — always visible, not overlapping map */}
      <div className="shrink-0 bg-white rounded-t-3xl shadow-2xl border-t border-surface-100 p-5" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="h-4 w-4 text-surface-400 animate-spin" />
                <span className="text-sm text-surface-400">Finding address...</span>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-surface-900 leading-snug">
                  {address || 'Move the map to select a location'}
                </p>
                {plusCode && (
                  <p className="text-xs text-surface-400 mt-0.5">{plusCode}</p>
                )}
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!center || loading || !address}
          className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors btn-press flex items-center justify-center gap-2"
        >
          <Check className="h-4.5 w-4.5" />
          Confirm This Location
        </button>

        <p className="text-[10px] text-surface-300 text-center mt-2">
          Drag the map to position the pin on your exact location
        </p>
      </div>
    </div>
  );
}
