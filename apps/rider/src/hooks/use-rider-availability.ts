'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiClient } from '@riderguy/auth';
import { useSocket } from './use-socket';

// ============================================================
// useRiderAvailability — manages the rider's online/offline
// state, persists to API, and controls geolocation tracking.
// ============================================================

export type RiderAvailability = 'ONLINE' | 'OFFLINE' | 'ON_DELIVERY' | 'ON_BREAK';

interface RiderAvailabilityState {
  availability: RiderAvailability;
  isOnline: boolean;
  loading: boolean;
  toggling: boolean;
  error: string | null;
  toggleAvailability: (status?: RiderAvailability) => Promise<void>;
  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
}

export function useRiderAvailability(): RiderAvailabilityState {
  const [availability, setAvailability] = useState<RiderAvailability>('OFFLINE');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { emitLocation, connected } = useSocket();
  const watchIdRef = useRef<number | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Fetch current availability from rider profile ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = getApiClient();
        const { data } = await api.get('/riders/profile');
        if (!cancelled && data.data?.availability) {
          setAvailability(data.data.availability as RiderAvailability);
        }
      } catch {
        // Will default to OFFLINE if profile fails
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Geolocation tracking ----
  const startLocationTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    // Use watchPosition for real-time updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        emitLocation(
          latitude,
          longitude,
          heading ?? undefined,
          speed ?? undefined,
        );
      },
      (err) => {
        console.warn('[Geolocation] Watch error:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    );
    watchIdRef.current = watchId;

    // Also send location every 30s as a heartbeat (in case watchPosition
    // doesn't fire on stationary riders)
    locationIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          emitLocation(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.heading ?? undefined,
            pos.coords.speed ?? undefined,
          );
        },
        () => { /* silent */ },
        { enableHighAccuracy: true, maximumAge: 30000 },
      );
    }, 30000);
  }, [emitLocation]);

  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  // Auto-start/stop geolocation when availability changes
  useEffect(() => {
    if (availability === 'ONLINE' || availability === 'ON_DELIVERY') {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    return () => stopLocationTracking();
  }, [availability, startLocationTracking, stopLocationTracking]);

  // ---- Toggle availability via API ----
  const toggleAvailability = useCallback(
    async (status?: RiderAvailability) => {
      const newStatus = status ?? (availability === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
      setToggling(true);
      setError(null);
      try {
        const api = getApiClient();
        const { data } = await api.patch('/riders/availability', { availability: newStatus });
        setAvailability(data.data?.availability ?? newStatus);
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response: { data: { error?: string } } }).response?.data?.error
            : 'Failed to update availability';
        setError(msg || 'Failed to update availability');
      } finally {
        setToggling(false);
      }
    },
    [availability],
  );

  const goOnline = useCallback(() => toggleAvailability('ONLINE'), [toggleAvailability]);
  const goOffline = useCallback(() => toggleAvailability('OFFLINE'), [toggleAvailability]);

  return {
    availability,
    isOnline: availability === 'ONLINE' || availability === 'ON_DELIVERY',
    loading,
    toggling,
    error,
    toggleAvailability,
    goOnline,
    goOffline,
  };
}
