// ══════════════════════════════════════════════════════════
// useDirections — React hook for Directions API
//
// Fetches directions through the API proxy (keeps key server-side).
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
import { useAuth } from '@riderguy/auth';

// ── Types ───────────────────────────────────────────────

type GeoJSONGeometry = { type: string; coordinates: unknown };

export interface DirectionsRoute {
  geometry: GeoJSONGeometry;
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
  geometry: GeoJSONGeometry;
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
  const { api } = useAuth();
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
        if (!api) throw new Error('Not authenticated');

        // Format coordinates: lng,lat;lng,lat;...
        const coordStr = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');

        const { data: json } = await api.get<{ success: boolean; data: DirectionsResult }>(
          '/orders/directions',
          {
            params: { coordinates: coordStr, profile },
            signal: controller.signal,
          },
        );

        if (!json.success || !json.data?.routes?.length) {
          throw new Error('No route found between these locations');
        }

        const result = json.data;
        setRoutes(result.routes);
        setWaypoints(result.waypoints ?? []);
        return result.routes;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        if ((err as { code?: string })?.code === 'ERR_CANCELED') return null;
        const axiosMsg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
        const msg = axiosMsg ?? (err instanceof Error ? err.message : 'Failed to fetch directions');
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [api],
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
