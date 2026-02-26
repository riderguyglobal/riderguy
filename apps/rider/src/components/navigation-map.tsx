'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER, MAP_STYLE, API_BASE_URL } from '@/lib/constants';
import { haversineDistance } from '@riderguy/utils';
import { Crosshair, Maximize2 } from 'lucide-react';

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
  /** Additional stops for multi-stop orders */
  stops?: Stop[];
  riderLat?: number;
  riderLng?: number;
  status: string;
  className?: string;
}

const STOP_COLORS: Record<string, string> = {
  PICKUP: '#f59e0b',
  DROPOFF: '#22c55e',
};

const PHASE_COLORS: Record<string, string> = {
  pickup: '#f59e0b',
  dropoff: '#22c55e',
};

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
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Determine phase: heading to pickup or dropoff
  const isPickupPhase = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP'].includes(status);
  const destLat = isPickupPhase ? pickupLat : dropoffLat;
  const destLng = isPickupPhase ? pickupLng : dropoffLng;
  const routeColor = isPickupPhase ? PHASE_COLORS.pickup : PHASE_COLORS.dropoff;

  /** Build multi-stop waypoint coordinates string for Directions API */
  const buildWaypointsCoords = useCallback((from: [number, number], to: [number, number]): string => {
    if (stops && stops.length > 0) {
      // Sort stops by sequence, build: from → stop1 → stop2 → ... → to
      const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
      const waypoints = sorted.map((s) => `${s.longitude},${s.latitude}`);
      return [
        `${from[0]},${from[1]}`,
        ...waypoints,
        `${to[0]},${to[1]}`,
      ].join(';');
    }
    return `${from[0]},${from[1]};${to[0]},${to[1]}`;
  }, [stops]);

  /** Fetch route through backend proxy (keeps Mapbox token server-side) */
  const fetchRoute = useCallback(async (map: mapboxgl.Map, from: [number, number], to: [number, number]) => {
    try {
      const coordinates = buildWaypointsCoords(from, to);
      const url = `${API_BASE_URL}/orders/directions?coordinates=${encodeURIComponent(coordinates)}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        console.warn('[NavigationMap] Directions API returned', res.status);
        return;
      }
      const json = await res.json();
      const route = json.data?.routes?.[0];
      if (!route) return;

      setEta(Math.ceil(route.duration / 60));

      const sourceId = 'route';
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(route.geometry);
        if (map.getLayer('route-line')) {
          map.setPaintProperty('route-line', 'line-color', routeColor);
        }
        if (map.getLayer('route-glow')) {
          map.setPaintProperty('route-glow', 'line-color', routeColor);
        }
      } else {
        map.addSource(sourceId, { type: 'geojson', data: route.geometry });
        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': routeColor, 'line-width': 12, 'line-opacity': 0.15 },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': routeColor, 'line-width': 5, 'line-opacity': 0.85 },
        });
      }
    } catch (err) {
      console.error('[NavigationMap] Failed to fetch route:', err);
    }
  }, [routeColor, buildWaypointsCoords]);

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

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center: [pickupLng, pickupLat],
          zoom: 13,
          attributionControl: false,
        });

        if (destroyed) { map.remove(); return; }
        mapRef.current = map;

        // Error handler
        map.on('error', (e) => {
          console.error('[NavigationMap] Mapbox error:', e.error?.message ?? e);
        });

        // Resize observer
        if (containerRef.current) {
          resizeObserverRef.current = new ResizeObserver(() => mapRef.current?.resize());
          resizeObserverRef.current.observe(containerRef.current);
        }

        map.on('load', () => {
          if (destroyed) return;
          setLoaded(true);

          // Pickup marker
          const pickupEl = document.createElement('div');
          pickupEl.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;border-radius:50%;background:white;"></div></div>`;
          new mapboxgl.Marker({ element: pickupEl }).setLngLat([pickupLng, pickupLat]).addTo(map);

          // Dropoff marker
          const dropoffEl = document.createElement('div');
          dropoffEl.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;border-radius:50%;background:white;"></div></div>`;
          new mapboxgl.Marker({ element: dropoffEl }).setLngLat([dropoffLng, dropoffLat]).addTo(map);

          // Multi-stop waypoint markers (numbered circles)
          if (stops && stops.length > 0) {
            const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
            sorted.forEach((stop, i) => {
              const color = STOP_COLORS[stop.type] ?? '#6366f1';
              const el = document.createElement('div');
              el.innerHTML = `
                <div style="position:relative;">
                  <div style="width:30px;height:30px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
                    <span style="color:white;font-size:11px;font-weight:700;">${i + 1}</span>
                  </div>
                </div>`;
              new mapboxgl.Marker({ element: el }).setLngLat([stop.longitude, stop.latitude]).addTo(map);
            });
          }

          // Fit bounds to show all points
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([pickupLng, pickupLat]);
          bounds.extend([dropoffLng, dropoffLat]);
          if (riderLat && riderLng) bounds.extend([riderLng, riderLat]);
          stops?.forEach((s) => bounds.extend([s.longitude, s.latitude]));
          map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 1000 });

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
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="position:relative;width:36px;height:36px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(34,197,94,.25);animation:pulse-ring 2s ease-out infinite;"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>
        </div>
      `;
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
    mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {!loaded && !mapError && (
        <div className="absolute inset-0 rounded-2xl bg-[#0a0e17] animate-shimmer bg-gradient-to-r from-[#0a0e17] via-white/[0.03] to-[#0a0e17]" />
      )}

      {mapError && (
        <div className="absolute inset-0 rounded-2xl bg-[#0a0e17] flex items-center justify-center">
          <p className="text-sm text-surface-500">{mapError}</p>
        </div>
      )}

      {/* ETA overlay */}
      {eta !== null && (
        <div className="absolute top-3 left-3 glass-elevated rounded-2xl px-4 py-2.5">
          <p className="text-[10px] text-surface-500 uppercase tracking-wider font-medium">ETA</p>
          <p className="text-xl font-extrabold text-white tabular-nums">{eta} <span className="text-sm font-medium text-surface-400">min</span></p>
        </div>
      )}

      {/* Map controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <button onClick={recenter} className="h-10 w-10 rounded-xl glass-elevated flex items-center justify-center hover:bg-white/[0.08] transition-colors btn-press">
          <Crosshair className="h-5 w-5 text-white" />
        </button>
        <button onClick={fitAll} className="h-10 w-10 rounded-xl glass-elevated flex items-center justify-center hover:bg-white/[0.08] transition-colors btn-press">
          <Maximize2 className="h-5 w-5 text-white" />
        </button>
      </div>
    </div>
  );
}
