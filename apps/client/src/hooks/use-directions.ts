// ══════════════════════════════════════════════════════════
// useDirections — React hook for Mapbox Directions API
//
// Fetches directions through the API proxy (keeps token server-side).
// Returns routes with geometry, duration, distance, congestion data,
// and step-by-step navigation instructions.
//
// Features:
// • Primary + alternative route support
// • Congestion annotations (from driving-traffic profile)
// • Step-by-step turn instructions
// • Multi-waypoint routing
// • Loading / error state management
// • Abort controller for cleanup
// ══════════════════════════════════════════════════════════

'use client';

import { useCallback, useRef, useState } from 'react';
import { tokenStorage } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';

// ── Types ───────────────────────────────────────────────

export interface DirectionsRoute {
  geometry: GeoJSON.Geometry;
  duration: number;  // seconds
  distance: number;  // meters
  weight: number;
  weight_name: string;
  legs: DirectionsLeg[];
}

export interface DirectionsLeg {
  duration: number;
  distance: number;
  summary: string;
  steps: DirectionsStep[];
  annotation?: {
    congestion?: string[];
    duration?: number[];
    distance?: number[];
  };
}

export interface DirectionsStep {
  geometry: GeoJSON.Geometry;
  duration: number;
  distance: number;
  name: string;
  mode: string;
  maneuver: {
    type: string;
    modifier?: string;
    instruction: string;
    bearing_before: number;
    bearing_after: number;
    location: [number, number];
  };
  driving_side: string;
  intersections?: Array<{
    location: [number, number];
    bearings: number[];
    entry: boolean[];
    out?: number;
    in?: number;
  }>;
}

export interface DirectionsWaypoint {
  name: string;
  location: [number, number];
}

export interface DirectionsResult {
  routes: DirectionsRoute[];
  waypoints: DirectionsWaypoint[];
  code: string;
}

export type DirectionsProfile = 'driving-traffic' | 'driving' | 'cycling' | 'walking';

export interface UseDirectionsReturn {
  /** Fetched routes (primary first, then alternatives) */
  routes: DirectionsRoute[];
  /** Waypoints snapped to the road network */
  waypoints: DirectionsWaypoint[];
  /** Loading state */
  loading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Fetch directions between coordinates */
  fetchDirections: (
    coordinates: [number, number][],
    profile?: DirectionsProfile,
  ) => Promise<DirectionsRoute[] | null>;
  /** Clear state */
  reset: () => void;
}

// ── Hook ────────────────────────────────────────────────

export function useDirections(): UseDirectionsReturn {
  const [routes, setRoutes] = useState<DirectionsRoute[]>([]);
  const [waypoints, setWaypoints] = useState<DirectionsWaypoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchDirections = useCallback(
    async (
      coordinates: [number, number][],
      profile: DirectionsProfile = 'driving-traffic',
    ): Promise<DirectionsRoute[] | null> => {
      if (coordinates.length < 2) {
        setError('At least two coordinates required');
        return null;
      }

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const token = tokenStorage.getAccessToken();
        if (!token) throw new Error('Not authenticated');

        // Format coordinates: lng,lat;lng,lat;...
        const coordStr = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');
        const url = `${API_BASE_URL}/orders/directions?coordinates=${encodeURIComponent(coordStr)}&profile=${profile}`;

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.error?.message ?? `Directions request failed (${res.status})`,
          );
        }

        const json = (await res.json()) as { success: boolean; data: DirectionsResult };

        if (!json.success || !json.data?.routes?.length) {
          throw new Error('No route found between these locations');
        }

        const result = json.data;
        setRoutes(result.routes);
        setWaypoints(result.waypoints ?? []);
        return result.routes;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        const msg = err instanceof Error ? err.message : 'Failed to fetch directions';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setRoutes([]);
    setWaypoints([]);
    setLoading(false);
    setError(null);
  }, []);

  return { routes, waypoints, loading, error, fetchDirections, reset };
}
