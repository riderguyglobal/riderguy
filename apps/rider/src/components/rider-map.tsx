'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/lib/constants';
import { useTheme } from '@/lib/theme';
import { Navigation, Layers } from 'lucide-react';

export type RiderMapStatus = 'offline' | 'online' | 'on-route';

interface RiderMapProps {
  className?: string;
  status?: RiderMapStatus;
}

/** Color palette for each rider status */
const STATUS_COLORS: Record<RiderMapStatus, { main: string; glow: string; ring: string }> = {
  offline:    { main: '#9ca3af', glow: 'rgba(156,163,175,.25)', ring: 'rgba(156,163,175,.12)' },
  online:     { main: '#22c55e', glow: 'rgba(34,197,94,.40)',   ring: 'rgba(34,197,94,.15)'  },
  'on-route': { main: '#4285F4', glow: 'rgba(66,133,244,.40)',  ring: 'rgba(66,133,244,.15)' },
};

/** Google Maps-style rider dot SVG */
function riderSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="${color}" stroke="white" stroke-width="3"/>
    <circle cx="12" cy="12" r="3.5" fill="white"/>
  </svg>`;
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

  // Update marker colors when status changes
  useEffect(() => {
    if (!markerElRef.current) return;
    const c = STATUS_COLORS[status];
    const ringEl = markerElRef.current.querySelector<HTMLDivElement>('[data-ring]');
    const glowEl = markerElRef.current.querySelector<HTMLDivElement>('[data-glow]');
    const dotEl = markerElRef.current.querySelector<HTMLDivElement>('[data-dot]');

    if (ringEl) {
      ringEl.style.background = c.ring;
      ringEl.style.animationPlayState = status === 'offline' ? 'paused' : 'running';
    }
    if (glowEl) glowEl.style.boxShadow = `0 0 20px 6px ${c.glow}`;
    if (dotEl) dotEl.innerHTML = riderSvg(c.main);
  }, [status]);

  /** Create Google Maps-style rider marker */
  const createMarker = useCallback((mapboxgl: typeof import('mapbox-gl').default, map: mapboxgl.Map, lng: number, lat: number) => {
    const c = STATUS_COLORS[status];
    const el = document.createElement('div');
    el.className = 'rider-marker';
    el.innerHTML = `
      <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
        <div data-ring style="position:absolute;inset:0;border-radius:50%;background:${c.ring};animation:pulse-ring 2.5s ease-out infinite;${status === 'offline' ? 'animation-play-state:paused;' : ''}"></div>
        <div data-glow style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;box-shadow:0 0 20px 6px ${c.glow};"></div>
        <div data-dot style="position:relative;z-index:1;width:24px;height:24px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.3));">
          ${riderSvg(c.main)}
        </div>
      </div>
    `;
    markerElRef.current = el;
    markerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);
  }, [status]);

  /** Add traffic layer — Google Maps colored road overlays */
  const addTrafficLayer = useCallback((map: mapboxgl.Map) => {
    if (map.getSource('mapbox-traffic')) return;

    map.addSource('mapbox-traffic', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-traffic-v1',
    });

    // Find a suitable layer to insert traffic below
    const layers = map.getStyle().layers ?? [];
    let beforeId: string | undefined;
    for (const layer of layers) {
      if (layer.id.includes('label') || layer.id.includes('symbol')) {
        beforeId = layer.id;
        break;
      }
    }

    map.addLayer({
      id: 'traffic-flow',
      type: 'line',
      source: 'mapbox-traffic',
      'source-layer': 'traffic',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': [
          'match', ['get', 'congestion'],
          'low', '#4caf50',
          'moderate', '#ffb300',
          'heavy', '#ff6f00',
          'severe', '#d50000',
          'rgba(0,0,0,0)',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 3, 16, 6, 20, 12],
        'line-opacity': 0.65,
        'line-offset': ['interpolate', ['linear'], ['zoom'], 7, 0, 12, 1, 16, 2],
      },
      minzoom: 7,
    }, beforeId);
  }, []);

  /** Toggle traffic layer visibility */
  const toggleTraffic = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const next = !showTraffic;
    setShowTraffic(next);
    if (map.getLayer('traffic-flow')) {
      map.setLayoutProperty('traffic-flow', 'visibility', next ? 'visible' : 'none');
    }
  }, [showTraffic]);

  /** Switch map style when theme changes */
  useEffect(() => {
    if (!mapRef.current || !loaded) return;
    if (prevThemeRef.current === resolvedTheme) return;
    prevThemeRef.current = resolvedTheme;

    const map = mapRef.current;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();
    const newStyle = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
    map.setStyle(newStyle);

    map.once('style.load', () => {
      map.setCenter(center);
      map.setZoom(zoom);
      map.setBearing(bearing);
      map.setPitch(pitch);
      if (showTraffic) addTrafficLayer(map);
    });
  }, [resolvedTheme, loaded, showTraffic, addTrafficLayer]);

  const initMap = useCallback(async () => {
    if (!containerRef.current || mapRef.current) return;

    if (!MAPBOX_TOKEN) {
      setMapError('Map token not configured');
      return;
    }

    try {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const currentStyle = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: currentStyle,
        center: DEFAULT_CENTER,
        zoom: 14,
        pitch: 0,
        interactive: true,
        attributionControl: false,
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
        createMarker(mapboxgl, map, DEFAULT_CENTER[0], DEFAULT_CENTER[1]);

        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            const { longitude: lng, latitude: lat } = pos.coords;
            map.flyTo({ center: [lng, lat], zoom: 15, duration: 1800, essential: true });
            markerRef.current?.setLngLat([lng, lat]);
          },
          (err) => {
            console.warn('[RiderMap] Geolocation denied/timed out:', err.message);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    } catch (err) {
      console.error('[RiderMap] Failed to initialise map:', err);
      setMapError('Failed to load map');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Recenter on rider location */
  const recenter = () => {
    if (!mapRef.current) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords;
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 800 });
        markerRef.current?.setLngLat([lng, lat]);
      },
      () => mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: 14, duration: 800 }),
      { enableHighAccuracy: true, timeout: 5000 }
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

      {/* Google Maps-style controls — right side */}
      {loaded && (
        <div className="absolute top-[calc(env(safe-area-inset-top)+4.5rem)] right-3 flex flex-col gap-2 z-10">
          <button
            onClick={toggleTraffic}
            className={`map-control-btn ${showTraffic ? 'map-control-active' : ''}`}
            aria-label="Toggle traffic"
          >
            <Layers className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* GPS recenter — Google Maps style */}
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
