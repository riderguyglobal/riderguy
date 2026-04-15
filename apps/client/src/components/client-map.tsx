// ══════════════════════════════════════════════════════════
// ClientMap — Dashboard map for the client (sender) app
//
// Features:
// • Google Maps JS API via initMapCore (zoom, scale,
//   3D buildings, dark-mode styles)
// • Nearby rider markers (polled via REST)
// • Live rider position updates (WebSocket rider:location)
// • Real-time traffic overlay (toggle)
// • User location dot
// • Full cleanup on unmount
// ══════════════════════════════════════════════════════════

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GOOGLE_MAPS_API_KEY, DEFAULT_CENTER } from '@/lib/constants';
import { MAP_ZOOM, LOCATION_INTERVALS } from '@riderguy/utils';
import { useAuth } from '@riderguy/auth';
import { useSocket } from '@/hooks/use-socket';
import { initMapCore, type MapCoreInstance } from '@/lib/map-core';
import { createSmallRiderMarker, createUserDotMarker, removeMarkers } from '@/lib/map-markers';
import { addTrafficLayer, toggleTraffic, hasTrafficLayer } from '@/lib/map-route';

// ── Types ───────────────────────────────────────────────

interface NearbyRider {
  id: string;
  latitude: number;
  longitude: number;
  firstName?: string;
}

// ── Component ───────────────────────────────────────────

export default function ClientMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MapCoreInstance | null>(null);
  const riderMarkersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [trafficOn, setTrafficOn] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const { socket } = useSocket();
  const { api } = useAuth();
  const apiRef = useRef(api);
  apiRef.current = api;

  // ── Get user position ─────────────────────────────────
  const getUserPosition = useCallback((): Promise<[number, number] | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    });
  }, []);

  // ── Fetch nearby riders ───────────────────────────────
  const fetchNearbyRiders = useCallback(
    async (map: google.maps.Map, center: [number, number]) => {
      try {
        const currentApi = apiRef.current;
        if (!currentApi) return;

        const [lng, lat] = center;
        const { data: json } = await currentApi.get('/riders/nearby', {
          params: { latitude: lat, longitude: lng, radius: 5 },
        });
        const riders: NearbyRider[] = json.data ?? [];
        const currentIds = new Set(riders.map((r) => r.id));

        // Remove markers for riders no longer nearby
        riderMarkersRef.current.forEach((marker, id) => {
          if (!currentIds.has(id)) {
            marker.map = null;
            riderMarkersRef.current.delete(id);
          }
        });

        // Add/update markers
        for (const rider of riders) {
          const existing = riderMarkersRef.current.get(rider.id);
          if (existing) {
            existing.position = { lat: rider.latitude, lng: rider.longitude };
          } else {
            const marker = createSmallRiderMarker(map, [rider.longitude, rider.latitude], {
              popup: rider.firstName ? `Rider nearby` : undefined,
            });
            riderMarkersRef.current.set(rider.id, marker);
          }
        }
      } catch {
        // Silently fail — non-critical
      }
    },
    [],
  );

  // ── Initialize map ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;

    (async () => {
      const userPos = await getUserPosition();
      if (cancelled) return;

      const core = await initMapCore({
        container: containerRef.current!,
        token: GOOGLE_MAPS_API_KEY,
        center: userPos ?? DEFAULT_CENTER,
        zoom: userPos ? MAP_ZOOM.close : MAP_ZOOM.default,
        onLoad: (map) => {
          // Traffic overlay (hidden by default)
          addTrafficLayer(map);
          toggleTraffic(map, false);

          // User location dot
          if (userPos) {
            const dot = createUserDotMarker(map, userPos);
            userMarkerRef.current = dot;
          }

          // Initial nearby riders fetch
          fetchNearbyRiders(map, userPos ?? DEFAULT_CENTER);

          // Poll nearby riders
          pollTimerRef.current = setInterval(() => {
            const center = map.getCenter();
            if (center) fetchNearbyRiders(map, [center.lng(), center.lat()]);
          }, LOCATION_INTERVALS.nearbyPoll);

          setMapReady(true);
        },
      });

      if (cancelled) {
        core.destroy();
        return;
      }
      coreRef.current = core;
    })();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      riderMarkersRef.current.forEach((m) => { m.map = null; });
      riderMarkersRef.current.clear();
      if (userMarkerRef.current) userMarkerRef.current.map = null;
      coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, [getUserPosition, fetchNearbyRiders]);

  // ── WebSocket for live rider locations ────────────────
  useEffect(() => {
    if (!mapReady || !socket) return;

    const handleRiderLocation = (data: { riderId: string; latitude: number; longitude: number }) => {
      const core = coreRef.current;
      if (!core) return;
      if (!Number.isFinite(data.longitude) || !Number.isFinite(data.latitude)) return;

      const existing = riderMarkersRef.current.get(data.riderId);
      if (existing) {
        existing.position = { lat: data.latitude, lng: data.longitude };
      } else {
        const marker = createSmallRiderMarker(core.map, [data.longitude, data.latitude]);
        riderMarkersRef.current.set(data.riderId, marker);
      }
    };

    socket.on('rider:location', handleRiderLocation);

    return () => {
      socket.off('rider:location', handleRiderLocation);
    };
  }, [mapReady, socket]);

  // ── Traffic toggle ────────────────────────────────────
  useEffect(() => {
    const map = coreRef.current?.map;
    if (!map || !hasTrafficLayer(map)) return;
    toggleTraffic(map, trafficOn);
  }, [trafficOn]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-2xl" />

      {/* Traffic toggle button */}
      <button
        onClick={() => setTrafficOn((p) => !p)}
        className="map-control-btn absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-xs font-medium shadow-md backdrop-blur transition hover:bg-white"
        aria-label={trafficOn ? 'Hide traffic' : 'Show traffic'}
        title={trafficOn ? 'Hide traffic' : 'Show traffic'}
      >
        <span className={`h-2 w-2 rounded-full ${trafficOn ? 'bg-green-500' : 'bg-gray-400'}`} />
        Traffic
      </button>
    </div>
  );
}
