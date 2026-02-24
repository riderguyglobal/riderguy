'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER } from '@/lib/constants';
import { haversineDistance } from '@riderguy/utils';
import { Navigation, Crosshair, Maximize2 } from 'lucide-react';

interface NavigationMapProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  riderLat?: number;
  riderLng?: number;
  status: string;
  className?: string;
}

const PHASE_COLORS: Record<string, string> = {
  pickup: '#f59e0b',
  dropoff: '#22c55e',
};

export function NavigationMap({
  pickupLat, pickupLng, dropoffLat, dropoffLng,
  riderLat, riderLng, status, className = '',
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastRoutePos = useRef<[number, number] | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Determine phase: heading to pickup or dropoff
  const isPickupPhase = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP'].includes(status);
  const destLat = isPickupPhase ? pickupLat : dropoffLat;
  const destLng = isPickupPhase ? pickupLng : dropoffLng;
  const routeColor = isPickupPhase ? PHASE_COLORS.pickup : PHASE_COLORS.dropoff;

  const fetchRoute = useCallback(async (map: mapboxgl.Map, from: [number, number], to: [number, number]) => {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return;

      setEta(Math.ceil(route.duration / 60));

      const sourceId = 'route';
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(route.geometry);
        if (map.getLayer('route-line')) {
          map.setPaintProperty('route-line', 'line-color', routeColor);
        }
      } else {
        map.addSource(sourceId, { type: 'geojson', data: route.geometry });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': routeColor, 'line-width': 5, 'line-opacity': 0.85 },
        });
        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': routeColor, 'line-width': 12, 'line-opacity': 0.15 },
        }, 'route-line');
      }
    } catch {}
  }, [routeColor]);

  // Init map
  useEffect(() => {
    let destroyed = false;

    (async () => {
      if (!containerRef.current || mapRef.current) return;

      const mapboxgl = (await import('mapbox-gl')).default;
      // @ts-ignore css import
      await import('mapbox-gl/dist/mapbox-gl.css');
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: [pickupLng, pickupLat],
        zoom: 13,
        attributionControl: false,
      });

      if (destroyed) { map.remove(); return; }
      mapRef.current = map;

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

        // Fit bounds to show all points
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([pickupLng, pickupLat]);
        bounds.extend([dropoffLng, dropoffLat]);
        if (riderLat && riderLng) bounds.extend([riderLng, riderLat]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 1000 });

        // Fetch initial route
        if (riderLat && riderLng) {
          fetchRoute(map, [riderLng, riderLat], [destLng, destLat]);
          lastRoutePos.current = [riderLng, riderLat];
        }
      });
    })();

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update rider marker position
  useEffect(() => {
    if (!mapRef.current || !loaded || !riderLat || !riderLng) return;

    const mapboxgl = require('mapbox-gl') as typeof import('mapbox-gl');

    if (!riderMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="position:relative;width:36px;height:36px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(14,165,233,.25);animation:pulse-ring 2s ease-out infinite;"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#0ea5e9;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>
        </div>
      `;
      riderMarkerRef.current = new (mapboxgl as any).default.Marker({ element: el })
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
    if (!mapRef.current) return;
    const mapboxgl = require('mapbox-gl') as typeof import('mapbox-gl');
    const bounds = new (mapboxgl as any).default.LngLatBounds();
    bounds.extend([pickupLng, pickupLat]);
    bounds.extend([dropoffLng, dropoffLat]);
    if (riderLat && riderLng) bounds.extend([riderLng, riderLat]);
    mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {!loaded && (
        <div className="absolute inset-0 rounded-2xl bg-surface-900 animate-shimmer bg-gradient-to-r from-surface-900 via-surface-800 to-surface-900" />
      )}

      {/* ETA overlay */}
      {eta !== null && (
        <div className="absolute top-3 left-3 glass rounded-xl px-3 py-2">
          <p className="text-xs text-surface-400">ETA</p>
          <p className="text-lg font-bold text-white">{eta} min</p>
        </div>
      )}

      {/* Map controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <button onClick={recenter} className="h-10 w-10 rounded-xl glass flex items-center justify-center hover:bg-white/10 transition-colors">
          <Crosshair className="h-5 w-5 text-white" />
        </button>
        <button onClick={fitAll} className="h-10 w-10 rounded-xl glass flex items-center justify-center hover:bg-white/10 transition-colors">
          <Maximize2 className="h-5 w-5 text-white" />
        </button>
      </div>
    </div>
  );
}
