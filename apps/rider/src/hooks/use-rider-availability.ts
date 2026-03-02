'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { useSocket } from './use-socket';
import { LOCATION_INTERVAL, HEARTBEAT_INTERVAL } from '@/lib/constants';
import { RiderAvailability } from '@riderguy/types';

export function useRiderAvailability() {
  const { api } = useAuth();
  const { emitLocation, connected } = useSocket();
  const [availability, setAvailability] = useState<RiderAvailability>(RiderAvailability.OFFLINE);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial availability
  useEffect(() => {
    let mounted = true;
    api?.get('/riders/profile')
      .then((res) => {
        if (mounted) setAvailability(res.data.data?.availability ?? RiderAvailability.OFFLINE);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [api]);

  // Track position when online
  useEffect(() => {
    if (availability !== RiderAvailability.ONLINE || !navigator.geolocation || !api) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        if (connected) emitLocation(lat, lng, pos.coords.heading ?? undefined);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5_000 }
    );

    // Heartbeat interval for location via REST
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          api?.post('/riders/location', { latitude, longitude }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5_000 }
      );
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [availability, connected, emitLocation, api]);

  const toggleAvailability = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    const next: RiderAvailability = availability === RiderAvailability.ONLINE ? RiderAvailability.OFFLINE : RiderAvailability.ONLINE;
    try {
      await api?.patch('/riders/availability', { availability: next });
      setAvailability(next);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [availability, loading, api]);

  return { availability, toggleAvailability, loading, coords };
}
