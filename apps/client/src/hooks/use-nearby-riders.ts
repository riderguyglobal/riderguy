'use client';

// ══════════════════════════════════════════════════════════
// useNearbyRiders — Poll for online riders near a location
//
// Used on the Send page to show rider availability before
// booking, and on the dashboard map for live rider dots.
//
// Returns an array of { id, latitude, longitude, firstName }
// plus a count for UI display. Polls every `intervalMs`
// while coordinates are available.
// ══════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@riderguy/auth';

export interface NearbyRider {
  id: string;
  latitude: number;
  longitude: number;
  firstName?: string;
  distKm?: number;
}

interface UseNearbyRidersOptions {
  /** Coordinates [lng, lat] to search around. Null disables polling. */
  coordinates: [number, number] | null;
  /** Search radius in km (default 5, max 50). */
  radiusKm?: number;
  /** Poll interval in ms (default 15000). */
  intervalMs?: number;
  /** Whether polling is enabled (default true). */
  enabled?: boolean;
}

export function useNearbyRiders({
  coordinates,
  radiusKm = 5,
  intervalMs = 15_000,
  enabled = true,
}: UseNearbyRidersOptions) {
  const { api } = useAuth();
  const [riders, setRiders] = useState<NearbyRider[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRiders = useCallback(
    async (coords: [number, number]) => {
      if (!api) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);

      try {
        const [lng, lat] = coords;
        const { data: json } = await api.get('/riders/nearby', {
          params: { latitude: lat, longitude: lng, radius: radiusKm },
          signal: ctrl.signal,
        });
        if (!ctrl.signal.aborted) {
          setRiders(json.data ?? []);
        }
      } catch {
        // Silently fail — non-critical
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [api, radiusKm],
  );

  useEffect(() => {
    if (!coordinates || !enabled || !api) {
      setRiders([]);
      return;
    }

    // Initial fetch
    fetchRiders(coordinates);

    // Poll
    timerRef.current = setInterval(() => {
      fetchRiders(coordinates);
    }, intervalMs);

    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [coordinates?.[0], coordinates?.[1], enabled, api, intervalMs, fetchRiders]);

  return {
    riders,
    count: riders.length,
    loading,
  };
}
