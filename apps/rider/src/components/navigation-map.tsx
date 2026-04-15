// ══════════════════════════════════════════════════════════
// NavigationMap — Active delivery navigation for rider app
//
// Features:
// • Google Maps JS API via initMapCore (all controls, 3D)
// • Theme-aware style switching (light / dark)
// • Pickup / dropoff / stop markers with InfoWindow
// • Rider position marker (live updates)
// • Multi-polyline route with wider nav-mode widths
// • Phase-aware coloring (blue pickup, green delivery)
// • Congestion overlay from driving-traffic data
// • Auto route refresh when rider drifts > 100 m
// • Traffic overlay (toggle)
// • Fit bounds to all points
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { GOOGLE_MAPS_API_KEY, DEFAULT_CENTER, API_BASE_URL, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/lib/constants';
import {
  ROUTE_COLORS,
  MAP_PADDING,
  MAP_ZOOM,
  ROUTE_REFRESH_DISTANCE_M,
  haversineDistance,
  formatPlusCode,
} from '@riderguy/utils';
import { tokenStorage } from '@riderguy/auth';
import { useTheme } from '@/lib/theme';
import { initMapCore, switchMapStyle, fitBoundsToCoords, type MapCoreInstance } from '@/lib/map-core';
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
  const staticMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const riderMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const lastRouteRiderRef = useRef<[number, number] | null>(null);
  const hasInitialRouteRef = useRef(false);
  const lastRouteDataRef = useRef<{ route: Parameters<typeof drawRoute>[1]; options: Parameters<typeof drawRoute>[2] } | null>(null);
  const [trafficOn, setTrafficOn] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // D-10: AbortController ref — abort stale fetch when new one starts
  const abortRef = useRef<AbortController | null>(null);
  // D-09: Minimum interval between route refreshes (30s)
  const lastRouteRefreshRef = useRef(0);
  const MIN_ROUTE_REFRESH_MS = 30_000;

  const { resolvedTheme } = useTheme();

  const pickupCoords: [number, number] = [pickupLng, pickupLat];
  const dropoffCoords: [number, number] = [dropoffLng, dropoffLat];

  // ── Fetch directions from API proxy ───────────────────
  const fetchRoute = useCallback(
    async (from: [number, number], to: [number, number]) => {
      try {
        // D-10: Abort any in-flight request before starting a new one
        if (abortRef.current) {
          abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        const token = tokenStorage.getAccessToken();
        if (!token) return null;

        const coordStr = `${from[0]},${from[1]};${to[0]},${to[1]}`;
        const url = `${API_BASE_URL}/orders/directions?coordinates=${encodeURIComponent(coordStr)}&profile=driving-traffic`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) return null;

        const json = await res.json();
        if (!json.success || !json.data?.routes?.length) return null;

        return json.data.routes[0] as {
          geometry: { type: string; coordinates: number[][] };
          duration: number;
          distance: number;
          legs: Array<{ annotation?: { congestion?: string[]; duration?: number[]; distance?: number[] } }>;
        };
      } catch (err) {
        // D-10: Silently ignore aborted requests
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        return null;
      }
    },
    [],
  );

  // ── Initialize map ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;

    (async () => {
      const style = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

      const core = await initMapCore({
        container: containerRef.current!,
        token: GOOGLE_MAPS_API_KEY,
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
      // D-10: Abort any in-flight route request on unmount
      abortRef.current?.abort();
      removeMarkers(staticMarkersRef.current);
      staticMarkersRef.current = [];
      if (riderMarkerRef.current) riderMarkerRef.current.map = null;
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
        // Traffic layer persists across Google style changes but ensure it's active
        if (trafficOn && !hasTrafficLayer(core.map)) addTrafficLayer(core.map);
      },
    });
  }, [resolvedTheme, mapReady]);

  // ── Static markers (pickup, dropoff, stops) — only recreated when locations change ──
  useEffect(() => {
    if (!mapReady) return;
    const core = coreRef.current;
    if (!core) return;
    const { map } = core;

    // Clear old static markers
    removeMarkers(staticMarkersRef.current);
    staticMarkersRef.current = [];

    // Pickup (with Plus Code)
    const pickupPC = formatPlusCode(pickupCoords[1], pickupCoords[0]);
    const pm = createPickupMarker(map, pickupCoords, {
      popup: `Pickup<br/><span style="font-size:11px;opacity:0.7">${pickupPC.display}</span>`,
    });
    staticMarkersRef.current.push(pm);

    // Dropoff (with Plus Code)
    const dropoffPC = formatPlusCode(dropoffCoords[1], dropoffCoords[0]);
    const dm = createDropoffMarker(map, dropoffCoords, {
      popup: `Dropoff<br/><span style="font-size:11px;opacity:0.7">${dropoffPC.display}</span>`,
    });
    staticMarkersRef.current.push(dm);

    // Multi-stop markers (with Plus Code)
    if (stops?.length) {
      for (const stop of stops) {
        const stopPC = formatPlusCode(stop.latitude, stop.longitude);
        const stopLabel = stop.address ?? `Stop ${stop.sequence}`;
        const sm = createStopMarker(map, [stop.longitude, stop.latitude], {
          popup: `${stopLabel}<br/><span style="font-size:11px;opacity:0.7">${stopPC.display}</span>`,
          label: String(stop.sequence),
        });
        staticMarkersRef.current.push(sm);
      }
    }

    // Fit bounds on first render (includes all points)
    if (!hasInitialRouteRef.current) {
      const boundsCoords: [number, number][] = [pickupCoords, dropoffCoords];
      if (stops?.length) {
        for (const s of stops) boundsCoords.push([s.longitude, s.latitude]);
      }
      if (riderLat != null && riderLng != null) boundsCoords.push([riderLng, riderLat]);
      fitBoundsToCoords(map, boundsCoords, MAP_PADDING.navigation);
    }
  }, [mapReady, pickupLat, pickupLng, dropoffLat, dropoffLng, stops]);

  // ── Rider marker + route — updates on every GPS change ──
  useEffect(() => {
    if (!mapReady) return;
    const core = coreRef.current;
    if (!core) return;
    const { map } = core;

    // Rider marker — update position or create on first appearance
    if (riderLat != null && riderLng != null) {
      const riderCoords: [number, number] = [riderLng, riderLat];
      if (riderMarkerRef.current) {
        riderMarkerRef.current.position = { lat: riderLat, lng: riderLng };
      } else {
        const rm = createRiderMarker(map, riderCoords, { popup: 'You' });
        riderMarkerRef.current = rm;
      }
    }

    // Route drawing
    const phase = getRoutePhase(status);
    const origin: [number, number] =
      riderLat != null && riderLng != null ? [riderLng, riderLat] : pickupCoords;
    const dest = phase === 'delivery' ? dropoffCoords : pickupCoords;

    if (origin[0] !== dest[0] || origin[1] !== dest[1]) {
      const lastPos = lastRouteRiderRef.current;
      const driftedEnough =
        !lastPos ||
        haversineDistance(origin[1], origin[0], lastPos[1], lastPos[0]) * 1000 > ROUTE_REFRESH_DISTANCE_M;

      // D-09: Enforce minimum 30s interval between route refreshes
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRouteRefreshRef.current;
      const cooldownOk = !hasInitialRouteRef.current || timeSinceLastRefresh >= MIN_ROUTE_REFRESH_MS;

      const shouldRefresh = (!hasInitialRouteRef.current || driftedEnough) && cooldownOk;

      if (shouldRefresh) {
        lastRouteRefreshRef.current = now;
        fetchRoute(origin, dest).then((route) => {
          if (!route) return;
          drawRoute(map, {
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
          lastRouteDataRef.current = {
            route: { geometry: route.geometry, duration: route.duration, distance: route.distance, legs: route.legs },
            options: { phase, showCongestion: true, fitBounds: false, padding: MAP_PADDING.navigation },
          };
          lastRouteRiderRef.current = origin;
          hasInitialRouteRef.current = true;
        });
      }
    }
  }, [mapReady, riderLat, riderLng, status, pickupLat, pickupLng, dropoffLat, dropoffLng, fetchRoute]);

  // ── Traffic toggle ────────────────────────────────────
  useEffect(() => {
    const map = coreRef.current?.map;
    if (!map || !hasTrafficLayer(map)) return;
    toggleTraffic(map, trafficOn);
  }, [trafficOn]);

  return (
    <div className={`relative ${className ?? 'w-full h-full'}`}>
      <div ref={containerRef} className="w-full h-full min-h-[200px] rounded-2xl" />

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
