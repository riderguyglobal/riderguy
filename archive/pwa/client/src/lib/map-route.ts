// ══════════════════════════════════════════════════════════
// Map Route & Traffic — Client app route rendering engine
//
// Google Maps JavaScript API:
// • Multi-polyline route rendering (shadow, border, glow, line)
// • Congestion-colored route segments
// • Alternative route rendering (dashed)
// • Built-in TrafficLayer for live traffic overlay
// • Per-map state via WeakMap (multiple concurrent map instances safe)
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

// ── Per-map State (WeakMap for GC-safe multi-instance support) ──

interface MapRouteState {
  routePolylines: google.maps.Polyline[];
  congestionPolylines: google.maps.Polyline[];
  altRoutePolylines: google.maps.Polyline[];
  trafficLayer: google.maps.TrafficLayer | null;
}

const mapState = new WeakMap<google.maps.Map, MapRouteState>();

function getState(map: google.maps.Map): MapRouteState {
  if (!mapState.has(map)) {
    mapState.set(map, {
      routePolylines: [],
      congestionPolylines: [],
      altRoutePolylines: [],
      trafficLayer: null,
    });
  }
  return mapState.get(map)!;
}

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
  const state = getState(map);

  // Clear existing route polylines
  for (const p of state.routePolylines) p.setMap(null);
  state.routePolylines = [];
  for (const p of state.congestionPolylines) p.setMap(null);
  state.congestionPolylines = [];

  const color = options.color ?? ROUTE_COLORS.primary;
  const path = geojsonToPath(route.geometry);
  if (path.length === 0) return;

  // Layer 1: Shadow
  state.routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: '#000000',
    strokeOpacity: 0.12,
    strokeWeight: ROUTE_LINE_WIDTHS.shadow,
    zIndex: 1,
  }));

  // Layer 2: Border
  state.routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: color,
    strokeOpacity: 0.3,
    strokeWeight: ROUTE_LINE_WIDTHS.border,
    zIndex: 2,
  }));

  // Layer 3: Glow
  state.routePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: color,
    strokeOpacity: 0.5,
    strokeWeight: ROUTE_LINE_WIDTHS.glow,
    zIndex: 3,
  }));

  // Layer 4: Main line with direction arrows
  const arrowRepeat = path.length < 20 ? '80px'
    : path.length < 100 ? '120px'
    : path.length < 300 ? '160px'
    : '220px';

  state.routePolylines.push(new google.maps.Polyline({
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
    drawCongestionPolylines(map, route, state);
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

function drawCongestionPolylines(
  map: google.maps.Map,
  route: RouteData,
  state: MapRouteState,
): void {
  if (!route.legs?.[0]?.annotation?.congestion) return;
  const geometry = route.geometry;
  if (geometry.type !== 'LineString') return;

  const coords = (geometry as { type: 'LineString'; coordinates: number[][] }).coordinates;
  const congestion = route.legs[0].annotation.congestion;

  for (let i = 0; i < congestion.length && i < coords.length - 1; i++) {
    const level = congestion[i] ?? '';
    const segColor = CONGESTION_COLORS[level];
    if (!segColor) continue;

    state.congestionPolylines.push(new google.maps.Polyline({
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
  const state = getState(map);

  for (const p of state.altRoutePolylines) p.setMap(null);
  state.altRoutePolylines = [];

  const path = geojsonToPath(geometry);
  if (path.length === 0) return;

  state.altRoutePolylines.push(new google.maps.Polyline({
    map,
    path,
    strokeColor: '#000000',
    strokeOpacity: 0.06,
    strokeWeight: 10,
    zIndex: 0,
  }));

  state.altRoutePolylines.push(new google.maps.Polyline({
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

export function removeRoute(map: google.maps.Map): void {
  const state = getState(map);
  for (const p of state.routePolylines) p.setMap(null);
  state.routePolylines = [];
  for (const p of state.congestionPolylines) p.setMap(null);
  state.congestionPolylines = [];
}

export function removeAlternativeRoute(map: google.maps.Map): void {
  const state = getState(map);
  for (const p of state.altRoutePolylines) p.setMap(null);
  state.altRoutePolylines = [];
}

// ── Traffic Overlay ─────────────────────────────────────

export function addTrafficLayer(map: google.maps.Map): void {
  const state = getState(map);
  if (state.trafficLayer) return;
  state.trafficLayer = new google.maps.TrafficLayer();
  state.trafficLayer.setMap(map);
}

export function toggleTraffic(map: google.maps.Map, visible: boolean): void {
  const state = getState(map);
  if (state.trafficLayer) {
    state.trafficLayer.setMap(visible ? map : null);
  }
}

export function hasTrafficLayer(map: google.maps.Map): boolean {
  return getState(map).trafficLayer !== null;
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
