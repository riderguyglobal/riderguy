'use client';

// ══════════════════════════════════════════════════════════
// RoutePreviewMap — Interactive route preview for the Send
// Package page. Shows pickup/dropoff markers with animated
// route, distance, ETA, and dynamically updates as locations
// are changed. Provides visual confirmation before placing
// an order.
// ══════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE } from '@/lib/constants';
import { ROUTE_COLORS, MAP_PADDING, MAP_ZOOM } from '@riderguy/utils';
import { useDirections } from '@/hooks/use-directions';
import {
  createPickupMarker,
  createDropoffMarker,
} from '@/lib/map-markers';
import {
  drawRoute,
  fitBoundsToCoords,
  addTrafficLayer,
  toggleTraffic,
} from '@/lib/map-route';
import { Clock, MapPin, Layers, Route as RouteIcon } from 'lucide-react';

interface RoutePreviewMapProps {
  /** Pickup coordinates [lng, lat] */
  pickupCoords: [number, number] | null;
  /** Dropoff coordinates [lng, lat] */
  dropoffCoords: [number, number] | null;
  /** Additional CSS class */
  className?: string;
  /** Callback with route info when route is fetched */
  onRouteInfo?: (info: { eta: number; distance: number } | null) => void;
}

export default function RoutePreviewMap({
  pickupCoords,
  dropoffCoords,
  className = '',
  onRouteInfo,
}: RoutePreviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapboxglRef = useRef<any>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const { fetchRoute, cancel: cancelRoute } = useDirections();

  const hasPickup = !!pickupCoords;
  const hasDropoff = !!dropoffCoords;
  const hasBoth = hasPickup && hasDropoff;

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

        const center = pickupCoords || dropoffCoords || [-0.187, 5.603];
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center,
          zoom: MAP_ZOOM.default,
          attributionControl: false,
          interactive: true,
        });

        mapRef.current = map;

        map.on('error', (e) => {
          console.error('[RoutePreview] Mapbox error:', e.error?.message ?? e);
        });

        if (containerRef.current) {
          resizeObserverRef.current = new ResizeObserver(() => mapRef.current?.resize());
          resizeObserverRef.current.observe(containerRef.current);
        }

        map.on('load', () => {
          if (cancelled) return;
          setLoaded(true);
        });
      } catch (err) {
        console.error('[RoutePreview] Init failed:', err);
        setMapError('Failed to load map');
      }
    })();

    return () => {
      cancelled = true;
      cancelRoute();
      resizeObserverRef.current?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update markers and route when coordinates change ──
  const updateMap = useCallback(async () => {
    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl || !loaded) return;

    // Update pickup marker
    if (pickupCoords) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLngLat(pickupCoords);
      } else {
        pickupMarkerRef.current = createPickupMarker(mapboxgl, pickupCoords, map);
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    // Update dropoff marker
    if (dropoffCoords) {
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setLngLat(dropoffCoords);
      } else {
        dropoffMarkerRef.current = createDropoffMarker(mapboxgl, dropoffCoords, map);
      }
    } else if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
      dropoffMarkerRef.current = null;
    }

    // Fit bounds
    const allCoords: [number, number][] = [];
    if (pickupCoords) allCoords.push(pickupCoords);
    if (dropoffCoords) allCoords.push(dropoffCoords);
    if (allCoords.length > 0) {
      fitBoundsToCoords(map, mapboxgl, allCoords, MAP_PADDING.compact);
    }

    // Fetch and draw route when both coords are set
    if (pickupCoords && dropoffCoords) {
      setRouteLoading(true);
      const result = await fetchRoute([pickupCoords, dropoffCoords]);
      setRouteLoading(false);

      if (result && result.routes[0]) {
        drawRoute(map, mapboxgl, result.routes[0], {
          color: ROUTE_COLORS.primary,
          fitBounds: true,
          padding: MAP_PADDING.compact,
        });
        setEta(result.eta);
        setDistance(result.distance);
        onRouteInfo?.({ eta: result.eta, distance: result.distance });
      }
    } else {
      // Clear route info if either coordinate is missing
      setEta(null);
      setDistance(null);
      onRouteInfo?.(null);
    }
  }, [pickupCoords, dropoffCoords, loaded, fetchRoute, onRouteInfo]);

  useEffect(() => {
    updateMap();
  }, [updateMap]);

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

  // Don't render if no coordinates at all
  if (!hasPickup && !hasDropoff) return null;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-surface-200 ${className}`} style={{ minHeight: '200px' }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading shimmer */}
      {!loaded && !mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.06) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 rounded-xl brand-gradient flex items-center justify-center shadow-brand animate-pulse">
              <RouteIcon className="h-4 w-4 text-white" />
            </div>
            <p className="text-xs font-medium text-surface-400">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 flex items-center justify-center">
          <p className="text-sm text-surface-500">{mapError}</p>
        </div>
      )}

      {/* Route info pill — bottom center */}
      {loaded && hasBoth && eta !== null && !routeLoading && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-surface-100 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-brand-500" />
            <span className="text-sm font-bold text-surface-900 tabular-nums">{eta} min</span>
          </div>
          {distance !== null && (
            <>
              <div className="w-px h-4 bg-surface-200" />
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-surface-400" />
                <span className="text-sm font-medium text-surface-600 tabular-nums">{distance} km</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Route loading indicator */}
      {loaded && routeLoading && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-surface-100">
          <p className="text-xs text-surface-400 animate-pulse">Calculating route...</p>
        </div>
      )}

      {/* Traffic toggle */}
      {loaded && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={handleToggleTraffic}
            className={`w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-surface-200 flex items-center justify-center transition-all hover:bg-surface-50 active:scale-95 ${showTrafficLayer ? 'text-blue-500' : 'text-surface-400'}`}
            aria-label="Toggle traffic"
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Waiting for second location hint */}
      {loaded && !hasBoth && (hasPickup || hasDropoff) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-surface-100">
          <p className="text-xs text-surface-400">
            {hasPickup ? 'Add dropoff to see route' : 'Add pickup to see route'}
          </p>
        </div>
      )}
    </div>
  );
}
