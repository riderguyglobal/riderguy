// ══════════════════════════════════════════════════════════
// Map Core — Advanced map initialization engine for Client
//
// Encapsulates Mapbox GL JS v3.19 best practices:
// • Dynamic import (no SSR)
// • NavigationControl, GeolocateControl, ScaleControl
// • 3D buildings layer
// • Atmospheric fog
// • Terrain-ready configuration
// • ResizeObserver lifecycle
// • Proper cleanup
// ══════════════════════════════════════════════════════════

import type mapboxgl from 'mapbox-gl';
import {
  MAP_STYLES,
  MAP_ZOOM,
  MAP_PITCH,
  MAP_FOG,
  MAP_ANIMATION,
  BUILDING_3D,
  GEOLOCATION_OPTIONS,
  ACCRA_CENTER,
} from '@riderguy/utils';

// ── Types ───────────────────────────────────────────────

export interface MapCoreOptions {
  container: HTMLElement;
  token: string;
  style?: string;
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  interactive?: boolean;
  /** Show NavigationControl (zoom +/- and compass) */
  navigationControl?: boolean;
  /** Show GeolocateControl (GPS button) */
  geolocateControl?: boolean;
  /** Show ScaleControl (distance ruler) */
  scaleControl?: boolean;
  /** Enable 3D building extrusions */
  buildings3D?: boolean;
  /** Enable atmospheric fog effect */
  fog?: boolean;
  /** Max bounds to restrict panning */
  maxBounds?: mapboxgl.LngLatBoundsLike;
  /** Min/max zoom */
  minZoom?: number;
  maxZoom?: number;
  /** Enable cooperative gestures (hold ctrl to zoom) */
  cooperativeGestures?: boolean;
  /** Callback when map loads */
  onLoad?: (map: mapboxgl.Map, mapboxgl: typeof import('mapbox-gl').default) => void;
  /** Callback on map errors */
  onError?: (error: Error) => void;
}

export interface MapCoreInstance {
  map: mapboxgl.Map;
  mapboxgl: typeof import('mapbox-gl').default;
  geolocate: mapboxgl.GeolocateControl | null;
  destroy: () => void;
}

// ── 3D Buildings ────────────────────────────────────────

function add3DBuildings(map: mapboxgl.Map, isDark = false): void {
  if (map.getLayer(BUILDING_3D.layerId)) return;

  // Find the first label layer to insert buildings below
  const layers = map.getStyle().layers ?? [];
  let labelLayerId: string | undefined;
  for (const layer of layers) {
    if (layer.type === 'symbol' && (layer.layout as Record<string, unknown>)?.['text-field']) {
      labelLayerId = layer.id;
      break;
    }
  }

  map.addLayer(
    {
      id: BUILDING_3D.layerId,
      source: 'composite',
      'source-layer': BUILDING_3D.sourceLayer,
      filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion',
      minzoom: BUILDING_3D.minzoom,
      paint: {
        'fill-extrusion-color': isDark ? BUILDING_3D.fillExtrusionColorDark : BUILDING_3D.fillExtrusionColor,
        'fill-extrusion-height': [
          'interpolate', ['linear'], ['zoom'],
          14, 0,
          14.05, ['get', 'height'],
        ],
        'fill-extrusion-base': [
          'interpolate', ['linear'], ['zoom'],
          14, 0,
          14.05, ['get', 'min_height'],
        ],
        'fill-extrusion-opacity': BUILDING_3D.fillExtrusionOpacity,
      },
    },
    labelLayerId,
  );
}

// ── Fog ─────────────────────────────────────────────────

function setFog(map: mapboxgl.Map, isDark = false): void {
  const fogConfig = isDark ? MAP_FOG.dark : MAP_FOG.light;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map.setFog(fogConfig as any);
}

// ── Core Init ───────────────────────────────────────────

/**
 * Initialize a Mapbox GL JS map with full feature set.
 * Dynamically imports mapbox-gl to avoid SSR issues.
 *
 * Returns a MapCoreInstance with map, mapboxgl ref, geolocate control, and destroy function.
 */
export async function initMapCore(options: MapCoreOptions): Promise<MapCoreInstance> {
  const mapboxgl = (await import('mapbox-gl')).default;
  mapboxgl.accessToken = options.token;

  const map = new mapboxgl.Map({
    container: options.container,
    style: options.style ?? MAP_STYLES.streets,
    center: options.center ?? ACCRA_CENTER,
    zoom: options.zoom ?? MAP_ZOOM.default,
    pitch: options.pitch ?? MAP_PITCH.flat,
    bearing: options.bearing ?? 0,
    interactive: options.interactive ?? true,
    antialias: true,
    attributionControl: true,
    fadeDuration: 0,
    maxBounds: options.maxBounds,
    minZoom: options.minZoom,
    maxZoom: options.maxZoom ?? MAP_ZOOM.max,
    cooperativeGestures: options.cooperativeGestures,
    // Mapbox v3.19: projection is 'mercator' by default, 'globe' for 3D globe
    projection: 'mercator',
    // Hash for URL-based map state (disabled for embedded maps)
    hash: false,
    // Prevent right-click context menu
    trackResize: false, // We handle resize via ResizeObserver
  });

  // ── Controls ──────────────────────────────────────────

  // Navigation control (zoom buttons + compass)
  if (options.navigationControl !== false) {
    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }),
      'top-right',
    );
  }

  // Scale control (distance ruler)
  if (options.scaleControl !== false) {
    map.addControl(
      new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: 'metric',
      }),
      'bottom-left',
    );
  }

  // GeolocateControl (GPS "locate me" button)
  let geolocate: mapboxgl.GeolocateControl | null = null;
  if (options.geolocateControl !== false) {
    geolocate = new mapboxgl.GeolocateControl({
      positionOptions: GEOLOCATION_OPTIONS.highAccuracy,
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true,
      fitBoundsOptions: {
        maxZoom: MAP_ZOOM.close,
        duration: MAP_ANIMATION.flyTo,
      },
    });
    map.addControl(geolocate, 'bottom-right');
  }

  // ── ResizeObserver ────────────────────────────────────

  const resizeObserver = new ResizeObserver(() => map.resize());
  resizeObserver.observe(options.container);

  // ── Map Event Handlers ────────────────────────────────

  map.on('error', (e) => {
    const msg = e.error?.message ?? String(e);
    console.error('[MapCore] Mapbox error:', msg);
    options.onError?.(new Error(msg));
  });

  // Ensure proper initial sizing
  map.once('idle', () => map.resize());

  // ── Load Event — add 3D buildings, fog, trigger callback ──

  await new Promise<void>((resolve) => {
    map.on('load', () => {
      // 3D Buildings
      if (options.buildings3D !== false) {
        try {
          add3DBuildings(map, options.style?.includes('dark') || options.style?.includes('night'));
        } catch {
          // Some styles (e.g., satellite) don't have building source
        }
      }

      // Atmospheric fog
      if (options.fog !== false) {
        setFog(map, options.style?.includes('dark') || options.style?.includes('night'));
      }

      options.onLoad?.(map, mapboxgl);
      resolve();
    });
  });

  // ── Cleanup ───────────────────────────────────────────

  const destroy = () => {
    resizeObserver.disconnect();
    map.remove();
  };

  return { map, mapboxgl, geolocate, destroy };
}

// ── Camera Utilities ────────────────────────────────────

/** Fly to coordinates with consistent animation */
function flyToPoint(
  map: mapboxgl.Map,
  center: [number, number],
  options?: { zoom?: number; pitch?: number; bearing?: number; duration?: number },
): void {
  map.flyTo({
    center,
    zoom: options?.zoom ?? MAP_ZOOM.close,
    pitch: options?.pitch ?? map.getPitch(),
    bearing: options?.bearing ?? map.getBearing(),
    duration: options?.duration ?? MAP_ANIMATION.flyTo,
    essential: true,
  });
}

/** Fit map bounds to an array of [lng, lat] coordinates */
export function fitBoundsToCoords(
  map: mapboxgl.Map,
  mapboxgl: typeof import('mapbox-gl').default,
  coords: [number, number][],
  padding?: mapboxgl.PaddingOptions | number,
  options?: { maxZoom?: number; duration?: number },
): void {
  if (coords.length === 0) return;
  if (coords.length === 1) {
    flyToPoint(map, coords[0]!, { zoom: MAP_ZOOM.close });
    return;
  }
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new mapboxgl.LngLatBounds(coords[0]!, coords[0]!),
  );
  map.fitBounds(bounds, {
    padding: padding ?? { top: 80, bottom: 120, left: 50, right: 50 },
    maxZoom: options?.maxZoom ?? MAP_ZOOM.routeFit,
    duration: options?.duration ?? MAP_ANIMATION.fitBounds,
  });
}
