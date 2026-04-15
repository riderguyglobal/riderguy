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
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { GOOGLE_MAPS_API_KEY } from '@/lib/constants';
import { MAP_PADDING, formatPlusCode } from '@riderguy/utils';
import { initMapCore, fitBoundsToCoords, type MapCoreInstance } from '@/lib/map-core';
import { createPickupMarker, createDropoffMarker, removeMarkers } from '@/lib/map-markers';
import {
  drawRoute,
  drawAlternativeRoute,
  addTrafficLayer,
  removeRoute,
  removeAlternativeRoute,
} from '@/lib/map-route';
import { useDirections } from '@/hooks/use-directions';

// ── Types ───────────────────────────────────────────────

interface RoutePreviewMapProps {
  pickupCoords: [number, number] | null;
  dropoffCoords: [number, number] | null;
  className?: string;
}

// ── Component ───────────────────────────────────────────

export default function RoutePreviewMap({
  pickupCoords,
  dropoffCoords,
  className,
}: RoutePreviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MapCoreInstance | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [mapReady, setMapReady] = useState(false);

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

    // Fetch and draw route
    let stale = false;
    (async () => {
      const routes = await fetchDirections([pickupCoords, dropoffCoords]);
      if (stale || !routes?.[0]) return;

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

    return () => { stale = true; };
  }, [mapReady, pickupCoords, dropoffCoords, fetchDirections]);

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-xl overflow-hidden ${className ?? 'h-[200px]'}`}
    />
  );
}
