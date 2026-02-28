// ══════════════════════════════════════════════════════════
// Map Route & Traffic — Rider app route rendering engine
//
// Rider-specific variant with wider line widths for nav mode,
// delivery-phase color support, and turn-by-turn-ready layers.
//
// Full Mapbox GL JS v3.19 layer management:
// • Multi-layer route rendering (shadow → border → glow → line)
// • Congestion-colored route segments (driving-traffic data)
// • Traffic overlay (mapbox-traffic-v1 vector tileset)
// • Proper source/layer lifecycle management
// ══════════════════════════════════════════════════════════

import type mapboxgl from 'mapbox-gl';
import {
  ROUTE_COLORS,
  ROUTE_LINE_WIDTHS,
  ROUTE_LAYER_IDS,
  TRAFFIC_IDS,
  MAP_PADDING,
  MAP_ZOOM,
  MAP_ANIMATION,
} from '@riderguy/utils';

// ── Types ───────────────────────────────────────────────

export interface RouteData {
  geometry: GeoJSON.Geometry;
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
  padding?: mapboxgl.PaddingOptions | number;
  /** Show congestion coloring (requires driving-traffic profile data) */
  showCongestion?: boolean;
}

// ── Rider-specific widths (1.3× wider for navigation view) ──

const NAV_WIDTHS = {
  shadow: Math.round(ROUTE_LINE_WIDTHS.shadow * 1.3),   // 18
  border: Math.round(ROUTE_LINE_WIDTHS.border * 1.3),   // 13
  glow: Math.round(ROUTE_LINE_WIDTHS.glow * 1.3),       // 9
  line: Math.round(ROUTE_LINE_WIDTHS.line * 1.3 * 10) / 10, // 5.9
  congestionLine: Math.round(ROUTE_LINE_WIDTHS.congestionLine * 1.3), // 8
} as const;

// ── Route Drawing ───────────────────────────────────────

/**
 * Draw a route on the rider's navigation map.
 * Uses wider line widths optimized for the tilted navigation perspective.
 */
export function drawRoute(
  map: mapboxgl.Map,
  mapboxgl: typeof import('mapbox-gl').default,
  route: RouteData,
  options: DrawRouteOptions = {},
): void {
  const phase = options.phase ?? 'pickup';
  const color = options.color ?? (phase === 'delivery' ? ROUTE_COLORS.delivery : ROUTE_COLORS.primary);

  const geojson: GeoJSON.Feature = {
    type: 'Feature',
    geometry: route.geometry,
    properties: {},
  };

  if (map.getSource(ROUTE_LAYER_IDS.source)) {
    (map.getSource(ROUTE_LAYER_IDS.source) as mapboxgl.GeoJSONSource).setData(geojson);
    if (map.getLayer(ROUTE_LAYER_IDS.border)) map.setPaintProperty(ROUTE_LAYER_IDS.border, 'line-color', color);
    if (map.getLayer(ROUTE_LAYER_IDS.glow)) map.setPaintProperty(ROUTE_LAYER_IDS.glow, 'line-color', color);
    if (map.getLayer(ROUTE_LAYER_IDS.line)) map.setPaintProperty(ROUTE_LAYER_IDS.line, 'line-color', color);
  } else {
    map.addSource(ROUTE_LAYER_IDS.source, { type: 'geojson', data: geojson });

    // Layer 1: Shadow
    map.addLayer({
      id: ROUTE_LAYER_IDS.shadow,
      type: 'line',
      source: ROUTE_LAYER_IDS.source,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': 'rgba(0,0,0,0.15)',
        'line-width': NAV_WIDTHS.shadow,
        'line-blur': 5,
      },
    });

    // Layer 2: Border
    map.addLayer({
      id: ROUTE_LAYER_IDS.border,
      type: 'line',
      source: ROUTE_LAYER_IDS.source,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-width': NAV_WIDTHS.border,
        'line-opacity': 0.3,
      },
    });

    // Layer 3: Glow
    map.addLayer({
      id: ROUTE_LAYER_IDS.glow,
      type: 'line',
      source: ROUTE_LAYER_IDS.source,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-width': NAV_WIDTHS.glow,
        'line-opacity': 0.5,
      },
    });

    // Layer 4: Main line
    map.addLayer({
      id: ROUTE_LAYER_IDS.line,
      type: 'line',
      source: ROUTE_LAYER_IDS.source,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-width': NAV_WIDTHS.line,
        'line-opacity': 1,
      },
    });
  }

  // Layer 5: Congestion overlay
  if (options.showCongestion && route.legs?.[0]?.annotation?.congestion) {
    drawCongestionLayer(map, route);
  }

  // Fit bounds to route
  if (options.fitBounds !== false) {
    fitRouteGeometry(map, mapboxgl, route.geometry, options.padding);
  }
}

/** Draw congestion-colored segments over the route */
function drawCongestionLayer(map: mapboxgl.Map, route: RouteData): void {
  if (!route.legs?.[0]?.annotation?.congestion) return;

  const geometry = route.geometry;
  if (geometry.type !== 'LineString') return;

  const coords = (geometry as GeoJSON.LineString).coordinates;
  const congestion = route.legs[0].annotation.congestion;

  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < congestion.length && i < coords.length - 1; i++) {
    features.push({
      type: 'Feature',
      properties: { congestion: congestion[i] },
      geometry: {
        type: 'LineString',
        coordinates: [coords[i]!, coords[i + 1]!],
      },
    });
  }

  const sourceId = ROUTE_LAYER_IDS.source + '-congestion';
  const layerId = ROUTE_LAYER_IDS.congestion;

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features,
    });
  } else {
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': [
          'match', ['get', 'congestion'],
          'low', ROUTE_COLORS.congestion.low,
          'moderate', ROUTE_COLORS.congestion.moderate,
          'heavy', ROUTE_COLORS.congestion.heavy,
          'severe', ROUTE_COLORS.congestion.severe,
          'rgba(0,0,0,0)',
        ],
        'line-width': NAV_WIDTHS.congestionLine,
        'line-opacity': 0.85,
      },
    });
  }
}

/** Remove route layers and sources */
export function removeRoute(map: mapboxgl.Map): void {
  const layers = [
    ROUTE_LAYER_IDS.congestion,
    ROUTE_LAYER_IDS.line,
    ROUTE_LAYER_IDS.glow,
    ROUTE_LAYER_IDS.border,
    ROUTE_LAYER_IDS.shadow,
  ];
  for (const id of layers) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  const sources = [ROUTE_LAYER_IDS.source, ROUTE_LAYER_IDS.source + '-congestion'];
  for (const id of sources) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

// ── Traffic Overlay ─────────────────────────────────────

/** Add real-time traffic overlay for rider navigation */
export function addTrafficLayer(map: mapboxgl.Map): void {
  if (map.getSource(TRAFFIC_IDS.source)) return;

  map.addSource(TRAFFIC_IDS.source, {
    type: 'vector',
    url: TRAFFIC_IDS.tilesetUrl,
  });

  const layers = map.getStyle().layers ?? [];
  let beforeId: string | undefined;
  for (const layer of layers) {
    if (layer.id.includes('label') || layer.id.includes('symbol')) {
      beforeId = layer.id;
      break;
    }
  }

  map.addLayer({
    id: TRAFFIC_IDS.layer,
    type: 'line',
    source: TRAFFIC_IDS.source,
    'source-layer': TRAFFIC_IDS.sourceLayer,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': [
        'match', ['get', 'congestion'],
        'low', ROUTE_COLORS.congestion.low,
        'moderate', ROUTE_COLORS.congestion.moderate,
        'heavy', ROUTE_COLORS.congestion.heavy,
        'severe', ROUTE_COLORS.congestion.severe,
        'rgba(0,0,0,0)',
      ],
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        7, 1,
        12, 3,
        16, 6,
        20, 12,
      ],
      'line-opacity': 0.55,
      'line-offset': [
        'interpolate', ['linear'], ['zoom'],
        7, 0,
        12, 1,
        16, 2,
      ],
    },
    minzoom: MAP_ZOOM.minTraffic,
  }, beforeId);
}

/** Toggle traffic layer visibility */
export function toggleTraffic(map: mapboxgl.Map, visible: boolean): void {
  if (map.getLayer(TRAFFIC_IDS.layer)) {
    map.setLayoutProperty(TRAFFIC_IDS.layer, 'visibility', visible ? 'visible' : 'none');
  }
}

/** Check if traffic layer exists */
export function hasTrafficLayer(map: mapboxgl.Map): boolean {
  return !!map.getSource(TRAFFIC_IDS.source);
}

// ── Bounds Fitting ──────────────────────────────────────

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
    padding: padding ?? MAP_PADDING.navigation,
    maxZoom: MAP_ZOOM.routeFit,
    duration: MAP_ANIMATION.fitBounds,
  });
}

/** Fit map to coordinate array */
export function fitBoundsToCoords(
  map: mapboxgl.Map,
  mapboxgl: typeof import('mapbox-gl').default,
  coords: [number, number][],
  padding?: mapboxgl.PaddingOptions | number,
): void {
  if (coords.length === 0) return;
  if (coords.length === 1) {
    map.flyTo({ center: coords[0], zoom: MAP_ZOOM.close, duration: MAP_ANIMATION.flyToFast });
    return;
  }
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new mapboxgl.LngLatBounds(coords[0]!, coords[0]!),
  );
  map.fitBounds(bounds, {
    padding: padding ?? MAP_PADDING.navigation,
    maxZoom: MAP_ZOOM.routeFit,
    duration: MAP_ANIMATION.fitBounds,
  });
}
