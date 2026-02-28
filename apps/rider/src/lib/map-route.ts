// ══════════════════════════════════════════════════════════
// Rider App — Map Route & Traffic Layer Utilities
// Manages route drawing (multi-layer Google Maps style),
// traffic overlay, and bounds fitting.
// ══════════════════════════════════════════════════════════

import { ROUTE_COLORS, MAP_PADDING } from '@riderguy/utils';

export interface RouteData {
  geometry: GeoJSON.Geometry;
  duration: number;
  distance: number;
}

// ── Layer IDs ─────────────────────────────────────────────
const ROUTE_LAYERS = ['rg-route-shadow', 'rg-route-border', 'rg-route-glow', 'rg-route-line'] as const;
const ROUTE_SOURCE = 'rg-route';
const TRAFFIC_SOURCE = 'rg-traffic';
const TRAFFIC_LAYER = 'rg-traffic-flow';

// ── Draw route (4-layer Google Maps style) ───────────────
export function drawRoute(
  map: mapboxgl.Map,
  mapboxgl: typeof import('mapbox-gl').default,
  route: RouteData,
  opts: { color?: string; fitBounds?: boolean; padding?: Record<string, number> } = {},
) {
  const color = opts.color ?? ROUTE_COLORS.primary;

  // Update existing source or create new
  if (map.getSource(ROUTE_SOURCE)) {
    (map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource).setData(route.geometry as GeoJSON.GeoJSON);
    if (map.getLayer('rg-route-border')) map.setPaintProperty('rg-route-border', 'line-color', color);
    if (map.getLayer('rg-route-glow')) map.setPaintProperty('rg-route-glow', 'line-color', color);
    if (map.getLayer('rg-route-line')) map.setPaintProperty('rg-route-line', 'line-color', color);
  } else {
    map.addSource(ROUTE_SOURCE, { type: 'geojson', data: route.geometry as GeoJSON.GeoJSON });

    map.addLayer({
      id: 'rg-route-shadow',
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': 'rgba(0,0,0,0.15)', 'line-width': 14, 'line-blur': 4 },
    });
    map.addLayer({
      id: 'rg-route-border',
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': 10, 'line-opacity': 0.35 },
    });
    map.addLayer({
      id: 'rg-route-glow',
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': 8, 'line-opacity': 0.5 },
    });
    map.addLayer({
      id: 'rg-route-line',
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': 5, 'line-opacity': 1 },
    });
  }

  if (opts.fitBounds && route.geometry.type === 'LineString') {
    const coords = (route.geometry as GeoJSON.LineString).coordinates;
    fitBoundsToCoords(map, mapboxgl, coords as [number, number][], opts.padding ?? MAP_PADDING.route);
  }
}

// ── Remove route ─────────────────────────────────────────
export function removeRoute(map: mapboxgl.Map) {
  for (const id of ROUTE_LAYERS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
}

// ── Traffic layer — Google Maps colored roads ────────────
export function addTrafficLayer(map: mapboxgl.Map) {
  if (map.getSource(TRAFFIC_SOURCE)) return;

  map.addSource(TRAFFIC_SOURCE, {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-traffic-v1',
  });

  // Insert below labels
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
      'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 3, 16, 6, 20, 12],
      'line-opacity': 0.65,
      'line-offset': ['interpolate', ['linear'], ['zoom'], 7, 0, 12, 1, 16, 2],
    },
    minzoom: 7,
  }, beforeId);
}

/** Toggle traffic layer visibility */
export function toggleTraffic(map: mapboxgl.Map, visible: boolean) {
  if (map.getLayer(TRAFFIC_LAYER)) {
    map.setLayoutProperty(TRAFFIC_LAYER, 'visibility', visible ? 'visible' : 'none');
  }
}

/** Check if traffic layer exists */
export function hasTrafficLayer(map: mapboxgl.Map): boolean {
  return !!map.getSource(TRAFFIC_SOURCE);
}

// ── Fit bounds to coordinates array ──────────────────────
export function fitBoundsToCoords(
  map: mapboxgl.Map,
  mapboxgl: typeof import('mapbox-gl').default,
  coords: [number, number][],
  padding: Record<string, number> = MAP_PADDING.route,
) {
  if (coords.length === 0) return;
  if (coords.length === 1) {
    map.flyTo({ center: coords[0], zoom: 15, duration: 800 });
    return;
  }
  const bounds = new mapboxgl.LngLatBounds();
  for (const c of coords) bounds.extend(c);
  map.fitBounds(bounds, { padding, maxZoom: 16, duration: 800 });
}
