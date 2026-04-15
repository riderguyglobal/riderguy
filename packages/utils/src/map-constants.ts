// ══════════════════════════════════════════════════════════
// Map Constants — shared across client, rider, and API apps
// Google Maps JavaScript API
// ══════════════════════════════════════════════════════════

/** Ghana bounding box [minLng, minLat, maxLng, maxLat] */
export const GHANA_BBOX = {
  string: '-3.26,4.74,1.19,11.17',
  array: [-3.26, 4.74, 1.19, 11.17] as [number, number, number, number],
};

/** Accra city center [lng, lat] */
export const ACCRA_CENTER: [number, number] = [-0.187, 5.603];

// ── Map Styles ──────────────────────────────────────────

/** Google Maps map style IDs */
export const MAP_STYLES = {
  /** Clean light style - client app default */
  light: 'roadmap',
  /** Street detail style - good for navigation */
  streets: 'roadmap',
  /** Dark style - general dark mode (applied via styles array) */
  dark: 'roadmap',
  /** Dark navigation style - rider app default */
  navigationNight: 'roadmap',
  /** Navigation day style */
  navigationDay: 'roadmap',
  /** Satellite view with labels */
  satellite: 'hybrid',
  /** Terrain-oriented */
  outdoors: 'terrain',
  /** Standard style */
  standard: 'roadmap',
} as const;

/** Google Maps dark mode style array */
export const DARK_MAP_STYLES: Array<{
  elementType?: string;
  featureType?: string;
  stylers: Array<Record<string, string>>;
}> = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1b3a1b' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
];

// ── Geocoding & Search ──────────────────────────────────

/** Google Geocoding API endpoint */
export const GEOCODING_ENDPOINTS = {
  forward: 'https://maps.googleapis.com/maps/api/geocode/json',
  reverse: 'https://maps.googleapis.com/maps/api/geocode/json',
} as const;

/** Google Routes API endpoint */
export const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** Travel mode mapping for Google Routes API */
export const TRAVEL_MODES = {
  driving: 'DRIVE',
  cycling: 'BICYCLE',
  walking: 'WALK',
  transit: 'TRANSIT',
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

/** Route identifier keys (used for tracking polyline instances) */
export const ROUTE_LAYER_IDS = {
  primary: 'rg-route-primary',
  shadow: 'rg-route-shadow',
  border: 'rg-route-border',
  glow: 'rg-route-glow',
  line: 'rg-route-line',
  arrow: 'rg-route-arrow',
  congestion: 'rg-route-congestion',
  altLine: 'rg-alt-line',
  altShadow: 'rg-alt-shadow',
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

/** Fog configuration — not applicable to Google Maps (kept as no-op) */
export const MAP_FOG = {
  light: {},
  dark: {},
} as const;

/** 3D building configuration — Google Maps uses tilt for 3D */
export const BUILDING_3D = {
  /** Default tilt angle for 3D building view */
  tilt: 45,
  /** Min zoom for 3D buildings to appear */
  minzoom: 14,
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
