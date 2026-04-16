// ══════════════════════════════════════════════════════════
// NavigationMap — Advanced rider navigation HUD
//
// Full-featured navigation overlay built on Google Maps JS API:
// • Live ETA countdown + distance remaining
// • Turn-by-turn next maneuver card with directional icons
// • Speed indicator (km/h from GPS)
// • Phase-aware coloring (blue pickup, green delivery)
// • Heading-based camera rotation + navigation tilt
// • Auto-center with manual override + re-center button
// • Arrival proximity detection with visual alerts
// • Congestion-colored route with auto-refresh on drift
// • Traffic overlay toggle
// ══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { GOOGLE_MAPS_API_KEY, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/lib/constants';
import {
  ROUTE_COLORS,
  MAP_PADDING,
  MAP_ZOOM,
  ROUTE_REFRESH_DISTANCE_M,
  haversineDistance,
  formatPlusCode,
  formatDistance,
  formatDuration,
} from '@riderguy/utils';
import { useTheme } from '@/lib/theme';
import { initMapCore, switchMapStyle, fitBoundsToCoords, type MapCoreInstance } from '@/lib/map-core';
import {
  createPickupMarker,
  createDropoffMarker,
  createStopMarker,
  removeMarkers,
} from '@/lib/map-markers';
import {
  drawRoute,
  addTrafficLayer,
  toggleTraffic,
  hasTrafficLayer,
  type RoutePhase,
} from '@/lib/map-route';
import { useDirections, type DirectionsStep } from '@/hooks/use-directions';
import {
  Clock, Crosshair,
  ArrowUp, ArrowUpLeft, ArrowUpRight,
  CornerUpLeft, CornerUpRight,
  RotateCcw, RotateCw,
  MapPin, Navigation2,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────

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
  riderHeading?: number | null;
  riderSpeed?: number | null;
  status: string;
  className?: string;
  onEtaUpdate?: (eta: { duration: number; distance: number }) => void;
  onArrival?: () => void;
}

interface NavInfo {
  duration: number;
  distance: number;
  nextManeuver: { type: string; instruction: string } | null;
  nextStepDistance: number;
  stepsRemaining: number;
}

// ── Constants ───────────────────────────────────────────

const DELIVERY_STATUSES = new Set([
  'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF', 'DELIVERED',
]);

const ARRIVING_THRESHOLD_M = 200;
const ARRIVED_THRESHOLD_M = 50;
const MIN_ROUTE_REFRESH_MS = 30_000;
const HEADING_MIN_SPEED_MPS = 1.4;
const HEADING_MIN_CHANGE_DEG = 15;

const BIKE_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="m12 17.5 3.5-7 7 0"/><path d="M6.5 17.5 9 13l4.5 0 1-2"/></svg>`;

// ── Helpers ─────────────────────────────────────────────

function getRoutePhase(status: string): RoutePhase {
  return DELIVERY_STATUSES.has(status) ? 'delivery' : 'pickup';
}

function getPhaseColor(phase: RoutePhase): string {
  return phase === 'delivery' ? ROUTE_COLORS.delivery : ROUTE_COLORS.primary;
}

function formatSpeed(mps: number): string {
  return `${Math.round(mps * 3.6)}`;
}

function formatNavDistance(meters: number): string {
  return formatDistance(meters / 1000);
}

function formatNavDuration(seconds: number): string {
  if (seconds < 60) return '< 1 min';
  return formatDuration(seconds / 60);
}

// ── Navigation info computation ─────────────────────────

function computeNavInfo(
  steps: DirectionsStep[],
  riderLat: number,
  riderLng: number,
  totalDuration: number,
  totalDistance: number,
): NavInfo {
  if (!steps?.length) {
    return {
      duration: totalDuration,
      distance: totalDistance,
      nextManeuver: null,
      nextStepDistance: 0,
      stepsRemaining: 0,
    };
  }

  for (let i = 0; i < steps.length; i++) {
    const coords = steps[i]!.geometry.coordinates;
    if (!coords?.length) continue;
    const endCoord = coords[coords.length - 1]!;
    const distToEnd = haversineDistance(riderLat, riderLng, endCoord[1]!, endCoord[0]!) * 1000;

    if (distToEnd > 40) {
      const nextIdx = i + 1 < steps.length ? i + 1 : i;
      const nextStep = steps[nextIdx]!;

      let remainDuration = 0;
      let remainDistance = 0;
      for (let j = i; j < steps.length; j++) {
        remainDuration += steps[j]!.duration;
        remainDistance += steps[j]!.distance;
      }

      const startCoord = coords[0]!;
      const stepLen = haversineDistance(startCoord[1]!, startCoord[0]!, endCoord[1]!, endCoord[0]!) * 1000;
      if (stepLen > 0) {
        const progressRatio = Math.max(0, 1 - distToEnd / stepLen);
        remainDuration -= steps[i]!.duration * progressRatio;
        remainDistance -= steps[i]!.distance * progressRatio;
      }

      return {
        duration: Math.max(0, remainDuration),
        distance: Math.max(0, remainDistance),
        nextManeuver: nextStep.maneuver?.type
          ? {
              type: nextStep.maneuver.type,
              instruction: nextStep.maneuver.instruction || nextStep.name || 'Continue',
            }
          : null,
        nextStepDistance: distToEnd,
        stepsRemaining: steps.length - i,
      };
    }
  }

  return {
    duration: 0,
    distance: 0,
    nextManeuver: { type: 'ARRIVE', instruction: 'You have arrived' },
    nextStepDistance: 0,
    stepsRemaining: 0,
  };
}

// ── Maneuver Icon ───────────────────────────────────────

function ManeuverIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? 'h-5 w-5';
  switch (type) {
    case 'TURN_LEFT':
    case 'TURN_SHARP_LEFT':
      return <CornerUpLeft className={cls} />;
    case 'TURN_RIGHT':
    case 'TURN_SHARP_RIGHT':
      return <CornerUpRight className={cls} />;
    case 'TURN_SLIGHT_LEFT':
      return <ArrowUpLeft className={cls} />;
    case 'TURN_SLIGHT_RIGHT':
      return <ArrowUpRight className={cls} />;
    case 'UTURN_LEFT':
    case 'ROUNDABOUT_LEFT':
      return <RotateCcw className={cls} />;
    case 'UTURN_RIGHT':
    case 'ROUNDABOUT_RIGHT':
      return <RotateCw className={cls} />;
    case 'ARRIVE':
      return <MapPin className={cls} />;
    case 'DEPART':
      return <Navigation2 className={cls} />;
    default:
      return <ArrowUp className={cls} />;
  }
}

// ── Component ───────────────────────────────────────────

export function NavigationMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  stops,
  riderLat,
  riderLng,
  riderHeading,
  riderSpeed,
  status,
  className,
  onEtaUpdate,
  onArrival,
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MapCoreInstance | null>(null);
  const staticMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const riderMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const headingBeamRef = useRef<HTMLDivElement | null>(null);
  const lastRouteRiderRef = useRef<[number, number] | null>(null);
  const hasInitialRouteRef = useRef(false);
  const lastRouteRefreshRef = useRef(0);
  const lastHeadingRef = useRef(0);
  const arrivalFiredRef = useRef(false);
  const userPannedRef = useRef(false);

  const [trafficOn, setTrafficOn] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [userPanned, setUserPanned] = useState(false);
  const [navInfo, setNavInfo] = useState<NavInfo | null>(null);
  const [arriving, setArriving] = useState(false);

  const { resolvedTheme } = useTheme();
  const { route, fetchDirections, abort: abortDirections } = useDirections();

  const pickupCoords: [number, number] = [pickupLng, pickupLat];
  const dropoffCoords: [number, number] = [dropoffLng, dropoffLat];
  const phase = getRoutePhase(status);
  const phaseColor = getPhaseColor(phase);

  // ── Initialize map ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;

    (async () => {
      const style = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

      const core = await initMapCore({
        container: containerRef.current!,
        token: GOOGLE_MAPS_API_KEY,
        style,
        center: riderLat && riderLng ? [riderLng, riderLat] : pickupCoords,
        zoom: MAP_ZOOM.close,
        onLoad: (map) => {
          addTrafficLayer(map);
          map.setTilt(45);
          map.addListener('dragstart', () => {
            userPannedRef.current = true;
            setUserPanned(true);
          });
          setMapReady(true);
        },
      });

      if (cancelled) {
        core.destroy();
        return;
      }
      coreRef.current = core;
    })();

    return () => {
      cancelled = true;
      abortDirections();
      removeMarkers(staticMarkersRef.current);
      staticMarkersRef.current = [];
      if (riderMarkerRef.current) riderMarkerRef.current.map = null;
      riderMarkerRef.current = null;
      coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, []);

  // ── Theme switching ───────────────────────────────────
  useEffect(() => {
    const core = coreRef.current;
    if (!core || !mapReady) return;
    const style = resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
    switchMapStyle(core.map, style, {
      onStyleLoad: () => {
        if (trafficOn && !hasTrafficLayer(core.map)) addTrafficLayer(core.map);
      },
    });
  }, [resolvedTheme, mapReady]);

  // ── Static markers ────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const core = coreRef.current;
    if (!core) return;
    const { map } = core;

    removeMarkers(staticMarkersRef.current);
    staticMarkersRef.current = [];

    const pickupPC = formatPlusCode(pickupCoords[1], pickupCoords[0]);
    staticMarkersRef.current.push(
      createPickupMarker(map, pickupCoords, {
        popup: `Pickup<br/><span style="font-size:11px;opacity:0.7">${pickupPC.display}</span>`,
      }),
    );

    const dropoffPC = formatPlusCode(dropoffCoords[1], dropoffCoords[0]);
    staticMarkersRef.current.push(
      createDropoffMarker(map, dropoffCoords, {
        popup: `Dropoff<br/><span style="font-size:11px;opacity:0.7">${dropoffPC.display}</span>`,
      }),
    );

    if (stops?.length) {
      for (const stop of stops) {
        const stopPC = formatPlusCode(stop.latitude, stop.longitude);
        const label = stop.address ?? `Stop ${stop.sequence}`;
        staticMarkersRef.current.push(
          createStopMarker(map, [stop.longitude, stop.latitude], {
            popup: `${label}<br/><span style="font-size:11px;opacity:0.7">${stopPC.display}</span>`,
            label: String(stop.sequence),
          }),
        );
      }
    }

    if (!hasInitialRouteRef.current) {
      const boundsCoords: [number, number][] = [pickupCoords, dropoffCoords];
      if (stops?.length) {
        for (const s of stops) boundsCoords.push([s.longitude, s.latitude]);
      }
      if (riderLat != null && riderLng != null) boundsCoords.push([riderLng, riderLat]);
      fitBoundsToCoords(map, boundsCoords, MAP_PADDING.navigation);
    }
  }, [mapReady, pickupLat, pickupLng, dropoffLat, dropoffLng, stops]);

  // ── Create rider marker with heading beam ─────────────
  const createNavRiderMarker = useCallback(
    (map: google.maps.Map, lat: number, lng: number): google.maps.marker.AdvancedMarkerElement => {
      const el = document.createElement('div');
      el.className = 'rg-marker rider-nav';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Your position');
      el.innerHTML = `
        <div style="position:relative;width:72px;height:72px;display:flex;align-items:center;justify-content:center;">
          <div data-heading-beam style="
            position:absolute;top:50%;left:50%;
            width:40px;height:60px;
            transform-origin:bottom center;
            transform:translate(-50%,-100%) rotate(0deg);
            opacity:0;
            transition:opacity 0.3s,transform 0.5s ease-out;
          ">
            <svg width="40" height="60" viewBox="0 0 40 60" fill="none">
              <path d="M20 0 L35 55 Q20 45 5 55 Z" fill="${phaseColor}" fill-opacity="0.2"/>
            </svg>
          </div>
          <div class="rg-pulse" style="position:absolute;inset:6px;border-radius:50%;background:rgba(66,133,244,.18);"></div>
          <div style="
            position:relative;z-index:1;width:40px;height:40px;border-radius:50%;
            background:${phaseColor};
            border:3.5px solid white;
            box-shadow:0 2px 12px rgba(0,0,0,.4),0 0 0 1px rgba(0,0,0,.08);
            display:flex;align-items:center;justify-content:center;
          ">
            ${BIKE_SVG}
          </div>
        </div>
      `;

      headingBeamRef.current = el.querySelector('[data-heading-beam]') as HTMLDivElement;

      return new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat, lng },
        content: el,
      });
    },
    [phaseColor],
  );

  // ── Rider position + route fetching + auto-center ─────
  useEffect(() => {
    if (!mapReady) return;
    const core = coreRef.current;
    if (!core) return;
    const { map } = core;

    if (riderLat != null && riderLng != null) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.position = { lat: riderLat, lng: riderLng };
      } else {
        riderMarkerRef.current = createNavRiderMarker(map, riderLat, riderLng);
      }

      // Heading beam
      if (headingBeamRef.current && riderHeading != null) {
        const shouldRotate = riderSpeed != null && riderSpeed > HEADING_MIN_SPEED_MPS;
        if (shouldRotate) {
          headingBeamRef.current.style.opacity = '1';
          headingBeamRef.current.style.transform = `translate(-50%,-100%) rotate(${riderHeading}deg)`;
        } else {
          headingBeamRef.current.style.opacity = '0';
        }
      }

      // Auto-center + heading rotation
      if (!userPannedRef.current) {
        map.panTo({ lat: riderLat, lng: riderLng });

        if (
          riderHeading != null &&
          riderSpeed != null &&
          riderSpeed > HEADING_MIN_SPEED_MPS
        ) {
          const diff = Math.abs(riderHeading - lastHeadingRef.current);
          const normalizedDiff = diff > 180 ? 360 - diff : diff;
          if (normalizedDiff > HEADING_MIN_CHANGE_DEG) {
            map.setHeading(riderHeading);
            lastHeadingRef.current = riderHeading;
          }
        }
      }
    }

    // Route drawing
    const origin: [number, number] =
      riderLat != null && riderLng != null ? [riderLng, riderLat] : pickupCoords;
    const dest = phase === 'delivery' ? dropoffCoords : pickupCoords;

    if (origin[0] !== dest[0] || origin[1] !== dest[1]) {
      const lastPos = lastRouteRiderRef.current;
      const driftedEnough =
        !lastPos ||
        haversineDistance(origin[1], origin[0], lastPos[1], lastPos[0]) * 1000 > ROUTE_REFRESH_DISTANCE_M;

      const now = Date.now();
      const cooldownOk = !hasInitialRouteRef.current || now - lastRouteRefreshRef.current >= MIN_ROUTE_REFRESH_MS;
      const shouldRefresh = (!hasInitialRouteRef.current || driftedEnough) && cooldownOk;

      if (shouldRefresh) {
        lastRouteRefreshRef.current = now;

        fetchDirections(origin, dest).then((newRoute) => {
          if (!newRoute) return;
          drawRoute(
            map,
            {
              geometry: newRoute.geometry,
              duration: newRoute.duration,
              distance: newRoute.distance,
              legs: newRoute.legs,
            },
            {
              phase,
              showCongestion: true,
              fitBounds: !hasInitialRouteRef.current,
              padding: MAP_PADDING.navigation,
            },
          );
          lastRouteRiderRef.current = origin;
          hasInitialRouteRef.current = true;
        });
      }
    }
  }, [mapReady, riderLat, riderLng, riderHeading, riderSpeed, status, pickupLat, pickupLng, dropoffLat, dropoffLng, fetchDirections, createNavRiderMarker, phase]);

  // ── Nav info + arrival detection ──────────────────────
  useEffect(() => {
    if (!route || riderLat == null || riderLng == null) return;

    const steps = route.legs?.[0]?.steps ?? [];
    const info = computeNavInfo(steps, riderLat, riderLng, route.duration, route.distance);
    setNavInfo(info);
    onEtaUpdate?.({ duration: info.duration, distance: info.distance });

    const destLat = phase === 'delivery' ? dropoffLat : pickupLat;
    const destLng = phase === 'delivery' ? dropoffLng : pickupLng;
    const distToDest = haversineDistance(riderLat, riderLng, destLat, destLng) * 1000;

    setArriving(distToDest < ARRIVING_THRESHOLD_M);

    if (distToDest < ARRIVED_THRESHOLD_M && !arrivalFiredRef.current) {
      arrivalFiredRef.current = true;
      navigator.vibrate?.([100, 50, 100]);
      onArrival?.();
    }
  }, [route, riderLat, riderLng, phase, pickupLat, pickupLng, dropoffLat, dropoffLng, onEtaUpdate, onArrival]);

  // Reset arrival flag on phase change
  useEffect(() => {
    arrivalFiredRef.current = false;
  }, [phase]);

  // ── Traffic toggle ────────────────────────────────────
  useEffect(() => {
    const map = coreRef.current?.map;
    if (!map || !hasTrafficLayer(map)) return;
    toggleTraffic(map, trafficOn);
  }, [trafficOn]);

  // ── Handlers ──────────────────────────────────────────

  const handleRecenter = useCallback(() => {
    const map = coreRef.current?.map;
    if (!map || riderLat == null || riderLng == null) return;
    userPannedRef.current = false;
    setUserPanned(false);
    map.panTo({ lat: riderLat, lng: riderLng });
    map.setTilt(45);
    if (riderHeading != null && riderSpeed != null && riderSpeed > HEADING_MIN_SPEED_MPS) {
      map.setHeading(riderHeading);
    }
  }, [riderLat, riderLng, riderHeading, riderSpeed]);

  // ── Render ────────────────────────────────────────────

  const phaseLabel = phase === 'delivery' ? 'To Drop-off' : 'To Pickup';
  const showSpeed = riderSpeed != null && riderSpeed > 0.5;
  const showManeuver = navInfo?.nextManeuver && navInfo.nextStepDistance > 0 && !arriving;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className ?? 'w-full h-full'}`}>
      <div ref={containerRef} className="w-full h-full min-h-[200px]" />

      {/* ── Top overlay ── */}
      <div className="absolute top-3 inset-x-3 z-10 flex items-start justify-between pointer-events-none">
        <div
          className="pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-xl"
          style={{ background: 'rgba(0,0,0,0.6)', color: phaseColor }}
        >
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ background: phaseColor, boxShadow: `0 0 8px ${phaseColor}` }}
          />
          {phaseLabel}
        </div>

        {showSpeed && (
          <div
            className="pointer-events-auto flex flex-col items-center justify-center rounded-full shadow-lg backdrop-blur-xl"
            style={{
              width: 48,
              height: 48,
              background: 'rgba(0,0,0,0.6)',
              border: `2px solid ${phaseColor}40`,
            }}
          >
            <span className="text-sm font-bold text-white leading-none">
              {formatSpeed(riderSpeed!)}
            </span>
            <span className="text-[8px] text-white/60 font-medium leading-none mt-0.5">km/h</span>
          </div>
        )}
      </div>

      {/* ── Right control buttons ── */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2 pointer-events-none">
        {userPanned && (
          <button
            onClick={handleRecenter}
            className="pointer-events-auto h-10 w-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-xl transition-all animate-fade-in btn-press"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            aria-label="Re-center on rider"
          >
            <Crosshair className="h-4 w-4 text-white" />
          </button>
        )}

        <button
          onClick={() => setTrafficOn((p) => !p)}
          className="pointer-events-auto h-10 w-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-xl transition-all btn-press"
          style={{
            background: trafficOn ? `${phaseColor}30` : 'rgba(0,0,0,0.6)',
            border: trafficOn ? `1.5px solid ${phaseColor}60` : '1.5px solid transparent',
          }}
          aria-label={trafficOn ? 'Hide traffic' : 'Show traffic'}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke={trafficOn ? phaseColor : '#ffffff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="2" width="12" height="20" rx="2" />
            <circle cx="12" cy="7" r="1.5" fill={trafficOn ? '#ef4444' : 'none'} />
            <circle cx="12" cy="12" r="1.5" fill={trafficOn ? '#f59e0b' : 'none'} />
            <circle cx="12" cy="17" r="1.5" fill={trafficOn ? '#22c55e' : 'none'} />
          </svg>
        </button>
      </div>

      {/* ── Bottom navigation HUD ── */}
      {navInfo && (
        <div className="absolute bottom-3 inset-x-3 z-10 space-y-2 animate-slide-up pointer-events-none">
          {showManeuver && (
            <div
              className="pointer-events-auto rounded-2xl p-3 backdrop-blur-xl shadow-lg"
              style={{ background: 'rgba(0,0,0,0.7)', borderLeft: `3px solid ${phaseColor}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${phaseColor}20`, color: phaseColor }}
                >
                  <ManeuverIcon type={navInfo.nextManeuver!.type} className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium leading-none mb-1" style={{ color: phaseColor }}>
                    In {formatNavDistance(navInfo.nextStepDistance)}
                  </p>
                  <p className="text-sm font-semibold text-white truncate">
                    {navInfo.nextManeuver!.instruction}
                  </p>
                </div>
              </div>
            </div>
          )}

          {arriving && (
            <div
              className="pointer-events-auto rounded-2xl p-3 backdrop-blur-xl shadow-lg text-center animate-pulse-glow"
              style={{
                background: `${phaseColor}25`,
                border: `1.5px solid ${phaseColor}50`,
                boxShadow: `0 0 20px ${phaseColor}30`,
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: phaseColor }} />
                <span className="text-sm font-bold text-white">
                  {phase === 'delivery' ? 'Arriving at drop-off' : 'Arriving at pickup'}
                </span>
              </div>
            </div>
          )}

          <div
            className="pointer-events-auto rounded-2xl px-4 py-3 backdrop-blur-xl shadow-lg flex items-center justify-between"
            style={{
              background: arriving ? `${phaseColor}20` : 'rgba(0,0,0,0.7)',
              border: arriving ? `1.5px solid ${phaseColor}40` : '1.5px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/50" />
              <span className="text-lg font-bold text-white">
                {arriving ? 'Arriving' : formatNavDuration(navInfo.duration)}
              </span>
            </div>
            <div className="h-1 w-1 rounded-full bg-white/30" />
            <span className="text-sm font-semibold text-white/80">
              {formatNavDistance(navInfo.distance)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
