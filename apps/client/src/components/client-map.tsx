'use client';

// ══════════════════════════════════════════════════════════
// ClientMap — Dashboard map showing nearby online riders
// with real-time WebSocket updates and traffic overlay
// ══════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE, DEFAULT_CENTER, API_BASE_URL } from '@/lib/constants';
import { MAP_ZOOM, LOCATION_INTERVALS } from '@riderguy/utils';
import { tokenStorage } from '@riderguy/auth';
import { connectSocket, disconnectSocket } from '@/hooks/use-socket';
import { createSmallRiderMarker, createUserDotMarker } from '@/lib/map-markers';
import { addTrafficLayer, toggleTraffic } from '@/lib/map-route';
import { Layers, Bike } from 'lucide-react';

interface NearbyRider {
  id: string;
  latitude: number;
  longitude: number;
  firstName?: string;
}

export default function ClientMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapboxglRef = useRef<any>(null);
  const markerMapRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userCoordsRef = useRef<[number, number]>(DEFAULT_CENTER);
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [riderCount, setRiderCount] = useState(0);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);

  /** Fetch nearby riders from backend API */
  const fetchNearbyRiders = useCallback(async (): Promise<NearbyRider[]> => {
    try {
      const [lng, lat] = userCoordsRef.current;
      const url = `${API_BASE_URL}/riders/nearby?latitude=${lat}&longitude=${lng}&radius=5`;
      const token = tokenStorage.getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, { headers, credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    } catch {
      return [];
    }
  }, []);

  /** Update rider markers on the map */
  const updateRiderMarkers = useCallback((riders: NearbyRider[]) => {
    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl) return;

    setRiderCount(riders.length);
    const currentIds = new Set(riders.map(r => r.id));

    // Remove markers that are no longer nearby
    for (const [id, marker] of markerMapRef.current.entries()) {
      if (!currentIds.has(id)) {
        marker.remove();
        markerMapRef.current.delete(id);
      }
    }

    // Add or update markers
    for (const rider of riders) {
      const existing = markerMapRef.current.get(rider.id);
      if (existing) {
        existing.setLngLat([rider.longitude, rider.latitude]);
      } else {
        const marker = createSmallRiderMarker(
          mapboxgl, [rider.longitude, rider.latitude], map,
        );
        markerMapRef.current.set(rider.id, marker);
      }
    }
  }, []);

  // ── Map initialization ────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      setMapError('Map service not configured');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        if (cancelled || !containerRef.current) return;
        mapboxglRef.current = mapboxgl;
        mapboxgl.accessToken = MAPBOX_TOKEN;

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center: DEFAULT_CENTER,
          zoom: MAP_ZOOM.default,
          attributionControl: true,
          interactive: true,
          fadeDuration: 0,
          antialias: true,
        });

        mapRef.current = map;

        map.on('error', (e) => {
          console.error('[ClientMap] Mapbox error:', e.error?.message ?? e);
        });

        map.once('idle', () => map.resize());

        // Resize observer
        resizeObserverRef.current = new ResizeObserver(() => mapRef.current?.resize());
        if (containerRef.current) resizeObserverRef.current.observe(containerRef.current);

        map.on('load', async () => {
          if (cancelled) return;
          setLoaded(true);

          // Get user location before fetching riders
          await new Promise<void>((resolve) => {
            if (!navigator.geolocation) { resolve(); return; }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const { longitude: lng, latitude: lat } = pos.coords;
                userCoordsRef.current = [lng, lat];
                map.flyTo({ center: [lng, lat], zoom: MAP_ZOOM.default, duration: 1500 });

                // "You are here" dot
                if (!userMarkerRef.current) {
                  userMarkerRef.current = createUserDotMarker(mapboxgl, [lng, lat], map);
                }
                resolve();
              },
              () => resolve(),
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
            );
          });

          if (cancelled) return;

          // Fetch and display nearby riders
          const riders = await fetchNearbyRiders();
          updateRiderMarkers(riders);

          // Poll for updated positions
          pollIntervalRef.current = setInterval(async () => {
            const updated = await fetchNearbyRiders();
            updateRiderMarkers(updated);
          }, LOCATION_INTERVALS.nearbyPoll);
        });

        // Listen for live rider location updates via WebSocket
        try {
          const socket = connectSocket();
          socketRef.current = socket;
          socket.on('rider:location', (data: { riderId: string; latitude: number; longitude: number }) => {
            const existing = markerMapRef.current.get(data.riderId);
            if (existing) {
              existing.setLngLat([data.longitude, data.latitude]);
            } else if (mapRef.current && mapboxglRef.current) {
              const marker = createSmallRiderMarker(
                mapboxglRef.current, [data.longitude, data.latitude], mapRef.current,
              );
              markerMapRef.current.set(data.riderId, marker);
              setRiderCount(c => c + 1);
            }
          });
        } catch {
          // WebSocket optional — API polling still works
        }
      } catch (err) {
        console.error('[ClientMap] Failed to initialise map:', err);
        setMapError('Failed to load map');
      }
    })();

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      resizeObserverRef.current?.disconnect();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      markerMapRef.current.forEach(m => m.remove());
      markerMapRef.current.clear();
      // Properly disconnect socket
      try { disconnectSocket(); } catch { /* ignore */ }
      socketRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleTraffic = () => {
    if (!mapRef.current) return;
    const next = !showTrafficLayer;
    setShowTrafficLayer(next);
    if (next && !mapRef.current.getSource('rg-traffic')) {
      addTrafficLayer(mapRef.current);
    } else {
      toggleTraffic(mapRef.current, next);
    }
  };

  return (
    <div className="relative w-full h-full" style={{ minHeight: '300px' }}>
      <div ref={containerRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

      {/* Shimmer loading */}
      {!loaded && !mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.06) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-2xl brand-gradient flex items-center justify-center shadow-brand animate-pulse">
              <Bike className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs font-medium text-surface-400">Finding nearby riders...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 flex items-center justify-center">
          <p className="text-sm text-surface-500">{mapError}</p>
        </div>
      )}

      {/* Rider count badge + traffic toggle */}
      {loaded && (
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
          {riderCount > 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm border border-surface-200">
              <p className="text-xs font-semibold text-brand-600">
                {riderCount} rider{riderCount !== 1 ? 's' : ''} nearby
              </p>
            </div>
          ) : <div />}
          <button
            onClick={handleToggleTraffic}
            className={`w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-surface-200 flex items-center justify-center transition-all hover:bg-surface-50 active:scale-95 ${showTrafficLayer ? 'text-blue-500' : 'text-surface-400'}`}
            aria-label="Toggle traffic"
          >
            <Layers className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-surface-50 via-surface-50/80 to-transparent pointer-events-none" />
    </div>
  );
}
