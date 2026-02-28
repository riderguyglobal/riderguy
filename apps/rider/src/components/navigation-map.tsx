// ══════════════════════════════════════════════════════════
// NavigationMap — Active delivery navigation for rider app
//
// Features:
// • Mapbox GL JS v3.19 via initMapCore (all controls, 3D, fog)
// • Theme-aware style switching (light ↔ dark)
// • Pickup / dropoff / stop markers with Popup
// • Rider position marker (live updates)
// • Multi-layer route with wider nav-mode widths
// • Phase-aware coloring (blue pickup → green delivery)
// • Congestion overlay from driving-traffic data
// • Auto route refresh when rider drifts > 100 m
// • Traffic overlay (toggle)
// • Fit bounds to all points
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import { MAPBOX_TOKEN, DEFAULT_CENTER, API_BASE_URL, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/lib/constants';
import {
  ROUTE_COLORS,
  MAP_PADDING,
  MAP_ZOOM,
  ROUTE_REFRESH_DISTANCE_M,
  haversineDistance,
} from '@riderguy/utils';
import { tokenStorage } from '@riderguy/auth';
import { useTheme } from '@/lib/theme';
import { initMapCore, switchMapStyle, easeToPoint, fitBoundsToCoords, type MapCoreInstance } from '@/lib/map-core';
import {
  createPickupMarker,
  createDropoffMarker,
  createStopMarker,
  createRiderMarker,
  removeMarkers,
} from '@/lib/map-markers';
import {
  drawRoute,
  addTrafficLayer,
  toggleTraffic,
  hasTrafficLayer,
  removeRoute,
  fitBoundsToCoords as routeFitBounds,
  type RoutePhase,
} from '@/lib/map-route';

// ── Types ───────────────────────────────────────────────

interface Stop {
  latitude: number;
  longitude: number;
  type: 'PICKUP' | 'DROPOFF';
  sequence: number;
  address?: string;
}

interface NavigationMapProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  stops?: Stop[];
  riderLat?: number;
  riderLng?: number;
  status: string;
  className?: string;
}

// ── Phase logic ─────────────────────────────────────────

const DELIVERY_STATUSES = new Set([
  'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF', 'DELIVERED',
]);

function getRoutePhase(status: string): RoutePhase {
  return DELIVERY_STATUSES.has(status) ? 'delivery' : 'pickup';
}

// ── Component ───────────────────────────────────────────

export function NavigationMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  stops,
  riderLat,
  riderLng,
  status,
  className,
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MapCoreInstance | null>(null);
  const staticMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastRouteRiderRef = useRef<[number, number] | null>(null);
  const hasInitialRouteRef = useRef(false);
  const [trafficOn, setTrafficOn] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const { resolvedTheme } = useTheme();

  const pickupCoords: [number, number] = [pickupLng, pickupLat];
  const dropoffCoords: [number, number] = [dropoffLng, dropoffLat];

  // ── Fetch directions from API proxy ───────────────────
  const fetchRoute = useCallback(
    async (from: [number, number], to: [number, number]) => {
      try {
        const token = tokenStorage.getAccessToken();
        if (!token) return null;

        const coordStr = `${from[0]},${from[1]};${to[0]},${to[1]}`;
        const url = `${API_BASE_URL}/orders/directions?coordinates=${encodeURIComponent(coordStr)}&profile=driving-traffic`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;

        const json = await res.json();
        if (!json.success || !json.data?.routes?.length) return null;

        return json.data.routes[0] as {
          geometry: GeoJSON.Geometry;
          duration: number;
          distance: number;
          legs: Array<{ annotation?: { congestion?: string[]; duration?: number[]; distance?: number[] } }>;
        };
      } catch {
        return null;
      }
    },
    [],
  );

  // ── Initialize map ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;
    let cancelled = false;

    (async () => {
      const style = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

      const core = await initMapCore({
        container: containerRef.current!,
        token: MAPBOX_TOKEN,
        style,
        center: riderLat && riderLng ? [riderLng, riderLat] : pickupCoords,
        zoom: MAP_ZOOM.close,
        onLoad: (map) => {
          addTrafficLayer(map);
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
      removeMarkers(staticMarkersRef.current);
      staticMarkersRef.current = [];
      riderMarkerRef.current?.remove();
      riderMarkerRef.current = null;
      coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, []);

  // ── Theme switching ───────────────────────────────────
  useEffect(() => {
    const core = coreRef.current;
    if (!core || !mapReady) return;

    const style = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
    switchMapStyle(core.map, style, {
      onStyleLoad: () => {
        addTrafficLayer(core.map);
        if (trafficOn) toggleTraffic(core.map, true);
      },
    });
  }, [resolvedTheme, mapReady]);

  // ── Update markers, route, rider position ─────────────
  useEffect(() => {
    if (!mapReady) return;
    const core = coreRef.current;
    if (!core) return;
    const { map, mapboxgl: mapboxglLib } = core;

    // Clear old static markers
    removeMarkers(staticMarkersRef.current);
    staticMarkersRef.current = [];

    const boundsCoords: [number, number][] = [];

    // Pickup
    const pm = createPickupMarker(mapboxglLib, pickupCoords, { popup: 'Pickup' });
    pm.addTo(map);
    staticMarkersRef.current.push(pm);
    boundsCoords.push(pickupCoords);

    // Dropoff
    const dm = createDropoffMarker(mapboxglLib, dropoffCoords, { popup: 'Dropoff' });
    dm.addTo(map);
    staticMarkersRef.current.push(dm);
    boundsCoords.push(dropoffCoords);

    // Multi-stop markers
    if (stops?.length) {
      for (const stop of stops) {
        const sm = createStopMarker(mapboxglLib, [stop.longitude, stop.latitude], {
          popup: stop.address ?? `Stop ${stop.sequence}`,
          label: String(stop.sequence),
        });
        sm.addTo(map);
        staticMarkersRef.current.push(sm);
        boundsCoords.push([stop.longitude, stop.latitude]);
      }
    }

    // Rider marker
    if (riderLat != null && riderLng != null) {
      const riderCoords: [number, number] = [riderLng, riderLat];
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLngLat(riderCoords);
      } else {
        const rm = createRiderMarker(mapboxglLib, riderCoords, { popup: 'You' });
        rm.addTo(map);
        riderMarkerRef.current = rm;
      }
      boundsCoords.push(riderCoords);
    }

    // Fit bounds on first render
    if (!hasInitialRouteRef.current && boundsCoords.length > 0) {
      fitBoundsToCoords(map, mapboxglLib, boundsCoords, MAP_PADDING.navigation);
    }

    // Route drawing
    const phase = getRoutePhase(status);
    const origin: [number, number] =
      riderLat != null && riderLng != null ? [riderLng, riderLat] : pickupCoords;
    const dest = phase === 'delivery' ? dropoffCoords : pickupCoords;

    if (origin[0] !== dest[0] || origin[1] !== dest[1]) {
      const lastPos = lastRouteRiderRef.current;
      const shouldRefresh =
        !hasInitialRouteRef.current ||
        !lastPos ||
        haversineDistance(origin[1], origin[0], lastPos[1], lastPos[0]) * 1000 > ROUTE_REFRESH_DISTANCE_M;

      if (shouldRefresh) {
        fetchRoute(origin, dest).then((route) => {
          if (!route) return;
          drawRoute(map, mapboxglLib, {
            geometry: route.geometry,
            duration: route.duration,
            distance: route.distance,
            legs: route.legs,
          }, {
            phase,
            showCongestion: true,
            fitBounds: !hasInitialRouteRef.current,
            padding: MAP_PADDING.navigation,
          });
          lastRouteRiderRef.current = origin;
          hasInitialRouteRef.current = true;
        });
      }
    }
  }, [mapReady, pickupLat, pickupLng, dropoffLat, dropoffLng, riderLat, riderLng, status, stops, fetchRoute]);

  // ── Traffic toggle ────────────────────────────────────
  useEffect(() => {
    const map = coreRef.current?.map;
    if (!map || !hasTrafficLayer(map)) return;
    toggleTraffic(map, trafficOn);
  }, [trafficOn]);

  return (
    <div className={`relative ${className ?? 'w-full h-full'}`}>
      <div ref={containerRef} className="w-full h-full rounded-2xl" />

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
