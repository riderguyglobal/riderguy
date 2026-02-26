'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE, DEFAULT_CENTER, API_BASE_URL } from '@/lib/constants';
import { tokenStorage } from '@riderguy/auth';
import { connectSocket } from '@/hooks/use-socket';

interface NearbyRider {
  id: string;
  latitude: number;
  longitude: number;
  firstName?: string;
}

/**
 * Client dashboard map — shows real nearby online riders.
 * Fetches rider positions from the API and listens to WebSocket
 * for live location updates.
 */
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
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [riderCount, setRiderCount] = useState(0);

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
    const currentIds = new Set(riders.map((r) => r.id));

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
        const el = document.createElement('div');
        el.className = 'rider-marker-wrapper';
        el.innerHTML = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:-4px;border-radius:14px;background:rgba(34,197,94,0.12);animation:pulse-ring 2.5s ease-out infinite;"></div>
            <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;background:linear-gradient(135deg,#22c55e,#4ade80);box-shadow:0 2px 8px rgba(34,197,94,0.35);border:2px solid white;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18.5" cy="17.5" r="3.5"/>
                <circle cx="5.5" cy="17.5" r="3.5"/>
                <circle cx="15" cy="5" r="1"/>
                <path d="m12 17.5 2-4.5h3l1.5-5"/>
                <path d="M5.5 17.5 8 12l4-1V7"/>
              </svg>
            </div>
          </div>`;
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([rider.longitude, rider.latitude])
          .addTo(map);
        markerMapRef.current.set(rider.id, marker);
      }
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Token guard
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
          zoom: 14,
          attributionControl: false,
          interactive: true,
          fadeDuration: 0,
        });

        mapRef.current = map;

        // Error handler
        map.on('error', (e) => {
          console.error('[ClientMap] Mapbox error:', e.error?.message ?? e);
        });

        // Force resize after first idle to ensure canvas fills container
        map.once('idle', () => {
          map.resize();
        });

        // Resize observer
        resizeObserverRef.current = new ResizeObserver(() => {
          mapRef.current?.resize();
        });
        resizeObserverRef.current.observe(containerRef.current);

        map.on('load', async () => {
          if (cancelled) return;
          setLoaded(true);

          // Resolve user location BEFORE fetching nearby riders so we
          // send the real coordinates instead of DEFAULT_CENTER.
          await new Promise<void>((resolve) => {
            if (!navigator.geolocation) {
              console.warn('[ClientMap] Geolocation API not available');
              resolve();
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const { longitude: lng, latitude: lat } = pos.coords;
                userCoordsRef.current = [lng, lat];
                map.flyTo({ center: [lng, lat], zoom: 14, duration: 1500 });

                // Add "You are here" blue dot marker
                if (!userMarkerRef.current && mapboxglRef.current) {
                  const el = document.createElement('div');
                  el.innerHTML = `
                    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
                      <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(59,130,246,0.15);animation:pulse-ring 2.5s ease-out infinite;"></div>
                      <div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 8px rgba(59,130,246,0.5);"></div>
                    </div>`;
                  userMarkerRef.current = new mapboxglRef.current.Marker({ element: el, anchor: 'center' })
                    .setLngLat([lng, lat])
                    .addTo(map);
                }
                resolve();
              },
              (err) => {
                console.warn('[ClientMap] Geolocation unavailable:', err.message);
                resolve(); // fall back to DEFAULT_CENTER
              },
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
            );
          });

          if (cancelled) return;

          // Fetch nearby riders using the (now-resolved) user coordinates
          const riders = await fetchNearbyRiders();
          updateRiderMarkers(riders);

          // Poll for updated positions every 15 seconds
          pollIntervalRef.current = setInterval(async () => {
            const updated = await fetchNearbyRiders();
            updateRiderMarkers(updated);
          }, 15_000);
        });

        // Listen for live rider location updates via WebSocket
        try {
          const socket = connectSocket();
          socket.on('rider:location', (data: { riderId: string; latitude: number; longitude: number }) => {
            const existing = markerMapRef.current.get(data.riderId);
            if (existing) {
              existing.setLngLat([data.longitude, data.latitude]);
            } else if (mapRef.current && mapboxglRef.current) {
              // New rider came online — create their marker immediately
              const el = document.createElement('div');
              el.className = 'rider-marker-wrapper';
              el.innerHTML = `
                <div style="position:relative;display:flex;align-items:center;justify-content:center;">
                  <div style="position:absolute;inset:-4px;border-radius:14px;background:rgba(34,197,94,0.12);animation:pulse-ring 2.5s ease-out infinite;"></div>
                  <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;background:linear-gradient(135deg,#22c55e,#4ade80);box-shadow:0 2px 8px rgba(34,197,94,0.35);border:2px solid white;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="18.5" cy="17.5" r="3.5"/>
                      <circle cx="5.5" cy="17.5" r="3.5"/>
                      <circle cx="15" cy="5" r="1"/>
                      <path d="m12 17.5 2-4.5h3l1.5-5"/>
                      <path d="M5.5 17.5 8 12l4-1V7"/>
                    </svg>
                  </div>
                </div>`;
              const marker = new mapboxglRef.current.Marker({ element: el, anchor: 'center' })
                .setLngLat([data.longitude, data.latitude])
                .addTo(mapRef.current);
              markerMapRef.current.set(data.riderId, marker);
              setRiderCount((c) => c + 1);
            }
          });
        } catch {
          // WebSocket is optional — API polling still works
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
      markerMapRef.current.forEach((m) => m.remove());
      markerMapRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-full" style={{ minHeight: '300px' }}>
      <div ref={containerRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

      {/* Shimmer loading */}
      {!loaded && !mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.06) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
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

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 flex items-center justify-center">
          <p className="text-sm text-surface-500">{mapError}</p>
        </div>
      )}

      {/* Rider count badge */}
      {loaded && riderCount > 0 && (
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm border border-surface-200">
          <p className="text-xs font-semibold text-brand-600">{riderCount} rider{riderCount !== 1 ? 's' : ''} nearby</p>
        </div>
      )}

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-surface-50 via-surface-50/80 to-transparent pointer-events-none" />
    </div>
  );
}
