// ══════════════════════════════════════════════════════════
// ClientMap — Dashboard map for the client (sender) app
//
// Features:
// • Mapbox GL JS v3.19 via initMapCore (NavigationControl,
//   GeolocateControl, ScaleControl, 3D buildings, fog)
// • Nearby rider markers (polled via REST)
// • Live rider position updates (WebSocket rider:location)
// • Real-time traffic overlay (toggle)
// • User location dot
// • Full cleanup on unmount
// ══════════════════════════════════════════════════════════

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import { MAPBOX_TOKEN, DEFAULT_CENTER, API_BASE_URL } from '@/lib/constants';
import { MAP_ZOOM, LOCATION_INTERVALS } from '@riderguy/utils';
import { tokenStorage } from '@riderguy/auth';
import { connectSocket, disconnectSocket } from '@/hooks/use-socket';
import { initMapCore, easeToPoint, type MapCoreInstance } from '@/lib/map-core';
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
  const riderMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [trafficOn, setTrafficOn] = useState(true);
  const [mapReady, setMapReady] = useState(false);

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
    async (map: mapboxgl.Map, mapboxglLib: typeof import('mapbox-gl').default, center: [number, number]) => {
      try {
        const token = tokenStorage.getAccessToken();
        if (!token) return;

        const [lng, lat] = center;
        const res = await fetch(
          `${API_BASE_URL}/riders/nearby?latitude=${lat}&longitude=${lng}&radius=5`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;

        const json = await res.json();
        const riders: NearbyRider[] = json.data ?? [];
        const currentIds = new Set(riders.map((r) => r.id));

        // Remove markers for riders no longer nearby
        riderMarkersRef.current.forEach((marker, id) => {
          if (!currentIds.has(id)) {
            marker.remove();
            riderMarkersRef.current.delete(id);
          }
        });

        // Add/update markers
        for (const rider of riders) {
          const existing = riderMarkersRef.current.get(rider.id);
          if (existing) {
            existing.setLngLat([rider.longitude, rider.latitude]);
          } else {
            const marker = createSmallRiderMarker(mapboxglLib, [rider.longitude, rider.latitude], {
              popup: rider.firstName ? `Rider nearby` : undefined,
            });
            marker.addTo(map);
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
    if (!containerRef.current || !MAPBOX_TOKEN) return;
    let cancelled = false;

    (async () => {
      const userPos = await getUserPosition();
      if (cancelled) return;

      const core = await initMapCore({
        container: containerRef.current!,
        token: MAPBOX_TOKEN,
        center: userPos ?? DEFAULT_CENTER,
        zoom: userPos ? MAP_ZOOM.close : MAP_ZOOM.default,
        onLoad: (map, mapboxglLib) => {
          // Traffic overlay
          addTrafficLayer(map);

          // User location dot
          if (userPos) {
            const dot = createUserDotMarker(mapboxglLib, userPos);
            dot.addTo(map);
            userMarkerRef.current = dot;
          }

          // Initial nearby riders fetch
          fetchNearbyRiders(map, mapboxglLib, userPos ?? DEFAULT_CENTER);

          // Poll nearby riders
          pollTimerRef.current = setInterval(() => {
            const center = map.getCenter();
            fetchNearbyRiders(map, mapboxglLib, [center.lng, center.lat]);
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
      riderMarkersRef.current.forEach((m) => m.remove());
      riderMarkersRef.current.clear();
      userMarkerRef.current?.remove();
      coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, [getUserPosition, fetchNearbyRiders]);

  // ── WebSocket for live rider locations ────────────────
  useEffect(() => {
    if (!mapReady) return;

    const socket = connectSocket();

    const handleRiderLocation = (data: { riderId: string; latitude: number; longitude: number }) => {
      const core = coreRef.current;
      if (!core) return;

      const existing = riderMarkersRef.current.get(data.riderId);
      if (existing) {
        existing.setLngLat([data.longitude, data.latitude]);
      } else {
        const marker = createSmallRiderMarker(core.mapboxgl, [data.longitude, data.latitude]);
        marker.addTo(core.map);
        riderMarkersRef.current.set(data.riderId, marker);
      }
    };

    socket.on('rider:location', handleRiderLocation);

    return () => {
      socket.off('rider:location', handleRiderLocation);
      disconnectSocket();
    };
  }, [mapReady]);

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
        className="map-control-btn absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-xs font-medium shadow-md backdrop-blur transition hover:bg-white dark:bg-neutral-900/90 dark:hover:bg-neutral-800"
        aria-label={trafficOn ? 'Hide traffic' : 'Show traffic'}
        title={trafficOn ? 'Hide traffic' : 'Show traffic'}
      >
        <span className={`h-2 w-2 rounded-full ${trafficOn ? 'bg-green-500' : 'bg-gray-400'}`} />
        Traffic
      </button>
    </div>
  );
}
