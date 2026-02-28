import { config } from '../config';
import { ApiError } from '../lib/api-error';

// ============================================================
// Geocoding Service — converts addresses to coordinates and
// provides autocomplete suggestions.
//
// Uses the Mapbox Geocoding API when MAPBOX_ACCESS_TOKEN is set,
// otherwise falls back to a mock implementation for local dev.
// ============================================================

export interface GeocodingResult {
  address: string;
  latitude: number;
  longitude: number;
  placeType: string;
}

export interface AutocompleteSuggestion {
  id: string;
  text: string;
  placeName: string;
  latitude: number;
  longitude: number;
}

// ── Geocoding API v6 endpoints ────────────────────────────
const GEOCODE_FORWARD = 'https://api.mapbox.com/search/geocode/v6/forward';
const GEOCODE_REVERSE = 'https://api.mapbox.com/search/geocode/v6/reverse';

/** Ghana bounding box: [minLng, minLat, maxLng, maxLat] */
const GHANA_BBOX = '-3.26,4.74,1.19,11.17';

/** Accra center for proximity bias */
const ACCRA_CENTER = { lng: -0.187, lat: 5.603 };

function warnMockFallback(method: string) {
  console.warn(
    `[GeocodingService] ${method}: MAPBOX_ACCESS_TOKEN not set — using mock data. Set the token in .env for real geocoding.`
  );
}

/**
 * Forward geocode: address text → coordinates.
 * Uses Mapbox Geocoding API v6.
 * Biased towards Ghana by default.
 */
export async function forwardGeocode(
  address: string,
  options: { country?: string; limit?: number; proximity?: { lat: number; lng: number } } = {},
): Promise<GeocodingResult[]> {
  const token = config.mapbox?.accessToken;

  if (!token) {
    warnMockFallback('forwardGeocode');
    return mockForwardGeocode(address);
  }

  const country = options.country ?? 'gh';
  const limit = options.limit ?? 5;
  const prox = options.proximity ?? ACCRA_CENTER;

  const params = new URLSearchParams({
    q: address,
    access_token: token,
    country,
    limit: String(limit),
    types: 'address,street,place,locality,neighborhood,district',
    language: 'en',
    bbox: GHANA_BBOX,
    proximity: `${prox.lng},${prox.lat}`,
  });

  const url = `${GEOCODE_FORWARD}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw ApiError.internal('Geocoding service unavailable');
  }

  const data = (await response.json()) as GeocodingV6Response;

  return data.features.map((f) => ({
    address: f.properties.full_address ?? `${f.properties.name}, ${f.properties.place_formatted ?? ''}`.trim(),
    latitude: f.properties.coordinates.latitude,
    longitude: f.properties.coordinates.longitude,
    placeType: f.properties.feature_type ?? 'unknown',
  }));
}

/**
 * Reverse geocode: coordinates → address.
 * Uses Mapbox Geocoding API v6.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodingResult | null> {
  const token = config.mapbox?.accessToken;

  if (!token) {
    warnMockFallback('reverseGeocode');
    return {
      address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      latitude,
      longitude,
      placeType: 'coordinate',
    };
  }

  const params = new URLSearchParams({
    longitude: String(longitude),
    latitude: String(latitude),
    access_token: token,
    types: 'address,street,place,locality,neighborhood',
    limit: '1',
    language: 'en',
  });

  const url = `${GEOCODE_REVERSE}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw ApiError.internal('Reverse geocoding service unavailable');
  }

  const data = (await response.json()) as GeocodingV6Response;
  const feature = data.features[0];
  if (!feature) return null;

  return {
    address: feature.properties.full_address ?? `${feature.properties.name}, ${feature.properties.place_formatted ?? ''}`.trim(),
    latitude: feature.properties.coordinates.latitude,
    longitude: feature.properties.coordinates.longitude,
    placeType: feature.properties.feature_type ?? 'unknown',
  };
}

/**
 * Autocomplete: partial text → suggestions.
 * Uses Mapbox Geocoding API v6 with autocomplete=true.
 * Designed for real-time search-as-you-type.
 */
export async function autocomplete(
  query: string,
  options: { proximity?: { lat: number; lng: number }; country?: string; limit?: number } = {},
): Promise<AutocompleteSuggestion[]> {
  const token = config.mapbox?.accessToken;

  if (!token) {
    warnMockFallback('autocomplete');
    return mockAutocomplete(query);
  }

  const country = options.country ?? 'gh';
  const limit = options.limit ?? 5;
  const prox = options.proximity ?? ACCRA_CENTER;

  const params = new URLSearchParams({
    q: query,
    access_token: token,
    country,
    limit: String(limit),
    types: 'address,street,place,locality,neighborhood,district',
    autocomplete: 'true',
    language: 'en',
    bbox: GHANA_BBOX,
    proximity: `${prox.lng},${prox.lat}`,
  });

  const url = `${GEOCODE_FORWARD}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw ApiError.internal('Autocomplete service unavailable');
  }

  const data = (await response.json()) as GeocodingV6Response;

  return data.features.map((f) => ({
    id: f.properties.mapbox_id ?? f.id,
    text: f.properties.name,
    placeName: f.properties.full_address ?? `${f.properties.name}, ${f.properties.place_formatted ?? ''}`.trim(),
    latitude: f.properties.coordinates.latitude,
    longitude: f.properties.coordinates.longitude,
  }));
}

// ── Mapbox Geocoding v6 response types ────────────────────

interface GeocodingV6Feature {
  type: string;
  id: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    mapbox_id: string;
    feature_type: string;
    name: string;
    name_preferred?: string;
    place_formatted?: string;
    full_address?: string;
    coordinates: { longitude: number; latitude: number; accuracy?: string };
    context?: Record<string, unknown>;
    match_code?: { confidence: string };
  };
}

interface GeocodingV6Response {
  type: string;
  features: GeocodingV6Feature[];
  attribution?: string;
}

// ---- Mock implementations for local dev ----

const ACCRA_AREAS = [
  { name: 'East Legon, Accra', lat: 5.6350, lng: -0.1572 },
  { name: 'Osu, Accra', lat: 5.5560, lng: -0.1870 },
  { name: 'Airport Residential, Accra', lat: 5.6050, lng: -0.1700 },
  { name: 'Cantonments, Accra', lat: 5.5720, lng: -0.1770 },
  { name: 'Labone, Accra', lat: 5.5630, lng: -0.1830 },
  { name: 'Adabraka, Accra', lat: 5.5580, lng: -0.2120 },
  { name: 'Dansoman, Accra', lat: 5.5390, lng: -0.2580 },
  { name: 'Tema, Greater Accra', lat: 5.6698, lng: -0.0166 },
  { name: 'Madina, Accra', lat: 5.6740, lng: -0.1680 },
  { name: 'Achimota, Accra', lat: 5.6150, lng: -0.2310 },
];

function mockForwardGeocode(address: string): GeocodingResult[] {
  const lower = address.toLowerCase();
  const matches = ACCRA_AREAS.filter((a) => a.name.toLowerCase().includes(lower));

  if (matches.length > 0) {
    return matches.map((m) => ({
      address: m.name,
      latitude: m.lat,
      longitude: m.lng,
      placeType: 'place',
    }));
  }

  // Return a random Accra coordinate if no match
  const fallback = ACCRA_AREAS[Math.floor(Math.random() * ACCRA_AREAS.length)]!;
  return [
    {
      address: `${address} (${fallback.name})`,
      latitude: fallback.lat + (Math.random() - 0.5) * 0.01,
      longitude: fallback.lng + (Math.random() - 0.5) * 0.01,
      placeType: 'address',
    },
  ];
}

function mockAutocomplete(query: string): AutocompleteSuggestion[] {
  const lower = query.toLowerCase();
  return ACCRA_AREAS.filter((a) => a.name.toLowerCase().includes(lower))
    .slice(0, 5)
    .map((a, i) => ({
      id: `mock-${i}`,
      text: a.name.split(',')[0] ?? a.name,
      placeName: a.name,
      latitude: a.lat,
      longitude: a.lng,
    }));
}
