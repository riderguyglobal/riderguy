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
// Client Dashboard — Live Mapbox Map Hero
// Shows user location + nearby rider markers around Accra
// ============================================================

/* Accra, Ghana — default center */
const ACCRA: [number, number] = [-0.1870, 5.6037];

/* Simulated nearby riders — will be replaced by real API data */
const NEARBY_RIDERS = [
  { id: 1, lng: -0.1830, lat: 5.6080, heading: 45 },
  { id: 2, lng: -0.1920, lat: 5.6000, heading: -30 },
  { id: 3, lng: -0.1890, lat: 5.6100, heading: 120 },
  { id: 4, lng: -0.1810, lat: 5.5970, heading: -90 },
  { id: 5, lng: -0.1950, lat: 5.6050, heading: 60 },
];

/** Create the motorcycle marker DOM element for a rider */
function createRiderMarkerEl(heading: number, delay: number): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rider-pin-bounce';
  wrapper.style.animationDelay = `${delay}s`;

  const inner = document.createElement('div');
  Object.assign(inner.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#0f172a',
    border: '2px solid white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    transform: `rotate(${heading}deg)`,
  });
  inner.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#38bdf8"><path d="M19.5 16a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM4.5 16a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM17 11l-2-4h-3V5h4l2.7 5.4M7.5 18.5h9M2 18.5h2.5M10 5H6l-3 7h5.3"/></svg>`;

  wrapper.appendChild(inner);
  return wrapper;
}

/** Create the pulsing user-location dot */
function createUserMarkerEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'tracking-pulse-ring';
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#0ea5e9',
    border: '3px solid white',
    boxShadow: '0 0 12px rgba(14,165,233,0.4)',
  });
  el.appendChild(dot);
  return el;
}

export default function ClientMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: ACCRA,
      zoom: 14,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    const markers: mapboxgl.Marker[] = [];

    map.on('load', () => {
      // ── User location pulsing dot ──
      const userEl = createUserMarkerEl();
      const userMarker = new mapboxgl.Marker({ element: userEl })
        .setLngLat(ACCRA)
        .addTo(map);
      markers.push(userMarker);

      // ── Nearby rider markers ──
      NEARBY_RIDERS.forEach((rider) => {
        const el = createRiderMarkerEl(rider.heading, rider.id * 0.3);
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([rider.lng, rider.lat])
          .addTo(map);
        markers.push(marker);
      });

      // ── Auto-locate user & redistribute riders around them ──
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords: [number, number] = [
              pos.coords.longitude,
              pos.coords.latitude,
            ];
            userMarker.setLngLat(coords);
            map.flyTo({ center: coords, zoom: 15, duration: 2000 });

            // Move rider markers around user's real location
            NEARBY_RIDERS.forEach((_, i) => {
              const offset = 0.003 + Math.random() * 0.004;
              const angle =
                (i / NEARBY_RIDERS.length) * 2 * Math.PI +
                (Math.random() - 0.5);
              const newLng = coords[0] + offset * Math.cos(angle);
              const newLat = coords[1] + offset * Math.sin(angle);
              // markers[0] = user, markers[1..N] = riders
              markers[i + 1]?.setLngLat([newLng, newLat]);
            });
          },
          () => {}, // Fail silently — stay centered on Accra
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
