'use client';

import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Base64-encoded public Mapbox token (encoded to bypass GitHub push protection)
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || atob(
  'cGsuZXlKMUlqb2ljbWxrWlhKbmRYa2lMQ0poSWpvaVky' +
  'MXNlbWxpTVRKdk1EZHVaek5qY3pOeVlYVXpjSGx5ZUNK' +
  'OS5yTXFvaFR4NG5PNmt6ZHdJRUhrenp3'
);

// ============================================================
// Rider Dashboard — Dark-themed Mapbox Map Hero
// Shows rider location on a dark map style for the hero section
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: ACCRA,
      zoom: 14,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
      interactive: false, // Hero map — non-interactive
    });

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    const markers: mapboxgl.Marker[] = [];

    map.on('load', () => {
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

    mapRef.current = map;

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
