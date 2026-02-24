'use client';

import { useEffect, useRef, useState } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE, DEFAULT_CENTER } from '@/lib/constants';

export default function ClientMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      // @ts-ignore css import
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: 14,
        attributionControl: false,
        interactive: false,
        fadeDuration: 0,
      });

      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;
        setLoaded(true);

        // Try to center on user's location
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 1500 });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 5000 }
        );

        // Add simulated nearby rider dots
        const center = map.getCenter();
        const riders = Array.from({ length: 6 }, (_, i) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [
              center.lng + (Math.random() - 0.5) * 0.02,
              center.lat + (Math.random() - 0.5) * 0.02,
            ],
          },
          properties: { id: i },
        }));

        map.addSource('nearby-riders', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: riders },
        });

        map.addLayer({
          id: 'riders-pulse',
          type: 'circle',
          source: 'nearby-riders',
          paint: {
            'circle-radius': 12,
            'circle-color': '#0ea5e9',
            'circle-opacity': 0.15,
          },
        });

        map.addLayer({
          id: 'riders-dots',
          type: 'circle',
          source: 'nearby-riders',
          paint: {
            'circle-radius': 5,
            'circle-color': '#0ea5e9',
            'circle-opacity': 0.8,
          },
        });
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {!loaded && (
        <div className="absolute inset-0 bg-surface-100 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      )}
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface-50 to-transparent pointer-events-none" />
    </div>
  );
}
