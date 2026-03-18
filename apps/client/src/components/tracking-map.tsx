// ══════════════════════════════════════════════════════════
// TrackingMap — Live order tracking map for the client app
//
// Features:
// • Mapbox GL JS v3.19 via initMapCore (all controls, 3D, fog)
// • Pickup / dropoff / rider markers with Popup
// • Multi-layer route rendering with congestion coloring
// • Auto route refresh when rider moves > 100 m
// • Traffic overlay
// • Phase-aware route coloring (blue→green)
// • Fit bounds to all points
// • Full cleanup on unmount
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import { MAPBOX_TOKEN } from '@/lib/constants';
import { ROUTE_COLORS, MAP_PADDING, ROUTE_REFRESH_DISTANCE_M, haversineDistance, formatPlusCode } from '@riderguy/utils';
import { initMapCore, fitBoundsToCoords, type MapCoreInstance } from '@/lib/map-core';
import { createPickupMarker, createDropoffMarker, createRiderMarker, removeMarkers } from '@/lib/map-markers';
import { drawRoute, addTrafficLayer, toggleTraffic, hasTrafficLayer, removeRoute } from '@/lib/map-route';
import { useDirections, type DirectionsRoute } from '@/hooks/use-directions';

// ── Types ───────────────────────────────────────────────

interface TrackingMapProps {
  pickupCoords: [number, number] | null;   // [lng, lat]
  dropoffCoords: [number, number] | null;  // [lng, lat]
  riderCoords: [number, number] | null;    // [lng, lat]
  status: string;
}

// ── Phase logic ─────────────────────────────────────────

const DELIVERY_STATUSES = new Set([
  'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF', 'DELIVERED',
]);

function getRouteColor(status: string): string {
  return DELIVERY_STATUSES.has(status) ? ROUTE_COLORS.delivery : ROUTE_COLORS.primary;
}

// ── Component ───────────────────────────────────────────

export default function TrackingMap({ pickupCoords, dropoffCoords, riderCoords, status }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MapCoreInstance | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastRouteRiderRef = useRef<[number, number] | null>(null);
  const [trafficOn, setTrafficOn] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const { fetchDirections } = useDirections();

  // ── Draw route helper ─────────────────────────────────
  const drawRouteFromDirections = useCallback(
    async (
      map: mapboxgl.Map,
      mapboxglLib: typeof import('mapbox-gl').default,
      from: [number, number],
      to: [number, number],
    ) => {
      const routes = await fetchDirections([from, to]);
      if (!routes?.[0]) return;

      const route = routes[0];
      drawRoute(map, mapboxglLib, {
        geometry: route.geometry,
        duration: route.duration,
        distance: route.distance,
        legs: route.legs,
      }, {
        color: getRouteColor(status),
        showCongestion: true,
        fitBounds: false,
      });

      lastRouteRiderRef.current = from;
    },
    [fetchDirections, status],
  );

  // ── Initialize map ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;
    let cancelled = false;

    (async () => {
      const core = await initMapCore({
        container: containerRef.current!,
        token: MAPBOX_TOKEN,
        center: pickupCoords ?? undefined,
        onLoad: (map, mapboxglLib) => {
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
      removeMarkers(markersRef.current);
      markersRef.current = [];
      riderMarkerRef.current?.remove();
      riderMarkerRef.current = null;
      coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, []);

  // ── Update markers & route when props change ──────────
  useEffect(() => {
    if (!mapReady) return;
    const core = coreRef.current;
    if (!core) return;
    const { map, mapboxgl: mapboxglLib } = core;

    // Helper — guard against NaN coords that crash Mapbox
    const isValid = (c: [number, number] | null): c is [number, number] =>
      c !== null && Number.isFinite(c[0]) && Number.isFinite(c[1]);

    // Clear old markers
    removeMarkers(markersRef.current);
    markersRef.current = [];

    const boundsCoords: [number, number][] = [];

    // Pickup marker (with Plus Code)
    if (isValid(pickupCoords)) {
      const pc = formatPlusCode(pickupCoords[1], pickupCoords[0]);
      const m = createPickupMarker(mapboxglLib, pickupCoords, {
        popup: `Pickup<br/><span style="font-size:11px;opacity:0.7">${pc.display}</span>`,
      });
      m.addTo(map);
      markersRef.current.push(m);
      boundsCoords.push(pickupCoords);
    }

    // Dropoff marker (with Plus Code)
    if (isValid(dropoffCoords)) {
      const pc = formatPlusCode(dropoffCoords[1], dropoffCoords[0]);
      const m = createDropoffMarker(mapboxglLib, dropoffCoords, {
        popup: `Dropoff<br/><span style="font-size:11px;opacity:0.7">${pc.display}</span>`,
      });
      m.addTo(map);
      markersRef.current.push(m);
      boundsCoords.push(dropoffCoords);
    }

    // Rider marker
    if (isValid(riderCoords)) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLngLat(riderCoords);
      } else {
        const m = createRiderMarker(mapboxglLib, riderCoords, { popup: 'Your rider' });
        m.addTo(map);
        riderMarkerRef.current = m;
      }
      boundsCoords.push(riderCoords);
    }

    // Fit bounds to all visible points
    if (boundsCoords.length > 0) {
      fitBoundsToCoords(map, mapboxglLib, boundsCoords, MAP_PADDING.route);
    }

    // Draw/refresh route
    const origin = isValid(riderCoords) ? riderCoords : isValid(pickupCoords) ? pickupCoords : null;
    const dest = DELIVERY_STATUSES.has(status) ? (isValid(dropoffCoords) ? dropoffCoords : null) : (isValid(pickupCoords) ? pickupCoords : null);

    if (origin && dest && origin !== dest) {
      // Only refresh if rider has moved > threshold
      const lastPos = lastRouteRiderRef.current;
      const shouldRefresh = !lastPos || haversineDistance(
        origin[1], origin[0], lastPos[1], lastPos[0],
      ) * 1000 > ROUTE_REFRESH_DISTANCE_M;

      if (shouldRefresh) {
        drawRouteFromDirections(map, mapboxglLib, origin, dest);
      }
    }
  }, [
    mapReady, pickupCoords, dropoffCoords, riderCoords, status, drawRouteFromDirections,
  ]);

  // ── Traffic toggle ────────────────────────────────────
  useEffect(() => {
    const map = coreRef.current?.map;
    if (!map || !hasTrafficLayer(map)) return;
    toggleTraffic(map, trafficOn);
  }, [trafficOn]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-2xl" />

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
