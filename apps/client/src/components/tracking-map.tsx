'use client';

// ══════════════════════════════════════════════════════════
// TrackingMap — Advanced order tracking map with real-time
// rider position, route display, ETA, traffic, and controls
// ══════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE } from '@/lib/constants';
import { ROUTE_COLORS, MAP_PADDING, MAP_ZOOM, ROUTE_REFRESH_DISTANCE_M } from '@riderguy/utils';
import { haversineDistance } from '@riderguy/utils';
import { useDirections } from '@/hooks/use-directions';
import {
  createPickupMarker,
  createDropoffMarker,
  createRiderMarker,
} from '@/lib/map-markers';
import {
  drawRoute,
  addTrafficLayer,
  toggleTraffic,
  fitBoundsToCoords,
} from '@/lib/map-route';
import { Navigation, Maximize2, Layers, Clock, MapPin, Route } from 'lucide-react';

interface TrackingMapProps {
  pickupCoords: [number, number] | null;
  dropoffCoords: [number, number] | null;
  riderCoords: [number, number] | null;
  status: string;
}

export default function TrackingMap({
  pickupCoords,
  dropoffCoords,
  riderCoords,
  status,
}: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapboxglRef = useRef<any>(null);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastRiderRoutePos = useRef<[number, number] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const { fetchRoute } = useDirections();

  // Determine phase-aware route color
  const isPickupPhase = ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP'].includes(status);
  const routeColor = isPickupPhase ? ROUTE_COLORS.primary : ROUTE_COLORS.delivery;

  /** Fetch and draw route on the map */
  const drawRouteOnMap = useCallback(async (
    from: [number, number],
    to: [number, number],
  ) => {
    const map = mapRef.current;
    const mbgl = mapboxglRef.current;
    if (!map || !mbgl) return;

    const result = await fetchRoute([from, to]);
    if (!result) return;

    const primary = result.routes[0]!;
    drawRoute(map, mbgl, primary, { color: routeColor, fitBounds: false });
    setEta(result.eta);
    setDistance(result.distance);
  }, [fetchRoute, routeColor]);

  // ── Map initialization ────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!pickupCoords && !dropoffCoords) return;
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

        const center = dropoffCoords || pickupCoords || [0, 0];
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center,
          zoom: MAP_ZOOM.default,
          attributionControl: false,
        });

        mapRef.current = map;

        map.on('error', (e) => {
          console.error('[TrackingMap] Mapbox error:', e.error?.message ?? e);
        });

        // Resize observer
        if (containerRef.current) {
          resizeObserverRef.current = new ResizeObserver(() => mapRef.current?.resize());
          resizeObserverRef.current.observe(containerRef.current);
        }

        map.on('load', () => {
          if (cancelled) return;
          setLoaded(true);

          // Pickup marker
          if (pickupCoords) {
            createPickupMarker(mapboxgl, pickupCoords, map);
          }

          // Dropoff marker
          if (dropoffCoords) {
            createDropoffMarker(mapboxgl, dropoffCoords, map);
          }

          // Draw initial route
          if (pickupCoords && dropoffCoords) {
            const from = riderCoords || pickupCoords;
            drawRouteOnMap(from, isPickupPhase ? pickupCoords : dropoffCoords);
          }

          // Fit bounds to all points
          const allCoords: [number, number][] = [];
          if (pickupCoords) allCoords.push(pickupCoords);
          if (dropoffCoords) allCoords.push(dropoffCoords);
          if (riderCoords) allCoords.push(riderCoords);
          if (allCoords.length > 0) {
            fitBoundsToCoords(map, mapboxgl, allCoords, MAP_PADDING.route);
          }
        });
      } catch (err) {
        console.error('[TrackingMap] Init failed:', err);
        setMapError('Failed to load map');
      }
    })();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, dropoffCoords]);

  // ── Rider position tracking ───────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapboxglRef.current || !riderCoords || !loaded) return;
    const mapboxgl = mapboxglRef.current;
    const map = mapRef.current;

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLngLat(riderCoords);
    } else {
      riderMarkerRef.current = createRiderMarker(mapboxgl, riderCoords, map, {
        color: '#22c55e',
        withBike: true,
      });
    }

    // Re-draw route when rider moves > threshold
    const dest = isPickupPhase ? pickupCoords : dropoffCoords;
    if (dest) {
      if (!lastRiderRoutePos.current) {
        lastRiderRoutePos.current = riderCoords;
        drawRouteOnMap(riderCoords, dest);
      } else {
        const [pLng, pLat] = lastRiderRoutePos.current;
        const [cLng, cLat] = riderCoords;
        const dist = haversineDistance(pLat, pLng, cLat, cLng) * 1000; // km → m
        if (dist > ROUTE_REFRESH_DISTANCE_M) {
          drawRouteOnMap(riderCoords, dest);
          lastRiderRoutePos.current = riderCoords;
        }
      }
    }
  }, [riderCoords, loaded, pickupCoords, dropoffCoords, isPickupPhase, drawRouteOnMap]);

  // ── Controls ──────────────────────────────────────────
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

  const handleRecenter = () => {
    if (!mapRef.current || !mapboxglRef.current) return;
    const allCoords: [number, number][] = [];
    if (pickupCoords) allCoords.push(pickupCoords);
    if (dropoffCoords) allCoords.push(dropoffCoords);
    if (riderCoords) allCoords.push(riderCoords);
    fitBoundsToCoords(mapRef.current, mapboxglRef.current, allCoords, MAP_PADDING.route);
  };

  const handleFollowRider = () => {
    if (!mapRef.current || !riderCoords) return;
    mapRef.current.flyTo({ center: riderCoords, zoom: MAP_ZOOM.close, duration: 800 });
  };

  const phaseLabel = isPickupPhase ? 'To Pickup' : 'To Dropoff';

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" />

      {/* Shimmer loading */}
      {!loaded && !mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 rounded-2xl flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.06) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 rounded-xl brand-gradient flex items-center justify-center shadow-brand animate-pulse">
              <Route className="h-4 w-4 text-white" />
            </div>
            <p className="text-xs font-medium text-surface-400">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 rounded-2xl flex items-center justify-center">
          <p className="text-sm text-surface-500">{mapError}</p>
        </div>
      )}

      {/* ETA panel — bottom left */}
      {loaded && eta !== null && (
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg border border-surface-100 max-w-[200px]">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-surface-400" />
            <span className="text-[10px] text-surface-400 uppercase tracking-wider font-semibold">{phaseLabel}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-surface-900 tabular-nums">{eta}</span>
            <span className="text-sm font-medium text-surface-400">min</span>
          </div>
          {distance !== null && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="h-3 w-3 text-surface-300" />
              <span className="text-xs text-surface-500 font-medium tabular-nums">{distance} km</span>
            </div>
          )}
        </div>
      )}

      {/* Map controls — right side */}
      {loaded && (
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            onClick={handleToggleTraffic}
            className={`w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-surface-100 flex items-center justify-center transition-all hover:bg-surface-50 active:scale-95 ${showTrafficLayer ? 'text-blue-500' : 'text-surface-400'}`}
            aria-label="Toggle traffic"
          >
            <Layers className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={handleRecenter}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-surface-100 flex items-center justify-center text-surface-400 hover:bg-surface-50 active:scale-95 transition-all"
            aria-label="Fit all markers"
          >
            <Maximize2 className="h-4.5 w-4.5" />
          </button>
          {riderCoords && (
            <button
              onClick={handleFollowRider}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-surface-100 flex items-center justify-center text-surface-400 hover:bg-surface-50 active:scale-95 transition-all"
              aria-label="Follow rider"
            >
              <Navigation className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
