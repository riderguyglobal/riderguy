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

// ── RID-05: location-POST failure tracker ────────────────────────────
//   We previously swallowed every `/riders/location` failure with a noop
//   catch. After N consecutive failures the rider is silently invisible
//   to dispatch; surface a warning so the UI can hint at GPS/network issues.
const LOCATION_FAILURE_THRESHOLD = 3;
let consecutiveLocationFailures = 0;
let warnedThreshold = false;

function recordLocationPostResult(ok: boolean, err?: unknown): void {
  if (ok) {
    if (warnedThreshold) {
      try {
        window.dispatchEvent(new CustomEvent('riderguy:location-post-recovered'));
      } catch { /* noop */ }
    }
    consecutiveLocationFailures = 0;
    warnedThreshold = false;
    return;
  }
  consecutiveLocationFailures++;
  if (consecutiveLocationFailures >= LOCATION_FAILURE_THRESHOLD && !warnedThreshold) {
    warnedThreshold = true;
    console.warn(
      `[RiderAvailability] ${consecutiveLocationFailures} consecutive location POST failures`,
      err,
    );
    try {
      window.dispatchEvent(
        new CustomEvent('riderguy:location-post-failed', {
          detail: { consecutive: consecutiveLocationFailures },
        }),
      );
    } catch { /* noop */ }
  }
}

function postLocation(api: { post: (url: string, body: unknown) => Promise<unknown> } | null | undefined, lat: number, lng: number): void {
  if (!api) return;
  api
    .post('/riders/location', { latitude: lat, longitude: lng })
    .then(() => recordLocationPostResult(true))
    .catch((err) => recordLocationPostResult(false, err));
}

// ── RID-01: Debounce thresholds ─────────────────────────────
const MIN_DISTANCE_M = 30;        // Skip emits for <30m moves
const MIN_HEADING_DELTA_DEG = 25; // …unless heading changed >25°
const MAX_EMIT_INTERVAL_MS = 30_000; // …or it's been >30s since last emit
const STATIONARY_THRESHOLD_MS = 120_000; // 2 min stationary → switch to LOW_ACCURACY

/** Haversine distance in metres between two GPS points */
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Smallest angular delta between two compass headings (0..360) */
function headingDelta(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null) return 0;
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

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

  // ── RID-01: Debounce + adaptive-accuracy state ─────────────
  // Track the last-emitted position + emit time so we can suppress
  // GPS updates that don't move the rider beyond a meaningful
  // threshold. This cuts socket emits + REST POSTs by ~80% when
  // the rider is stationary (waiting at pickup, traffic, idle).
  const lastEmitRef = useRef<{ lat: number; lng: number; at: number; heading: number | null } | null>(null);
  const stationarySinceRef = useRef<number | null>(null);
  const accuracyModeRef = useRef<'HIGH' | 'LOW'>('HIGH');

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
              api?.post('/riders/location', { latitude, longitude })
                .then(() => recordLocationPostResult(true))
                .catch((err) => recordLocationPostResult(false, err));
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

    // RID-01: Reset debounce/accuracy state on each ONLINE start
    lastEmitRef.current = null;
    stationarySinceRef.current = Date.now();
    accuracyModeRef.current = 'HIGH';

    /**
     * RID-01: Decide whether a new GPS fix is worth emitting.
     * Returns true if the position has moved at least MIN_DISTANCE_M,
     * heading changed by MIN_HEADING_DELTA_DEG, or MAX_EMIT_INTERVAL_MS
     * has elapsed since the last emit. Updates stationary/active state
     * for adaptive-accuracy switching.
     */
    const shouldEmit = (lat: number, lng: number, heading: number | null): boolean => {
      const now = Date.now();
      const prev = lastEmitRef.current;
      if (!prev) return true;

      const dist = haversineMetres(prev.lat, prev.lng, lat, lng);
      const dHeading = headingDelta(prev.heading, heading);
      const dt = now - prev.at;

      // Track stationary-time for adaptive-accuracy
      if (dist < MIN_DISTANCE_M) {
        stationarySinceRef.current ??= prev.at;
      } else {
        stationarySinceRef.current = null;
      }

      const moved = dist >= MIN_DISTANCE_M;
      const turned = dHeading >= MIN_HEADING_DELTA_DEG;
      const stale = dt >= MAX_EMIT_INTERVAL_MS;
      return moved || turned || stale;
    };

    const recordEmit = (lat: number, lng: number, heading: number | null) => {
      lastEmitRef.current = { lat, lng, at: Date.now(), heading };
    };

    const maybeEmit = (
      lat: number,
      lng: number,
      heading: number | null,
      opts?: { post?: boolean },
    ) => {
      if (!shouldEmit(lat, lng, heading)) return;
      recordEmit(lat, lng, heading);
      if (connected) emitLocation(lat, lng, heading ?? undefined);
      if (opts?.post !== false) {
        postLocation(api, lat, lng);
      }
    };

    // 1. Fire an immediate position so dispatch has fresh coords
    //    within the first second (instead of waiting for watchPosition's first fire).
    //    Uses fallback so we never show a timeout on first load.
    getPositionWithFallback()
      .then((pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setGpsError(null);
        // First emit is unconditional (no prior state)
        if (connected) emitLocation(lat, lng, pos.coords.heading ?? undefined);
        postLocation(api, lat, lng);
        recordEmit(lat, lng, pos.coords.heading ?? null);
      })
      .catch(() => {});

    // RID-01: Adaptive-accuracy starter — re-evaluates every 60s whether to
    // downshift to LOW_ACCURACY (saves battery when stationary) or upshift
    // back to HIGH_ACCURACY (resumes precise tracking when rider moves).
    const startWatch = (mode: 'HIGH' | 'LOW' = accuracyModeRef.current) => {
      const opts = mode === 'HIGH' ? HIGH_ACCURACY : LOW_ACCURACY;
      accuracyModeRef.current = mode;
      return navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          // Always update local state so the UI reflects current position
          setCoords({ lat, lng });
          setGpsError(null);
          // Debounced emit
          maybeEmit(lat, lng, pos.coords.heading ?? null);
        },
        (err) => {
          if (err.code === 1) {
            setGpsError('Location permission denied — enable it in your browser settings');
          } else if (err.code === 2) {
            setGpsError('Location unavailable — check your device GPS');
          } else {
            getPosition(LOW_ACCURACY)
              .then((pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                setCoords({ lat, lng });
                setGpsError(null);
                maybeEmit(lat, lng, pos.coords.heading ?? null);
              })
              .catch(() => {
                setGpsError('Location timed out — retrying…');
              });
          }
        },
        opts,
      );
    };

    // 2. Continuous watch — fires on every significant position change
    watchRef.current = startWatch('HIGH');

    // 2b. RID-01: Adaptive-accuracy supervisor — every 60s, if the rider has
    //     been stationary for STATIONARY_THRESHOLD_MS, restart the watcher
    //     in LOW_ACCURACY mode (network-based, much lower battery cost).
    //     When motion resumes, upshift back to HIGH.
    const accuracySupervisor = setInterval(() => {
      const now = Date.now();
      const stationarySince = stationarySinceRef.current;
      const isStationary = stationarySince != null && now - stationarySince >= STATIONARY_THRESHOLD_MS;

      if (isStationary && accuracyModeRef.current === 'HIGH') {
        // Downshift
        if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = startWatch('LOW');
      } else if (!isStationary && accuracyModeRef.current === 'LOW') {
        // Upshift
        if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = startWatch('HIGH');
      }
    }, 60_000);

    // 3. REST heartbeat fallback — ensures DB is updated even if socket drops
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          postLocation(api, latitude, longitude);
        },
        () => {},
        accuracyModeRef.current === 'HIGH' ? HIGH_ACCURACY : LOW_ACCURACY,
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
          // Force-emit on resume regardless of debounce
          if (connected) emitLocation(lat, lng, pos.coords.heading ?? undefined);
          postLocation(api, lat, lng);
          recordEmit(lat, lng, pos.coords.heading ?? null);
        })
        .catch(() => {});
      // Restart continuous watch in current accuracy mode
      watchRef.current = startWatch(accuracyModeRef.current);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(accuracySupervisor);
      document.removeEventListener('visibilitychange', handleVisibility);
      watchRef.current = null;
      intervalRef.current = null;
      lastEmitRef.current = null;
      stationarySinceRef.current = null;
      accuracyModeRef.current = 'HIGH';
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
