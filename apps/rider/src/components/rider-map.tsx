'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER } from '@/lib/constants';

interface RiderMapProps {
  className?: string;
}

export function RiderMap({ className = '' }: RiderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);

  const initMap = useCallback(async () => {
    if (!containerRef.current || mapRef.current) return;

    const mapboxgl = (await import('mapbox-gl')).default;
    // @ts-ignore css import
    await import('mapbox-gl/dist/mapbox-gl.css');

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: DEFAULT_CENTER,
      zoom: 14,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });

    mapRef.current = map;

    map.on('load', () => {
      setLoaded(true);

      // Try to get user location
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const { longitude: lng, latitude: lat } = pos.coords;
          map.flyTo({ center: [lng, lat], zoom: 15, duration: 1500 });

          // Rider marker
          const el = document.createElement('div');
          el.innerHTML = `
            <div style="position:relative;width:40px;height:40px;">
              <div style="position:absolute;inset:0;border-radius:50%;background:rgba(14,165,233,.2);animation:pulse-ring 2s ease-out infinite;"></div>
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:#0ea5e9;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);"></div>
            </div>
          `;
          markerRef.current = new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }, []);

  useEffect(() => {
    initMap();
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 bg-surface-900 animate-shimmer bg-gradient-to-r from-surface-900 via-surface-800 to-surface-900" />
      )}
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface-950 to-transparent pointer-events-none" />
    </div>
  );
}
