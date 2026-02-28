// ══════════════════════════════════════════════════════════
// Map Constants — shared across client, rider, and API apps
// ══════════════════════════════════════════════════════════

/** Ghana bounding box [minLng, minLat, maxLng, maxLat] */
export const GHANA_BBOX = {
  string: '-3.26,4.74,1.19,11.17',
  array: [-3.26, 4.74, 1.19, 11.17] as [number, number, number, number],
};

/** Accra city center [lng, lat] */
export const ACCRA_CENTER: [number, number] = [-0.187, 5.603];

/** Mapbox map styles */
export const MAP_STYLES = {
  /** Clean light style — client app default */
  light: 'mapbox://styles/mapbox/light-v11',
  /** Street detail style — good for navigation */
  streets: 'mapbox://styles/mapbox/streets-v12',
  /** Dark navigation style — rider app default */
  navigationNight: 'mapbox://styles/mapbox/navigation-night-v1',
  /** Satellite view */
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;

/** Mapbox place types for Ghana-focused autocomplete */
export const AUTOCOMPLETE_PLACE_TYPES = 'address,poi,place,locality,neighborhood,district';

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
} as const;

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

/** Map fit-bounds padding presets */
export const MAP_PADDING = {
  /** Default padding for route fitting */
  route: { top: 80, bottom: 120, left: 50, right: 50 },
  /** Tighter padding for small maps */
  compact: { top: 40, bottom: 60, left: 30, right: 30 },
  /** Even padding all around */
  uniform: 60,
} as const;

/** Maximum zoom levels */
export const MAP_ZOOM = {
  default: 14,
  close: 16,
  routeFit: 16,
  city: 12,
  neighborhood: 15,
} as const;
