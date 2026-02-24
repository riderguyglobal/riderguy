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

        // Center on user location
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 1500 });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 5000 }
        );

        // Simulated nearby riders as bike icons
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

        // Glow ring
        map.addLayer({
          id: 'riders-glow',
          type: 'circle',
          source: 'nearby-riders',
          paint: {
            'circle-radius': 18,
            'circle-color': '#0ea5e9',
            'circle-opacity': 0.08,
            'circle-blur': 1,
          },
        });

        // Outer pulse ring
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

        // Core dot
        map.addLayer({
          id: 'riders-dots',
          type: 'circle',
          source: 'nearby-riders',
          paint: {
            'circle-radius': 5,
            'circle-color': '#0ea5e9',
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Add bike icon markers via HTML
        riders.forEach((rider) => {
          const el = document.createElement('div');
          el.className = 'rider-marker-wrapper';
          el.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#38bdf8);box-shadow:0 2px 8px rgba(14,165,233,0.35);border:2px solid white;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18.5" cy="17.5" r="3.5"/>
                <circle cx="5.5" cy="17.5" r="3.5"/>
                <circle cx="15" cy="5" r="1"/>
                <path d="m12 17.5 2-4.5h3l1.5-5"/>
                <path d="M5.5 17.5 8 12l4-1V7"/>
              </svg>
            </div>`;
          new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(rider.geometry.coordinates as [number, number])
            .addTo(map);
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

      {/* Shimmer loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.06) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-2xl brand-gradient flex items-center justify-center shadow-brand animate-pulse">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18.5" cy="17.5" r="3.5"/>
                <circle cx="5.5" cy="17.5" r="3.5"/>
                <circle cx="15" cy="5" r="1"/>
                <path d="m12 17.5 2-4.5h3l1.5-5"/>
                <path d="M5.5 17.5 8 12l4-1V7"/>
              </svg>
            </div>
            <p className="text-xs font-medium text-surface-400">Finding nearby riders...</p>
          </div>
        </div>
      )}

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-surface-50 via-surface-50/80 to-transparent pointer-events-none" />
    </div>
  );
}
