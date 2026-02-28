'use client';

// ══════════════════════════════════════════════════════════
// useMapboxAutocomplete — Address autocomplete via API proxy
// Routes all requests through the backend to keep the
// Mapbox token server-side (not exposed in client URLs)
// ══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { API_BASE_URL, DEFAULT_CENTER } from '@/lib/constants';
import { tokenStorage } from '@riderguy/auth';

export interface MapboxFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  context?: Array<{ id: string; text: string }>;
}

interface UseMapboxAutocompleteOptions {
  /** Debounce delay in ms. Defaults to 250. */
  debounce?: number;
}

export function useMapboxAutocomplete(options: UseMapboxAutocompleteOptions = {}) {
  const { debounce = 250 } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapboxFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();
  const userLocationRef = useRef<[number, number] | null>(null);

  // Try to get user's actual location for better proximity bias
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocationRef.current = [pos.coords.longitude, pos.coords.latitude];
      },
      () => { /* ignore — API will use Accra default */ },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300_000 },
    );
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    try {
      const prox = userLocationRef.current || DEFAULT_CENTER;
      const url = `${API_BASE_URL}/orders/autocomplete?q=${encodeURIComponent(q)}&lat=${prox[1]}&lng=${prox[0]}`;
      const token = tokenStorage.getAccessToken();
      const res = await fetch(url, {
        signal: ctrl.signal,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error('Autocomplete failed');
      const json = await res.json();
      const suggestions = json.data ?? [];

      // Normalize API proxy response → standard MapboxFeature shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const features: MapboxFeature[] = suggestions.map((s: any) => ({
        id: s.id,
        text: s.text,
        place_name: s.placeName ?? s.place_name ?? s.text,
        center: s.center ?? [s.longitude ?? 0, s.latitude ?? 0],
        place_type: s.place_type ?? ['place'],
      }));

      setResults(features);
    } catch {
      if (!ctrl.signal.aborted) setResults([]);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  const onChange = useCallback((value: string) => {
    setQuery(value);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (value.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => search(value), debounce);
  }, [search, debounce]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setOpen(false);
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      abortRef.current?.abort();
    };
  }, []);

  return { query, setQuery, results, loading, open, setOpen, onChange, clear };
}

/**
 * Reverse geocode coordinates to a human-readable address.
 * Routes through the backend API proxy (no token exposure).
 * Returns both the address and Plus Code when available.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string;
  plusCode?: { full: string; short: string; display: string; city: string };
}> {
  try {
    const url = `${API_BASE_URL}/orders/reverse-geocode?latitude=${lat}&longitude=${lng}`;
    const token = tokenStorage.getAccessToken();
    const res = await fetch(url, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    const json = await res.json();
    return {
      address: json.data?.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      plusCode: json.data?.plusCode,
    };
  } catch {
    return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
  }
}

/**
 * Reverse geocode coordinates to a plain address string.
 * Convenience wrapper for backwards compatibility.
 */
export async function reverseGeocodeAddress(lat: number, lng: number): Promise<string> {
  const result = await reverseGeocode(lat, lng);
  return result.address;
}

/**
 * Split a Mapbox place_name into primary and secondary parts.
 * e.g. "East Legon, Accra, Greater Accra Region, Ghana" →
 *   primary: "East Legon"
 *   secondary: "Accra, Greater Accra Region, Ghana"
 */
export function splitPlaceName(placeName: string) {
  const parts = placeName.split(', ');
  const primary = parts[0] || placeName;
  const secondary = parts.length > 1 ? parts.slice(1).join(', ') : '';
  return { primary, secondary };
}
