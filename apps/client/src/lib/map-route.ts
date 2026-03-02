// ══════════════════════════════════════════════════════════
// Map Route & Traffic — Client app route rendering engine
//
// Full Mapbox GL JS v3.19 layer management:
// • Multi-layer route rendering (shadow → border → glow → line)
// • Congestion-colored route segments (driving-traffic data)
// • Alternative route rendering (dashed)
// • Traffic overlay (mapbox-traffic-v1 vector tileset)
// • Route animation support
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
  /** Congestion annotations per leg segment (from Directions API) */
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
  padding?: mapboxgl.PaddingOptions | number;
  /** Show congestion coloring on route (requires driving-traffic profile data) */
  showCongestion?: boolean;
  /** Animation duration in ms (0 = no animation) */
  animationDuration?: number;
}

// ── Arrow Image ─────────────────────────────────────────

/**
 * Load a chevron arrow image into the map style for directional indicators.
 * Uses an SDF (signed distance field) image so `icon-color` paint works.
 */
function ensureArrowImage(map: mapboxgl.Map): void {
  if (map.hasImage(ROUTE_LAYER_IDS.arrowImage)) return;

  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Draw a right-pointing chevron (>) — Mapbox rotates it to follow the line
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 3);
  ctx.lineTo(18, 12);
  ctx.lineTo(6, 21);
  ctx.lineTo(9, 12);
  ctx.closePath();
  ctx.fill();

  const imageData = ctx.getImageData(0, 0, size, size);
  map.addImage(ROUTE_LAYER_IDS.arrowImage, imageData, { sdf: true });
}

// ── Route Drawing ───────────────────────────────────────

/**
 * Draw a route on the map with Google Maps-style multi-layer rendering.
 *
 * Layer stack (bottom to top):
 * 1. Shadow — provides depth/elevation effect
 * 2. Border — color halo at lower opacity
 * 3. Glow — mid-opacity color spread
 * 4. Line — the crisp main route line
 * 5. Congestion — optional colored segments for traffic
 */
export function drawRoute(
  map: mapboxgl.Map,
  mapboxgl: typeof import('mapbox-gl').default,
  route: RouteData,
  options: DrawRouteOptions = {},
): void {
  const color = options.color ?? ROUTE_COLORS.primary;
  const geojson: GeoJSON.Feature = {
    type: 'Feature',
    geometry: route.geometry,
    properties: {},
  };

  if (map.getSource(ROUTE_LAYER_IDS.source)) {
    // Update existing source data
    (map.getSource(ROUTE_LAYER_IDS.source) as mapboxgl.GeoJSONSource).setData(geojson);
    // Update colors for phase transitions
    if (map.getLayer(ROUTE_LAYER_IDS.border)) map.setPaintProperty(ROUTE_LAYER_IDS.border, 'line-color', color);
    if (map.getLayer(ROUTE_LAYER_IDS.glow)) map.setPaintProperty(ROUTE_LAYER_IDS.glow, 'line-color', color);
    if (map.getLayer(ROUTE_LAYER_IDS.line)) map.setPaintProperty(ROUTE_LAYER_IDS.line, 'line-color', color);
  } else {
    // Create source + all layers
    map.addSource(ROUTE_LAYER_IDS.source, { type: 'geojson', data: geojson });

    // Layer 1: Shadow
    map.addLayer({
      id: ROUTE_LAYER_IDS.shadow,
      type: 'line',
      source: ROUTE_LAYER_IDS.source,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': 'rgba(0,0,0,0.12)',
        'line-width': ROUTE_LINE_WIDTHS.shadow,
        'line-blur': 4,
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
        'line-width': ROUTE_LINE_WIDTHS.border,
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
        'line-width': ROUTE_LINE_WIDTHS.glow,
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
        'line-width': ROUTE_LINE_WIDTHS.line,
        'line-opacity': 1,
      },
    });

    // Layer 5: Directional arrows along route
    ensureArrowImage(map);
    map.addLayer({
      id: ROUTE_LAYER_IDS.arrow,
      type: 'symbol',
      source: ROUTE_LAYER_IDS.source,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 100,
        'icon-image': ROUTE_LAYER_IDS.arrowImage,
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          10, 0.5,
          14, 0.7,
          18, 0.85,
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
      },
      paint: {
        'icon-color': '#ffffff',
        'icon-opacity': 0.92,
      },
    });
  }

  // Layer 5: Congestion coloring (optional)
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

  // Build GeoJSON FeatureCollection with congestion per segment
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

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };

  const sourceId = ROUTE_LAYER_IDS.source + '-congestion';
  const layerId = ROUTE_LAYER_IDS.congestion;

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson);
  } else {
    map.addSource(sourceId, { type: 'geojson', data: geojson });
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
        'line-width': ROUTE_LINE_WIDTHS.congestionLine,
        'line-opacity': 0.8,
      },
    });
  }
}

/** Draw an alternative route (gray, dashed) */
export function drawAlternativeRoute(
  map: mapboxgl.Map,
  geometry: GeoJSON.Geometry,
): void {
  const geojson: GeoJSON.Feature = { type: 'Feature', geometry, properties: {} };

  if (map.getSource(ROUTE_LAYER_IDS.altSource)) {
    (map.getSource(ROUTE_LAYER_IDS.altSource) as mapboxgl.GeoJSONSource).setData(geojson);
  } else {
    map.addSource(ROUTE_LAYER_IDS.altSource, { type: 'geojson', data: geojson });

    map.addLayer({
      id: ROUTE_LAYER_IDS.altShadow,
      type: 'line',
      source: ROUTE_LAYER_IDS.altSource,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': 'rgba(0,0,0,0.06)', 'line-width': 10, 'line-blur': 3 },
    });

    map.addLayer({
      id: ROUTE_LAYER_IDS.altLine,
      type: 'line',
      source: ROUTE_LAYER_IDS.altSource,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ROUTE_COLORS.completed,
        'line-width': ROUTE_LINE_WIDTHS.alternative,
        'line-opacity': 0.6,
        'line-dasharray': [2, 3],
      },
    });
  }
}

/** Remove primary route from map */
export function removeRoute(map: mapboxgl.Map): void {
  const layers = [
    ROUTE_LAYER_IDS.arrow,
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

/** Remove alternative route from map */
export function removeAlternativeRoute(map: mapboxgl.Map): void {
  for (const id of [ROUTE_LAYER_IDS.altLine, ROUTE_LAYER_IDS.altShadow]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(ROUTE_LAYER_IDS.altSource)) map.removeSource(ROUTE_LAYER_IDS.altSource);
}

// ── Traffic Overlay ─────────────────────────────────────

/**
 * Add Google Maps-style colored traffic overlay.
 * Uses the official mapbox-traffic-v1 vector tileset.
 * Colors: Green (low) → Yellow (moderate) → Orange (heavy) → Red (severe)
 */
export function addTrafficLayer(map: mapboxgl.Map): void {
  if (map.getSource(TRAFFIC_IDS.source)) return;

  map.addSource(TRAFFIC_IDS.source, {
    type: 'vector',
    url: TRAFFIC_IDS.tilesetUrl,
  });

  // Insert traffic below labels/symbols for visual clarity
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
        16, 5,
        20, 10,
      ],
      'line-opacity': 0.6,
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
    duration: MAP_ANIMATION.fitBounds,
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
    map.flyTo({ center: coords[0], zoom: MAP_ZOOM.close, duration: MAP_ANIMATION.flyToFast });
    return;
  }
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new mapboxgl.LngLatBounds(coords[0]!, coords[0]!),
  );
  map.fitBounds(bounds, {
    padding: padding ?? MAP_PADDING.route,
    maxZoom: MAP_ZOOM.routeFit,
    duration: MAP_ANIMATION.fitBounds,
  });
}
