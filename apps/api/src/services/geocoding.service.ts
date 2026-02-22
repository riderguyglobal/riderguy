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

const MAPBOX_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

/**
 * Forward geocode: address text → coordinates.
 * Biased towards Ghana by default.
 */
export async function forwardGeocode(
  address: string,
  options: { country?: string; limit?: number } = {},
): Promise<GeocodingResult[]> {
  const token = config.mapbox?.accessToken;

  if (!token) {
    // Fallback for local dev — return a mocked result based on address
    return mockForwardGeocode(address);
  }

  const country = options.country ?? 'ng';
  const limit = options.limit ?? 5;
  const encoded = encodeURIComponent(address);
  const url = `${MAPBOX_BASE}/${encoded}.json?access_token=${token}&country=${country}&limit=${limit}&types=address,poi,place`;

  const response = await fetch(url);
  if (!response.ok) {
    throw ApiError.internal('Geocoding service unavailable');
  }

  const data = (await response.json()) as MapboxResponse;

  return data.features.map((f) => ({
    address: f.place_name,
    latitude: f.center[1],
    longitude: f.center[0],
    placeType: f.place_type[0] ?? 'unknown',
  }));
}

/**
 * Reverse geocode: coordinates → address.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodingResult | null> {
  const token = config.mapbox?.accessToken;

  if (!token) {
    return {
      address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      latitude,
      longitude,
      placeType: 'coordinate',
    };
  }

  const url = `${MAPBOX_BASE}/${longitude},${latitude}.json?access_token=${token}&types=address,poi,place&limit=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw ApiError.internal('Reverse geocoding service unavailable');
  }

  const data = (await response.json()) as MapboxResponse;
  const feature = data.features[0];
  if (!feature) return null;

  return {
    address: feature.place_name,
    latitude: feature.center[1],
    longitude: feature.center[0],
    placeType: feature.place_type[0] ?? 'unknown',
  };
}

/**
 * Autocomplete: partial text → suggestions.
 * Designed for real-time search-as-you-type.
 */
export async function autocomplete(
  query: string,
  options: { proximity?: { lat: number; lng: number }; country?: string; limit?: number } = {},
): Promise<AutocompleteSuggestion[]> {
  const token = config.mapbox?.accessToken;

  if (!token) {
    return mockAutocomplete(query);
  }

  const country = options.country ?? 'ng';
  const limit = options.limit ?? 5;
  const encoded = encodeURIComponent(query);
  let url = `${MAPBOX_BASE}/${encoded}.json?access_token=${token}&country=${country}&limit=${limit}&types=address,poi,place&autocomplete=true`;

  if (options.proximity) {
    url += `&proximity=${options.proximity.lng},${options.proximity.lat}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw ApiError.internal('Autocomplete service unavailable');
  }

  const data = (await response.json()) as MapboxResponse;

  return data.features.map((f) => ({
    id: f.id,
    text: f.text,
    placeName: f.place_name,
    latitude: f.center[1],
    longitude: f.center[0],
  }));
}

// ---- Mapbox response types ----

interface MapboxFeature {
  id: string;
  type: string;
  place_type: string[];
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface MapboxResponse {
  type: string;
  features: MapboxFeature[];
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
