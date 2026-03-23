'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth';
import { useSocket } from './use-socket';
import { HEARTBEAT_INTERVAL } from '@/lib/constants';
import { RiderAvailability } from '@riderguy/types';

// ── Helpers ─────────────────────────────────────────────

/** Promise-based wrapper around getCurrentPosition for cleaner async flow */
function getPosition(opts?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opts);
  });
}

/**
 * Try high-accuracy first; if it times out, fall back to network/cell location.
 * This prevents the common PWA issue where GPS needs 15–30 s for a cold fix.
 */
async function getPositionWithFallback(): Promise<GeolocationPosition> {
  try {
    return await getPosition(HIGH_ACCURACY);
  } catch (err) {
    // Code 3 = TIMEOUT — retry with low accuracy (WiFi/cell, much faster)
    if (err instanceof GeolocationPositionError && err.code === 3) {
      return getPosition(LOW_ACCURACY);
    }
    throw err;
  }
}

/** High-accuracy (GPS satellite) — may take 15-30 s on cold start */
const HIGH_ACCURACY: PositionOptions = { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 };

/** Low-accuracy fallback (WiFi / cell tower) — resolves in 1-3 s */
const LOW_ACCURACY: PositionOptions = { enableHighAccuracy: false, maximumAge: 30_000, timeout: 10_000 };

// ══════════════════════════════════════════════════════════

export function useRiderAvailability() {
  const { api } = useAuth();
  const { emitLocation, connected } = useSocket();
  const queryClient = useQueryClient();
  const [availability, setAvailability] = useState<RiderAvailability>(RiderAvailability.OFFLINE);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const toggleGuardRef = useRef(false);

  // ── Fetch initial availability & seed GPS on first load ──
  useEffect(() => {
    if (!api) return;
    let mounted = true;

    (async () => {
      try {
        const profile = await queryClient.fetchQuery({
          queryKey: ['rider-profile-full'],
          queryFn: () => api.get('/riders/profile').then(r => r.data.data),
          staleTime: 30_000,
        });
        if (!mounted) return;
        setAvailability(profile?.availability ?? RiderAvailability.OFFLINE);
        setOnboardingStatus(profile?.onboardingStatus ?? null);

        // If rider profile has no GPS stored yet, seed it now so they
        // appear in dispatch queries immediately when they go ONLINE.
        if (profile && profile.currentLatitude == null && navigator.geolocation) {
          try {
            const pos = await getPositionWithFallback();
            const { latitude, longitude } = pos.coords;
            if (mounted) {
              setCoords({ lat: latitude, lng: longitude });
              api?.post('/riders/location', { latitude, longitude }).catch(() => {});
            }
          } catch {
            // GPS not available yet — will be set when they go online
          }
        }
      } catch {
        // profile fetch failed
      }
    })();

    return () => { mounted = false; };
  }, [api]);

  // ── Continuous GPS tracking when ONLINE ──
  useEffect(() => {
    if (availability !== RiderAvailability.ONLINE || !navigator.geolocation || !api) return;

    setGpsError(null);

    // 1. Fire an immediate position so dispatch has fresh coords
    //    within the first second (instead of waiting for watchPosition's first fire).
    //    Uses fallback so we never show a timeout on first load.
    getPositionWithFallback()
      .then((pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setGpsError(null);
        if (connected) emitLocation(lat, lng, pos.coords.heading ?? undefined);
        api.post('/riders/location', { latitude: lat, longitude: lng }).catch(() => {});
      })
      .catch(() => {});

    // 2. Continuous watch — fires on every significant position change
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setGpsError(null);
        if (connected) emitLocation(lat, lng, pos.coords.heading ?? undefined);
      },
      (err) => {
        if (err.code === 1) {
          setGpsError('Location permission denied — enable it in your browser settings');
        } else if (err.code === 2) {
          setGpsError('Location unavailable — check your device GPS');
        } else {
          // Code 3 — TIMEOUT: silently retry with low accuracy (WiFi/cell)
          // instead of alarming the user with a red banner.
          getPosition(LOW_ACCURACY)
            .then((pos) => {
              const { latitude: lat, longitude: lng } = pos.coords;
              setCoords({ lat, lng });
              setGpsError(null);
              if (connected) emitLocation(lat, lng, pos.coords.heading ?? undefined);
              api.post('/riders/location', { latitude: lat, longitude: lng }).catch(() => {});
            })
            .catch(() => {
              setGpsError('Location timed out — retrying…');
            });
        }
      },
      HIGH_ACCURACY,
    );

    // 3. REST heartbeat fallback — ensures DB is updated even if socket drops
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          api.post('/riders/location', { latitude, longitude }).catch(() => {});
        },
        () => {},
        HIGH_ACCURACY,
      );
    }, HEARTBEAT_INTERVAL);

    // 4. iOS suspends watchPosition when backgrounded — restart on foreground return
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      // Clear potentially stale watch and restart
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      // Re-acquire fresh position immediately
      getPositionWithFallback()
        .then((pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setCoords({ lat, lng });
          if (connected) emitLocation(lat, lng, pos.coords.heading ?? undefined);
          api.post('/riders/location', { latitude: lat, longitude: lng }).catch(() => {});
        })
        .catch(() => {});
      // Restart continuous watch
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setCoords({ lat, lng });
          setGpsError(null);
          if (connected) emitLocation(lat, lng, pos.coords.heading ?? undefined);
        },
        () => {},
        HIGH_ACCURACY,
      );
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      watchRef.current = null;
      intervalRef.current = null;
    };
  }, [availability, connected, emitLocation, api]);

  // ── Toggle ONLINE ↔ OFFLINE ──
  const toggleAvailability = useCallback(async () => {
    if (toggleGuardRef.current || !api) return;
    toggleGuardRef.current = true;
    setLoading(true);

    const next: RiderAvailability =
      availability === RiderAvailability.ONLINE
        ? RiderAvailability.OFFLINE
        : RiderAvailability.ONLINE;

    try {
      // When going ONLINE, grab GPS first and send it with the availability toggle
      // so the rider's lat/lng is NEVER null when they appear as ONLINE in dispatch.
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (next === RiderAvailability.ONLINE && navigator.geolocation) {
        try {
          const pos = await getPositionWithFallback();
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
          setCoords({ lat: latitude, lng: longitude });
        } catch {
          setGpsError('Enable location to go online');
          setLoading(false);
          toggleGuardRef.current = false;
          return;
        }
      }

      await api.patch('/riders/availability', { availability: next, latitude, longitude });
      setAvailability(next);
      setGpsError(null);
    } catch (err: any) {
      // Server returns 403 if rider is not ACTIVATED
      const message = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? '';
      if (err?.response?.status === 403 || message.includes('not yet activated')) {
        setGpsError(message || 'Your account is not yet activated. Complete onboarding and wait for approval.');
      } else if (message) {
        setGpsError(message);
      }
      // Other errors — silently ignore (network issues, etc.)
    } finally {
      setLoading(false);
      toggleGuardRef.current = false;
    }
  }, [availability, api]);

  return { availability, toggleAvailability, loading, coords, gpsError, onboardingStatus };
}
