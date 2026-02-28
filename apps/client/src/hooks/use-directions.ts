'use client';

// ══════════════════════════════════════════════════════════
// useDirections — Fetch routes through backend API proxy
// Keeps Mapbox token server-side for security
// ══════════════════════════════════════════════════════════

import { useCallback, useRef } from 'react';
import { API_BASE_URL } from '@/lib/constants';
import { tokenStorage } from '@riderguy/auth';
import type { RouteData } from '@/lib/map-route';

export interface DirectionsResult {
  routes: RouteData[];
  /** Primary route ETA in minutes */
  eta: number;
  /** Primary route distance in km */
  distance: number;
}

/**
 * Hook for fetching directions through the backend API proxy.
 * Supports driving and cycling profiles with waypoints.
 */
export function useDirections() {
  const abortRef = useRef<AbortController>();

  const fetchRoute = useCallback(async (
    coords: [number, number][],
    options: { profile?: 'driving' | 'cycling'; signal?: AbortSignal } = {},
  ): Promise<DirectionsResult | null> => {
    if (coords.length < 2) return null;

    // Cancel previous in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const coordStr = coords.map(c => c.join(',')).join(';');
      const profile = options.profile ?? 'driving';
      const url = `${API_BASE_URL}/orders/directions?coordinates=${encodeURIComponent(coordStr)}&profile=${profile}`;
      const token = tokenStorage.getAccessToken();
      const res = await fetch(url, {
        signal: options.signal ?? ctrl.signal,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        console.warn('[useDirections] API returned', res.status);
        return null;
      }

      const json = await res.json();
      const rawRoutes = json.data?.routes;
      if (!rawRoutes?.length) return null;

      const routes: RouteData[] = rawRoutes.map((r: { geometry: GeoJSON.Geometry; duration: number; distance: number }) => ({
        geometry: r.geometry,
        duration: r.duration,
        distance: r.distance,
      }));

      const primary = routes[0]!;
      return {
        routes,
        eta: Math.ceil(primary.duration / 60),
        distance: Math.round(primary.distance / 100) / 10,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      console.warn('[useDirections] Failed:', err);
      return null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { fetchRoute, cancel };
}
