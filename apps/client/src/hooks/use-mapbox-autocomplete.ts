'use client';

// ══════════════════════════════════════════════════════════
// useMapboxAutocomplete — Address autocomplete via API proxy
//
// Multi-provider strategy (Mapbox Geocoding v6 + Nominatim + 
// local Ghana gazetteer) through the backend API proxy.
//
// Flow:
// 1. User types → API proxy → merged results (with coords!)
// 2. User selects → if coords present: instant, no retrieve call
//                  → if no coords: retrieve endpoint for details
// ══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { API_BASE_URL, DEFAULT_CENTER } from '@/lib/constants';
import { useAuth, tokenStorage } from '@riderguy/auth';

export interface MapboxFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  context?: Array<{ id: string; text: string }>;
}

/** Suggestion returned by autocomplete (coordinates included for most providers) */
export interface SearchSuggestion {
  id: string;           // mapbox_id, gaz-*, nom-* — used for retrieve
  text: string;         // short display name
  placeName: string;    // full formatted address
  placeType?: string;   // feature_type (poi, address, place, etc.)
  category?: string;    // POI category if applicable
  /** Coordinates are included for Geocoding v6, Nominatim, and gazetteer results */
  latitude?: number;
  longitude?: number;
  source?: string;      // 'mapbox' | 'nominatim' | 'gazetteer'
}

/** Full place returned by Search Box retrieve (WITH coordinates) */
export interface RetrievedPlace {
  id: string;
  name: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  placeType: string;
  plusCode?: { full: string; short: string; display: string; city: string };
}

interface UseMapboxAutocompleteOptions {
  /** Debounce delay in ms. Defaults to 250. */
  debounce?: number;
}

/** Generate a random UUID v4 for session tokens */
function uuid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useMapboxAutocomplete(options: UseMapboxAutocompleteOptions = {}) {
  const { debounce = 250 } = options;
  const { api } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();
  const userLocationRef = useRef<[number, number] | null>(null);
  // Session token groups suggest + retrieve calls for Mapbox billing
  const sessionTokenRef = useRef<string>(uuid());

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

  /** Fetch suggestions from Search Box suggest endpoint */
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
      if (!api) { setLoading(false); return; }
      const prox = userLocationRef.current || DEFAULT_CENTER;
      const { data: json } = await api.get('/orders/autocomplete', {
        params: { q, lat: prox[1], lng: prox[0], session_token: sessionTokenRef.current },
        signal: ctrl.signal,
      });

      const suggestions: SearchSuggestion[] = (json.data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        text: s.text as string,
        placeName: (s.placeName ?? s.place_name ?? s.text) as string,
        placeType: s.placeType as string | undefined,
        category: s.category as string | undefined,
        latitude: s.latitude as number | undefined,
        longitude: s.longitude as number | undefined,
        source: s.source as string | undefined,
      }));

      setResults(suggestions);
    } catch {
      if (!ctrl.signal.aborted) setResults([]);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [api]);

  /** Retrieve full place details (coordinates) for a selected suggestion */
  const retrieve = useCallback(async (suggestion: SearchSuggestion): Promise<RetrievedPlace | null> => {
    // If coordinates are already present (Geocoding v6, Nominatim, gazetteer),
    // skip the retrieve API call entirely — build the place object directly.
    if (suggestion.latitude != null && suggestion.longitude != null) {
      // Start a new session for the next search
      sessionTokenRef.current = uuid();
      return {
        id: suggestion.id,
        name: suggestion.text,
        fullAddress: suggestion.placeName,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        placeType: suggestion.placeType ?? 'place',
      };
    }

    // Legacy path: Search Box IDs that need a retrieve call for coordinates
    setRetrieving(true);
    try {
      if (!api) return null;
      const { data: json } = await api.get(
        `/orders/retrieve-place/${encodeURIComponent(suggestion.id)}`,
        { params: { session_token: sessionTokenRef.current } },
      );

      const place = json.data as RetrievedPlace | undefined;

      // Start a new session for the next search
      sessionTokenRef.current = uuid();

      return place ?? null;
    } catch {
      return null;
    } finally {
      setRetrieving(false);
    }
  }, [api]);

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
    // New session for next search
    sessionTokenRef.current = uuid();
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      abortRef.current?.abort();
    };
  }, []);

  return { query, setQuery, results, loading, retrieving, open, setOpen, onChange, clear, retrieve };
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
