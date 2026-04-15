// ══════════════════════════════════════════════════════════
// RiderMap — Dashboard map for the rider app
//
// Features:
// • Google Maps JS API via initMapCore (all controls, 3D)
// • Theme-aware style switching (light / dark)
// • Rider status dot (offline, online, on-route)
// • User geolocation tracking
// • Traffic overlay (toggle)
// • Branded map controls
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { GOOGLE_MAPS_API_KEY, DEFAULT_CENTER, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/lib/constants';
import { MAP_ZOOM } from '@riderguy/utils';
import { useTheme } from '@/lib/theme';
import { initMapCore, switchMapStyle, flyToPoint, type MapCoreInstance } from '@/lib/map-core';
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
  const statusDotRef = useRef<{ marker: google.maps.marker.AdvancedMarkerElement; element: HTMLDivElement } | null>(null);
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
    if (!containerRef.current || !GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;

    const style = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

    // Initialize map immediately with default center
    (async () => {
      const core = await initMapCore({
        container: containerRef.current!,
        token: GOOGLE_MAPS_API_KEY,
        style,
        center: DEFAULT_CENTER,
        zoom: MAP_ZOOM.default,
        onLoad: (map) => {
          addTrafficLayer(map);
          setMapReady(true);

          // Resolve geolocation in the background and update map + dot
          getUserPosition().then((userPos) => {
            if (cancelled || !userPos) return;

            flyToPoint(map, userPos, { zoom: MAP_ZOOM.close });

            const dot = createRiderStatusDot(map, userPos, status);
            statusDotRef.current = dot;
          });
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
      if (statusDotRef.current) statusDotRef.current.marker.map = null;
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
        if (trafficOn && !hasTrafficLayer(core.map)) addTrafficLayer(core.map);
      },
    });
  }, [resolvedTheme, mapReady]);

  // ── Update status dot when status prop changes ────────
  useEffect(() => {
    if (!statusDotRef.current) return;
    updateRiderStatusDot(statusDotRef.current.element, status);
  }, [status]);

  // ── Update dot position via browser geolocation ────────
  useEffect(() => {
    if (!mapReady || !statusDotRef.current) return;
    const watchId = navigator.geolocation?.watchPosition(
      (pos) => {
        if (statusDotRef.current) {
          statusDotRef.current.marker.position = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => {
      if (watchId != null) navigator.geolocation?.clearWatch(watchId);
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
