// ══════════════════════════════════════════════════════════
// Map Constants — shared across client, rider, and API apps
// Full Mapbox GL JS v3.19 feature set
// ══════════════════════════════════════════════════════════

/** Ghana bounding box [minLng, minLat, maxLng, maxLat] */
export const GHANA_BBOX = {
  string: '-3.26,4.74,1.19,11.17',
  array: [-3.26, 4.74, 1.19, 11.17] as [number, number, number, number],
};

/** Accra city center [lng, lat] */
export const ACCRA_CENTER: [number, number] = [-0.187, 5.603];

// ── Map Styles ──────────────────────────────────────────

/** Mapbox map styles — all built-in Mapbox styles */
export const MAP_STYLES = {
  /** Clean light style — client app default */
  light: 'mapbox://styles/mapbox/light-v11',
  /** Street detail style — good for navigation */
  streets: 'mapbox://styles/mapbox/streets-v12',
  /** Dark style — general dark mode */
  dark: 'mapbox://styles/mapbox/dark-v11',
  /** Dark navigation style — rider app default */
  navigationNight: 'mapbox://styles/mapbox/navigation-night-v1',
  /** Navigation day style */
  navigationDay: 'mapbox://styles/mapbox/navigation-day-v1',
  /** Satellite view with labels */
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  /** Outdoors style — terrain-oriented */
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  /** Standard style with 3D features */
  standard: 'mapbox://styles/mapbox/standard',
} as const;

// ── Geocoding & Search ──────────────────────────────────

/** Mapbox place types for Ghana-focused autocomplete (v6 API) */
export const AUTOCOMPLETE_PLACE_TYPES = 'address,street,place,locality,neighborhood,district';

/** Geocoding API v6 endpoints */
export const GEOCODING_ENDPOINTS = {
  forward: 'https://api.mapbox.com/search/geocode/v6/forward',
  reverse: 'https://api.mapbox.com/search/geocode/v6/reverse',
  batch: 'https://api.mapbox.com/search/geocode/v6/batch',
} as const;

/** Directions API v5 endpoints */
export const DIRECTIONS_ENDPOINT = 'https://api.mapbox.com/directions/v5/mapbox';

/** Directions API profiles */
export const DIRECTIONS_PROFILES = {
  drivingTraffic: 'driving-traffic',
  driving: 'driving',
  cycling: 'cycling',
  walking: 'walking',
} as const;

// ── Route Rendering ─────────────────────────────────────

/** Route colors matching Google Maps conventions */
export const ROUTE_COLORS = {
  /** Blue — approaching pickup / default route */
  primary: '#4285F4',
  /** Green — delivering to dropoff */
  delivery: '#34A853',
  /** Gray — walked/completed portion */
  completed: '#9ca3af',
  /** Orange — alternative route */
  alternative: '#fbbc04',
  /** Congestion colors for traffic-aware rendering */
  congestion: {
    low: '#4caf50',
    moderate: '#ffb300',
    heavy: '#ff6f00',
    severe: '#d50000',
  },
} as const;

/** Route line layer widths for multi-layer rendering */
export const ROUTE_LINE_WIDTHS = {
  shadow: 14,
  border: 10,
  glow: 7,
  line: 4.5,
  alternative: 4,
  congestionLine: 6,
} as const;

/** Route source and layer IDs */
export const ROUTE_LAYER_IDS = {
  source: 'rg-route',
  altSource: 'rg-alt-route',
  shadow: 'rg-route-shadow',
  border: 'rg-route-border',
  glow: 'rg-route-glow',
  line: 'rg-route-line',
  arrow: 'rg-route-arrow',
  arrowImage: 'rg-arrow-chevron',
  congestion: 'rg-route-congestion',
  altShadow: 'rg-alt-shadow',
  altLine: 'rg-alt-line',
} as const;

/** Traffic overlay IDs */
export const TRAFFIC_IDS = {
  source: 'rg-traffic',
  layer: 'rg-traffic-flow',
  tilesetUrl: 'mapbox://mapbox.mapbox-traffic-v1',
  sourceLayer: 'traffic',
} as const;

// ── Marker Colors ───────────────────────────────────────

/** Marker colors */
export const MARKER_COLORS = {
  pickup: '#fbbc04',       // Google yellow
  dropoff: '#34A853',      // Google green
  rider: '#4285F4',        // Google blue
  user: '#3b82f6',         // Tailwind blue-500
  riderOnline: '#22c55e',  // Tailwind green-500
  riderOffline: '#9ca3af', // Tailwind gray-400
  stop: '#6366f1',         // Tailwind indigo-500
  brand: '#22c55e',        // RiderGuy brand green
} as const;

// ── Route Refresh ───────────────────────────────────────

/** Route refresh thresholds */
export const ROUTE_REFRESH_DISTANCE_M = 100;

/** Rider location update intervals */
export const LOCATION_INTERVALS = {
  /** How often rider GPS position is sampled (ms) */
  gpsWatch: 5_000,
  /** How often position is sent via WebSocket (ms, effective with throttle) */
  socketEmit: 3_000,
  /** REST heartbeat interval (ms) */
  restHeartbeat: 30_000,
  /** Client nearby-rider poll interval (ms) */
  nearbyPoll: 15_000,
} as const;

// ── Camera & Bounds ─────────────────────────────────────

/** Map fit-bounds padding presets */
export const MAP_PADDING = {
  /** Default padding for route fitting */
  route: { top: 80, bottom: 120, left: 50, right: 50 },
  /** Tighter padding for small maps */
  compact: { top: 40, bottom: 60, left: 30, right: 30 },
  /** Even padding all around */
  uniform: 60,
  /** Wide padding for navigation mode */
  navigation: { top: 100, bottom: 200, left: 60, right: 60 },
} as const;

/** Zoom levels */
export const MAP_ZOOM = {
  default: 14,
  close: 16,
  routeFit: 16,
  city: 12,
  neighborhood: 15,
  building: 18,
  max: 22,
  minTraffic: 7,
} as const;

/** Default camera pitch for 3D perspective */
export const MAP_PITCH = {
  flat: 0,
  mild: 30,
  perspective: 45,
  navigation: 60,
} as const;

// ── 3D & Fog ────────────────────────────────────────────

/** Fog configuration for atmospheric depth effect */
export const MAP_FOG = {
  light: {
    color: 'rgba(255, 255, 255, 0.8)',
    'high-color': '#add8e6',
    'horizon-blend': 0.02,
    'space-color': '#d8f2ff',
    'star-intensity': 0.0,
  },
  dark: {
    color: 'rgba(20, 20, 30, 0.9)',
    'high-color': '#1a1a2e',
    'horizon-blend': 0.04,
    'space-color': '#0d1117',
    'star-intensity': 0.6,
  },
} as const;

/** 3D building layer configuration */
export const BUILDING_3D = {
  layerId: 'rg-3d-buildings',
  sourceLayer: 'building',
  minzoom: 14,
  fillExtrusionOpacity: 0.6,
  fillExtrusionColor: '#aaa',
  fillExtrusionColorDark: '#333',
} as const;

// ── Geolocation Options ─────────────────────────────────

/** Browser Geolocation API options */
export const GEOLOCATION_OPTIONS = {
  highAccuracy: {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 5_000,
  },
  balanced: {
    enableHighAccuracy: true,
    timeout: 8_000,
    maximumAge: 60_000,
  },
  passive: {
    enableHighAccuracy: false,
    timeout: 5_000,
    maximumAge: 300_000,
  },
} as const;

// ── Animation ───────────────────────────────────────────

/** Standard animation durations (ms) */
export const MAP_ANIMATION = {
  flyTo: 1500,
  flyToFast: 800,
  easeTo: 1000,
  fitBounds: 1000,
  markerTransition: 300,
} as const;
