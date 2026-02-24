'use client';

import { useEffect, useRef, useState } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE } from '@/lib/constants';

interface TrackingMapProps {
  pickupCoords: [number, number] | null;
  dropoffCoords: [number, number] | null;
  riderCoords: [number, number] | null;
  status: string;
}

export default function TrackingMap({ pickupCoords, dropoffCoords, riderCoords, status }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!pickupCoords && !dropoffCoords) return;

    let cancelled = false;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;
      const center = dropoffCoords || pickupCoords || [0, 0];
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center,
        zoom: 13,
        attributionControl: false,
      });

      // Ensure map fills container after render
      map.once('idle', () => map.resize());

      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;
        setLoaded(true);

        // Pickup marker — brand gradient rounded square
        if (pickupCoords) {
          const el = document.createElement('div');
          el.innerHTML = `
            <div style="position:relative;">
              <div style="position:absolute;inset:-4px;border-radius:14px;background:rgba(14,165,233,0.15);"></div>
              <div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#38bdf8);box-shadow:0 4px 12px rgba(14,165,233,0.35);border:2.5px solid white;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              </div>
            </div>`;
          new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(pickupCoords).addTo(map);
        }

        // Dropoff marker — accent gradient rounded square
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

        // Route line
        if (pickupCoords && dropoffCoords) {
          fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${pickupCoords.join(',')};${dropoffCoords.join(',')}?geometries=geojson&access_token=${MAPBOX_TOKEN}`)
            .then((r) => r.json())
            .then((data) => {
              const route = data.routes?.[0]?.geometry;
              if (!route) return;

              // Route glow
              map.addSource('route', {
                type: 'geojson',
                data: { type: 'Feature', geometry: route, properties: {} },
              });

              map.addLayer({
                id: 'route-glow',
                type: 'line',
                source: 'route',
                paint: {
                  'line-color': '#0ea5e9',
                  'line-width': 10,
                  'line-opacity': 0.12,
                  'line-blur': 4,
                },
                layout: { 'line-cap': 'round', 'line-join': 'round' },
              });

              map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route',
                paint: {
                  'line-color': '#0ea5e9',
                  'line-width': 4,
                  'line-opacity': 0.85,
                },
                layout: { 'line-cap': 'round', 'line-join': 'round' },
              });

              // Fit bounds
              const coords = route.coordinates as [number, number][];
              const bounds = coords.reduce(
                (b, c) => b.extend(c),
                new mapboxgl.LngLatBounds(coords[0], coords[0])
              );
              map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
            })
            .catch(() => {});
        }
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pickupCoords, dropoffCoords]);

  // Rider position — bike icon marker
  useEffect(() => {
    if (!mapRef.current || !riderCoords || !loaded) return;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLngLat(riderCoords);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(14,165,233,0.2);animation:pulse 2s ease-in-out infinite;"></div>
            <div style="position:absolute;inset:-3px;border-radius:50%;background:rgba(14,165,233,0.1);"></div>
            <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:14px;background:linear-gradient(135deg,#0ea5e9,#0284c7);box-shadow:0 4px 16px rgba(14,165,233,0.4);border:3px solid white;">
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
    })();
  }, [riderCoords, loaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" />

      {/* Shimmer loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 rounded-2xl flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.06) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
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
    </div>
  );
}
