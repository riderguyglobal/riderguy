'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE, API_BASE_URL } from '@/lib/constants';

interface TrackingMapProps {
  pickupCoords: [number, number] | null;
  dropoffCoords: [number, number] | null;
  riderCoords: [number, number] | null;
  status: string;
}

export default function TrackingMap({ pickupCoords, dropoffCoords, riderCoords, status }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapboxglRef = useRef<any>(null);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastRiderRoutePos = useRef<[number, number] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  /** Fetch route through backend proxy (keeps Mapbox token server-side) */
  const fetchRouteProxy = useCallback(async (
    map: mapboxgl.Map,
    from: [number, number],
    to: [number, number],
  ) => {
    try {
      const coordinates = `${from.join(',')};${to.join(',')}`;
      const url = `${API_BASE_URL}/orders/directions?coordinates=${encodeURIComponent(coordinates)}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data?.routes?.[0]?.geometry ?? null;
    } catch (err) {
      console.warn('[TrackingMap] Failed to fetch route:', err);
      return null;
    }
  }, []);

  /** Add or update the route line on the map */
  const drawRoute = useCallback(async (
    map: mapboxgl.Map,
    from: [number, number],
    to: [number, number],
  ) => {
    const geometry = await fetchRouteProxy(map, from, to);
    if (!geometry) return;

    const sourceId = 'route';
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(
        { type: 'Feature', geometry, properties: {} },
      );
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'Feature', geometry, properties: {} },
      });

      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#22c55e', 'line-width': 10, 'line-opacity': 0.12, 'line-blur': 4 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#22c55e', 'line-width': 4, 'line-opacity': 0.85 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    }

    // Fit bounds to the route
    const coords = geometry.coordinates as [number, number][];
    if (coords.length > 0) {
      const mapboxgl = mapboxglRef.current;
      if (!mapboxgl) return;
      const bounds = coords.reduce(
        (b: mapboxgl.LngLatBounds, c: [number, number]) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
    }
  }, [fetchRouteProxy]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!pickupCoords && !dropoffCoords) return;

    // Token guard
    if (!MAPBOX_TOKEN) {
      setMapError('Map service not configured');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        if (cancelled || !containerRef.current) return;
        mapboxglRef.current = mapboxgl;

        mapboxgl.accessToken = MAPBOX_TOKEN;
        const center = dropoffCoords || pickupCoords || [0, 0];
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center,
          zoom: 13,
          attributionControl: false,
        });

        mapRef.current = map;

        // Error handler
        map.on('error', (e) => {
          console.error('[TrackingMap] Mapbox error:', e.error?.message ?? e);
        });

        // Resize observer
        if (containerRef.current) {
          resizeObserverRef.current = new ResizeObserver(() => mapRef.current?.resize());
          resizeObserverRef.current.observe(containerRef.current);
        }

        map.on('load', () => {
          if (cancelled) return;
          setLoaded(true);

          // Pickup marker — dark (black) rounded square for green/black/white theme
          if (pickupCoords) {
            const el = document.createElement('div');
            el.innerHTML = `
              <div style="position:relative;">
                <div style="position:absolute;inset:-4px;border-radius:14px;background:rgba(15,23,42,0.12);"></div>
                <div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#1e293b,#0f172a);box-shadow:0 4px 12px rgba(0,0,0,0.25);border:2.5px solid white;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                </div>
              </div>`;
            new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(pickupCoords).addTo(map);
          }

          // Dropoff marker — brand green gradient rounded square
          if (dropoffCoords) {
            const el = document.createElement('div');
            el.innerHTML = `
              <div style="position:relative;">
                <div style="position:absolute;inset:-4px;border-radius:14px;background:rgba(34,197,94,0.15);"></div>
                <div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#22c55e,#4ade80);box-shadow:0 4px 12px rgba(34,197,94,0.35);border:2.5px solid white;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
              </div>`;
            new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(dropoffCoords).addTo(map);
          }

          // Route line (via backend proxy)
          if (pickupCoords && dropoffCoords) {
            drawRoute(map, pickupCoords, dropoffCoords);
          }
        });
      } catch (err) {
        console.error('[TrackingMap] Init failed:', err);
        setMapError('Failed to load map');
      }
    })();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pickupCoords, dropoffCoords, drawRoute]);

  // Rider position — bike icon marker (no re-import of mapbox-gl)
  useEffect(() => {
    if (!mapRef.current || !mapboxglRef.current || !riderCoords || !loaded) return;

    const mapboxgl = mapboxglRef.current;

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLngLat(riderCoords);
    } else {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(34,197,94,0.2);animation:pulse-ring 2s ease-in-out infinite;"></div>
          <div style="position:absolute;inset:-3px;border-radius:50%;background:rgba(34,197,94,0.1);"></div>
          <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:14px;background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 4px 16px rgba(34,197,94,0.4);border:3px solid white;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18.5" cy="17.5" r="3.5"/>
              <circle cx="5.5" cy="17.5" r="3.5"/>
              <circle cx="15" cy="5" r="1"/>
              <path d="m12 17.5 2-4.5h3l1.5-5"/>
              <path d="M5.5 17.5 8 12l4-1V7"/>
            </svg>
          </div>
        </div>`;
      riderMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(riderCoords).addTo(mapRef.current!);
    }

    // Re-draw route from rider to dropoff when rider moves > 150m
    if (dropoffCoords && mapRef.current) {
      if (!lastRiderRoutePos.current) {
        lastRiderRoutePos.current = riderCoords;
      } else {
        const [pLng, pLat] = lastRiderRoutePos.current;
        const [cLng, cLat] = riderCoords;
        const dLat = (cLat - pLat) * (Math.PI / 180);
        const dLng = (cLng - pLng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(pLat * Math.PI / 180) * Math.cos(cLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (dist > 150) {
          drawRoute(mapRef.current, riderCoords, dropoffCoords);
          lastRiderRoutePos.current = riderCoords;
        }
      }
    }
  }, [riderCoords, loaded, dropoffCoords, drawRoute]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" />

      {/* Shimmer loading */}
      {!loaded && !mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 rounded-2xl flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.06) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 rounded-xl brand-gradient flex items-center justify-center shadow-brand animate-pulse">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <p className="text-xs font-medium text-surface-400">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 rounded-2xl flex items-center justify-center">
          <p className="text-sm text-surface-500">{mapError}</p>
        </div>
      )}
    </div>
  );
}
