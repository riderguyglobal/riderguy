import { config } from '../config';
import { ApiError } from '../lib/api-error';
import { formatPlusCode } from '@riderguy/utils';
import { prisma } from '@riderguy/database';
import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeAddress,
  fuzzyMatch,
  buildTrigramIndex,
  searchTrigramIndex,
  type IndexedEntry,
} from '../lib/fuzzy-search';
import {
  parseNaturalLocation,
  isNaturalLanguageQuery,
} from '../lib/natural-location-parser';
import {
  recordLocationSelection,
  getPopularityBoosts,
} from './popularity.service';

// ============================================================
// Geocoding Service — converts addresses to coordinates and
// provides autocomplete suggestions.
//
// Strategy for Ghana / West Africa:
//
// 1. **Google Geocoding API** is the PRIMARY geocoding provider
//    for forward and reverse geocoding.
//
// 2. **Nominatim (OpenStreetMap)** is queried in parallel as a
//    SUPPLEMENTARY provider — OSM has excellent community-mapped
//    data for Ghana (neighborhoods, markets, landmarks).
//
// 3. A **comprehensive local Ghana gazetteer** of 42,000+
//    locations provides instant offline matching. Sources:
//    • GeoNames.org (CC BY 4.0) — 15,997 populated places
//    • HOT/OSM Populated Places (CC BY 4.0) — 6,300+ settlements
//    • HOT/OSM Points of Interest (CC BY 4.0) — 20,000+ named POIs
//      (restaurants, hotels, fuel stations, hospitals, schools,
//      banks, shops, markets, places of worship, etc.)
//    An additional set of curated landmarks supplements the dataset.
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
  /** Coordinates are included whenever available (Google Geocoding, Nominatim, gazetteer) */
  latitude?: number;
  longitude?: number;
  placeType?: string;
  category?: string;
  /** Source provider for logging / debugging */
  source?: 'google' | 'nominatim' | 'gazetteer' | 'community';
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

// ── Google Geocoding API endpoint ─────────────────────────
const GOOGLE_GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';

// ── Nominatim (OpenStreetMap) endpoint ────────────────────
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';

/** Ghana bounding box: [minLng, minLat, maxLng, maxLat] */
const GHANA_BBOX = '-3.26,4.74,1.19,11.17';

/** Accra center for proximity bias */
const ACCRA_CENTER = { lng: -0.187, lat: 5.603 };

function warnMockFallback(method: string) {
  console.warn(
    `[GeocodingService] ${method}: GOOGLE_MAPS_API_KEY not set — using mock data. Set the key in .env for real geocoding.`
  );
}

// ═══════════════════════════════════════════════════════════
// Ghana Gazetteer — 42,000+ locations from multiple sources:
// • GeoNames.org (15,997 populated places)
// • HOT/OSM Populated Places (6,300+ unique settlements)
// • HOT/OSM Points of Interest (20,000+ named POIs)
// plus curated landmarks (malls, hospitals, airports, etc.)
// ═══════════════════════════════════════════════════════════

/** Unified gazetteer entry from ghana-places.json */
interface GazetteerEntry {
  n: string;             // display name
  a?: string;            // ascii / english name (when different from n)
  lat: number;
  lon: number;
  p?: number;            // population (places only)
  r?: string;            // region name (GeoNames places only)
  al?: string[];         // alternate names (GeoNames places only)
  t: 'place' | 'poi';   // type: populated place or point of interest
  c?: string;            // category (POIs only): health, education, food, shop, etc.
  st?: string;           // subtype: village, town, hotel, fuel, pharmacy, etc.
  src: 'gn' | 'osm' | 'dre' | 'nga';  // source: geonames, openstreetmap, DRE Atlas, or NGA GEOnet
}

/** Curated landmark / POI entry */
interface LandmarkEntry {
  name: string;
  area: string;          // parent city / region
  lat: number;
  lng: number;
  aliases?: string[];    // alternative spellings / local names
}

// ────────────────────────────────────────────────────────────
// Curated landmarks — malls, hospitals, airports, popular
// neighborhoods, and other POIs that are commonly searched
// but may not appear (or appear poorly) in GeoNames data.
// ────────────────────────────────────────────────────────────
const LANDMARKS: LandmarkEntry[] = [
  // ── Greater Accra neighborhoods ───────────────
  { name: 'East Legon', area: 'Accra', lat: 5.6350, lng: -0.1572 },
  { name: 'West Legon', area: 'Accra', lat: 5.6380, lng: -0.2210 },
  { name: 'Osu', area: 'Accra', lat: 5.5560, lng: -0.1870, aliases: ['Oxford Street'] },
  { name: 'Airport Residential', area: 'Accra', lat: 5.6050, lng: -0.1700, aliases: ['Airport Area'] },
  { name: 'Cantonments', area: 'Accra', lat: 5.5720, lng: -0.1770 },
  { name: 'Labone', area: 'Accra', lat: 5.5630, lng: -0.1830 },
  { name: 'Spintex', area: 'Accra', lat: 5.6340, lng: -0.0960, aliases: ['Spintex Road'] },
  { name: 'Dzorwulu', area: 'Accra', lat: 5.6100, lng: -0.1990 },
  { name: 'Roman Ridge', area: 'Accra', lat: 5.5750, lng: -0.1940 },
  { name: 'Asylum Down', area: 'Accra', lat: 5.5630, lng: -0.2090 },
  { name: 'Pig Farm', area: 'Accra', lat: 5.5680, lng: -0.2290 },
  { name: 'Abelemkpe', area: 'Accra', lat: 5.5950, lng: -0.2030 },
  { name: 'Sakumono', area: 'Accra', lat: 5.6210, lng: -0.0480, aliases: ['Sakumono Estates'] },
  { name: 'Lapaz', area: 'Accra', lat: 5.6090, lng: -0.2470, aliases: ['La Paz'] },
  { name: 'Circle', area: 'Accra', lat: 5.5700, lng: -0.2170, aliases: ['Kwame Nkrumah Circle'] },
  { name: 'Agbogba', area: 'Accra', lat: 5.6710, lng: -0.1810 },

  // ── Takoradi / Western Region neighborhoods ───
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
  { name: 'Essikado', area: 'Sekondi-Takoradi', lat: 4.9420, lng: -1.7010 },
  { name: 'Dixcove Hill', area: 'Takoradi', lat: 4.9030, lng: -1.7490 },
  { name: 'Windy Ridge', area: 'Takoradi', lat: 4.9150, lng: -1.7470 },
  { name: 'Airport Ridge', area: 'Takoradi', lat: 4.9220, lng: -1.7410, aliases: ['Takoradi Airport'] },
  { name: 'West Tanokrom', area: 'Takoradi', lat: 4.9110, lng: -1.7560 },
  { name: 'Harbour Area', area: 'Takoradi', lat: 4.8920, lng: -1.7510, aliases: ['Takoradi Harbour'] },
  { name: 'Liberation Road', area: 'Takoradi', lat: 4.9030, lng: -1.7530 },

  // ── Kumasi / Ashanti neighborhoods ────────────
  { name: 'Adum', area: 'Kumasi', lat: 6.6940, lng: -1.6220 },
  { name: 'Kejetia', area: 'Kumasi', lat: 6.6920, lng: -1.6260, aliases: ['Kejetia Market'] },
  { name: 'Bantama', area: 'Kumasi', lat: 6.7020, lng: -1.6350 },
  { name: 'Ahodwo', area: 'Kumasi', lat: 6.6700, lng: -1.6370, aliases: ['Ahodwo Roundabout'] },
  { name: 'Ayigya', area: 'Kumasi', lat: 6.6780, lng: -1.5730, aliases: ['KNUST Area'] },
  { name: 'Suame', area: 'Kumasi', lat: 6.7180, lng: -1.6210, aliases: ['Suame Magazine'] },
  { name: 'Tech Junction', area: 'Kumasi', lat: 6.6850, lng: -1.5730, aliases: ['KNUST Junction'] },
  { name: 'Asafo', area: 'Kumasi', lat: 6.6890, lng: -1.6110, aliases: ['Asafo Market'] },
  { name: 'Nhyiaeso', area: 'Kumasi', lat: 6.6740, lng: -1.6240 },

  // ── Popular landmarks & POIs ──────────────────
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
  { name: 'Korle Bu Teaching Hospital', area: 'Accra', lat: 5.5350, lng: -0.2270, aliases: ['Korle-Bu', 'Korle Bu'] },
  { name: '37 Military Hospital', area: 'Accra', lat: 5.5920, lng: -0.1860, aliases: ['37 Hospital'] },
  { name: 'Effia Nkwanta Hospital', area: 'Takoradi', lat: 4.9310, lng: -1.7590 },
  { name: 'KNUST', area: 'Kumasi', lat: 6.6730, lng: -1.5670, aliases: ['Kwame Nkrumah University of Science and Technology'] },
  { name: 'University of Ghana', area: 'Accra', lat: 5.6510, lng: -0.1860, aliases: ['UG', 'Legon'] },
  { name: 'UCC Campus', area: 'Cape Coast', lat: 5.1120, lng: -1.2890, aliases: ['University of Cape Coast'] },
];

// ── Load gazetteer dataset at startup ─────────────────────
let gazetteerEntries: GazetteerEntry[] = [];
let gazetteerLoaded = false;
let gazetteerIndex: IndexedEntry[] = [];
let landmarkIndex: IndexedEntry[] = [];

function loadGazetteerData(): void {
  if (gazetteerLoaded) return;
  try {
    // Try multiple paths to support both dev (tsx src/) and prod (node dist/)
    const candidates = [
      path.join(__dirname, '..', 'data', 'ghana-places.json'),    // dist/services → dist/data  OR  src/services → src/data
      path.join(__dirname, 'data', 'ghana-places.json'),           // fallback
      path.resolve(process.cwd(), 'src', 'data', 'ghana-places.json'),  // cwd-based (for tsx)
      path.resolve(process.cwd(), 'data', 'ghana-places.json'),         // cwd-based (for Docker/Render)
    ];

    let filePath: string | null = null;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        filePath = candidate;
        break;
      }
    }

    if (filePath) {
      const raw = fs.readFileSync(filePath, 'utf8');
      gazetteerEntries = JSON.parse(raw) as GazetteerEntry[];
      const places = gazetteerEntries.filter(e => e.t === 'place').length;
      const pois = gazetteerEntries.filter(e => e.t === 'poi').length;
      console.log(`[GeocodingService] Loaded ${gazetteerEntries.length} Ghana locations (${places} places + ${pois} POIs) from ${filePath}`);

      // Build trigram indexes for fuzzy search
      const indexStartTime = Date.now();
      gazetteerIndex = buildTrigramIndex(
        gazetteerEntries.map((e) => ({
          name: e.n,
          altNames: [
            ...(e.a ? [e.a] : []),
            ...(e.al ?? []),
            ...(e.r ? [`${e.n}, ${e.r}`] : []),
          ],
        })),
      );
      landmarkIndex = buildTrigramIndex(
        LANDMARKS.map((e) => ({
          name: e.name,
          altNames: [
            ...(e.aliases ?? []),
            `${e.name}, ${e.area}`,
          ],
        })),
      );
      console.log(`[GeocodingService] Built fuzzy indexes (${gazetteerIndex.length} + ${landmarkIndex.length} entries) in ${Date.now() - indexStartTime}ms`);
    } else {
      console.warn('[GeocodingService] ghana-places.json not found — gazetteer will use landmarks only. Checked:', candidates.join(', '));
    }
  } catch (err) {
    console.error('[GeocodingService] Failed to load gazetteer data:', err);
  }
  gazetteerLoaded = true;
}

// Load on first import
loadGazetteerData();

/**
 * Search the comprehensive gazetteer for matching locations.
 *
 * Uses trigram-indexed fuzzy search with:
 * • Typo tolerance (Levenshtein + Damerau-Levenshtein)
 * • Address normalization (Rd→Road, St→Street, etc.)
 * • Trigram pre-filtering for fast lookups across 80K+ entries
 * • Population & proximity bonuses
 * • Usage-based popularity boosts (learned from user selections)
 *
 * @param query  The user's search text
 * @param limit  Maximum results to return
 * @param proximity  Optional coordinates to boost nearby results
 * @param popularityBoosts  Pre-fetched popularity data
 */
function searchGazetteer(
  query: string,
  limit = 5,
  proximity?: { lat: number; lng: number },
  popularityBoosts?: Map<string, number>,
): AutocompleteSuggestion[] {
  const lower = query.toLowerCase().trim();
  if (!lower || lower.length < 2) return [];
  const normQuery = normalizeAddress(query);

  const scored: { name: string; area: string; lat: number; lng: number; score: number; source: 'landmark' | 'gazetteer'; category?: string; placeType?: string }[] = [];

  // ── 1. Search curated landmarks via fuzzy index ───────────
  if (landmarkIndex.length > 0) {
    const landmarkHits = searchTrigramIndex(normQuery, landmarkIndex, 0.28, 10);
    for (const hit of landmarkHits) {
      const entry = LANDMARKS[hit.index];
      if (!entry) continue;

      // Convert fuzzy score (0–1) to scoring scale (0–200)
      let baseScore = hit.score * 200;

      // Popularity boost
      const popBoost = popularityBoosts?.get(normalizeAddress(entry.name)) ?? 0;
      baseScore += popBoost * 5;

      scored.push({
        name: entry.name,
        area: entry.area,
        lat: entry.lat,
        lng: entry.lng,
        score: baseScore,
        source: 'landmark',
      });
    }
  } else {
    // Fallback: linear search with fuzzy matching if index not built
    for (const entry of LANDMARKS) {
      const match = fuzzyMatch(normQuery, normalizeAddress(entry.name));
      if (match.score < 0.28) {
        // Also try aliases
        let bestAliasScore = 0;
        for (const alias of entry.aliases ?? []) {
          const aliasMatch = fuzzyMatch(normQuery, normalizeAddress(alias));
          bestAliasScore = Math.max(bestAliasScore, aliasMatch.score);
        }
        if (bestAliasScore < 0.28) continue;
        // Use alias score
        const popBoost = popularityBoosts?.get(normalizeAddress(entry.name)) ?? 0;
        scored.push({
          name: entry.name,
          area: entry.area,
          lat: entry.lat,
          lng: entry.lng,
          score: bestAliasScore * 180 + popBoost * 5,
          source: 'landmark',
        });
        continue;
      }

      const popBoost = popularityBoosts?.get(normalizeAddress(entry.name)) ?? 0;
      scored.push({
        name: entry.name,
        area: entry.area,
        lat: entry.lat,
        lng: entry.lng,
        score: match.score * 200 + popBoost * 5,
        source: 'landmark',
      });
    }
  }

  // ── 2. Search unified gazetteer via fuzzy trigram index ─────────
  if (gazetteerIndex.length > 0) {
    const gazHits = searchTrigramIndex(normQuery, gazetteerIndex, 0.28, 30);
    for (const hit of gazHits) {
      const entry = gazetteerEntries[hit.index];
      if (!entry) continue;

      const isPlace = entry.t === 'place';
      // Scale: fuzzy score (0–1) → base (0–100/90 for places/POIs)
      const maxBase = isPlace ? 100 : 90;
      let baseScore = hit.score * maxBase;

      // Population bonus (same as before)
      const pop = entry.p ?? 0;
      const popBonus = pop > 100000 ? 15 : pop > 50000 ? 10 : pop > 10000 ? 5 : pop > 1000 ? 2 : 0;

      // Proximity bonus
      let proxBonus = 0;
      if (proximity) {
        const dist = Math.abs(entry.lat - proximity.lat) + Math.abs(entry.lon - proximity.lng);
        if (dist < 0.1) proxBonus = 10;
        else if (dist < 0.3) proxBonus = 5;
        else if (dist < 1.0) proxBonus = 2;
      }

      // Popularity boost from learned data
      const popBoost = popularityBoosts?.get(normalizeAddress(entry.n)) ?? 0;

      let area = entry.r ?? '';
      if (!area && entry.c) {
        area = entry.c.charAt(0).toUpperCase() + entry.c.slice(1);
      }

      scored.push({
        name: entry.n,
        area,
        lat: entry.lat,
        lng: entry.lon,
        score: baseScore + popBonus + proxBonus + popBoost * 3,
        source: 'gazetteer',
        category: entry.c,
        placeType: isPlace ? (entry.st ?? 'place') : (entry.st ?? entry.c ?? 'poi'),
      });
    }
  } else {
    // Fallback: linear fuzzy search (slower but works without index)
    for (const entry of gazetteerEntries) {
      const names = [entry.n, ...(entry.a ? [entry.a] : []), ...(entry.al ?? [])];
      let bestScore = 0;
      for (const name of names) {
        const match = fuzzyMatch(normQuery, normalizeAddress(name));
        bestScore = Math.max(bestScore, match.score);
      }

      // Also try category/subtype matching for POI searches
      if (bestScore < 0.28 && entry.t === 'poi') {
        if (entry.st) {
          const stMatch = fuzzyMatch(normQuery, entry.st.toLowerCase());
          bestScore = Math.max(bestScore, stMatch.score * 0.7);
        }
        if (entry.c) {
          const cMatch = fuzzyMatch(normQuery, entry.c.toLowerCase());
          bestScore = Math.max(bestScore, cMatch.score * 0.6);
        }
      }

      if (bestScore < 0.28) continue;

      const isPlace = entry.t === 'place';
      const maxBase = isPlace ? 100 : 90;
      const pop = entry.p ?? 0;
      const popBonus = pop > 100000 ? 15 : pop > 50000 ? 10 : pop > 10000 ? 5 : pop > 1000 ? 2 : 0;
      let proxBonus = 0;
      if (proximity) {
        const dist = Math.abs(entry.lat - proximity.lat) + Math.abs(entry.lon - proximity.lng);
        if (dist < 0.1) proxBonus = 10;
        else if (dist < 0.3) proxBonus = 5;
        else if (dist < 1.0) proxBonus = 2;
      }

      const popBoost = popularityBoosts?.get(normalizeAddress(entry.n)) ?? 0;
      let area = entry.r ?? '';
      if (!area && entry.c) area = entry.c.charAt(0).toUpperCase() + entry.c.slice(1);

      scored.push({
        name: entry.n,
        area,
        lat: entry.lat,
        lng: entry.lon,
        score: bestScore * maxBase + popBonus + proxBonus + popBoost * 3,
        source: 'gazetteer',
        category: entry.c,
        placeType: isPlace ? (entry.st ?? 'place') : (entry.st ?? entry.c ?? 'poi'),
      });
    }
  }

  // Sort by score descending, then deduplicate by proximity
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate: skip entries within ~200m of an already-selected result
  const selected: typeof scored = [];
  for (const s of scored) {
    const tooClose = selected.some(
      (existing) =>
        Math.abs(existing.lat - s.lat) < 0.002 &&
        Math.abs(existing.lng - s.lng) < 0.002,
    );
    if (!tooClose) {
      selected.push(s);
      if (selected.length >= limit) break;
    }
  }

  return selected.map((s, i) => ({
    id: `gaz-${i}-${s.name.toLowerCase().replace(/\s/g, '-')}`,
    text: s.name,
    placeName: s.area ? `${s.name}, ${s.area}, Ghana` : `${s.name}, Ghana`,
    latitude: s.lat,
    longitude: s.lng,
    placeType: s.placeType ?? 'place',
    category: s.category,
    source: 'gazetteer' as const,
  }));
}

/**
 * Forward geocode: address text → coordinates.
 * Uses Google Geocoding API.
 * Biased towards Ghana by default.
 */
export async function forwardGeocode(
  address: string,
  options: { country?: string; limit?: number; proximity?: { lat: number; lng: number } } = {},
): Promise<GeocodingResult[]> {
  const apiKey = config.google?.mapsApiKey;

  if (!apiKey) {
    warnMockFallback('forwardGeocode');
    return mockForwardGeocode(address);
  }

  const limit = options.limit ?? 5;

  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: 'gh',
    language: 'en',
  });

  const url = `${GOOGLE_GEOCODE}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw ApiError.internal('Geocoding service unavailable');
  }

  const data = (await response.json()) as GoogleGeocodingResponse;

  if (data.status !== 'OK' || !data.results?.length) return [];

  return data.results.slice(0, limit).map((r) => {
    const lat = r.geometry.location.lat;
    const lng = r.geometry.location.lng;
    return {
      address: r.formatted_address,
      latitude: lat,
      longitude: lng,
      placeType: r.types?.[0] ?? 'unknown',
      plusCode: formatPlusCode(lat, lng),
    };
  });
}

/**
 * Reverse geocode: coordinates → address.
 * Uses Google Geocoding API.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodingResult | null> {
  const apiKey = config.google?.mapsApiKey;

  if (!apiKey) {
    warnMockFallback('reverseGeocode');
    return {
      address: 'Address not available',
      latitude,
      longitude,
      placeType: 'coordinate',
    };
  }

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    key: apiKey,
    language: 'en',
    result_type: 'street_address|route|neighborhood|sublocality|locality',
  });

  const url = `${GOOGLE_GEOCODE}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw ApiError.internal('Reverse geocoding service unavailable');
  }

  const data = (await response.json()) as GoogleGeocodingResponse;
  const result = data.results?.[0];
  if (!result) return null;

  return {
    address: result.formatted_address,
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    placeType: result.types?.[0] ?? 'unknown',
    plusCode: formatPlusCode(result.geometry.location.lat, result.geometry.location.lng),
  };
}

/**
 * Autocomplete: partial text → suggestions.
 *
 * Intelligent multi-provider strategy:
 * 1. Natural language parsing (if query looks like a description)
 * 2. Local Ghana gazetteer with fuzzy trigram search (instant)
 * 3. Community places from database (user-contributed)
 * 4. Google Geocoding API with autocomplete (global)
 * 5. Nominatim / OpenStreetMap (supplementary)
 * 6. Popularity boosts from learned user selections
 *
 * Results are merged, deduplicated, and returned with coordinates
 * already included — no separate retrieve step needed.
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
  const apiKey = config.google?.mapsApiKey;

  if (!apiKey) {
    warnMockFallback('autocomplete');
    return mockAutocomplete(query);
  }

  const limit = options.limit ?? 8;
  const prox = options.proximity ?? ACCRA_CENTER;

  // ── 0. Natural language parsing ──────────────────────────
  let searchQueries = [query];
  if (isNaturalLanguageQuery(query)) {
    const parsed = parseNaturalLocation(query);
    searchQueries = [parsed.primaryPlace, ...parsed.alternativeQueries].filter(Boolean);
    if (parsed.primaryPlace !== query) {
      searchQueries.push(query);
    }
  }

  // ── 1. Fetch popularity boosts in parallel with other lookups ──
  const popularityPromise = getPopularityBoosts(query).catch(() => new Map<string, number>());

  // ── 2. Instant local gazetteer lookup (synchronous, zero latency) ──
  const popularityBoosts = await popularityPromise;
  let gazetteerResults: AutocompleteSuggestion[] = [];
  for (const sq of searchQueries) {
    const results = searchGazetteer(sq, 6, prox, popularityBoosts);
    gazetteerResults = gazetteerResults.concat(results);
    if (gazetteerResults.length >= 6) break;
  }
  gazetteerResults = deduplicateSuggestions(gazetteerResults).slice(0, 6);

  // ── 3. Community places — user-contributed locations ──
  const communityPromise = searchCommunityPlaces(searchQueries[0]!, 6, prox);

  // ── 4. Google Geocoding API ──
  const googlePromise = googleGeocodeAutocomplete(query, { proximity: prox, limit });

  // ── 5. Nominatim / OpenStreetMap (supplementary) ──
  const nominatimPromise = nominatimAutocomplete(query, { proximity: prox, limit: 5 });

  // Wait for all API providers in parallel
  const [communityResults, googleResults, nominatimResults] = await Promise.allSettled([
    communityPromise,
    googlePromise,
    nominatimPromise,
  ]);

  const community = communityResults.status === 'fulfilled' ? communityResults.value : [];
  const google = googleResults.status === 'fulfilled' ? googleResults.value : [];
  const nominatim = nominatimResults.status === 'fulfilled' ? nominatimResults.value : [];

  if (communityResults.status === 'rejected') {
    console.warn('[GeocodingService] Community places search failed:', communityResults.reason);
  }
  if (googleResults.status === 'rejected') {
    console.warn('[GeocodingService] Google geocoding failed:', googleResults.reason);
  }
  if (nominatimResults.status === 'rejected') {
    console.warn('[GeocodingService] Nominatim autocomplete failed:', nominatimResults.reason);
  }

  // Merge: gazetteer first (instant + fuzzy), then community,
  // then Google (API), then Nominatim (supplementary)
  const merged = deduplicateSuggestions([...gazetteerResults, ...community, ...google, ...nominatim]);

  return merged.slice(0, limit);
}

/**
 * Google Geocoding API autocomplete.
 * Returns results WITH coordinates.
 */
async function googleGeocodeAutocomplete(
  query: string,
  options: { proximity: { lat: number; lng: number }; limit: number },
): Promise<AutocompleteSuggestion[]> {
  const apiKey = config.google?.mapsApiKey;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    address: query,
    key: apiKey,
    region: 'gh',
    language: 'en',
    bounds: `4.74,-3.26|11.17,1.19`,
  });

  const url = `${GOOGLE_GEOCODE}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) return [];

  const data = (await response.json()) as GoogleGeocodingResponse;
  if (data.status !== 'OK' || !data.results?.length) return [];

  return data.results.slice(0, options.limit).map((r) => {
    // Extract a short display name from address components
    const shortName = r.address_components?.[0]?.long_name ?? r.formatted_address.split(',')[0] ?? '';
    return {
      id: `google-${r.place_id}`,
      text: shortName,
      placeName: r.formatted_address,
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
      placeType: r.types?.[0] ?? 'place',
      source: 'google' as const,
    };
  });
}

/**
 * Search community places (user-contributed locations) from the database.
 * These are locations added by users via Google Maps links or pin drops.
 * Results are scored by match quality, usage count, and proximity.
 */
async function searchCommunityPlaces(
  query: string,
  limit = 6,
  proximity?: { lat: number; lng: number },
): Promise<AutocompleteSuggestion[]> {
  try {
    const lower = query.toLowerCase().trim();
    if (lower.length < 2) return [];

    const places = await prisma.communityPlace.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
      take: limit * 3, // Fetch extra for proximity sorting
    });

    if (places.length === 0) return [];

    // Score and sort by relevance + proximity
    type ScoredPlace = { place: typeof places[number]; score: number };
    const scored: ScoredPlace[] = places.map((p) => {
      let score = 0;
      const nameLower = p.name.toLowerCase();

      // Name matching
      if (nameLower === lower) score += 100;
      else if (nameLower.startsWith(lower)) score += 80;
      else if (nameLower.includes(lower)) score += 60;
      else score += 30; // matched via address or category

      // Usage count bonus (popular places rank higher)
      score += Math.min(p.usageCount * 3, 30);

      // Verified bonus
      if (p.verified) score += 15;

      // Proximity bonus
      if (proximity) {
        const dist = Math.abs(p.latitude - proximity.lat) + Math.abs(p.longitude - proximity.lng);
        if (dist < 0.1) score += 10;       // ~10km
        else if (dist < 0.3) score += 5;   // ~30km
        else if (dist < 1.0) score += 2;   // ~100km
      }

      return { place: p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s, i) => ({
      id: `com-${s.place.id}`,
      text: s.place.name,
      placeName: s.place.address
        ? `${s.place.name}, ${s.place.address}`
        : `${s.place.name}, Ghana`,
      latitude: s.place.latitude,
      longitude: s.place.longitude,
      placeType: s.place.placeType,
      category: s.place.category ?? undefined,
      source: 'community' as const,
    }));
  } catch (err) {
    console.warn('[GeocodingService] Community places search failed:', err);
    return [];
  }
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
        'User-Agent': 'RiderGuy-Delivery-App/1.0 (support@myriderguy.com)',
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
 * For Google, Nominatim, and gazetteer results, coordinates are
 * already included in the suggestion — this builds a RetrievedPlace directly.
 *
 * For gazetteer IDs (gaz- prefix), looks up the gazetteer.
 * For Nominatim IDs (nom- prefix), data is already in the suggestion.
 * For Google IDs (google- prefix), uses Google Geocoding by place_id.
 */
export async function retrievePlace(
  placeId: string,
  sessionToken?: string,
): Promise<RetrievedPlace | null> {
  const apiKey = config.google?.mapsApiKey;

  if (!apiKey) {
    warnMockFallback('retrievePlace');
    return null;
  }

  // Gazetteer entries — search landmarks + GeoNames by name
  if (placeId.startsWith('gaz-')) {
    const namePart = placeId.replace(/^gaz-\d+-/, '').replace(/-/g, ' ');

    // First check curated landmarks
    const landmark = LANDMARKS.find(
      (e) => e.name.toLowerCase().replace(/\s/g, ' ') === namePart
    );
    if (landmark) {
      return {
        id: placeId,
        name: landmark.name,
        fullAddress: `${landmark.name}, ${landmark.area}, Ghana`,
        latitude: landmark.lat,
        longitude: landmark.lng,
        placeType: 'place',
        plusCode: formatPlusCode(landmark.lat, landmark.lng),
      };
    }

    // Then check the full gazetteer dataset
    const geoPlace = gazetteerEntries.find(
      (e) => e.n.toLowerCase().replace(/\s/g, ' ') === namePart ||
             (e.a && e.a.toLowerCase().replace(/\s/g, ' ') === namePart)
    );
    if (geoPlace) {
      const area = geoPlace.r ?? (geoPlace.c ? geoPlace.c.charAt(0).toUpperCase() + geoPlace.c.slice(1) : '');
      return {
        id: placeId,
        name: geoPlace.n,
        fullAddress: area ? `${geoPlace.n}, ${area}, Ghana` : `${geoPlace.n}, Ghana`,
        latitude: geoPlace.lat,
        longitude: geoPlace.lon,
        placeType: geoPlace.t === 'poi' ? (geoPlace.st ?? 'poi') : 'place',
        plusCode: formatPlusCode(geoPlace.lat, geoPlace.lon),
      };
    }
  }

  // Nominatim entries — coordinates were already in suggestion
  if (placeId.startsWith('nom-')) {
    return null;
  }

  // Community place entries — look up from database and increment usage
  if (placeId.startsWith('com-')) {
    const dbId = placeId.replace('com-', '');
    try {
      const place = await prisma.communityPlace.update({
        where: { id: dbId },
        data: { usageCount: { increment: 1 } },
      });
      return {
        id: placeId,
        name: place.name,
        fullAddress: place.address ?? `${place.name}, Ghana`,
        latitude: place.latitude,
        longitude: place.longitude,
        placeType: place.placeType,
        plusCode: formatPlusCode(place.latitude, place.longitude),
      };
    } catch {
      return null;
    }
  }

  // Google place IDs — use Google Geocoding to retrieve by place_id
  if (placeId.startsWith('google-')) {
    const googlePlaceId = placeId.replace('google-', '');
    const params = new URLSearchParams({
      place_id: googlePlaceId,
      key: apiKey,
      language: 'en',
    });

    const url = `${GOOGLE_GEOCODE}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as GoogleGeocodingResponse;
    const result = data.results?.[0];
    if (!result) return null;

    return {
      id: placeId,
      name: result.address_components?.[0]?.long_name ?? result.formatted_address.split(',')[0] ?? '',
      fullAddress: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      placeType: result.types?.[0] ?? 'unknown',
      plusCode: formatPlusCode(result.geometry.location.lat, result.geometry.location.lng),
    };
  }

  return null;
}

// ── Google Geocoding API response types ───────────────────

interface GoogleGeocodingResult {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
    location_type: string;
    viewport: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } };
  };
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  types: string[];
}

interface GoogleGeocodingResponse {
  status: string;
  results: GoogleGeocodingResult[];
  error_message?: string;
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

  // Search landmarks first
  const landmarkMatches = LANDMARKS.filter(
    (a) => a.name.toLowerCase().includes(lower) || a.area.toLowerCase().includes(lower)
  );
  if (landmarkMatches.length > 0) {
    return landmarkMatches.slice(0, 5).map((m) => ({
      address: `${m.name}, ${m.area}`,
      latitude: m.lat,
      longitude: m.lng,
      placeType: 'place',
    }));
  }

  // Search gazetteer (places and POIs)
  const geoMatches = gazetteerEntries.filter(
    (p) => p.n.toLowerCase().includes(lower) || (p.a && p.a.toLowerCase().includes(lower))
  );
  if (geoMatches.length > 0) {
    return geoMatches.slice(0, 5).map((m) => ({
      address: m.r ? `${m.n}, ${m.r}, Ghana` : `${m.n}, Ghana`,
      latitude: m.lat,
      longitude: m.lon,
      placeType: m.t === 'poi' ? (m.st ?? 'poi') : 'place',
    }));
  }

  // Fallback with a random landmark
  const fallback = LANDMARKS[Math.floor(Math.random() * LANDMARKS.length)]!;
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

// ── Selection recording (usage-based learning) ─────────────

/**
 * Record that a user selected a particular autocomplete suggestion.
 * This feeds the popularity service to improve future rankings.
 */
export async function recordSelection(
  query: string,
  selectedSuggestion: AutocompleteSuggestion
): Promise<void> {
  try {
    if (selectedSuggestion.latitude == null || selectedSuggestion.longitude == null) return;
    await recordLocationSelection(
      query,
      selectedSuggestion.placeName || selectedSuggestion.text,
      selectedSuggestion.latitude,
      selectedSuggestion.longitude,
      selectedSuggestion.source ?? 'unknown',
    );
  } catch (err) {
    console.error('[geocoding] Failed to record selection:', err);
  }
}
