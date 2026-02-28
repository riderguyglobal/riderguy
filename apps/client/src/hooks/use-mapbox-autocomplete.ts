'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER } from '@/lib/constants';

// ── Ghana bounding box for better regional results ──
const GHANA_BBOX = '-3.26,4.74,1.19,11.17';

export interface MapboxFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  context?: Array<{ id: string; text: string }>;
}

interface UseMapboxAutocompleteOptions {
  /** Bias results near this coordinate [lng, lat]. Defaults to Accra. */
  proximity?: [number, number] | null;
  /** Country code (ISO 3166-1 alpha-2). Defaults to 'gh'. */
  country?: string;
  /** Max results. Defaults to 5. */
  limit?: number;
  /** Debounce delay in ms. Defaults to 250. */
  debounce?: number;
  /** Mapbox place types to search. Defaults to comprehensive set. */
  types?: string;
}

export function useMapboxAutocomplete(options: UseMapboxAutocompleteOptions = {}) {
  const {
    proximity = DEFAULT_CENTER,
    country = 'gh',
    limit = 5,
    debounce = 250,
    types = 'address,poi,place,locality,neighborhood,district',
  } = options;

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
      () => { /* ignore — will use DEFAULT_CENTER */ },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300_000 }
    );
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (!q || q.length < 2 || !MAPBOX_TOKEN) {
        setResults([]);
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);

      try {
        const encoded = encodeURIComponent(q);
        // Use user's actual location if available, otherwise fall back to provided proximity / Accra
        const prox = userLocationRef.current || proximity || DEFAULT_CENTER;
        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          country,
          limit: String(limit),
          types,
          autocomplete: 'true',
          language: 'en',
          bbox: GHANA_BBOX,
          proximity: `${prox[0]},${prox[1]}`,
          fuzzyMatch: 'true',
        });

        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?${params.toString()}`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error('Geocoding failed');
        const data = await res.json();
        setResults(data.features || []);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [proximity, country, limit, types]
  );

  const onChange = useCallback(
    (value: string) => {
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
    },
    [search, debounce]
  );

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
 * Calls Mapbox Geocoding API directly from the client.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!MAPBOX_TOKEN) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      types: 'address,poi,place,locality,neighborhood',
      limit: '1',
      language: 'en',
    });
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params.toString()}`
    );
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    return data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
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
