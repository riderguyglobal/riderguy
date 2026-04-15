// ══════════════════════════════════════════════════════════
// Map Core — Advanced map initialization engine for Client
//
// Encapsulates Google Maps JavaScript API:
// • Dynamic loading via @googlemaps/js-api-loader (no SSR)
// • Zoom / Scale controls
// • 3D tilt for buildings
// • ResizeObserver lifecycle
// • Proper cleanup
// ══════════════════════════════════════════════════════════

import {
  MAP_ZOOM,
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
  navigationControl?: boolean;
  geolocateControl?: boolean;
  scaleControl?: boolean;
  buildings3D?: boolean;
  fog?: boolean;
  maxBounds?: unknown;
  minZoom?: number;
  maxZoom?: number;
  cooperativeGestures?: boolean;
  onLoad?: (map: google.maps.Map) => void;
  onError?: (error: Error) => void;
}

export interface MapCoreInstance {
  map: google.maps.Map;
  geolocate: null;
  destroy: () => void;
}

// ── Core Init ───────────────────────────────────────────

export async function initMapCore(options: MapCoreOptions): Promise<MapCoreInstance> {
  const { Loader } = await import('@googlemaps/js-api-loader');

  const loader = new Loader({
    apiKey: options.token,
    version: 'weekly',
    libraries: ['marker', 'geometry', 'places'],
  });

  await loader.load();

  const center = options.center ?? ACCRA_CENTER;

  const map = new google.maps.Map(options.container, {
    center: { lat: center[1], lng: center[0] },
    zoom: options.zoom ?? MAP_ZOOM.default,
    tilt: options.pitch ?? 0,
    heading: options.bearing ?? 0,
    mapId: 'riderguy-client',
    zoomControl: options.navigationControl !== false,
    scaleControl: options.scaleControl !== false,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    gestureHandling: options.cooperativeGestures ? 'cooperative' : 'greedy',
    maxZoom: options.maxZoom ?? MAP_ZOOM.max,
    minZoom: options.minZoom,
  });

  // ResizeObserver
  const resizeObserver = new ResizeObserver(() => {
    google.maps.event.trigger(map, 'resize');
  });
  resizeObserver.observe(options.container);

  // Ensure proper initial sizing
  google.maps.event.addListenerOnce(map, 'idle', () => {
    google.maps.event.trigger(map, 'resize');
  });

  // Wait for tiles_loaded then fire onLoad
  await new Promise<void>((resolve) => {
    google.maps.event.addListenerOnce(map, 'idle', () => {
      options.onLoad?.(map);
      resolve();
    });
  });

  const destroy = () => {
    resizeObserver.disconnect();
    google.maps.event.clearInstanceListeners(map);
  };

  return { map, geolocate: null, destroy };
}

// ── Style Switching ─────────────────────────────────────

export function switchMapStyle(
  _map: google.maps.Map,
  _newStyle: string,
  callbacks?: { onStyleLoad?: () => void },
): void {
  // Programmatic styles are not supported with mapId. Use Cloud-based Map Styling.
  callbacks?.onStyleLoad?.();
}

// ── Camera Utilities ────────────────────────────────────

export function flyToPoint(
  map: google.maps.Map,
  center: [number, number],
  options?: { zoom?: number },
): void {
  map.panTo({ lat: center[1], lng: center[0] });
  if (options?.zoom) map.setZoom(options.zoom);
}

export function fitBoundsToCoords(
  map: google.maps.Map,
  coords: [number, number][],
  padding?: number | google.maps.Padding,
): void {
  if (coords.length === 0) return;
  if (coords.length === 1) {
    flyToPoint(map, coords[0]!);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  for (const c of coords) {
    bounds.extend({ lat: c[1], lng: c[0] });
  }
  const padValue = typeof padding === 'number' ? padding : (padding ? Math.max(padding.top ?? 0, padding.bottom ?? 0, padding.left ?? 0, padding.right ?? 0) : 80);
  map.fitBounds(bounds, padValue);
}
