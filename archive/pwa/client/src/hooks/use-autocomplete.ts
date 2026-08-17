'use client';

// ══════════════════════════════════════════════════════════
// useAutocomplete — Google Places Autocomplete + Gazetteer
//
// Uses Google Places Autocomplete API (client-side) as the
// PRIMARY provider for rich, real-time place predictions
// with proper session tokens for cost efficiency.
//
// Also queries the backend gazetteer (42,000+ Ghana locations)
// in parallel for local coverage.
//
// Flow:
// 1. User types → Google Places Autocomplete + backend gazetteer
// 2. Results merged: Google predictions first, then gazetteer
// 3. User selects → Google Place Details (formatted address,
//    coordinates, place types) — no raw coordinates ever shown
// ══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { API_BASE_URL, DEFAULT_CENTER } from '@/lib/constants';
import { useAuth, tokenStorage } from '@riderguy/auth';
import {
  loadGoogleMaps,
  reverseGeocodeWithGoogle,
} from '@/lib/google-maps-loader';

/** Suggestion returned by autocomplete */
export interface SearchSuggestion {
  id: string;           // Google place_id or gaz-*/nom-* ID
  text: string;         // short display name
  placeName: string;    // full formatted address / description
  placeType?: string;   // feature type (poi, address, place, etc.)
  category?: string;    // POI category if applicable
  latitude?: number;    // coordinates (always present for gazetteer)
  longitude?: number;
  source?: string;      // 'google' | 'nominatim' | 'gazetteer'
}

/** Full place returned after retrieving details */
export interface RetrievedPlace {
  id: string;
  name: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  placeType: string;
  plusCode?: { full: string; short: string; display: string; city: string };
}

interface UseAutocompleteOptions {
  /** Debounce delay in ms. Defaults to 250. */
  debounce?: number;
}

export function useAutocomplete(options: UseAutocompleteOptions = {}) {
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
  // Google session token groups autocomplete + fetchFields for billing
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  // Track the last search query for recording selections
  const lastSearchQueryRef = useRef<string>('');
  // Cache PlacePrediction objects so retrieve can call toPlace() (preserves session token)
  const predictionsRef = useRef<Map<string, google.maps.places.PlacePrediction>>(new Map());

  // Pre-load Google Maps and init session token
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled) return;
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Get user's actual location for proximity bias
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocationRef.current = [pos.coords.longitude, pos.coords.latitude];
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300_000 },
    );
  }, []);

  /** Fetch suggestions from Google Places Autocomplete + backend gazetteer */
  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    lastSearchQueryRef.current = q;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    const prox = userLocationRef.current || DEFAULT_CENTER;

    // Run Google Places Autocomplete + backend gazetteer in parallel
    const [googleResults, gazetteerResults] = await Promise.allSettled([
      // ── Google Places Autocomplete (new API) ──
      (async (): Promise<SearchSuggestion[]> => {
        try {
          await loadGoogleMaps();
          if (ctrl.signal.aborted) return [];
          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
          }

          const { suggestions } = await google.maps.places.AutocompleteSuggestion
            .fetchAutocompleteSuggestions({
              input: q,
              sessionToken: sessionTokenRef.current,
              includedRegionCodes: ['GH'],
              locationBias: { center: { lat: prox[1], lng: prox[0] }, radius: 50000 },
            });

          if (ctrl.signal.aborted) return [];

          // Cache predictions for session-aware retrieval
          predictionsRef.current.clear();
          const mapped: SearchSuggestion[] = [];
          for (const s of suggestions) {
            const pred = s.placePrediction;
            if (!pred) continue;
            predictionsRef.current.set(pred.placeId, pred);
            mapped.push({
              id: pred.placeId,
              text: pred.mainText?.text ?? pred.text.text,
              placeName: pred.text.text,
              placeType: pred.types?.[0] ?? 'place',
              source: 'google' as const,
            });
          }
          return mapped;
        } catch {
          return [];
        }
      })(),

      // ── Backend gazetteer (42K+ Ghana locations) ──
      (async (): Promise<SearchSuggestion[]> => {
        try {
          if (!api) return [];
          const { data: json } = await api.get('/orders/autocomplete', {
            params: { q, lat: prox[1], lng: prox[0] },
            signal: ctrl.signal,
          });
          return (json.data ?? [])
            .filter((s: Record<string, unknown>) => s.source !== 'google')
            .map((s: Record<string, unknown>) => ({
              id: s.id as string,
              text: s.text as string,
              placeName: (s.placeName ?? s.place_name ?? s.text) as string,
              placeType: s.placeType as string | undefined,
              category: s.category as string | undefined,
              latitude: s.latitude as number | undefined,
              longitude: s.longitude as number | undefined,
              source: s.source as string | undefined,
            }));
        } catch {
          return [];
        }
      })(),
    ]);

    if (ctrl.signal.aborted) return;

    const google_ = googleResults.status === 'fulfilled' ? googleResults.value : [];
    const gazetteer_ = gazetteerResults.status === 'fulfilled' ? gazetteerResults.value : [];

    // Merge: Google predictions first (richer data), then gazetteer
    // Deduplicate by similar name
    const seen = new Set<string>();
    const merged: SearchSuggestion[] = [];

    for (const s of google_) {
      const key = s.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(s);
      }
    }
    for (const s of gazetteer_) {
      const key = s.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(s);
      }
    }

    setResults(merged.slice(0, 8));
    setLoading(false);
  }, [api]);

  /** Retrieve full place details for a selected suggestion */
  const retrieve = useCallback(async (suggestion: SearchSuggestion): Promise<RetrievedPlace | null> => {
    // ── Google Places: use new Place API for full info ──
    if (suggestion.source === 'google') {
      setRetrieving(true);
      try {
        await loadGoogleMaps();

        // Use cached prediction's toPlace() to preserve session token for billing
        const cachedPrediction = predictionsRef.current.get(suggestion.id);
        const placeObj = cachedPrediction
          ? cachedPrediction.toPlace()
          : new google.maps.places.Place({ id: suggestion.id });

        const { place: result } = await placeObj.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'types', 'addressComponents', 'plusCode', 'id'],
        });

        const lat = result.location?.lat();
        const lng = result.location?.lng();
        if (lat == null || lng == null) return null;

        // Extract Plus Code
        let plusCode: RetrievedPlace['plusCode'] | undefined;
        if (result.plusCode) {
          const globalCode = result.plusCode.globalCode ?? '';
          const compoundCode = result.plusCode.compoundCode ?? '';
          const shortCode = compoundCode
            ? compoundCode.split(' ')[0] ?? globalCode.slice(4)
            : globalCode.slice(4);
          const city = compoundCode
            ? compoundCode.replace(/^\S+\s*/, '')
            : '';
          plusCode = { full: globalCode, short: shortCode, display: shortCode, city };
        }

        const place: RetrievedPlace = {
          id: result.id ?? suggestion.id,
          name: result.displayName ?? suggestion.text,
          fullAddress: result.formattedAddress ?? suggestion.placeName,
          latitude: lat,
          longitude: lng,
          placeType: result.types?.[0] ?? 'place',
          plusCode,
        };

        // New session token for next search (billing: session complete)
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

        // Record selection for usage-based learning
        if (api && lastSearchQueryRef.current) {
          api.post('/orders/record-selection', {
            query: lastSearchQueryRef.current,
            suggestion: {
              id: place.id,
              text: place.name,
              placeName: place.fullAddress,
              latitude: place.latitude,
              longitude: place.longitude,
              source: 'google',
            },
          }).catch(() => {});
        }

        return place;
      } catch {
        return null;
      } finally {
        setRetrieving(false);
      }
    }

    // ── Gazetteer / Nominatim: coordinates already present ──
    if (suggestion.latitude != null && suggestion.longitude != null) {
      if (api && lastSearchQueryRef.current) {
        api.post('/orders/record-selection', {
          query: lastSearchQueryRef.current,
          suggestion: {
            id: suggestion.id,
            text: suggestion.text,
            placeName: suggestion.placeName,
            latitude: suggestion.latitude,
            longitude: suggestion.longitude,
            source: suggestion.source,
          },
        }).catch(() => {});
      }

      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      return {
        id: suggestion.id,
        name: suggestion.text,
        fullAddress: suggestion.placeName,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        placeType: suggestion.placeType ?? 'place',
      };
    }

    // ── Fallback: retrieve from backend ──
    setRetrieving(true);
    try {
      if (!api) return null;
      const { data: json } = await api.get(
        `/orders/retrieve-place/${encodeURIComponent(suggestion.id)}`,
      );
      const place = json.data as RetrievedPlace | undefined;
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
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
    predictionsRef.current.clear();
    if (typeof google !== 'undefined' && google.maps?.places) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
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
 *
 * Uses Google Maps Geocoder (client-side) as primary, with
 * backend API proxy as fallback. NEVER returns raw coordinates.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string;
  plusCode?: { full: string; short: string; display: string; city: string };
}> {
  // Primary: Google Maps Geocoder (client-side) — fastest, most accurate
  try {
    const result = await reverseGeocodeWithGoogle(lat, lng);
    if (result.address && !result.address.includes('Unknown') && !result.address.includes('Unable')) {
      return {
        address: result.address,
        plusCode: result.plusCode
          ? { full: result.plusCode, short: result.plusCode, display: result.plusCode, city: '' }
          : undefined,
      };
    }
  } catch {
    // Fall through to backend
  }

  // Fallback: Backend API proxy
  try {
    const url = `${API_BASE_URL}/orders/reverse-geocode?latitude=${lat}&longitude=${lng}`;
    const token = tokenStorage.getAccessToken();
    const res = await fetch(url, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      return { address: 'Address not found. Please search for the location.' };
    }
    const json = await res.json();
    return {
      address: json.data?.address || 'Address not found. Please search for the location.',
      plusCode: json.data?.plusCode,
    };
  } catch {
    return { address: 'Address not found. Please search for the location.' };
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
 * Split a place_name into primary and secondary parts.
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
