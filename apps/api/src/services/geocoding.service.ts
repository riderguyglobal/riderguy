import { config } from '../config';
import { ApiError } from '../lib/api-error';
import { formatPlusCode } from '@riderguy/utils';

// ============================================================
// Geocoding Service — converts addresses to coordinates and
// provides autocomplete suggestions.
//
// Strategy for Ghana / West Africa:
//
// 1. **Mapbox Geocoding v6** with `autocomplete: true` is the
//    PRIMARY autocomplete provider — it has global coverage.
//    ⚠️  Mapbox Search Box v1 (suggest/retrieve) only covers
//    US, Canada & Europe and returns EMPTY results for Ghana.
//
// 2. **Nominatim (OpenStreetMap)** is queried in parallel as a
//    SUPPLEMENTARY provider — OSM has excellent community-mapped
//    data for Ghana (neighborhoods, markets, landmarks).
//
// 3. A **local Ghana gazetteer** of 100+ well-known locations
//    instantly matches popular neighborhoods and landmarks
//    before any API call, providing immediate results.
//
// Results are merged, deduplicated, and the gazetteer results
// appear first when matched.
// ============================================================

export interface GeocodingResult {
  address: string;
  latitude: number;
  longitude: number;
  placeType: string;
  plusCode?: {
    full: string;
    short: string;
    display: string;
    city: string;
  };
}

export interface AutocompleteSuggestion {
  id: string;
  text: string;
  placeName: string;
  /** Coordinates are included whenever available (Geocoding v6, Nominatim, gazetteer) */
  latitude?: number;
  longitude?: number;
  placeType?: string;
  category?: string;
  /** Source provider for logging / debugging */
  source?: 'mapbox' | 'nominatim' | 'gazetteer';
}

export interface RetrievedPlace {
  id: string;
  name: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  placeType: string;
  plusCode?: {
    full: string;
    short: string;
    display: string;
    city: string;
  };
}

// ── Geocoding API v6 endpoints ────────────────────────────
const GEOCODE_FORWARD = 'https://api.mapbox.com/search/geocode/v6/forward';
const GEOCODE_REVERSE = 'https://api.mapbox.com/search/geocode/v6/reverse';

// ── Search Box API v1 endpoints (kept for retrieve of Mapbox IDs) ──
const SEARCHBOX_RETRIEVE = 'https://api.mapbox.com/search/searchbox/v1/retrieve';

// ── Nominatim (OpenStreetMap) endpoint ────────────────────
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';

/** Ghana bounding box: [minLng, minLat, maxLng, maxLat] */
const GHANA_BBOX = '-3.26,4.74,1.19,11.17';

/** Accra center for proximity bias */
const ACCRA_CENTER = { lng: -0.187, lat: 5.603 };

function warnMockFallback(method: string) {
  console.warn(
    `[GeocodingService] ${method}: MAPBOX_ACCESS_TOKEN not set — using mock data. Set the token in .env for real geocoding.`
  );
}

// ═══════════════════════════════════════════════════════════
// Ghana Gazetteer — instant matches for well-known locations
// ═══════════════════════════════════════════════════════════

interface GazetteerEntry {
  name: string;
  area: string;         // parent city / region
  lat: number;
  lng: number;
  aliases?: string[];   // alternative spellings / local names
}

const GHANA_GAZETTEER: GazetteerEntry[] = [
  // ── Greater Accra ─────────────────────────────
  { name: 'East Legon', area: 'Accra', lat: 5.6350, lng: -0.1572 },
  { name: 'West Legon', area: 'Accra', lat: 5.6380, lng: -0.2210 },
  { name: 'Osu', area: 'Accra', lat: 5.5560, lng: -0.1870, aliases: ['Oxford Street'] },
  { name: 'Airport Residential', area: 'Accra', lat: 5.6050, lng: -0.1700, aliases: ['Airport Area'] },
  { name: 'Cantonments', area: 'Accra', lat: 5.5720, lng: -0.1770 },
  { name: 'Labone', area: 'Accra', lat: 5.5630, lng: -0.1830 },
  { name: 'Adabraka', area: 'Accra', lat: 5.5580, lng: -0.2120 },
  { name: 'Dansoman', area: 'Accra', lat: 5.5390, lng: -0.2580 },
  { name: 'Tema', area: 'Greater Accra', lat: 5.6698, lng: -0.0166 },
  { name: 'Madina', area: 'Accra', lat: 5.6740, lng: -0.1680 },
  { name: 'Achimota', area: 'Accra', lat: 5.6150, lng: -0.2310 },
  { name: 'Dzorwulu', area: 'Accra', lat: 5.6100, lng: -0.1990 },
  { name: 'Spintex', area: 'Accra', lat: 5.6340, lng: -0.0960, aliases: ['Spintex Road'] },
  { name: 'Teshie', area: 'Accra', lat: 5.5780, lng: -0.1070 },
  { name: 'Nungua', area: 'Accra', lat: 5.5890, lng: -0.0770 },
  { name: 'Labadi', area: 'Accra', lat: 5.5590, lng: -0.1530, aliases: ['La'] },
  { name: 'Tesano', area: 'Accra', lat: 5.6000, lng: -0.2280 },
  { name: 'Kokomlemle', area: 'Accra', lat: 5.5700, lng: -0.2050 },
  { name: 'Asylum Down', area: 'Accra', lat: 5.5630, lng: -0.2090 },
  { name: 'Ridge', area: 'Accra', lat: 5.5650, lng: -0.2010 },
  { name: 'Roman Ridge', area: 'Accra', lat: 5.5750, lng: -0.1940 },
  { name: 'North Kaneshie', area: 'Accra', lat: 5.5690, lng: -0.2350 },
  { name: 'Kaneshie', area: 'Accra', lat: 5.5620, lng: -0.2400 },
  { name: 'Odorkor', area: 'Accra', lat: 5.5700, lng: -0.2620 },
  { name: 'Darkuman', area: 'Accra', lat: 5.5650, lng: -0.2500 },
  { name: 'Circle', area: 'Accra', lat: 5.5700, lng: -0.2170, aliases: ['Kwame Nkrumah Circle'] },
  { name: 'Makola', area: 'Accra', lat: 5.5480, lng: -0.2120, aliases: ['Makola Market'] },
  { name: 'James Town', area: 'Accra', lat: 5.5370, lng: -0.2100 },
  { name: 'Mamprobi', area: 'Accra', lat: 5.5330, lng: -0.2280 },
  { name: 'Korle Bu', area: 'Accra', lat: 5.5350, lng: -0.2270, aliases: ['Korle-Bu Teaching Hospital'] },
  { name: 'Sakumono', area: 'Accra', lat: 5.6210, lng: -0.0480, aliases: ['Sakumono Estates'] },
  { name: 'Kasoa', area: 'Greater Accra', lat: 5.5340, lng: -0.4190 },
  { name: 'Weija', area: 'Accra', lat: 5.5560, lng: -0.3520 },
  { name: 'Haatso', area: 'Accra', lat: 5.6650, lng: -0.1940 },
  { name: 'Dome', area: 'Accra', lat: 5.6510, lng: -0.2280 },
  { name: 'Kwabenya', area: 'Accra', lat: 5.6820, lng: -0.2140 },
  { name: 'Pokuase', area: 'Accra', lat: 5.6970, lng: -0.2800 },
  { name: 'Agbogba', area: 'Accra', lat: 5.6710, lng: -0.1810 },
  { name: 'Adenta', area: 'Accra', lat: 5.6830, lng: -0.1540, aliases: ['Adentan'] },
  { name: 'Ashaiman', area: 'Greater Accra', lat: 5.6880, lng: -0.0330 },
  { name: 'Lapaz', area: 'Accra', lat: 5.6090, lng: -0.2470, aliases: ['La Paz'] },
  { name: 'Abeka', area: 'Accra', lat: 5.5920, lng: -0.2410 },
  { name: 'Nima', area: 'Accra', lat: 5.5780, lng: -0.1930 },
  { name: 'Mamobi', area: 'Accra', lat: 5.5790, lng: -0.1990 },
  { name: 'Pig Farm', area: 'Accra', lat: 5.5680, lng: -0.2290 },
  { name: 'Abelemkpe', area: 'Accra', lat: 5.5950, lng: -0.2030 },
  { name: 'Legon', area: 'Accra', lat: 5.6510, lng: -0.1860, aliases: ['University of Ghana'] },

  // ── Takoradi / Western Region ─────────────────
  { name: 'Effia', area: 'Takoradi', lat: 4.9300, lng: -1.7580, aliases: ['Effia Nkwanta'] },
  { name: 'Effiekuma', area: 'Takoradi', lat: 4.9200, lng: -1.7700, aliases: ['Effikuma', 'Effiakuma'] },
  { name: 'Anaji', area: 'Takoradi', lat: 4.9140, lng: -1.7640, aliases: ['Anaji Estate'] },
  { name: 'Takoradi Market Circle', area: 'Takoradi', lat: 4.8980, lng: -1.7590, aliases: ['Market Circle'] },
  { name: 'Beach Road', area: 'Takoradi', lat: 4.8940, lng: -1.7450, aliases: ['Takoradi Beach'] },
  { name: 'New Takoradi', area: 'Takoradi', lat: 4.8850, lng: -1.7320 },
  { name: 'Kojokrom', area: 'Takoradi', lat: 4.9180, lng: -1.7310 },
  { name: 'Fijai', area: 'Takoradi', lat: 4.9280, lng: -1.7380 },
  { name: 'Tanokrom', area: 'Takoradi', lat: 4.9130, lng: -1.7500 },
  { name: 'Apremdo', area: 'Takoradi', lat: 4.9350, lng: -1.7820 },
  { name: 'Kwesimintsim', area: 'Takoradi', lat: 4.9420, lng: -1.7900, aliases: ['Kwesi Mintim'] },
  { name: 'Chapel Hill', area: 'Takoradi', lat: 4.9060, lng: -1.7560 },
  { name: 'Sekondi', area: 'Sekondi-Takoradi', lat: 4.9340, lng: -1.7090 },
  { name: 'Essikado', area: 'Sekondi-Takoradi', lat: 4.9420, lng: -1.7010 },
  { name: 'Dixcove Hill', area: 'Takoradi', lat: 4.9030, lng: -1.7490 },
  { name: 'Windy Ridge', area: 'Takoradi', lat: 4.9150, lng: -1.7470 },
  { name: 'Airport Ridge', area: 'Takoradi', lat: 4.9220, lng: -1.7410, aliases: ['Takoradi Airport'] },
  { name: 'West Tanokrom', area: 'Takoradi', lat: 4.9110, lng: -1.7560 },
  { name: 'Harbour Area', area: 'Takoradi', lat: 4.8920, lng: -1.7510, aliases: ['Takoradi Harbour'] },
  { name: 'Liberation Road', area: 'Takoradi', lat: 4.9030, lng: -1.7530 },

  // ── Kumasi / Ashanti Region ───────────────────
  { name: 'Adum', area: 'Kumasi', lat: 6.6940, lng: -1.6220 },
  { name: 'Kejetia', area: 'Kumasi', lat: 6.6920, lng: -1.6260, aliases: ['Kejetia Market'] },
  { name: 'Bantama', area: 'Kumasi', lat: 6.7020, lng: -1.6350 },
  { name: 'Ahodwo', area: 'Kumasi', lat: 6.6700, lng: -1.6370, aliases: ['Ahodwo Roundabout'] },
  { name: 'Ayigya', area: 'Kumasi', lat: 6.6780, lng: -1.5730, aliases: ['KNUST Area'] },
  { name: 'Suame', area: 'Kumasi', lat: 6.7180, lng: -1.6210, aliases: ['Suame Magazine'] },
  { name: 'Asokwa', area: 'Kumasi', lat: 6.6680, lng: -1.6120 },
  { name: 'Oforikrom', area: 'Kumasi', lat: 6.6880, lng: -1.5820 },
  { name: 'Tech Junction', area: 'Kumasi', lat: 6.6850, lng: -1.5730, aliases: ['KNUST Junction'] },
  { name: 'Asafo', area: 'Kumasi', lat: 6.6890, lng: -1.6110, aliases: ['Asafo Market'] },
  { name: 'Tafo', area: 'Kumasi', lat: 6.7250, lng: -1.5900, aliases: ['Old Tafo'] },
  { name: 'Nhyiaeso', area: 'Kumasi', lat: 6.6740, lng: -1.6240 },
  { name: 'Danyame', area: 'Kumasi', lat: 6.6780, lng: -1.6400 },

  // ── Cape Coast / Central Region ───────────────
  { name: 'Cape Coast', area: 'Central Region', lat: 5.1050, lng: -1.2466 },
  { name: 'Abura', area: 'Cape Coast', lat: 5.1080, lng: -1.2510 },
  { name: 'Pedu', area: 'Cape Coast', lat: 5.1230, lng: -1.2530 },
  { name: 'UCC Campus', area: 'Cape Coast', lat: 5.1120, lng: -1.2890, aliases: ['University of Cape Coast'] },
  { name: 'Elmina', area: 'Central Region', lat: 5.0850, lng: -1.3510 },

  // ── Tamale / Northern Region ──────────────────
  { name: 'Tamale', area: 'Northern Region', lat: 9.4035, lng: -0.8392 },
  { name: 'Lamashegu', area: 'Tamale', lat: 9.4120, lng: -0.8420 },
  { name: 'Nyohini', area: 'Tamale', lat: 9.4180, lng: -0.8360 },
  { name: 'Jisonayili', area: 'Tamale', lat: 9.4260, lng: -0.8300 },

  // ── Ho / Volta Region ─────────────────────────
  { name: 'Ho', area: 'Volta Region', lat: 6.6118, lng: 0.4703 },
  { name: 'Ho Bankoe', area: 'Ho', lat: 6.6060, lng: 0.4650, aliases: ['Bankoe'] },
  { name: 'Ho Dome', area: 'Ho', lat: 6.6200, lng: 0.4750 },

  // ── Koforidua / Eastern Region ────────────────
  { name: 'Koforidua', area: 'Eastern Region', lat: 6.0940, lng: -0.2572 },
  { name: 'Adweso', area: 'Koforidua', lat: 6.0880, lng: -0.2510 },

  // ── Sunyani / Bono Region ─────────────────────
  { name: 'Sunyani', area: 'Bono Region', lat: 7.3390, lng: -2.3266 },

  // ── Popular landmarks ─────────────────────────
  { name: 'Accra Mall', area: 'Accra', lat: 5.6170, lng: -0.0840, aliases: ['A&C Mall'] },
  { name: 'West Hills Mall', area: 'Accra', lat: 5.5820, lng: -0.3450 },
  { name: 'Junction Mall', area: 'Accra', lat: 5.5670, lng: -0.2570 },
  { name: 'Marina Mall', area: 'Accra', lat: 5.5560, lng: -0.1860 },
  { name: 'Makola Market', area: 'Accra', lat: 5.5480, lng: -0.2120 },
  { name: 'Kaneshie Market', area: 'Accra', lat: 5.5630, lng: -0.2410 },
  { name: 'Madina Market', area: 'Accra', lat: 5.6730, lng: -0.1660 },
  { name: 'Takoradi Mall', area: 'Takoradi', lat: 4.9270, lng: -1.7650 },
  { name: 'Kumasi City Mall', area: 'Kumasi', lat: 6.6770, lng: -1.6180 },
  { name: 'Kotoka International Airport', area: 'Accra', lat: 5.6052, lng: -0.1668, aliases: ['KIA', 'Accra Airport'] },
  { name: 'Korle Bu Teaching Hospital', area: 'Accra', lat: 5.5350, lng: -0.2270 },
  { name: '37 Military Hospital', area: 'Accra', lat: 5.5920, lng: -0.1860, aliases: ['37 Hospital'] },
  { name: 'Effia Nkwanta Hospital', area: 'Takoradi', lat: 4.9310, lng: -1.7590 },
  { name: 'KNUST', area: 'Kumasi', lat: 6.6730, lng: -1.5670, aliases: ['Kwame Nkrumah University of Science and Technology'] },
  { name: 'University of Ghana', area: 'Accra', lat: 5.6510, lng: -0.1860, aliases: ['UG', 'Legon'] },
];

/**
 * Search the local gazetteer for instant matches.
 * Returns results sorted by relevance (prefix match first, then substring).
 */
function searchGazetteer(query: string, limit = 5): AutocompleteSuggestion[] {
  const lower = query.toLowerCase().trim();
  if (!lower || lower.length < 2) return [];

  const scored: { entry: GazetteerEntry; score: number }[] = [];

  for (const entry of GHANA_GAZETTEER) {
    const nameLower = entry.name.toLowerCase();
    const areaLower = entry.area.toLowerCase();
    const allNames = [nameLower, ...(entry.aliases?.map((a) => a.toLowerCase()) ?? [])];
    const fullName = `${nameLower}, ${areaLower}`;

    let bestScore = 0;

    for (const n of allNames) {
      if (n === lower) {
        bestScore = Math.max(bestScore, 100); // exact match
      } else if (n.startsWith(lower)) {
        bestScore = Math.max(bestScore, 80); // prefix match
      } else if (n.includes(lower)) {
        bestScore = Math.max(bestScore, 60); // substring
      }
    }

    // Also check "name, area" combined
    if (fullName.startsWith(lower)) {
      bestScore = Math.max(bestScore, 75);
    } else if (fullName.includes(lower)) {
      bestScore = Math.max(bestScore, 50);
    }

    if (bestScore > 0) {
      scored.push({ entry, score: bestScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s, i) => ({
    id: `gaz-${i}-${s.entry.name.toLowerCase().replace(/\s/g, '-')}`,
    text: s.entry.name,
    placeName: `${s.entry.name}, ${s.entry.area}, Ghana`,
    latitude: s.entry.lat,
    longitude: s.entry.lng,
    placeType: 'place',
    source: 'gazetteer' as const,
  }));
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

  return data.features.map((f) => {
    const lat = f.properties.coordinates.latitude;
    const lng = f.properties.coordinates.longitude;
    return {
      address: f.properties.full_address ?? `${f.properties.name}, ${f.properties.place_formatted ?? ''}`.trim(),
      latitude: lat,
      longitude: lng,
      placeType: f.properties.feature_type ?? 'unknown',
      plusCode: formatPlusCode(lat, lng),
    };
  });
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
    plusCode: formatPlusCode(feature.properties.coordinates.latitude, feature.properties.coordinates.longitude),
  };
}

/**
 * Autocomplete: partial text → suggestions.
 *
 * Multi-provider strategy:
 * 1. Local Ghana gazetteer (instant, no API call)
 * 2. Mapbox Geocoding v6 with autocomplete: true (global coverage)
 * 3. Nominatim / OpenStreetMap (good Ghana community data)
 *
 * Results are merged, deduplicated, and returned with coordinates
 * already included — no separate retrieve step needed (except for
 * legacy Search Box IDs, which are unlikely).
 */
export async function autocomplete(
  query: string,
  options: {
    proximity?: { lat: number; lng: number };
    country?: string;
    limit?: number;
    sessionToken?: string;
  } = {},
): Promise<AutocompleteSuggestion[]> {
  const token = config.mapbox?.accessToken;

  if (!token) {
    warnMockFallback('autocomplete');
    return mockAutocomplete(query);
  }

  const country = options.country ?? 'gh';
  const limit = options.limit ?? 8;
  const prox = options.proximity ?? ACCRA_CENTER;

  // 1. Instant local gazetteer lookup (synchronous, zero latency)
  const gazetteerResults = searchGazetteer(query, 4);

  // 2. Mapbox Geocoding v6 with autocomplete: true
  const mapboxPromise = mapboxGeocodeAutocomplete(query, { proximity: prox, country, limit });

  // 3. Nominatim / OpenStreetMap (search in parallel with Mapbox)
  const nominatimPromise = nominatimAutocomplete(query, { proximity: prox, limit: 5 });

  // Wait for both API providers in parallel
  const [mapboxResults, nominatimResults] = await Promise.allSettled([
    mapboxPromise,
    nominatimPromise,
  ]);

  const mapbox = mapboxResults.status === 'fulfilled' ? mapboxResults.value : [];
  const nominatim = nominatimResults.status === 'fulfilled' ? nominatimResults.value : [];

  if (mapboxResults.status === 'rejected') {
    console.warn('[GeocodingService] Mapbox autocomplete failed:', mapboxResults.reason);
  }
  if (nominatimResults.status === 'rejected') {
    console.warn('[GeocodingService] Nominatim autocomplete failed:', nominatimResults.reason);
  }

  // Merge: gazetteer first (instant, reliable), then Mapbox, then Nominatim
  const merged = deduplicateSuggestions([...gazetteerResults, ...mapbox, ...nominatim]);

  return merged.slice(0, limit);
}

/**
 * Mapbox Geocoding v6 autocomplete.
 * Returns results WITH coordinates (unlike Search Box suggest).
 */
async function mapboxGeocodeAutocomplete(
  query: string,
  options: { proximity: { lat: number; lng: number }; country: string; limit: number },
): Promise<AutocompleteSuggestion[]> {
  const token = config.mapbox?.accessToken;
  if (!token) return [];

  const params = new URLSearchParams({
    q: query,
    access_token: token,
    country: options.country,
    limit: String(options.limit),
    types: 'address,street,place,locality,neighborhood,district',
    autocomplete: 'true',
    language: 'en',
    bbox: GHANA_BBOX,
    proximity: `${options.proximity.lng},${options.proximity.lat}`,
  });

  const url = `${GEOCODE_FORWARD}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) return [];

  const data = (await response.json()) as GeocodingV6Response;

  return data.features.map((f) => ({
    id: f.properties.mapbox_id ?? f.id,
    text: f.properties.name,
    placeName: f.properties.full_address ?? `${f.properties.name}, ${f.properties.place_formatted ?? ''}`.trim(),
    latitude: f.properties.coordinates.latitude,
    longitude: f.properties.coordinates.longitude,
    placeType: f.properties.feature_type,
    source: 'mapbox' as const,
  }));
}

/**
 * Nominatim (OpenStreetMap) autocomplete.
 * Free, no API key needed, excellent Ghana community data.
 * Rate limit: 1 req/s — the 250ms client debounce handles this.
 */
async function nominatimAutocomplete(
  query: string,
  options: { proximity: { lat: number; lng: number }; limit: number },
): Promise<AutocompleteSuggestion[]> {
  try {
    const params = new URLSearchParams({
      q: `${query}, Ghana`,
      format: 'json',
      addressdetails: '1',
      limit: String(options.limit),
      countrycodes: 'gh',
      viewbox: GHANA_BBOX,
      bounded: '1',
    });

    const url = `${NOMINATIM_SEARCH}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RiderGuy-Delivery-App/1.0 (support@riderguy.com)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3000), // 3s timeout to avoid blocking
    });

    if (!response.ok) return [];

    const data = (await response.json()) as NominatimResult[];

    return data.map((r) => {
      const parts: string[] = [];
      if (r.address?.suburb) parts.push(r.address.suburb);
      if (r.address?.city || r.address?.town || r.address?.village) {
        parts.push(r.address.city ?? r.address.town ?? r.address.village ?? '');
      }

      // Derive a short display name
      const shortName = r.address?.suburb ?? r.address?.neighbourhood ?? r.name ?? r.display_name.split(',')[0] ?? '';

      return {
        id: `nom-${r.place_id}`,
        text: shortName,
        placeName: r.display_name,
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
        placeType: r.type ?? 'place',
        source: 'nominatim' as const,
      };
    });
  } catch {
    // Nominatim is supplementary — silently fail
    return [];
  }
}

/**
 * Deduplicate suggestions by comparing coordinates (within ~200m)
 * and name similarity. Earlier items in the array take priority.
 */
function deduplicateSuggestions(suggestions: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
  const seen: AutocompleteSuggestion[] = [];

  for (const s of suggestions) {
    const isDuplicate = seen.some((existing) => {
      // Check coordinate proximity (~200m threshold)
      if (
        existing.latitude != null && s.latitude != null &&
        existing.longitude != null && s.longitude != null
      ) {
        const latDiff = Math.abs(existing.latitude - s.latitude);
        const lngDiff = Math.abs(existing.longitude - s.longitude);
        if (latDiff < 0.002 && lngDiff < 0.002) return true;
      }

      // Check name similarity
      const a = existing.text?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
      const b = s.text?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
      if (a && b && (a.includes(b) || b.includes(a))) return true;

      return false;
    });

    if (!isDuplicate) {
      seen.push(s);
    }
  }

  return seen;
}

/**
 * Retrieve full place details (including coordinates) for a
 * suggestion selected by the user.
 *
 * For Geocoding v6 and Nominatim results, coordinates are already
 * included in the suggestion — this builds a RetrievedPlace directly.
 *
 * For legacy Search Box IDs (dXJuO... prefix), uses the retrieve endpoint.
 * For gazetteer IDs (gaz- prefix), looks up the gazetteer.
 * For Nominatim IDs (nom- prefix), data is already in the suggestion.
 */
export async function retrievePlace(
  mapboxId: string,
  sessionToken?: string,
): Promise<RetrievedPlace | null> {
  const token = config.mapbox?.accessToken;

  if (!token) {
    warnMockFallback('retrievePlace');
    return null;
  }

  // Gazetteer entries — look up directly
  if (mapboxId.startsWith('gaz-')) {
    const namePart = mapboxId.replace(/^gaz-\d+-/, '').replace(/-/g, ' ');
    const entry = GHANA_GAZETTEER.find(
      (e) => e.name.toLowerCase().replace(/\s/g, ' ') === namePart
    );
    if (entry) {
      return {
        id: mapboxId,
        name: entry.name,
        fullAddress: `${entry.name}, ${entry.area}, Ghana`,
        latitude: entry.lat,
        longitude: entry.lng,
        placeType: 'place',
        plusCode: formatPlusCode(entry.lat, entry.lng),
      };
    }
  }

  // Nominatim entries — coordinates were already in suggestion
  // The client should skip retrieve for these, but handle gracefully
  if (mapboxId.startsWith('nom-')) {
    return null; // Coordinates already in suggestion; client should use them
  }

  // Mapbox IDs — use Search Box retrieve for dXJuO... IDs,
  // or Geocoding v6 forward lookup for other Mapbox IDs
  if (mapboxId.startsWith('dXJuO')) {
    // Search Box retrieve endpoint
    const params = new URLSearchParams({ access_token: token });
    if (sessionToken) {
      params.set('session_token', sessionToken);
    }

    const url = `${SEARCHBOX_RETRIEVE}/${encodeURIComponent(mapboxId)}?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('[GeocodingService] Search Box retrieve failed:', response.status);
      return null;
    }

    const data = (await response.json()) as SearchBoxRetrieveResponse;
    const feature = data.features?.[0];
    if (!feature) return null;

    const [lng, lat] = feature.geometry.coordinates;

    return {
      id: feature.properties.mapbox_id,
      name: feature.properties.name,
      fullAddress:
        feature.properties.full_address ??
        `${feature.properties.name}, ${feature.properties.place_formatted ?? ''}`.trim(),
      latitude: lat,
      longitude: lng,
      placeType: feature.properties.feature_type ?? 'unknown',
      plusCode: formatPlusCode(lat, lng),
    };
  }

  // For other Mapbox IDs, try forward lookup by ID
  const params = new URLSearchParams({
    q: mapboxId,
    access_token: token,
    limit: '1',
    language: 'en',
  });

  const url = `${GEOCODE_FORWARD}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as GeocodingV6Response;
  const feature = data.features?.[0];
  if (!feature) return null;

  return {
    id: feature.properties.mapbox_id ?? feature.id,
    name: feature.properties.name,
    fullAddress:
      feature.properties.full_address ??
      `${feature.properties.name}, ${feature.properties.place_formatted ?? ''}`.trim(),
    latitude: feature.properties.coordinates.latitude,
    longitude: feature.properties.coordinates.longitude,
    placeType: feature.properties.feature_type ?? 'unknown',
    plusCode: formatPlusCode(feature.properties.coordinates.latitude, feature.properties.coordinates.longitude),
  };
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

// ── Mapbox Search Box v1 response types (kept for retrieve) ──

interface SearchBoxRetrieveFeature {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    mapbox_id: string;
    feature_type: string;
    name: string;
    name_preferred?: string;
    place_formatted?: string;
    full_address?: string;
    coordinates: { longitude: number; latitude: number };
    context?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    poi_category?: string[];
  };
}

interface SearchBoxRetrieveResponse {
  type: string;
  features: SearchBoxRetrieveFeature[];
  attribution?: string;
}

// ── Nominatim response types ──────────────────────────────

interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  type: string;
  display_name: string;
  name?: string;
  address?: {
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    road?: string;
  };
}

// ---- Mock implementations for local dev ----

function mockForwardGeocode(address: string): GeocodingResult[] {
  const lower = address.toLowerCase();
  const matches = GHANA_GAZETTEER.filter(
    (a) => a.name.toLowerCase().includes(lower) || a.area.toLowerCase().includes(lower)
  );

  if (matches.length > 0) {
    return matches.slice(0, 5).map((m) => ({
      address: `${m.name}, ${m.area}`,
      latitude: m.lat,
      longitude: m.lng,
      placeType: 'place',
    }));
  }

  // Return a random location if no match
  const fallback = GHANA_GAZETTEER[Math.floor(Math.random() * GHANA_GAZETTEER.length)]!;
  return [
    {
      address: `${address} (${fallback.name}, ${fallback.area})`,
      latitude: fallback.lat + (Math.random() - 0.5) * 0.01,
      longitude: fallback.lng + (Math.random() - 0.5) * 0.01,
      placeType: 'address',
    },
  ];
}

function mockAutocomplete(query: string): AutocompleteSuggestion[] {
  return searchGazetteer(query, 5);
}
