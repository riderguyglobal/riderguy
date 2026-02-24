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
      // @ts-ignore css import
      await import('mapbox-gl/dist/mapbox-gl.css');
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

      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;
        setLoaded(true);

        // Pickup marker
        if (pickupCoords) {
          const el = document.createElement('div');
          el.innerHTML = `<div class="h-8 w-8 rounded-full bg-brand-500 border-2 border-white shadow-lg flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>`;
          new mapboxgl.Marker({ element: el }).setLngLat(pickupCoords).addTo(map);
        }

        // Dropoff marker
        if (dropoffCoords) {
          const el = document.createElement('div');
          el.innerHTML = `<div class="h-8 w-8 rounded-full bg-accent-500 border-2 border-white shadow-lg flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`;
          new mapboxgl.Marker({ element: el }).setLngLat(dropoffCoords).addTo(map);
        }

        // Draw route
        if (pickupCoords && dropoffCoords) {
          fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${pickupCoords.join(',')};${dropoffCoords.join(',')}?geometries=geojson&access_token=${MAPBOX_TOKEN}`)
            .then((r) => r.json())
            .then((data) => {
              const route = data.routes?.[0]?.geometry;
              if (!route) return;

              map.addSource('route', {
                type: 'geojson',
                data: { type: 'Feature', geometry: route, properties: {} },
              });

              map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route',
                paint: {
                  'line-color': '#0ea5e9',
                  'line-width': 4,
                  'line-opacity': 0.7,
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

  // Update rider position
  useEffect(() => {
    if (!mapRef.current || !riderCoords || !loaded) return;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLngLat(riderCoords);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `
          <div class="relative">
            <div class="absolute -inset-3 rounded-full bg-brand-500/20 animate-pulse-ring"></div>
            <div class="h-10 w-10 rounded-full bg-brand-500 border-3 border-white shadow-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
            </div>
          </div>`;
        riderMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(riderCoords).addTo(mapRef.current!);
      }
    })();
  }, [riderCoords, loaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" />
      {!loaded && (
        <div className="absolute inset-0 bg-surface-100 rounded-2xl flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
}
