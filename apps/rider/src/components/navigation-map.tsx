'use client';

// ══════════════════════════════════════════════════════════
// NavigationMap — Active delivery navigation map
// Shows pickup/dropoff/stop markers, rider position dot,
// animated route, traffic overlay, ETA panel, and multi-stop
// support. Uses shared map utilities to eliminate duplication.
// ══════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, DEFAULT_CENTER, MAP_STYLE_LIGHT, MAP_STYLE_DARK, API_BASE_URL } from '@/lib/constants';
import { ROUTE_COLORS, ROUTE_REFRESH_DISTANCE_M, MAP_PADDING, MAP_ZOOM } from '@riderguy/utils';
import { useTheme } from '@/lib/theme';
import { tokenStorage } from '@riderguy/auth';
import { haversineDistance } from '@riderguy/utils';
import {
  createPickupMarker,
  createDropoffMarker,
  createStopMarker,
  createRiderMarker,
} from '@/lib/map-markers';
import {
  drawRoute,
  addTrafficLayer,
  toggleTraffic as toggleTrafficLayer,
  hasTrafficLayer as checkTraffic,
  fitBoundsToCoords,
} from '@/lib/map-route';
import { Navigation, Maximize2, Layers, Clock, MapPin } from 'lucide-react';

interface Stop {
  latitude: number;
  longitude: number;
  type: 'PICKUP' | 'DROPOFF';
  sequence: number;
  address?: string;
}

interface NavigationMapProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  stops?: Stop[];
  riderLat?: number;
  riderLng?: number;
  status: string;
  className?: string;
}

export function NavigationMap({
  pickupLat, pickupLng, dropoffLat, dropoffLng,
  stops, riderLat, riderLng, status, className = '',
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapboxglRef = useRef<any>(null);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastRoutePos = useRef<[number, number] | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showTraffic, setShowTraffic] = useState(true);
  const { resolvedTheme } = useTheme();
  const prevThemeRef = useRef(resolvedTheme);

  const isPickupPhase = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP'].includes(status);
  const destLat = isPickupPhase ? pickupLat : dropoffLat;
  const destLng = isPickupPhase ? pickupLng : dropoffLng;
  const routeColor = isPickupPhase ? ROUTE_COLORS.primary : ROUTE_COLORS.delivery;

  // ── Build waypoints coordinate string (for API) ───────
  const buildWaypointsCoords = useCallback((from: [number, number], to: [number, number]): string => {
    if (stops && stops.length > 0) {
      const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
      const waypoints = sorted.map((s) => `${s.longitude},${s.latitude}`);
      return [`${from[0]},${from[1]}`, ...waypoints, `${to[0]},${to[1]}`].join(';');
    }
    return `${from[0]},${from[1]};${to[0]},${to[1]}`;
  }, [stops]);

  // ── Fetch route from API and draw ─────────────────────
  const fetchRoute = useCallback(async (map: mapboxgl.Map, from: [number, number], to: [number, number]) => {
    try {
      const coordinates = buildWaypointsCoords(from, to);
      const url = `${API_BASE_URL}/orders/directions?coordinates=${encodeURIComponent(coordinates)}`;
      const token = tokenStorage.getAccessToken();
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const json = await res.json();
      const route = json.data?.routes?.[0];
      if (!route) return;

      setEta(Math.ceil(route.duration / 60));
      setDistance(Math.round(route.distance / 100) / 10);

      drawRoute(map, mapboxglRef.current, route, {
        color: routeColor,
        fitBounds: false, // We manage bounds separately
      });
    } catch (err) {
      console.error('[NavigationMap] Route fetch failed:', err);
    }
  }, [routeColor, buildWaypointsCoords]);

  // ── Theme switching ───────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !loaded) return;
    if (prevThemeRef.current === resolvedTheme) return;
    prevThemeRef.current = resolvedTheme;

    const map = mapRef.current;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();
    map.setStyle(resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT);

    map.once('style.load', () => {
      map.setCenter(center);
      map.setZoom(zoom);
      map.setBearing(bearing);
      map.setPitch(pitch);
      if (showTraffic) addTrafficLayer(map);
      if (lastRoutePos.current) {
        fetchRoute(map, lastRoutePos.current, [destLng, destLat]);
      }
    });
  }, [resolvedTheme, loaded, showTraffic, fetchRoute, destLng, destLat]);

  // ── Map initialization ────────────────────────────────
  useEffect(() => {
    let destroyed = false;
    if (!MAPBOX_TOKEN) {
      setMapError('Map token not configured');
      return;
    }

    (async () => {
      try {
        if (!containerRef.current || mapRef.current) return;

        const mapboxgl = (await import('mapbox-gl')).default;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        mapboxglRef.current = mapboxgl;

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
          center: [pickupLng, pickupLat],
          zoom: 13,
          attributionControl: true,
          antialias: true,
        });

        if (destroyed) { map.remove(); return; }
        mapRef.current = map;
        prevThemeRef.current = resolvedTheme;

        map.on('error', (e) => {
          console.error('[NavigationMap] Mapbox error:', e.error?.message ?? e);
        });

        if (containerRef.current) {
          resizeObserverRef.current = new ResizeObserver(() => mapRef.current?.resize());
          resizeObserverRef.current.observe(containerRef.current);
        }

        map.on('load', () => {
          if (destroyed) return;
          setLoaded(true);

          // Traffic
          addTrafficLayer(map);

          // Pickup + Dropoff markers (shared factories)
          createPickupMarker(mapboxgl, [pickupLng, pickupLat], map);
          createDropoffMarker(mapboxgl, [dropoffLng, dropoffLat], map);

          // Multi-stop waypoint markers
          if (stops && stops.length > 0) {
            const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
            sorted.forEach((stop, i) => {
              createStopMarker(mapboxgl, [stop.longitude, stop.latitude], map, i + 1, stop.type);
            });
          }

          // Fit bounds to all markers
          const allCoords: [number, number][] = [
            [pickupLng, pickupLat],
            [dropoffLng, dropoffLat],
          ];
          if (riderLat && riderLng) allCoords.push([riderLng, riderLat]);
          stops?.forEach((s) => allCoords.push([s.longitude, s.latitude]));
          fitBoundsToCoords(map, mapboxgl, allCoords, MAP_PADDING.route);

          // Initial route
          if (riderLat && riderLng) {
            fetchRoute(map, [riderLng, riderLat], [destLng, destLat]);
            lastRoutePos.current = [riderLng, riderLat];
          }
        });
      } catch (err) {
        console.error('[NavigationMap] Init failed:', err);
        setMapError('Failed to load map');
      }
    })();

    return () => {
      destroyed = true;
      resizeObserverRef.current?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update rider marker & refresh route on movement ───
  useEffect(() => {
    if (!mapRef.current || !mapboxglRef.current || !loaded || !riderLat || !riderLng) return;

    const mapboxgl = mapboxglRef.current;

    if (!riderMarkerRef.current) {
      riderMarkerRef.current = createRiderMarker(mapboxgl, [riderLng, riderLat], mapRef.current);
    } else {
      riderMarkerRef.current.setLngLat([riderLng, riderLat]);
    }

    // Refresh route if rider moved beyond threshold
    if (lastRoutePos.current) {
      const dist = haversineDistance(
        lastRoutePos.current[1], lastRoutePos.current[0],
        riderLat, riderLng,
      );
      if (dist > ROUTE_REFRESH_DISTANCE_M) {
        fetchRoute(mapRef.current, [riderLng, riderLat], [destLng, destLat]);
        lastRoutePos.current = [riderLng, riderLat];
      }
    } else {
      fetchRoute(mapRef.current, [riderLng, riderLat], [destLng, destLat]);
      lastRoutePos.current = [riderLng, riderLat];
    }
  }, [riderLat, riderLng, loaded, fetchRoute, destLat, destLng]);

  // ── Controls ──────────────────────────────────────────
  const handleToggleTraffic = useCallback(() => {
    if (!mapRef.current) return;
    const next = !showTraffic;
    setShowTraffic(next);
    if (!checkTraffic(mapRef.current)) {
      addTrafficLayer(mapRef.current);
    } else {
      toggleTrafficLayer(mapRef.current, next);
    }
  }, [showTraffic]);

  const recenter = () => {
    if (!mapRef.current || !riderLat || !riderLng) return;
    mapRef.current.flyTo({ center: [riderLng, riderLat], zoom: MAP_ZOOM.neighborhood, duration: 800 });
  };

  const fitAll = () => {
    if (!mapRef.current || !mapboxglRef.current) return;
    const allCoords: [number, number][] = [
      [pickupLng, pickupLat],
      [dropoffLng, dropoffLat],
    ];
    if (riderLat && riderLng) allCoords.push([riderLng, riderLat]);
    stops?.forEach((s) => allCoords.push([s.longitude, s.latitude]));
    fitBoundsToCoords(mapRef.current, mapboxglRef.current, allCoords, MAP_PADDING.route);
  };

  const phaseLabel = isPickupPhase ? 'To Pickup' : 'To Dropoff';

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {/* Loading shimmer */}
      {!loaded && !mapError && (
        <div className="absolute inset-0 rounded-2xl bg-page animate-shimmer bg-gradient-to-r from-page via-shimmer to-page" />
      )}

      {mapError && (
        <div className="absolute inset-0 rounded-2xl bg-page flex items-center justify-center">
          <p className="text-sm text-subtle">{mapError}</p>
        </div>
      )}

      {/* ETA panel — bottom left */}
      {eta !== null && (
        <div className="absolute bottom-3 left-3 map-info-panel rounded-2xl px-4 py-3 max-w-[200px]">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-muted" />
            <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">{phaseLabel}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-primary tabular-nums">{eta}</span>
            <span className="text-sm font-medium text-muted">min</span>
          </div>
          {distance !== null && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="h-3 w-3 text-subtle" />
              <span className="text-xs text-secondary font-medium tabular-nums">{distance} km</span>
            </div>
          )}
        </div>
      )}

      {/* Map controls — right side */}
      {loaded && (
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            onClick={handleToggleTraffic}
            className={`map-control-btn ${showTraffic ? 'map-control-active' : ''}`}
            aria-label="Toggle traffic"
          >
            <Layers className="h-5 w-5" />
          </button>
          <button onClick={fitAll} className="map-control-btn" aria-label="Fit all markers">
            <Maximize2 className="h-5 w-5" />
          </button>
          <button onClick={recenter} className="map-control-btn map-control-gps" aria-label="Recenter on rider">
            <Navigation className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
