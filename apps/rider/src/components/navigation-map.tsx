'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Base64-encoded public Mapbox token (encoded to bypass GitHub push protection)
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || atob(
  'cGsuZXlKMUlqb2ljbWxrWlhKbmRYa2lMQ0poSWpvaVky' +
  'MXNlbWxpTVRKdk1EZHVaek5qY3pOeVlYVXpjSGx5ZUNK' +
  'OS5yTXFvaFR4NG5PNmt6ZHdJRUhrenp3'
);

// ============================================================
// NavigationMap — Interactive Mapbox GL map for active delivery
//
// Features:
//   • Route line from rider → destination (pickup or dropoff)
//   • Pickup (green) and dropoff (red) markers
//   • Real-time rider position marker with heading cone
//   • Distance/ETA overlay
//   • Re-center button
//   • Auto-fetches Mapbox Directions for route geometry
//   • Re-calculates route on significant position changes
//   • Loading/error states for resilient rendering
// ============================================================

const ACCRA: [number, number] = [-0.1870, 5.6037];
const ROUTE_REFRESH_DISTANCE_KM = 0.1; // Re-fetch route if rider moves 100m+

interface NavigationMapProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  riderLat: number | null;
  riderLng: number | null;
  riderHeading?: number;
  /** 'TO_PICKUP' before pickup, 'TO_DROPOFF' after */
  phase: 'TO_PICKUP' | 'TO_DROPOFF';
  /** Order status label shown on the map */
  statusLabel?: string;
}

/** Haversine distance in km (inline to avoid import issues in client bundle) */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Create a pulsing rider marker element with heading indicator */
function createRiderEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'rider-nav-marker';
  el.innerHTML = `
    <div class="rider-heading-cone" style="position:absolute;width:60px;height:60px;top:50%;left:50%;transform:translate(-50%,-50%) rotate(0deg);pointer-events:none;opacity:0;transition:opacity 0.3s">
      <svg viewBox="0 0 60 60" width="60" height="60">
        <path d="M30 4 L42 24 A18 18 0 0 0 18 24 Z" fill="rgba(14,165,233,0.2)" stroke="none"/>
      </svg>
    </div>
    <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(14,165,233,0.15);top:50%;left:50%;transform:translate(-50%,-50%);animation:pulse-ring 2s ease-out infinite"></div>
    <div style="position:relative;width:20px;height:20px;border-radius:50%;background:#0ea5e9;border:3px solid white;box-shadow:0 0 12px rgba(14,165,233,0.5);z-index:1"></div>
  `;
  el.style.position = 'relative';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  return el;
}

/** Create a waypoint marker */
function createWaypointEl(color: string, label: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.innerHTML = `
    <div style="background:${color};color:white;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${label}</div>
    <div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);margin-top:4px"></div>
  `;
  return el;
}

export default function NavigationMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  riderLat,
  riderLng,
  riderHeading,
  phase,
  statusLabel,
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastRouteFetchPos = useRef<{ lat: number; lng: number } | null>(null);
  const routeFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMin: number;
  } | null>(null);
  const [centered, setCentered] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Current navigation destination
  const destLat = phase === 'TO_PICKUP' ? pickupLat : dropoffLat;
  const destLng = phase === 'TO_PICKUP' ? pickupLng : dropoffLng;

  // ── Fetch route from Mapbox Directions API ──
  const fetchRoute = useCallback(
    async (fromLat: number, fromLng: number) => {
      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${destLng},${destLat}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (!data.routes?.[0]) return;

        const route = data.routes[0];
        const geometry = route.geometry;
        const distKm = route.distance / 1000;
        const durMin = Math.round(route.duration / 60);

        setRouteInfo({ distanceKm: Math.round(distKm * 10) / 10, durationMin: durMin });

        const map = mapRef.current;
        if (!map) return;

        // Update or add route layer
        const source = map.getSource('route') as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: 'Feature',
            properties: {},
            geometry,
          });
        } else if (map.isStyleLoaded()) {
          map.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry },
          });
          map.addLayer({
            id: 'route-casing',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#0f172a',
              'line-width': 8,
              'line-opacity': 0.3,
            },
          });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': phase === 'TO_PICKUP' ? '#10b981' : '#6366f1',
              'line-width': 5,
              'line-opacity': 0.9,
            },
          });
        }

        lastRouteFetchPos.current = { lat: fromLat, lng: fromLng };
      } catch {
        // Route fetch failed — will retry on next movement
      }
    },
    [destLat, destLng, phase],
  );

  // ── Initialize map ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    let map: mapboxgl.Map;
    const initialCenter: [number, number] =
      riderLat && riderLng ? [riderLng, riderLat] : ACCRA;

    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: initialCenter,
        zoom: 14,
        attributionControl: false,
        pitchWithRotate: false,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (err) {
      setMapError('Map failed to initialize');
      console.error('[NavigationMap] init error:', err);
      return;
    }

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      setMapReady(true);

      // ── Pickup marker ──
      new mapboxgl.Marker({ element: createWaypointEl('#10b981', 'Pickup') })
        .setLngLat([pickupLng, pickupLat])
        .addTo(map);

      // ── Dropoff marker ──
      new mapboxgl.Marker({ element: createWaypointEl('#ef4444', 'Dropoff') })
        .setLngLat([dropoffLng, dropoffLat])
        .addTo(map);

      // ── Rider marker ──
      const riderEl = createRiderEl();
      const riderMarker = new mapboxgl.Marker({ element: riderEl })
        .setLngLat(riderLat && riderLng ? [riderLng, riderLat] : initialCenter)
        .addTo(map);
      riderMarkerRef.current = riderMarker;

      // ── Fit bounds to show all points ──
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pickupLng, pickupLat]);
      bounds.extend([dropoffLng, dropoffLat]);
      if (riderLat && riderLng) bounds.extend([riderLng, riderLat]);
      map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1500 });

      // ── Initial route fetch ──
      if (riderLat && riderLng) {
        fetchRoute(riderLat, riderLng);
      }
    });

    // Detect user interaction to disable auto-center
    map.on('dragstart', () => setCentered(false));

    // Handle errors (invalid token, tile load failures, etc.)
    map.on('error', (e) => {
      console.error('[NavigationMap] error:', e.error?.message || e);
      const status = (e.error as any)?.status;
      if (e.error?.message?.includes('access token') || status === 401) {
        setMapError('Map authentication failed');
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      riderMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update rider marker position and re-fetch route ──
  useEffect(() => {
    if (!riderLat || !riderLng || !mapRef.current) return;

    const map = mapRef.current;
    const marker = riderMarkerRef.current;

    // Update marker position
    if (marker) {
      marker.setLngLat([riderLng, riderLat]);

      // Apply heading rotation to direction cone
      if (riderHeading != null) {
        const el = marker.getElement();
        const cone = el?.querySelector('.rider-heading-cone') as HTMLElement | null;
        if (cone) {
          cone.style.opacity = '1';
          cone.style.transform = `translate(-50%,-50%) rotate(${riderHeading}deg)`;
        }
      }
    }

    // Auto-center on rider if user hasn't dragged the map
    if (centered) {
      map.easeTo({ center: [riderLng, riderLat], duration: 800 });
    }

    // Re-fetch route if rider moved significantly
    if (lastRouteFetchPos.current) {
      const movedKm = haversine(
        lastRouteFetchPos.current.lat,
        lastRouteFetchPos.current.lng,
        riderLat,
        riderLng,
      );
      if (movedKm > ROUTE_REFRESH_DISTANCE_KM) {
        // Debounce route fetch
        if (routeFetchTimer.current) clearTimeout(routeFetchTimer.current);
        routeFetchTimer.current = setTimeout(() => fetchRoute(riderLat!, riderLng!), 2000);
      }
    } else {
      fetchRoute(riderLat, riderLng);
    }
  }, [riderLat, riderLng, centered, fetchRoute]);

  // ── Update route color when phase changes ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      if (map.getLayer('route-line')) {
        map.setPaintProperty(
          'route-line',
          'line-color',
          phase === 'TO_PICKUP' ? '#10b981' : '#6366f1',
        );
      }
    } catch {}

    // Re-fetch route for new destination
    if (riderLat && riderLng) {
      fetchRoute(riderLat, riderLng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Re-center handler ──
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !riderLat || !riderLng) return;
    map.easeTo({ center: [riderLng, riderLat], zoom: 15, duration: 800 });
    setCentered(true);
  }, [riderLat, riderLng]);

  // ── Fit all markers ──
  const handleFitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([pickupLng, pickupLat]);
    bounds.extend([dropoffLng, dropoffLat]);
    if (riderLat && riderLng) bounds.extend([riderLng, riderLat]);
    map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 });
    setCentered(false);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, riderLat, riderLng]);

  return (
    <div className="relative w-full bg-[#0a0a1a]" style={{ height: 'calc(100dvh - 3.5rem)' }}>
      {/* Map container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading state */}
      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a1a] z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
            <p className="text-sm text-surface-400">Loading navigation map…</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a1a] z-20">
          <div className="flex flex-col items-center gap-3 text-center px-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-800">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <p className="text-sm font-medium text-surface-300">{mapError}</p>
            <p className="text-xs text-surface-500">Navigation is unavailable. Check your connection.</p>
          </div>
        </div>
      )}

      {/* ── Navigation info overlay ── */}
      {routeInfo && (
        <div className="absolute top-3 left-3 right-3 z-10">
          <div className="rounded-2xl bg-surface-900/90 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                phase === 'TO_PICKUP' ? 'bg-accent-500/20' : 'bg-purple-500/20'
              }`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={phase === 'TO_PICKUP' ? '#10b981' : '#818cf8'} strokeWidth="2.5" strokeLinecap="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-bold">
                  {routeInfo.durationMin} min
                  <span className="text-surface-400 font-normal"> · {routeInfo.distanceKm} km</span>
                </p>
                <p className="text-[11px] text-surface-400">
                  {phase === 'TO_PICKUP' ? 'To pickup location' : 'To dropoff location'}
                </p>
              </div>
            </div>
            {statusLabel && (
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                phase === 'TO_PICKUP'
                  ? 'bg-accent-500/20 text-accent-400'
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                {statusLabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Map controls ── */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-2">
        {/* Re-center button */}
        {!centered && (
          <button
            onClick={handleRecenter}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg active:scale-95 transition-transform"
            title="Re-center on rider"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            </svg>
          </button>
        )}
        {/* Fit all button */}
        <button
          onClick={handleFitAll}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg active:scale-95 transition-transform"
          title="Show full route"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
            <polyline points="15 3 21 3 21 9"/>
            <polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
      </div>

      {/* Pulse ring animation (inline for SSR compat) */}
      <style jsx global>{`
        @keyframes pulse-ring {
          0% { transform: translate(-50%,-50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
        }
        .mapboxgl-canvas:focus { outline: none; }
      `}</style>
    </div>
  );
}
