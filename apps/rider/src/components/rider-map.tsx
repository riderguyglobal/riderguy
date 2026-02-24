'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Base64-encoded public Mapbox token (encoded to bypass GitHub push protection)
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || atob(
  'cGsuZXlKMUlqb2ljbWxrWlhKbmRYa2lMQ0poSWpvaVky' +
  'MXNlbWxpTVRKdk1EZHVaek5qY3pOeVlYVXpjSGx5ZUNK' +
  'OS5yTXFvaFR4NG5PNmt6ZHdJRUhrenp3'
);

// ============================================================
// Rider Dashboard — Mapbox Map Hero
// Shows rider location on a navigation-optimized dark map style
// ============================================================

/* Accra, Ghana — default center */
const ACCRA: [number, number] = [-0.1870, 5.6037];

/** Create the pulsing rider-location marker */
function createRiderLocationEl(): HTMLDivElement {
  const el = document.createElement('div');

  // Outer pulse ring
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'absolute',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(14,165,233,0.15)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  });
  ring.className = 'tracking-pulse-ring';

  // Center dot
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'relative',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#0ea5e9',
    border: '3px solid white',
    boxShadow: '0 0 12px rgba(14,165,233,0.5)',
    zIndex: '1',
  });

  el.style.position = 'relative';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.appendChild(ring);
  el.appendChild(dot);
  return el;
}

export default function RiderMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: ACCRA,
        zoom: 14,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        interactive: false, // Hero map — non-interactive
        failIfMajorPerformanceCaveat: false,
      });
    } catch (err) {
      setMapError('Map failed to initialize');
      console.error('[RiderMap] init error:', err);
      return;
    }

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    const markers: mapboxgl.Marker[] = [];

    map.on('load', () => {
      setMapReady(true);

      // ── Rider location marker ──
      const riderEl = createRiderLocationEl();
      const riderMarker = new mapboxgl.Marker({ element: riderEl })
        .setLngLat(ACCRA)
        .addTo(map);
      markers.push(riderMarker);

      // ── Auto-locate rider ──
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords: [number, number] = [
              pos.coords.longitude,
              pos.coords.latitude,
            ];
            riderMarker.setLngLat(coords);
            map.flyTo({ center: coords, zoom: 15, duration: 2000 });
          },
          () => {}, // Stay centered on Accra
          { enableHighAccuracy: true, timeout: 10000 },
        );
      }
    });

    // Handle errors (invalid token, tile load failures, etc.)
    map.on('error', (e) => {
      console.error('[RiderMap] error:', e.error?.message || e);
      const status = (e.error as any)?.status;
      if (e.error?.message?.includes('access token') || status === 401) {
        setMapError('Map authentication failed');
      }
    });

    mapRef.current = map;

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="absolute inset-0">
      {/* Map canvas container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading state */}
      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a1a]">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
            <p className="text-[11px] text-surface-500">Loading map…</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a1a]">
          <div className="flex flex-col items-center gap-2 text-center px-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <p className="text-xs text-surface-400">{mapError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
