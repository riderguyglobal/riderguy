'use client';

// ══════════════════════════════════════════════════════════
// RiderMap — Dashboard map for the rider app
// Shows rider position dot (status-aware), traffic overlay,
// and theme-switching. Uses shared utilities.
// ══════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/lib/constants';
import { MAP_ZOOM } from '@riderguy/utils';
import { useTheme } from '@/lib/theme';
import {
  createRiderStatusDot,
  updateRiderStatusDot,
  type RiderMapStatus,
} from '@/lib/map-markers';
import {
  addTrafficLayer,
  toggleTraffic as toggleTrafficLayer,
  hasTrafficLayer as checkTraffic,
} from '@/lib/map-route';
import { Navigation, Layers } from 'lucide-react';

export type { RiderMapStatus };

interface RiderMapProps {
  className?: string;
  status?: RiderMapStatus;
}

export function RiderMap({ className = '', status = 'offline' }: RiderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showTraffic, setShowTraffic] = useState(true);
  const { resolvedTheme } = useTheme();
  const prevThemeRef = useRef(resolvedTheme);

  // ── Update marker colors when status changes ──────────
  useEffect(() => {
    if (!markerElRef.current) return;
    updateRiderStatusDot(markerElRef.current, status);
  }, [status]);

  // ── Theme switching ───────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !loaded) return;
    if (prevThemeRef.current === resolvedTheme) return;
    prevThemeRef.current = resolvedTheme;

    const map = mapRef.current;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();
    map.setStyle(resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT);

    map.once('style.load', () => {
      map.setCenter(center);
      map.setZoom(zoom);
      map.setBearing(bearing);
      map.setPitch(pitch);
      if (showTraffic) addTrafficLayer(map);
    });
  }, [resolvedTheme, loaded, showTraffic]);

  // ── Map initialization ────────────────────────────────
  const initMap = useCallback(async () => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      setMapError('Map token not configured');
      return;
    }

    try {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
        center: DEFAULT_CENTER,
        zoom: MAP_ZOOM.default,
        interactive: true,
        attributionControl: true,
        fadeDuration: 0,
        antialias: true,
      });

      mapRef.current = map;
      prevThemeRef.current = resolvedTheme;

      map.on('error', (e) => {
        console.error('[RiderMap] Mapbox error:', e.error?.message ?? e);
      });

      resizeObserverRef.current = new ResizeObserver(() => mapRef.current?.resize());
      if (containerRef.current) resizeObserverRef.current.observe(containerRef.current);

      map.on('load', () => {
        setLoaded(true);
        addTrafficLayer(map);

        // Create rider status dot marker
        const { marker, element } = createRiderStatusDot(
          mapboxgl, [DEFAULT_CENTER[0], DEFAULT_CENTER[1]], map, status,
        );
        markerRef.current = marker;
        markerElRef.current = element;

        // Fly to rider's actual position
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            const { longitude: lng, latitude: lat } = pos.coords;
            map.flyTo({ center: [lng, lat], zoom: MAP_ZOOM.neighborhood, duration: 1800, essential: true });
            markerRef.current?.setLngLat([lng, lat]);
          },
          (err) => console.warn('[RiderMap] Geolocation denied:', err.message),
          { enableHighAccuracy: true, timeout: 8000 },
        );
      });
    } catch (err) {
      console.error('[RiderMap] Init failed:', err);
      setMapError('Failed to load map');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Traffic toggle ────────────────────────────────────
  const handleToggleTraffic = useCallback(() => {
    if (!mapRef.current) return;
    const next = !showTraffic;
    setShowTraffic(next);
    if (!checkTraffic(mapRef.current)) {
      addTrafficLayer(mapRef.current);
    } else {
      toggleTrafficLayer(mapRef.current, next);
    }
  }, [showTraffic]);

  // ── Recenter on GPS position ──────────────────────────
  const recenter = () => {
    if (!mapRef.current) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords;
        mapRef.current?.flyTo({ center: [lng, lat], zoom: MAP_ZOOM.close, duration: 800 });
        markerRef.current?.setLngLat([lng, lat]);
      },
      () => mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: MAP_ZOOM.default, duration: 800 }),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  };

  useEffect(() => {
    initMap();
    return () => {
      resizeObserverRef.current?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      {!loaded && !mapError && (
        <div className="absolute inset-0 bg-page animate-shimmer bg-gradient-to-r from-page via-shimmer to-page" />
      )}
      {mapError && (
        <div className="absolute inset-0 bg-page flex items-center justify-center">
          <p className="text-sm text-subtle">{mapError}</p>
        </div>
      )}

      {/* Controls — right side */}
      {loaded && (
        <div className="absolute top-[calc(env(safe-area-inset-top)+4.5rem)] right-3 flex flex-col gap-2 z-10">
          <button
            onClick={handleToggleTraffic}
            className={`map-control-btn ${showTraffic ? 'map-control-active' : ''}`}
            aria-label="Toggle traffic"
          >
            <Layers className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* GPS recenter */}
      {loaded && (
        <div className="absolute bottom-32 right-3 z-10">
          <button onClick={recenter} className="map-control-btn map-control-gps" aria-label="Recenter map">
            <Navigation className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-page to-transparent pointer-events-none" />
    </div>
  );
}
