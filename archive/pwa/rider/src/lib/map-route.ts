// ══════════════════════════════════════════════════════════
// Map Route & Traffic — Rider app route rendering engine
//
// Rider-specific variant with wider line widths for nav mode,
// delivery-phase color support, and turn-by-turn-ready layers.
//
// Google Maps JavaScript API:
// • Multi-polyline route rendering (shadow → border → glow → line)
// • Congestion-colored route segments
// • Built-in TrafficLayer for live traffic overlay
// • Proper polyline lifecycle management
// ══════════════════════════════════════════════════════════

import {
  ROUTE_COLORS,
  ROUTE_LINE_WIDTHS,
  MAP_PADDING,
  MAP_ZOOM,
} from '@riderguy/utils';

// ── GeoJSON inline types (avoid @types/geojson dependency) ──

type GeoJSONGeometry =
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] }
  | { type: string; coordinates: unknown };

// ── Types ───────────────────────────────────────────────

export interface RouteData {
  geometry: GeoJSONGeometry;
  duration: number;  // seconds
  distance: number;  // meters
  legs?: Array<{
    annotation?: {
      congestion?: string[];
      duration?: number[];
      distance?: number[];
    };
  }>;
}

export type RoutePhase = 'pickup' | 'delivery';

export interface DrawRouteOptions {
  /** Route phase determines color (blue → green) */
  phase?: RoutePhase;
  /** Override phase-based color */
  color?: string;
  fitBounds?: boolean;
  padding?: number | google.maps.Padding;
  /** Show congestion coloring (requires driving-traffic profile data) */
  showCongestion?: boolean;
}

// ── Rider-specific widths (1.3x wider for navigation view) ──

const NAV_WIDTHS = {
  shadow: Math.round(ROUTE_LINE_WIDTHS.shadow * 1.3),
  border: Math.round(ROUTE_LINE_WIDTHS.border * 1.3),
  glow: Math.round(ROUTE_LINE_WIDTHS.glow * 1.3),
  line: Math.round(ROUTE_LINE_WIDTHS.line * 1.3 * 10) / 10,
  congestionLine: Math.round(ROUTE_LINE_WIDTHS.congestionLine * 1.3),
} as const;

// ── Polyline State ──────────────────────────────────────

let routePolylines: google.maps.Polyline[] = [];
let congestionPolylines: google.maps.Polyline[] = [];
let trafficLayer: google.maps.TrafficLayer | null = null;

// ── GeoJSON → LatLng Path ───────────────────────────────

function geojsonToPath(geometry: GeoJSONGeometry): google.maps.LatLngLiteral[] {
  if (geometry.type === 'LineString') {
    return (geometry as { type: 'LineString'; coordinates: number[][] }).coordinates.map(
      (c) => ({ lat: c[1]!, lng: c[0]! }),
    );
  }
  if (geometry.type === 'MultiLineString') {
    return (geometry as { type: 'MultiLineString'; coordinates: number[][][] }).coordinates
      .flat()
      .map((c) => ({ lat: c[1]!, lng: c[0]! }));
  }
  return [];
}

// ── Route Drawing ───────────────────────────────────────

export function drawRoute(
  map: google.maps.Map,
  route: RouteData,
  options: DrawRouteOptions = {},
): void {
  // Clear existing route polylines
  for (const p of routePolylines) p.setMap(null);
  routePolylines = [];
  for (const p of congestionPolylines) p.setMap(null);
  congestionPolylines = [];

  const phase = options.phase ?? 'pickup';
  const color = options.color ?? (phase === 'delivery' ? ROUTE_COLORS.delivery : ROUTE_COLORS.primary);
  const path = geojsonToPath(route.geometry);
  if (path.length === 0) return;

  // Layer 1: Shadow
  routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: '#000000',
    strokeOpacity: 0.15,
    strokeWeight: NAV_WIDTHS.shadow,
    zIndex: 1,
  }));

  // Layer 2: Border
  routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: color,
    strokeOpacity: 0.3,
    strokeWeight: NAV_WIDTHS.border,
    zIndex: 2,
  }));

  // Layer 3: Glow
  routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: color,
    strokeOpacity: 0.5,
    strokeWeight: NAV_WIDTHS.glow,
    zIndex: 3,
  }));

  // Layer 4: Main line with direction arrows
  routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: color,
    strokeOpacity: 1,
    strokeWeight: NAV_WIDTHS.line,
    zIndex: 4,
    icons: [{
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 2.5,
        strokeColor: '#ffffff',
        strokeOpacity: 0.92,
        fillColor: '#ffffff',
        fillOpacity: 0.92,
      },
      offset: '0',
      repeat: '90px',
    }],
  }));

  // Congestion overlay
  if (options.showCongestion && route.legs?.[0]?.annotation?.congestion) {
    drawCongestionPolylines(map, route);
  }

  // Fit bounds to route
  if (options.fitBounds !== false) {
    fitRouteGeometry(map, route.geometry, options.padding);
  }
}

// ── Congestion Overlay ──────────────────────────────────

const CONGESTION_COLORS: Record<string, string> = {
  low: ROUTE_COLORS.congestion.low,
  moderate: ROUTE_COLORS.congestion.moderate,
  heavy: ROUTE_COLORS.congestion.heavy,
  severe: ROUTE_COLORS.congestion.severe,
};

function drawCongestionPolylines(map: google.maps.Map, route: RouteData): void {
  if (!route.legs?.[0]?.annotation?.congestion) return;
  const geometry = route.geometry;
  if (geometry.type !== 'LineString') return;

  const coords = (geometry as { type: 'LineString'; coordinates: number[][] }).coordinates;
  const congestion = route.legs[0].annotation.congestion;

  for (let i = 0; i < congestion.length && i < coords.length - 1; i++) {
    const level = congestion[i] ?? '';
    const segColor = CONGESTION_COLORS[level];
    if (!segColor) continue;

    congestionPolylines.push(new google.maps.Polyline({
      map,
      path: [
        { lat: coords[i]![1]!, lng: coords[i]![0]! },
        { lat: coords[i + 1]![1]!, lng: coords[i + 1]![0]! },
      ],
      strokeColor: segColor,
      strokeOpacity: 0.85,
      strokeWeight: NAV_WIDTHS.congestionLine,
      zIndex: 5,
    }));
  }
}

// ── Remove Route ────────────────────────────────────────

export function removeRoute(_map: google.maps.Map): void {
  for (const p of routePolylines) p.setMap(null);
  routePolylines = [];
  for (const p of congestionPolylines) p.setMap(null);
  congestionPolylines = [];
}

// ── Traffic Overlay ─────────────────────────────────────

export function addTrafficLayer(map: google.maps.Map): void {
  if (trafficLayer) return;
  trafficLayer = new google.maps.TrafficLayer();
  trafficLayer.setMap(map);
}

export function toggleTraffic(map: google.maps.Map, visible: boolean): void {
  if (trafficLayer) {
    trafficLayer.setMap(visible ? map : null);
  }
}

export function hasTrafficLayer(_map: google.maps.Map): boolean {
  return trafficLayer !== null;
}

// ── Bounds Fitting ──────────────────────────────────────

function fitRouteGeometry(
  map: google.maps.Map,
  geometry: GeoJSONGeometry,
  padding?: number | google.maps.Padding,
): void {
  const path = geojsonToPath(geometry);
  if (path.length === 0) return;

  const bounds = new google.maps.LatLngBounds();
  for (const p of path) bounds.extend(p);

  const padValue = typeof padding === 'number'
    ? padding
    : padding
      ? Math.max(
          (padding as google.maps.Padding).top ?? 0,
          (padding as google.maps.Padding).bottom ?? 0,
          (padding as google.maps.Padding).left ?? 0,
          (padding as google.maps.Padding).right ?? 0,
        )
      : MAP_PADDING.navigation;

  map.fitBounds(bounds, padValue);
}


