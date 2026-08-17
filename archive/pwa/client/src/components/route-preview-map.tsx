// ══════════════════════════════════════════════════════════
// RoutePreviewMap — Send-package route preview for client
//
// Compact map showing pickup → dropoff route preview before
// the user confirms the delivery order.
//
// Features:
// • Google Maps JS API via initMapCore (controls, 3D)
// • Pickup / dropoff markers with InfoWindow
// • Multi-layer route rendering with congestion
// • Alternative route (dashed gray)
// • Auto-fit to route bounds
// • Traffic overlay
// • Nearby rider markers (small dots showing availability)
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { GOOGLE_MAPS_API_KEY } from '@/lib/constants';
import { MAP_PADDING, formatPlusCode } from '@riderguy/utils';
import { initMapCore, fitBoundsToCoords, type MapCoreInstance } from '@/lib/map-core';
import { createPickupMarker, createDropoffMarker, createSmallRiderMarker, removeMarkers } from '@/lib/map-markers';
import {
  drawRoute,
  drawAlternativeRoute,
  addTrafficLayer,
  removeRoute,
  removeAlternativeRoute,
} from '@/lib/map-route';
import { useDirections } from '@/hooks/use-directions';
import type { NearbyRider } from '@/hooks/use-nearby-riders';

// ── Types ───────────────────────────────────────────────

interface RoutePreviewMapProps {
  pickupCoords: [number, number] | null;
  dropoffCoords: [number, number] | null;
  nearbyRiders?: NearbyRider[];
  className?: string;
}

// ── Component ───────────────────────────────────────────

export default function RoutePreviewMap({
  pickupCoords,
  dropoffCoords,
  nearbyRiders,
  className,
}: RoutePreviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MapCoreInstance | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const riderMarkersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const fetchSeqRef = useRef(0);

  const { fetchDirections } = useDirections();

  // ── Initialize map ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;

    (async () => {
      const core = await initMapCore({
        container: containerRef.current!,
        token: GOOGLE_MAPS_API_KEY,
        center: pickupCoords ?? undefined,
        navigationControl: false,
        geolocateControl: false,
        scaleControl: false,
        cooperativeGestures: true,
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
      removeMarkers(markersRef.current);
      markersRef.current = [];
      riderMarkersRef.current.forEach((m) => { m.map = null; });
      riderMarkersRef.current.clear();
      coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, []);

  // ── Draw route & markers when coords change ───────────
  useEffect(() => {
    if (!mapReady) return;
    const core = coreRef.current;
    if (!core) return;
    const { map } = core;

    // Clear previous
    removeMarkers(markersRef.current);
    markersRef.current = [];
    removeRoute(map);
    removeAlternativeRoute(map);

    if (!pickupCoords || !dropoffCoords) {
      // Center on whatever we have
      if (pickupCoords) {
        map.panTo({ lat: pickupCoords[1], lng: pickupCoords[0] });
        map.setZoom(15);
      }
      return;
    }

    // Markers (with Plus Code)
    const pickupPC = formatPlusCode(pickupCoords[1], pickupCoords[0]);
    const pickup = createPickupMarker(map, pickupCoords, {
      popup: `Pickup<br/><span style="font-size:11px;opacity:0.7">${pickupPC.display}</span>`,
    });
    markersRef.current.push(pickup);

    const dropoffPC = formatPlusCode(dropoffCoords[1], dropoffCoords[0]);
    const dropoff = createDropoffMarker(map, dropoffCoords, {
      popup: `Dropoff<br/><span style="font-size:11px;opacity:0.7">${dropoffPC.display}</span>`,
    });
    markersRef.current.push(dropoff);

    // Fit bounds
    fitBoundsToCoords(map, [pickupCoords, dropoffCoords], MAP_PADDING.compact);

    // Fetch and draw route (sequence number guards against stale responses)
    const seq = ++fetchSeqRef.current;
    setRouteError(false);
    (async () => {
      const routes = await fetchDirections([pickupCoords, dropoffCoords]);
      if (seq !== fetchSeqRef.current) return; // stale response

      if (!routes?.[0]) {
        setRouteError(true);
        return;
      }

      // Primary route
      drawRoute(map, {
        geometry: routes[0].geometry,
        duration: routes[0].duration,
        distance: routes[0].distance,
        legs: routes[0].legs,
      }, {
        showCongestion: true,
        fitBounds: true,
        padding: MAP_PADDING.compact,
      });

      // Alternative route (if available)
      if (routes[1]) {
        drawAlternativeRoute(map, routes[1].geometry);
      }
    })();

    return () => { fetchSeqRef.current++; };
  }, [mapReady, pickupCoords, dropoffCoords, fetchDirections]);

  // ── Render nearby rider markers ───────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const core = coreRef.current;
    if (!core) return;
    const { map } = core;

    const currentIds = new Set((nearbyRiders ?? []).map((r) => r.id));

    // Remove markers for riders no longer nearby
    riderMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.map = null;
        riderMarkersRef.current.delete(id);
      }
    });

    // Add or update markers
    for (const rider of nearbyRiders ?? []) {
      const existing = riderMarkersRef.current.get(rider.id);
      if (existing) {
        existing.position = { lat: rider.latitude, lng: rider.longitude };
      } else {
        const marker = createSmallRiderMarker(map, [rider.longitude, rider.latitude]);
        riderMarkersRef.current.set(rider.id, marker);
      }
    }
  }, [mapReady, nearbyRiders]);

  return (
    <div className={`relative w-full rounded-xl overflow-hidden ${className ?? 'h-[200px]'}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {routeError && (
        <div className="absolute inset-x-0 bottom-0 bg-amber-50/90 px-3 py-1.5 text-center">
          <p className="text-[11px] text-amber-700">Could not load route preview</p>
        </div>
      )}
    </div>
  );
}
