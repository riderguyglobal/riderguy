'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ============================================================
// TrackingMap — Live order tracking map for the client app
//
// Features:
//   • Pickup (blue) and dropoff (green) markers with labels
//   • Animated route line via Mapbox Directions API
//   • Pulsing rider marker that updates from live socket data
//   • ETA overlay (distance + duration remaining)
//   • Re-center & fit-all controls
//   • Phase-aware: blue route before pickup, green after pickup
//   • Works in read-only mode when no rider yet (shows route preview)
// ============================================================

const ACCRA: [number, number] = [-0.1870, 5.6037];
const ROUTE_REFRESH_DISTANCE_KM = 0.1;

interface TrackingMapProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  riderLat: number | null;
  riderLng: number | null;
  /** 'WAITING' before rider assigned, 'TO_PICKUP' before pickup, 'TO_DROPOFF' after */
  phase: 'WAITING' | 'TO_PICKUP' | 'TO_DROPOFF';
  /** Optional status label e.g. "En route to pickup" */
  statusLabel?: string;
  /** Called when ETA info updates */
  onEtaUpdate?: (info: { distanceKm: number; durationMin: number } | null) => void;
}

/** Haversine distance in km */
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

/** Create pulsing rider marker element */
function createRiderEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'tracking-rider-marker';
  el.innerHTML = `
    <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(14,165,233,0.15);top:50%;left:50%;transform:translate(-50%,-50%);animation:tracking-pulse 2s ease-out infinite"></div>
    <div style="position:relative;width:20px;height:20px;border-radius:50%;background:#0ea5e9;border:3px solid white;box-shadow:0 0 12px rgba(14,165,233,0.5);z-index:1"></div>
  `;
  el.style.position = 'relative';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  return el;
}

/** Create a labeled waypoint marker */
function createWaypointEl(color: string, label: string, icon: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.innerHTML = `
    <div style="background:${color};color:white;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;gap:4px">
      ${icon}
      ${label}
    </div>
    <div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);margin-top:4px"></div>
  `;
  return el;
}

export default function TrackingMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  riderLat,
  riderLng,
  phase,
  statusLabel,
  onEtaUpdate,
}: TrackingMapProps) {
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

  // Destination changes based on phase
  const destLat = phase === 'TO_PICKUP' ? pickupLat : dropoffLat;
  const destLng = phase === 'TO_PICKUP' ? pickupLng : dropoffLng;

  // ── Fetch route from Mapbox Directions API ──
  const fetchRoute = useCallback(
    async (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!token) return;

      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?geometries=geojson&overview=full&access_token=${token}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (!data.routes?.[0]) return;

        const route = data.routes[0];
        const geometry = route.geometry;
        const distKm = route.distance / 1000;
        const durMin = Math.round(route.duration / 60);

        const info = { distanceKm: Math.round(distKm * 10) / 10, durationMin: durMin };
        setRouteInfo(info);
        onEtaUpdate?.(info);

        const map = mapRef.current;
        if (!map) return;

        const source = map.getSource('route') as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({ type: 'Feature', properties: {}, geometry });
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
            paint: { 'line-color': '#0f172a', 'line-width': 7, 'line-opacity': 0.15 },
          });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': phase === 'TO_PICKUP' ? '#0ea5e9' : '#22c55e',
              'line-width': 4,
              'line-opacity': 0.9,
            },
          });
        }

        lastRouteFetchPos.current = { lat: fromLat, lng: fromLng };
      } catch {
        // Route fetch failed — will retry on next movement
      }
    },
    [phase, onEtaUpdate],
  );

  // ── Initialize map ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const initialCenter: [number, number] =
      riderLat && riderLng ? [riderLng, riderLat] : [pickupLng, pickupLat];

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: initialCenter,
      zoom: 14,
      attributionControl: false,
      pitchWithRotate: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      // ── Pickup marker (blue) ──
      new mapboxgl.Marker({
        element: createWaypointEl(
          '#0ea5e9',
          'Pickup',
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
        ),
      })
        .setLngLat([pickupLng, pickupLat])
        .addTo(map);

      // ── Dropoff marker (green) ──
      new mapboxgl.Marker({
        element: createWaypointEl(
          '#22c55e',
          'Dropoff',
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/></svg>',
        ),
      })
        .setLngLat([dropoffLng, dropoffLat])
        .addTo(map);

      // ── Rider marker (only if rider assigned) ──
      if (phase !== 'WAITING') {
        const riderEl = createRiderEl();
        const riderMarker = new mapboxgl.Marker({ element: riderEl })
          .setLngLat(riderLat && riderLng ? [riderLng, riderLat] : [pickupLng, pickupLat])
          .addTo(map);
        riderMarkerRef.current = riderMarker;
      }

      // ── Fit bounds to show all points ──
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pickupLng, pickupLat]);
      bounds.extend([dropoffLng, dropoffLat]);
      if (riderLat && riderLng) bounds.extend([riderLng, riderLat]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1500 });

      // ── Initial route ──
      if (riderLat && riderLng && phase !== 'WAITING') {
        // Show route from rider to destination
        fetchRoute(riderLat, riderLng, destLat, destLng);
      } else {
        // Show route preview from pickup to dropoff
        fetchRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);
      }
    });

    map.on('dragstart', () => setCentered(false));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      riderMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update rider marker position ──
  useEffect(() => {
    if (!riderLat || !riderLng || !mapRef.current) return;
    if (phase === 'WAITING') return;

    const map = mapRef.current;
    const marker = riderMarkerRef.current;

    // If rider just got assigned but marker doesn't exist, create it
    if (!marker) {
      const riderEl = createRiderEl();
      const newMarker = new mapboxgl.Marker({ element: riderEl })
        .setLngLat([riderLng, riderLat])
        .addTo(map);
      riderMarkerRef.current = newMarker;
    } else {
      marker.setLngLat([riderLng, riderLat]);
    }

    // Auto-center
    if (centered) {
      map.easeTo({ center: [riderLng, riderLat], duration: 800 });
    }

    // Re-fetch route if rider moved 100m+
    if (lastRouteFetchPos.current) {
      const movedKm = haversine(
        lastRouteFetchPos.current.lat,
        lastRouteFetchPos.current.lng,
        riderLat,
        riderLng,
      );
      if (movedKm > ROUTE_REFRESH_DISTANCE_KM) {
        if (routeFetchTimer.current) clearTimeout(routeFetchTimer.current);
        routeFetchTimer.current = setTimeout(
          () => fetchRoute(riderLat!, riderLng!, destLat, destLng),
          2000,
        );
      }
    } else {
      fetchRoute(riderLat, riderLng, destLat, destLng);
    }
  }, [riderLat, riderLng, centered, fetchRoute, phase, destLat, destLng]);

  // ── Update route color when phase changes ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      if (map.getLayer('route-line')) {
        map.setPaintProperty(
          'route-line',
          'line-color',
          phase === 'TO_PICKUP' ? '#0ea5e9' : '#22c55e',
        );
      }
    } catch {}

    // Re-fetch route for new destination
    if (riderLat && riderLng && phase !== 'WAITING') {
      fetchRoute(riderLat, riderLng, destLat, destLng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Re-center on rider ──
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (riderLat && riderLng) {
      map.easeTo({ center: [riderLng, riderLat], zoom: 15, duration: 800 });
    } else {
      map.easeTo({ center: [pickupLng, pickupLat], zoom: 15, duration: 800 });
    }
    setCentered(true);
  }, [riderLat, riderLng, pickupLat, pickupLng]);

  // ── Fit all markers ──
  const handleFitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([pickupLng, pickupLat]);
    bounds.extend([dropoffLng, dropoffLat]);
    if (riderLat && riderLng) bounds.extend([riderLng, riderLat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });
    setCentered(false);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, riderLat, riderLng]);

  // Determine route color and label for overlay
  const routeColor = phase === 'TO_PICKUP' ? '#0ea5e9' : '#22c55e';
  const phaseLabel =
    phase === 'WAITING'
      ? 'Searching for rider…'
      : phase === 'TO_PICKUP'
        ? 'Rider heading to pickup'
        : 'Package on its way';

  return (
    <div className="relative w-full" style={{ height: '260px' }}>
      {/* Map container */}
      <div ref={containerRef} className="absolute inset-0 rounded-none" />

      {/* ── ETA overlay ── */}
      {routeInfo && phase !== 'WAITING' && (
        <div className="absolute top-3 left-3 right-14 z-10">
          <div className="rounded-2xl bg-white/90 backdrop-blur-md px-3 py-2.5 flex items-center gap-3 shadow-lg border border-surface-100">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: `${routeColor}20` }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={routeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-surface-900">
                {routeInfo.durationMin} min
                <span className="text-surface-400 font-normal text-xs"> · {routeInfo.distanceKm} km</span>
              </p>
              <p className="text-[11px] text-surface-500 truncate">
                {statusLabel || phaseLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Waiting overlay (no rider yet) ── */}
      {phase === 'WAITING' && (
        <div className="absolute top-3 left-3 right-14 z-10">
          <div className="rounded-2xl bg-white/90 backdrop-blur-md px-3 py-2.5 flex items-center gap-3 shadow-lg border border-surface-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-surface-900">Finding your rider</p>
              <p className="text-[11px] text-surface-500">Route preview shown</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Map controls ── */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        {!centered && (
          <button
            onClick={handleRecenter}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg border border-surface-100 active:scale-95 transition-transform"
            title="Re-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>
        )}
        <button
          onClick={handleFitAll}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg border border-surface-100 active:scale-95 transition-transform"
          title="Show full route"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>

      {/* Pulse animation */}
      <style jsx global>{`
        @keyframes tracking-pulse {
          0% { transform: translate(-50%,-50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
        }
        .mapboxgl-canvas:focus { outline: none; }
      `}</style>
    </div>
  );
}
