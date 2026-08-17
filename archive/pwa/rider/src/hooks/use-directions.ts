'use client';

import { useCallback, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/constants';
import { tokenStorage } from '@riderguy/auth';

// ── Types ───────────────────────────────────────────────

export interface DirectionsManeuver {
  type: string;
  instruction: string;
}

export interface DirectionsStep {
  geometry: { type: string; coordinates: number[][] };
  duration: number;
  distance: number;
  name: string;
  maneuver: DirectionsManeuver;
}

export interface DirectionsLeg {
  duration: number;
  distance: number;
  steps: DirectionsStep[];
  annotation?: {
    congestion?: string[];
    duration?: number[];
    distance?: number[];
  };
}

export interface DirectionsRoute {
  geometry: { type: string; coordinates: number[][] };
  duration: number;
  distance: number;
  legs: DirectionsLeg[];
}

// ── Hook ────────────────────────────────────────────────

export function useDirections() {
  const [route, setRoute] = useState<DirectionsRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchDirections = useCallback(
    async (from: [number, number], to: [number, number]): Promise<DirectionsRoute | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const token = tokenStorage.getAccessToken();
      if (!token) return null;

      setLoading(true);
      setError(null);

      try {
        const coordStr = `${from[0]},${from[1]};${to[0]},${to[1]}`;
        const url = `${API_BASE_URL}/orders/directions?coordinates=${encodeURIComponent(coordStr)}&profile=driving-traffic`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) {
          setLoading(false);
          setError('Failed to fetch directions');
          return null;
        }

        const json = await res.json();
        if (!json.success || !json.data?.routes?.length) {
          setLoading(false);
          setError('No route found');
          return null;
        }

        const r = json.data.routes[0] as DirectionsRoute;
        setRoute(r);
        setLoading(false);
        return r;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        setLoading(false);
        setError('Direction request failed');
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setRoute(null);
    setLoading(false);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { route, loading, error, fetchDirections, reset, abort };
}
