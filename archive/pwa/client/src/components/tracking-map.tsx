// ══════════════════════════════════════════════════════════
// TrackingMap — Live order tracking map for the client app
//
// Features:
// • Google Maps JS API via initMapCore (controls, 3D)
// • Pickup / dropoff / rider markers with InfoWindow
// • Multi-layer route rendering with congestion coloring
// • Auto route refresh when rider moves > 100 m
// • Traffic overlay
// • Phase-aware route coloring (blue→green)
// • Fit bounds to all points
// • Full cleanup on unmount
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Navigation } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '@/lib/constants';
import { ROUTE_COLORS, MAP_PADDING, ROUTE_REFRESH_DISTANCE_M, haversineDistance, formatPlusCode, calculateBearing } from '@riderguy/utils';
import { initMapCore, fitBoundsToCoords, type MapCoreInstance } from '@/lib/map-core';
import { createPickupMarker, createDropoffMarker, createRiderMarker, removeMarkers, updateRiderMarkerBearing } from '@/lib/map-markers';
import { drawRoute, addTrafficLayer, toggleTraffic, hasTrafficLayer } from '@/lib/map-route';
import { useDirections } from '@/hooks/use-directions';

// ── Types ───────────────────────────────────────────────

interface TrackingMapProps {
  pickupCoords: [number, number] | null;   // [lng, lat]
  dropoffCoords: [number, number] | null;  // [lng, lat]
  riderCoords: [number, number] | null;    // [lng, lat]
  status: string;
  onRouteError?: (err: Error | null) => void;
  onEtaUpdate?: (durationSec: number, distanceM: number) => void;
}

// ── Phase logic ─────────────────────────────────────────

const DELIVERY_STATUSES = new Set([
  'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF', 'DELIVERED',
]);

function getRouteColor(status: string): string {
  return DELIVERY_STATUSES.has(status) ? ROUTE_COLORS.delivery : ROUTE_COLORS.primary;
}

// ── Component ───────────────────────────────────────────

export default function TrackingMap({ pickupCoords, dropoffCoords, riderCoords, status, onRouteError, onEtaUpdate }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MapCoreInstance | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const riderMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const lastRouteRiderRef = useRef<[number, number] | null>(null);
  const boundsInitializedRef = useRef(false);
  const prevRiderCoordsRef = useRef<[number, number] | null>(null);
  const [trafficOn, setTrafficOn] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const { fetchDirections } = useDirections();

  // ── Draw route helper ─────────────────────────────────
  const drawRouteFromDirections = useCallback(
    async (
      map: google.maps.Map,
      from: [number, number],
      to: [number, number],
    ) => {
      try {
        const routes = await fetchDirections([from, to]);
        if (!routes?.[0]) {
          // CLI-06: empty result is itself a failure mode.
          onRouteError?.(new Error('Routing service returned no route'));
          return;
        }

        const route = routes[0];
        drawRoute(map, {
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
        onEtaUpdate?.(route.duration, route.distance);
        onRouteError?.(null);
      } catch (err) {
        onRouteError?.(err instanceof Error ? err : new Error('Failed to fetch route'));
      }
    },
    [fetchDirections, status, onRouteError, onEtaUpdate],
  );

  // ── Initialize map ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;

    (async () => {
      const core = await initMapCore({
        container: containerRef.current!,
        token: GOOGLE_MAPS_API_KEY,
        center: pickupCoords ?? undefined,
        onLoad: (map) => {
          addTrafficLayer(map);
          toggleTraffic(map, false);
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
      if (riderMarkerRef.current) riderMarkerRef.current.map = null;
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
    const { map } = core;

    // Helper — guard against NaN coords
    const isValid = (c: [number, number] | null): c is [number, number] =>
      c !== null && Number.isFinite(c[0]) && Number.isFinite(c[1]);

    // Clear old markers
    removeMarkers(markersRef.current);
    markersRef.current = [];

    const boundsCoords: [number, number][] = [];

    // Pickup marker (with Plus Code)
    if (isValid(pickupCoords)) {
      const pc = formatPlusCode(pickupCoords[1], pickupCoords[0]);
      const m = createPickupMarker(map, pickupCoords, {
        popup: `Pickup<br/><span style="font-size:11px;opacity:0.7">${pc.display}</span>`,
      });
      markersRef.current.push(m);
      boundsCoords.push(pickupCoords);
    }

    // Dropoff marker (with Plus Code)
    if (isValid(dropoffCoords)) {
      const pc = formatPlusCode(dropoffCoords[1], dropoffCoords[0]);
      const m = createDropoffMarker(map, dropoffCoords, {
        popup: `Dropoff<br/><span style="font-size:11px;opacity:0.7">${pc.display}</span>`,
      });
      markersRef.current.push(m);
      boundsCoords.push(dropoffCoords);
    }

    // Rider marker
    if (isValid(riderCoords)) {
      if (riderMarkerRef.current) {
        const prev = prevRiderCoordsRef.current;
        if (prev && (prev[0] !== riderCoords[0] || prev[1] !== riderCoords[1])) {
          const bearing = calculateBearing(prev[1], prev[0], riderCoords[1], riderCoords[0]);
          updateRiderMarkerBearing(riderMarkerRef.current, bearing);
        }
        riderMarkerRef.current.position = { lat: riderCoords[1], lng: riderCoords[0] };
      } else {
        const m = createRiderMarker(map, riderCoords, { popup: 'Your rider' });
        riderMarkerRef.current = m;
      }
      prevRiderCoordsRef.current = riderCoords;
      boundsCoords.push(riderCoords);
    }

    // Fit bounds only on first render; subsequent rider updates just move the marker
    if (boundsCoords.length > 0 && !boundsInitializedRef.current) {
      fitBoundsToCoords(map, boundsCoords, MAP_PADDING.route);
      boundsInitializedRef.current = true;
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
        drawRouteFromDirections(map, origin, dest);
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

      <button
        onClick={() => {
          const map = coreRef.current?.map;
          if (!map) return;
          const coords: [number, number][] = [];
          if (pickupCoords) coords.push(pickupCoords);
          if (dropoffCoords) coords.push(dropoffCoords);
          if (riderCoords) coords.push(riderCoords);
          if (coords.length > 0) fitBoundsToCoords(map, coords, MAP_PADDING.route);
        }}
        className="map-control-btn absolute bottom-3 right-3 z-10 flex items-center justify-center w-9 h-9 rounded-xl bg-white/90 shadow-md backdrop-blur transition hover:bg-white"
        aria-label="Re-center map"
        title="Re-center map"
      >
        <Navigation className="h-4 w-4 text-surface-700" />
      </button>
    </div>
  );
}
