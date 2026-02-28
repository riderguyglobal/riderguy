// ══════════════════════════════════════════════════════════
// Map Route Layers — Professional multi-layer route rendering
// and traffic overlay management for Mapbox GL maps
// ══════════════════════════════════════════════════════════

import type mapboxgl from 'mapbox-gl';
import { ROUTE_COLORS, MAP_PADDING, MAP_ZOOM } from '@riderguy/utils';

// ── Route Layer IDs ─────────────────────────────────────

const ROUTE_LAYERS = {
  shadow: 'rg-route-shadow',
  border: 'rg-route-border',
  glow: 'rg-route-glow',
  line: 'rg-route-line',
} as const;

const ALT_ROUTE_LAYERS = {
  shadow: 'rg-alt-shadow',
  line: 'rg-alt-line',
} as const;

const TRAFFIC_SOURCE = 'rg-traffic';
const TRAFFIC_LAYER = 'rg-traffic-flow';
const ROUTE_SOURCE = 'rg-route';
const ALT_ROUTE_SOURCE = 'rg-alt-route';

// ── Route Rendering ─────────────────────────────────────

export interface RouteData {
  geometry: GeoJSON.Geometry;
  duration: number;  // seconds
  distance: number;  // meters
}

/**
 * Add or update a route on the map with Google Maps-style multi-layer rendering.
 * Layers: shadow → border → glow → main line (4 layers for depth)
 */
export function drawRoute(
  map: mapboxgl.Map,
  mapboxgl: typeof import('mapbox-gl').default,
  route: RouteData,
  options: {
    color?: string;
    fitBounds?: boolean;
    padding?: mapboxgl.PaddingOptions | number;
    animate?: boolean;
  } = {},
): void {
  const color = options.color ?? ROUTE_COLORS.primary;
  const geojson: GeoJSON.Feature = {
    type: 'Feature',
    geometry: route.geometry,
    properties: {},
  };

  if (map.getSource(ROUTE_SOURCE)) {
    // Update existing route data
    (map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource).setData(geojson);
    // Update colors for phase changes
    if (map.getLayer(ROUTE_LAYERS.border)) map.setPaintProperty(ROUTE_LAYERS.border, 'line-color', color);
    if (map.getLayer(ROUTE_LAYERS.glow)) map.setPaintProperty(ROUTE_LAYERS.glow, 'line-color', color);
    if (map.getLayer(ROUTE_LAYERS.line)) map.setPaintProperty(ROUTE_LAYERS.line, 'line-color', color);
  } else {
    // Add new route source + layers
    map.addSource(ROUTE_SOURCE, { type: 'geojson', data: geojson });

    // Layer 1: Shadow (depth effect)
    map.addLayer({
      id: ROUTE_LAYERS.shadow,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': 'rgba(0,0,0,0.12)', 'line-width': 14, 'line-blur': 4 },
    });

    // Layer 2: Border (white outline effect)
    map.addLayer({
      id: ROUTE_LAYERS.border,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': 10, 'line-opacity': 0.3 },
    });

    // Layer 3: Glow
    map.addLayer({
      id: ROUTE_LAYERS.glow,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': 7, 'line-opacity': 0.5 },
    });

    // Layer 4: Main line
    map.addLayer({
      id: ROUTE_LAYERS.line,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': 4.5, 'line-opacity': 1 },
    });
  }

  // Fit bounds to route
  if (options.fitBounds !== false) {
    fitRouteGeometry(map, mapboxgl, route.geometry, options.padding);
  }
}

/** Draw an alternative/secondary route (gray, dashed) */
export function drawAlternativeRoute(
  map: mapboxgl.Map,
  geometry: GeoJSON.Geometry,
): void {
  const geojson: GeoJSON.Feature = { type: 'Feature', geometry, properties: {} };

  if (map.getSource(ALT_ROUTE_SOURCE)) {
    (map.getSource(ALT_ROUTE_SOURCE) as mapboxgl.GeoJSONSource).setData(geojson);
  } else {
    map.addSource(ALT_ROUTE_SOURCE, { type: 'geojson', data: geojson });

    map.addLayer({
      id: ALT_ROUTE_LAYERS.shadow,
      type: 'line',
      source: ALT_ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': 'rgba(0,0,0,0.06)', 'line-width': 10, 'line-blur': 3 },
    });

    map.addLayer({
      id: ALT_ROUTE_LAYERS.line,
      type: 'line',
      source: ALT_ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ROUTE_COLORS.completed,
        'line-width': 4,
        'line-opacity': 0.6,
        'line-dasharray': [2, 3],
      },
    });
  }
}

/** Remove route from map */
export function removeRoute(map: mapboxgl.Map): void {
  for (const id of Object.values(ROUTE_LAYERS)) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
}

/** Remove alternative route from map */
export function removeAlternativeRoute(map: mapboxgl.Map): void {
  for (const id of Object.values(ALT_ROUTE_LAYERS)) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(ALT_ROUTE_SOURCE)) map.removeSource(ALT_ROUTE_SOURCE);
}

// ── Traffic Layer ───────────────────────────────────────

/**
 * Add Google Maps-style colored traffic overlay.
 * Green (low) → Yellow (moderate) → Orange (heavy) → Red (severe)
 */
export function addTrafficLayer(map: mapboxgl.Map): void {
  if (map.getSource(TRAFFIC_SOURCE)) return;

  map.addSource(TRAFFIC_SOURCE, {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-traffic-v1',
  });

  // Find the first label/symbol layer to insert traffic below
  const layers = map.getStyle().layers ?? [];
  let beforeId: string | undefined;
  for (const layer of layers) {
    if (layer.id.includes('label') || layer.id.includes('symbol')) {
      beforeId = layer.id;
      break;
    }
  }

  map.addLayer({
    id: TRAFFIC_LAYER,
    type: 'line',
    source: TRAFFIC_SOURCE,
    'source-layer': 'traffic',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': [
        'match', ['get', 'congestion'],
        'low', '#4caf50',
        'moderate', '#ffb300',
        'heavy', '#ff6f00',
        'severe', '#d50000',
        'rgba(0,0,0,0)',
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 3, 16, 5, 20, 10],
      'line-opacity': 0.6,
      'line-offset': ['interpolate', ['linear'], ['zoom'], 7, 0, 12, 1, 16, 2],
    },
    minzoom: 7,
  }, beforeId);
}

/** Toggle traffic layer visibility */
export function toggleTraffic(map: mapboxgl.Map, visible: boolean): void {
  if (map.getLayer(TRAFFIC_LAYER)) {
    map.setLayoutProperty(TRAFFIC_LAYER, 'visibility', visible ? 'visible' : 'none');
  }
}

/** Check if traffic layer exists */
export function hasTrafficLayer(map: mapboxgl.Map): boolean {
  return !!map.getSource(TRAFFIC_SOURCE);
}

// ── Bounds Fitting ──────────────────────────────────────

/** Fit map to a route geometry */
function fitRouteGeometry(
  map: mapboxgl.Map,
  mapboxgl: typeof import('mapbox-gl').default,
  geometry: GeoJSON.Geometry,
  padding?: mapboxgl.PaddingOptions | number,
): void {
  if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') return;
  const coords = geometry.type === 'LineString'
    ? geometry.coordinates as [number, number][]
    : (geometry.coordinates as [number, number][][]).flat();
  if (coords.length === 0) return;

  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new mapboxgl.LngLatBounds(coords[0]!, coords[0]!),
  );
  map.fitBounds(bounds, {
    padding: padding ?? MAP_PADDING.route,
    maxZoom: MAP_ZOOM.routeFit,
    duration: 1000,
  });
}

/** Fit map to an array of [lng, lat] coordinates */
export function fitBoundsToCoords(
  map: mapboxgl.Map,
  mapboxgl: typeof import('mapbox-gl').default,
  coords: [number, number][],
  padding?: mapboxgl.PaddingOptions | number,
): void {
  if (coords.length === 0) return;
  if (coords.length === 1) {
    map.flyTo({ center: coords[0], zoom: MAP_ZOOM.close, duration: 800 });
    return;
  }
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new mapboxgl.LngLatBounds(coords[0]!, coords[0]!),
  );
  map.fitBounds(bounds, {
    padding: padding ?? MAP_PADDING.route,
    maxZoom: MAP_ZOOM.routeFit,
    duration: 1000,
  });
}

// ── Re-export layer IDs for external usage ──────────────
export { ROUTE_LAYERS, TRAFFIC_LAYER, ROUTE_SOURCE };
