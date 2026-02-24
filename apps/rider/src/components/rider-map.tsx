'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER } from '@/lib/constants';

export type RiderMapStatus = 'offline' | 'online' | 'on-route';

interface RiderMapProps {
  className?: string;
  status?: RiderMapStatus;
}

/** Color palette for each rider status */
const STATUS_COLORS: Record<RiderMapStatus, { main: string; glow: string; ring: string }> = {
  offline:  { main: '#9ca3af', glow: 'rgba(156,163,175,.25)', ring: 'rgba(156,163,175,.15)' }, // gray/ash
  online:   { main: '#22c55e', glow: 'rgba(34,197,94,.35)',   ring: 'rgba(34,197,94,.18)'  }, // green
  'on-route': { main: '#ef4444', glow: 'rgba(239,68,68,.35)', ring: 'rgba(239,68,68,.18)'  }, // red
};

/** Motorbike SVG icon – 20×20 viewBox, rendered at marker size */
function bikeSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="5" cy="17" r="3"/>
    <circle cx="19" cy="17" r="3"/>
    <path d="M12 17V5l4 4h4"/>
    <path d="M5 14l4-4 4 4"/>
  </svg>`;
}

export function RiderMap({ className = '', status = 'offline' }: RiderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Update marker colors when status changes (without re-creating the marker)
  useEffect(() => {
    if (!markerElRef.current) return;
    const c = STATUS_COLORS[status];
    const ringEl = markerElRef.current.querySelector<HTMLDivElement>('[data-ring]');
    const glowEl = markerElRef.current.querySelector<HTMLDivElement>('[data-glow]');
    const bgEl = markerElRef.current.querySelector<HTMLDivElement>('[data-bg]');
    const svgContainer = markerElRef.current.querySelector<HTMLDivElement>('[data-icon]');

    if (ringEl) {
      ringEl.style.background = c.ring;
      ringEl.style.animationPlayState = status === 'offline' ? 'paused' : 'running';
    }
    if (glowEl) glowEl.style.boxShadow = `0 0 16px 4px ${c.glow}`;
    if (bgEl) bgEl.style.background = c.main;
    if (svgContainer) svgContainer.innerHTML = bikeSvg('#ffffff');
  }, [status]);

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

          const c = STATUS_COLORS[status];

          // Rider bike marker
          const el = document.createElement('div');
          el.innerHTML = `
            <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
              <!-- Pulse ring -->
              <div data-ring style="position:absolute;inset:0;border-radius:50%;background:${c.ring};animation:pulse-ring 2s ease-out infinite;${status === 'offline' ? 'animation-play-state:paused;' : ''}"></div>
              <!-- Glow shadow -->
              <div data-glow style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;box-shadow:0 0 16px 4px ${c.glow};"></div>
              <!-- Solid background circle -->
              <div data-bg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:${c.main};border:3px solid rgba(255,255,255,.9);box-shadow:0 2px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">
                <!-- Bike icon -->
                <div data-icon style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;">
                  ${bikeSvg('#ffffff')}
                </div>
              </div>
            </div>
          `;
          markerElRef.current = el;
          markerRef.current = new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="absolute inset-0 bg-[#0a0e17] animate-shimmer bg-gradient-to-r from-[#0a0e17] via-white/[0.03] to-[#0a0e17]" />
      )}
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#0a0e17] to-transparent pointer-events-none" />
    </div>
  );
}
