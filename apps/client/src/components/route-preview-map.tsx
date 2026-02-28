// ══════════════════════════════════════════════════════════
// RoutePreviewMap — Send-package route preview for client
//
// Compact map showing pickup → dropoff route preview before
// the user confirms the delivery order.
//
// Features:
// • Mapbox GL JS v3.19 via initMapCore (controls, 3D, fog)
// • Pickup / dropoff markers with Popup
// • Multi-layer route rendering with congestion
// • Alternative route (dashed gray)
// • Auto-fit to route bounds
// • Traffic overlay
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import { MAPBOX_TOKEN } from '@/lib/constants';
import { MAP_PADDING } from '@riderguy/utils';
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
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const { fetchDirections } = useDirections();

  // ── Initialize map ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;
    let cancelled = false;

    (async () => {
      const core = await initMapCore({
        container: containerRef.current!,
        token: MAPBOX_TOKEN,
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
    const { map, mapboxgl: mapboxglLib } = core;

    // Clear previous
    removeMarkers(markersRef.current);
    markersRef.current = [];
    removeRoute(map);
    removeAlternativeRoute(map);

    if (!pickupCoords || !dropoffCoords) {
      // Center on whatever we have
      if (pickupCoords) {
        map.flyTo({ center: pickupCoords, zoom: 15, duration: 800 });
      }
      return;
    }

    // Markers
    const pickup = createPickupMarker(mapboxglLib, pickupCoords, { popup: 'Pickup' });
    pickup.addTo(map);
    markersRef.current.push(pickup);

    const dropoff = createDropoffMarker(mapboxglLib, dropoffCoords, { popup: 'Dropoff' });
    dropoff.addTo(map);
    markersRef.current.push(dropoff);

    // Fit bounds
    fitBoundsToCoords(map, mapboxglLib, [pickupCoords, dropoffCoords], MAP_PADDING.compact);

    // Fetch and draw route
    (async () => {
      const routes = await fetchDirections([pickupCoords, dropoffCoords]);
      if (!routes?.[0]) return;

      // Primary route
      drawRoute(map, mapboxglLib, {
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
  }, [mapReady, pickupCoords, dropoffCoords, fetchDirections]);

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-xl overflow-hidden ${className ?? 'h-[200px]'}`}
    />
  );
}
