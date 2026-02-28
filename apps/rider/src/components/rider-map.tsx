// ══════════════════════════════════════════════════════════
// RiderMap — Dashboard map for the rider app
//
// Features:
// • Mapbox GL JS v3.19 via initMapCore (all controls, 3D, fog)
// • Theme-aware style switching (light ↔ dark)
// • Rider status dot (offline → online → on-route)
// • User geolocation tracking
// • Traffic overlay (toggle)
// • Branded map controls
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/lib/constants';
import { MAP_ZOOM } from '@riderguy/utils';
import { useTheme } from '@/lib/theme';
import { initMapCore, switchMapStyle, type MapCoreInstance } from '@/lib/map-core';
import {
  createRiderStatusDot,
  updateRiderStatusDot,
  type RiderMapStatus,
} from '@/lib/map-markers';
import { addTrafficLayer, toggleTraffic, hasTrafficLayer } from '@/lib/map-route';

// Re-export type for page-level usage
export type { RiderMapStatus };

// ── Types ───────────────────────────────────────────────

interface RiderMapProps {
  className?: string;
  status?: RiderMapStatus;
}

// ── Component ───────────────────────────────────────────

export function RiderMap({ className, status = 'offline' }: RiderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MapCoreInstance | null>(null);
  const statusDotRef = useRef<{ marker: import('mapbox-gl').Marker; element: HTMLDivElement } | null>(null);
  const [trafficOn, setTrafficOn] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const { resolvedTheme } = useTheme();

  // ── Get user position ─────────────────────────────────
  const getUserPosition = (): Promise<[number, number] | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    });
  };

  // ── Initialize map ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;
    let cancelled = false;

    (async () => {
      const userPos = await getUserPosition();
      if (cancelled) return;

      const style = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

      const core = await initMapCore({
        container: containerRef.current!,
        token: MAPBOX_TOKEN,
        style,
        center: userPos ?? DEFAULT_CENTER,
        zoom: userPos ? MAP_ZOOM.close : MAP_ZOOM.default,
        onLoad: (map, mapboxglLib) => {
          addTrafficLayer(map);

          // Rider status dot at user position
          if (userPos) {
            const dot = createRiderStatusDot(mapboxglLib, userPos, status);
            dot.marker.addTo(map);
            statusDotRef.current = dot;
          }

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
      statusDotRef.current?.marker.remove();
      statusDotRef.current = null;
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

  // ── Update status dot when status prop changes ────────
  useEffect(() => {
    if (!statusDotRef.current) return;
    updateRiderStatusDot(statusDotRef.current.element, status);
  }, [status]);

  // ── Update dot position from GeolocateControl ────────
  useEffect(() => {
    if (!mapReady) return;
    const geolocate = coreRef.current?.geolocate;
    if (!geolocate) return;

    const handleGeolocate = (e: { coords: { longitude: number; latitude: number } }) => {
      statusDotRef.current?.marker.setLngLat([e.coords.longitude, e.coords.latitude]);
    };

    geolocate.on('geolocate', handleGeolocate as any);
    return () => {
      geolocate.off('geolocate', handleGeolocate as any);
    };
  }, [mapReady]);

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
