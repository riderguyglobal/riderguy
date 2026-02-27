'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER, MAP_STYLE_LIGHT, MAP_STYLE_DARK, API_BASE_URL } from '@/lib/constants';
import { useTheme } from '@/lib/theme';
import { tokenStorage } from '@riderguy/auth';
import { haversineDistance } from '@riderguy/utils';
import { Navigation, Maximize2, Layers, Clock, MapPin } from 'lucide-react';

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

/** Google Maps-style route colors */
const ROUTE_COLORS = {
  pickup:  '#4285F4',  // Google blue for approach phase
  dropoff: '#34A853',  // Google green for delivery phase
};

const STOP_COLORS = {
  PICKUP: '#fbbc04',   // Google yellow
  DROPOFF: '#34A853',  // Google green
} as const;

/** Create Google Maps-style pin marker HTML */
function createPinMarker(color: string, label: string, type: 'pickup' | 'dropoff' | 'stop') {
  const el = document.createElement('div');
  el.className = 'gmap-marker';

  if (type === 'pickup') {
    // Google Maps green circle pickup marker
    el.innerHTML = `
      <div class="gmap-pin" style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="4" fill="white"/></svg>
        </div>
        <div style="width:3px;height:8px;background:${color};border-radius:0 0 2px 2px;box-shadow:0 2px 4px rgba(0,0,0,.2);"></div>
      </div>
    `;
  } else if (type === 'dropoff') {
    // Google Maps red-style pin marker for dropoff
    el.innerHTML = `
      <div class="gmap-pin" style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M5 3l3.057-3L20 12 8.057 24 5 21l9-9z"/></svg>
        </div>
        <div style="width:3px;height:8px;background:${color};border-radius:0 0 2px 2px;box-shadow:0 2px 4px rgba(0,0,0,.2);"></div>
      </div>
    `;
  } else {
    // Numbered stop marker
    el.innerHTML = `
      <div class="gmap-pin" style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:12px;font-weight:700;line-height:1;">${label}</span>
        </div>
        <div style="width:2px;height:6px;background:${color};border-radius:0 0 2px 2px;"></div>
      </div>
    `;
  }
  return el;
}

/** Create Google Maps-style rider dot */
function createRiderDot() {
  const el = document.createElement('div');
  el.className = 'gmap-rider';
  el.innerHTML = `
    <div style="position:relative;width:44px;height:44px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(66,133,244,.18);animation:pulse-ring 2.5s ease-out infinite;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#4285F4;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>
    </div>
  `;
  return el;
}

export function NavigationMap({
  pickupLat, pickupLng, dropoffLat, dropoffLng,
  stops, riderLat, riderLng, status, className = '',
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapboxglRef = useRef<any>(null);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastRoutePos = useRef<[number, number] | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showTraffic, setShowTraffic] = useState(true);
  const { resolvedTheme } = useTheme();
  const prevThemeRef = useRef(resolvedTheme);

  const isPickupPhase = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP'].includes(status);
  const destLat = isPickupPhase ? pickupLat : dropoffLat;
  const destLng = isPickupPhase ? pickupLng : dropoffLng;
  const routeColor = isPickupPhase ? ROUTE_COLORS.pickup : ROUTE_COLORS.dropoff;

  /** Build waypoints coordinates string */
  const buildWaypointsCoords = useCallback((from: [number, number], to: [number, number]): string => {
    if (stops && stops.length > 0) {
      const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
      const waypoints = sorted.map((s) => `${s.longitude},${s.latitude}`);
      return [`${from[0]},${from[1]}`, ...waypoints, `${to[0]},${to[1]}`].join(';');
    }
    return `${from[0]},${from[1]};${to[0]},${to[1]}`;
  }, [stops]);

  /** Fetch route from backend with Google Maps-style rendering */
  const fetchRoute = useCallback(async (map: mapboxgl.Map, from: [number, number], to: [number, number]) => {
    try {
      const coordinates = buildWaypointsCoords(from, to);
      const url = `${API_BASE_URL}/orders/directions?coordinates=${encodeURIComponent(coordinates)}`;
      const token = tokenStorage.getAccessToken();
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const json = await res.json();
      const route = json.data?.routes?.[0];
      if (!route) return;

      setEta(Math.ceil(route.duration / 60));
      setDistance(Math.round(route.distance / 100) / 10); // km with 1 decimal

      const sourceId = 'route';
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(route.geometry);
        // Update colors for phase changes
        if (map.getLayer('route-border')) map.setPaintProperty('route-border', 'line-color', routeColor);
        if (map.getLayer('route-line'))   map.setPaintProperty('route-line', 'line-color', routeColor);
        if (map.getLayer('route-glow'))   map.setPaintProperty('route-glow', 'line-color', routeColor);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: route.geometry });

        // Google Maps-style route: shadow → white border → colored line
        map.addLayer({
          id: 'route-shadow',
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': 'rgba(0,0,0,0.15)', 'line-width': 14, 'line-blur': 4 },
        });
        map.addLayer({
          id: 'route-border',
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': routeColor, 'line-width': 10, 'line-opacity': 0.35 },
        });
        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': routeColor, 'line-width': 8, 'line-opacity': 0.5 },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': routeColor, 'line-width': 5, 'line-opacity': 1 },
        });
      }
    } catch (err) {
      console.error('[NavigationMap] Failed to fetch route:', err);
    }
  }, [routeColor, buildWaypointsCoords]);

  /** Add traffic layer */
  const addTrafficLayer = useCallback((map: mapboxgl.Map) => {
    if (map.getSource('mapbox-traffic')) return;

    map.addSource('mapbox-traffic', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-traffic-v1',
    });

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
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 3, 16, 5, 20, 10],
        'line-opacity': 0.6,
        'line-offset': ['interpolate', ['linear'], ['zoom'], 7, 0, 12, 1, 16, 2],
      },
      minzoom: 7,
    }, beforeId);
  }, []);

  const toggleTraffic = useCallback(() => {
    if (!mapRef.current) return;
    const next = !showTraffic;
    setShowTraffic(next);
    if (mapRef.current.getLayer('traffic-flow')) {
      mapRef.current.setLayoutProperty('traffic-flow', 'visibility', next ? 'visible' : 'none');
    }
  }, [showTraffic]);

  /** Switch style on theme change */
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
      // Re-fetch route to re-add layers
      if (lastRoutePos.current) {
        fetchRoute(map, lastRoutePos.current, [destLng, destLat]);
      }
    });
  }, [resolvedTheme, loaded, showTraffic, addTrafficLayer, fetchRoute, destLng, destLat]);

  // Init map
  useEffect(() => {
    let destroyed = false;

    if (!MAPBOX_TOKEN) {
      setMapError('Map token not configured');
      return;
    }

    (async () => {
      try {
        if (!containerRef.current || mapRef.current) return;

        const mapboxgl = (await import('mapbox-gl')).default;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        mapboxglRef.current = mapboxgl;

        const currentStyle = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: currentStyle,
          center: [pickupLng, pickupLat],
          zoom: 13,
          attributionControl: false,
          antialias: true,
        });

        if (destroyed) { map.remove(); return; }
        mapRef.current = map;
        prevThemeRef.current = resolvedTheme;

        map.on('error', (e) => {
          console.error('[NavigationMap] Mapbox error:', e.error?.message ?? e);
        });

        if (containerRef.current) {
          resizeObserverRef.current = new ResizeObserver(() => mapRef.current?.resize());
          resizeObserverRef.current.observe(containerRef.current);
        }

        map.on('load', () => {
          if (destroyed) return;
          setLoaded(true);

          // Traffic layer
          addTrafficLayer(map);

          // Google Maps-style pickup marker (yellow circle with dot)
          const pickupEl = createPinMarker(STOP_COLORS.PICKUP, '', 'pickup');
          new mapboxgl.Marker({ element: pickupEl, anchor: 'bottom' })
            .setLngLat([pickupLng, pickupLat])
            .addTo(map);

          // Google Maps-style dropoff marker (green with arrow)
          const dropoffEl = createPinMarker(STOP_COLORS.DROPOFF, '', 'dropoff');
          new mapboxgl.Marker({ element: dropoffEl, anchor: 'bottom' })
            .setLngLat([dropoffLng, dropoffLat])
            .addTo(map);

          // Multi-stop waypoint markers (numbered)
          if (stops && stops.length > 0) {
            const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
            sorted.forEach((stop, i) => {
              const color = STOP_COLORS[stop.type] ?? '#6366f1';
              const el = createPinMarker(color, String(i + 1), 'stop');
              new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([stop.longitude, stop.latitude])
                .addTo(map);
            });
          }

          // Fit bounds
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([pickupLng, pickupLat]);
          bounds.extend([dropoffLng, dropoffLat]);
          if (riderLat && riderLng) bounds.extend([riderLng, riderLat]);
          stops?.forEach((s) => bounds.extend([s.longitude, s.latitude]));
          map.fitBounds(bounds, { padding: { top: 80, bottom: 100, left: 50, right: 50 }, maxZoom: 16, duration: 1000 });

          // Fetch initial route
          if (riderLat && riderLng) {
            fetchRoute(map, [riderLng, riderLat], [destLng, destLat]);
            lastRoutePos.current = [riderLng, riderLat];
          }
        });
      } catch (err) {
        console.error('[NavigationMap] Init failed:', err);
        setMapError('Failed to load map');
      }
    })();

    return () => {
      destroyed = true;
      resizeObserverRef.current?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update rider marker position
  useEffect(() => {
    if (!mapRef.current || !mapboxglRef.current || !loaded || !riderLat || !riderLng) return;

    const mapboxgl = mapboxglRef.current;

    if (!riderMarkerRef.current) {
      const el = createRiderDot();
      riderMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([riderLng, riderLat])
        .addTo(mapRef.current);
    } else {
      riderMarkerRef.current.setLngLat([riderLng, riderLat]);
    }

    // Refresh route if rider moved > 100m
    if (lastRoutePos.current) {
      const dist = haversineDistance(
        lastRoutePos.current[1], lastRoutePos.current[0],
        riderLat, riderLng
      );
      if (dist > 100) {
        fetchRoute(mapRef.current, [riderLng, riderLat], [destLng, destLat]);
        lastRoutePos.current = [riderLng, riderLat];
      }
    } else {
      fetchRoute(mapRef.current, [riderLng, riderLat], [destLng, destLat]);
      lastRoutePos.current = [riderLng, riderLat];
    }
  }, [riderLat, riderLng, loaded, fetchRoute, destLat, destLng]);

  const recenter = () => {
    if (!mapRef.current || !riderLat || !riderLng) return;
    mapRef.current.flyTo({ center: [riderLng, riderLat], zoom: 15, duration: 800 });
  };

  const fitAll = () => {
    if (!mapRef.current || !mapboxglRef.current) return;
    const mapboxgl = mapboxglRef.current;
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([pickupLng, pickupLat]);
    bounds.extend([dropoffLng, dropoffLat]);
    if (riderLat && riderLng) bounds.extend([riderLng, riderLat]);
    stops?.forEach((s) => bounds.extend([s.longitude, s.latitude]));
    mapRef.current.fitBounds(bounds, { padding: { top: 80, bottom: 100, left: 50, right: 50 }, maxZoom: 16, duration: 800 });
  };

  const phaseLabel = isPickupPhase ? 'To Pickup' : 'To Dropoff';

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {!loaded && !mapError && (
        <div className="absolute inset-0 rounded-2xl bg-page animate-shimmer bg-gradient-to-r from-page via-shimmer to-page" />
      )}

      {mapError && (
        <div className="absolute inset-0 rounded-2xl bg-page flex items-center justify-center">
          <p className="text-sm text-subtle">{mapError}</p>
        </div>
      )}

      {/* Google Maps-style ETA panel — bottom left */}
      {eta !== null && (
        <div className="absolute bottom-3 left-3 map-info-panel rounded-2xl px-4 py-3 max-w-[200px]">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-muted" />
            <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">{phaseLabel}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-primary tabular-nums">{eta}</span>
            <span className="text-sm font-medium text-muted">min</span>
          </div>
          {distance !== null && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="h-3 w-3 text-subtle" />
              <span className="text-xs text-secondary font-medium tabular-nums">{distance} km</span>
            </div>
          )}
        </div>
      )}

      {/* Map controls — right side */}
      {loaded && (
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            onClick={toggleTraffic}
            className={`map-control-btn ${showTraffic ? 'map-control-active' : ''}`}
            aria-label="Toggle traffic"
          >
            <Layers className="h-5 w-5" />
          </button>
          <button onClick={fitAll} className="map-control-btn" aria-label="Fit all markers">
            <Maximize2 className="h-5 w-5" />
          </button>
          <button onClick={recenter} className="map-control-btn map-control-gps" aria-label="Recenter on rider">
            <Navigation className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
