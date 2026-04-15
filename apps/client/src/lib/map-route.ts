// ══════════════════════════════════════════════════════════
// Map Route & Traffic — Client app route rendering engine
//
// Google Maps JavaScript API:
// • Multi-polyline route rendering (shadow, border, glow, line)
// • Congestion-colored route segments
// • Alternative route rendering (dashed)
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

export interface DrawRouteOptions {
  color?: string;
  fitBounds?: boolean;
  padding?: number | google.maps.Padding;
  showCongestion?: boolean;
  animationDuration?: number;
}

// ── Polyline State ──────────────────────────────────────

let routePolylines: google.maps.Polyline[] = [];
let congestionPolylines: google.maps.Polyline[] = [];
let altRoutePolylines: google.maps.Polyline[] = [];
let trafficLayer: google.maps.TrafficLayer | null = null;

// ── GeoJSON to LatLng Path ──────────────────────────────

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

  const color = options.color ?? ROUTE_COLORS.primary;
  const path = geojsonToPath(route.geometry);
  if (path.length === 0) return;

  // Layer 1: Shadow
  routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: '#000000',
    strokeOpacity: 0.12,
    strokeWeight: ROUTE_LINE_WIDTHS.shadow,
    zIndex: 1,
  }));

  // Layer 2: Border
  routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: color,
    strokeOpacity: 0.3,
    strokeWeight: ROUTE_LINE_WIDTHS.border,
    zIndex: 2,
  }));

  // Layer 3: Glow
  routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: color,
    strokeOpacity: 0.5,
    strokeWeight: ROUTE_LINE_WIDTHS.glow,
    zIndex: 3,
  }));

  // Layer 4: Main line with direction arrows
  // Scale arrow repeat interval based on route length to avoid
  // cluttering short routes or starving long ones
  const arrowRepeat = path.length < 20 ? '80px'
    : path.length < 100 ? '120px'
    : path.length < 300 ? '160px'
    : '220px';

  routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: color,
    strokeOpacity: 1,
    strokeWeight: ROUTE_LINE_WIDTHS.line,
    zIndex: 4,
    icons: [{
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 2,
        strokeColor: '#ffffff',
        strokeOpacity: 0.92,
        fillColor: '#ffffff',
        fillOpacity: 0.92,
      },
      offset: '0',
      repeat: arrowRepeat,
    }],
  }));

  // Congestion overlay
  if (options.showCongestion && route.legs?.[0]?.annotation?.congestion) {
    drawCongestionPolylines(map, route);
  }

  // Fit bounds
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
      strokeOpacity: 0.8,
      strokeWeight: ROUTE_LINE_WIDTHS.congestionLine,
      zIndex: 5,
    }));
  }
}

// ── Alternative Route ───────────────────────────────────

export function drawAlternativeRoute(
  map: google.maps.Map,
  geometry: GeoJSONGeometry,
): void {
  // Clear previous alt route
  for (const p of altRoutePolylines) p.setMap(null);
  altRoutePolylines = [];

  const path = geojsonToPath(geometry);
  if (path.length === 0) return;

  // Shadow
  altRoutePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: '#000000',
    strokeOpacity: 0.06,
    strokeWeight: 10,
    zIndex: 0,
  }));

  // Dashed line
  altRoutePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: ROUTE_COLORS.completed,
    strokeOpacity: 0.6,
    strokeWeight: ROUTE_LINE_WIDTHS.alternative,
    zIndex: 0,
    icons: [{
      icon: {
        path: 'M 0,-1 0,1',
        strokeOpacity: 0.6,
        scale: 3,
      },
      offset: '0',
      repeat: '12px',
    }],
  }));
}

// ── Remove Routes ───────────────────────────────────────

export function removeRoute(_map: google.maps.Map): void {
  for (const p of routePolylines) p.setMap(null);
  routePolylines = [];
  for (const p of congestionPolylines) p.setMap(null);
  congestionPolylines = [];
}

export function removeAlternativeRoute(_map: google.maps.Map): void {
  for (const p of altRoutePolylines) p.setMap(null);
  altRoutePolylines = [];
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
      : MAP_PADDING.route;

  map.fitBounds(bounds, padValue);
}

export function fitBoundsToCoords(
  map: google.maps.Map,
  coords: [number, number][],
  padding?: number | google.maps.Padding,
): void {
  if (coords.length === 0) return;
  if (coords.length === 1) {
    map.panTo({ lat: coords[0]![1], lng: coords[0]![0] });
    map.setZoom(MAP_ZOOM.close);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  for (const c of coords) {
    bounds.extend({ lat: c[1], lng: c[0] });
  }
  const padValue = typeof padding === 'number'
    ? padding
    : padding
      ? Math.max(
          (padding as google.maps.Padding).top ?? 0,
          (padding as google.maps.Padding).bottom ?? 0,
          (padding as google.maps.Padding).left ?? 0,
          (padding as google.maps.Padding).right ?? 0,
        )
      : MAP_PADDING.route;

  map.fitBounds(bounds, padValue);
}
