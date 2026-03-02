// ============================================================
// Google Maps URL Parser
//
// Extracts latitude/longitude from various Google Maps URL
// formats. Supports:
//
// 1. Direct coordinate URLs:
//    https://maps.google.com/?q=5.6037,-0.1870
//    https://www.google.com/maps?q=5.6037,-0.1870
//
// 2. Place URLs with @lat,lng:
//    https://www.google.com/maps/place/East+Legon/@5.635,-0.1572,15z
//    https://google.com/maps/place/.../@5.635,-0.1572,15z/data=...
//
// 3. Search URLs with @lat,lng:
//    https://www.google.com/maps/search/restaurant/@5.603,-0.187,14z
//
// 4. Short links (need to be resolved externally):
//    https://maps.app.goo.gl/abc123
//    https://goo.gl/maps/abc123
//
// 5. Directions URLs:
//    https://www.google.com/maps/dir/origin/dest/@5.603,-0.187,14z
//
// 6. Mobile share URLs with query params:
//    https://maps.google.com/maps?q=5.6037,-0.1870&...
//    https://www.google.com/maps/@5.603,-0.187,15z
// ============================================================

export interface ParsedGoogleMapsResult {
  latitude: number;
  longitude: number;
  placeName?: string;   // extracted place name from URL path
  rawUrl: string;       // original URL for storage
}

/**
 * Parse a Google Maps URL and extract coordinates.
 *
 * Returns null if the URL format is not recognized or
 * coordinates cannot be extracted.
 *
 * NOTE: Short URLs (goo.gl, maps.app.goo.gl) must be resolved
 * to their full URL first before passing to this function.
 */
export function parseGoogleMapsUrl(url: string): ParsedGoogleMapsResult | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Validate it looks like a Google Maps URL or contains coordinates
  const isGoogleMaps =
    /google\.(com|[a-z]{2,3})\/maps/i.test(trimmed) ||
    /maps\.google\./i.test(trimmed) ||
    /maps\.app\.goo\.gl/i.test(trimmed) ||
    /goo\.gl\/maps/i.test(trimmed);

  if (!isGoogleMaps) {
    // Fall back: maybe user pasted raw coordinates like "5.6037, -0.1870"
    return parseRawCoordinates(trimmed);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  // ── Strategy 1: ?q=lat,lng or ?query=lat,lng ──────────
  const qParam = parsed.searchParams.get('q') || parsed.searchParams.get('query');
  if (qParam) {
    const coords = extractLatLng(qParam);
    if (coords) {
      return { ...coords, rawUrl: trimmed };
    }
  }

  // ── Strategy 2: @lat,lng in the path ──────────────────
  const atMatch = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]!);
    const lng = parseFloat(atMatch[2]!);
    if (isValidCoordinate(lat, lng)) {
      const placeName = extractPlaceNameFromPath(parsed.pathname);
      return { latitude: lat, longitude: lng, placeName, rawUrl: trimmed };
    }
  }

  // ── Strategy 3: /place/ in path — extract name even without @coords
  const placeMatch = parsed.pathname.match(/\/place\/([^/@]+)/);
  if (placeMatch) {
    // Place name is URL-encoded
    const placeName = decodeURIComponent(placeMatch[1]!.replace(/\+/g, ' '));
    // Coordinates might be in a data= parameter or further in the path
    const dataCoords = extractCoordsFromDataParam(parsed.searchParams.get('data') || '');
    if (dataCoords) {
      return { ...dataCoords, placeName, rawUrl: trimmed };
    }
  }

  // ── Strategy 4: ll= parameter (older format) ──────────
  const llParam = parsed.searchParams.get('ll');
  if (llParam) {
    const coords = extractLatLng(llParam);
    if (coords) {
      return { ...coords, rawUrl: trimmed };
    }
  }

  // ── Strategy 5: sll= parameter (search lat/lng) ───────
  const sllParam = parsed.searchParams.get('sll');
  if (sllParam) {
    const coords = extractLatLng(sllParam);
    if (coords) {
      return { ...coords, rawUrl: trimmed };
    }
  }

  return null;
}

/**
 * Check if a URL is a Google Maps short link that needs resolving.
 */
export function isGoogleMapsShortLink(url: string): boolean {
  if (!url) return false;
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url.trim());
}

/**
 * Parse raw coordinate text like "5.6037, -0.1870" or "5.6037 -0.1870".
 */
export function parseRawCoordinates(text: string): ParsedGoogleMapsResult | null {
  if (!text) return null;

  // Match patterns like "5.6037, -0.1870" or "5.6037 -0.1870" or "5.6037,-0.1870"
  const match = text.trim().match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (match) {
    const a = parseFloat(match[1]!);
    const b = parseFloat(match[2]!);
    if (isValidCoordinate(a, b)) {
      return { latitude: a, longitude: b, rawUrl: text };
    }
    // Try reversed (lng, lat) — common in GeoJSON
    if (isValidCoordinate(b, a)) {
      return { latitude: b, longitude: a, rawUrl: text };
    }
  }

  return null;
}

// ── Internal helpers ────────────────────────────────────────

function extractLatLng(text: string): { latitude: number; longitude: number } | null {
  // "5.6037,-0.1870" or "5.6037, -0.1870"
  const match = text.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  if (!match) return null;
  const lat = parseFloat(match[1]!);
  const lng = parseFloat(match[2]!);
  if (isValidCoordinate(lat, lng)) {
    return { latitude: lat, longitude: lng };
  }
  return null;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // Reject obvious non-coordinates (both zero, etc.)
    !(lat === 0 && lng === 0)
  );
}

function extractPlaceNameFromPath(pathname: string): string | undefined {
  // /maps/place/East+Legon/@... → "East Legon"
  const match = pathname.match(/\/place\/([^/@]+)/);
  if (match) {
    return decodeURIComponent(match[1]!.replace(/\+/g, ' '));
  }
  return undefined;
}

function extractCoordsFromDataParam(data: string): { latitude: number; longitude: number } | null {
  if (!data) return null;
  // data parameter sometimes contains coordinates like !3d5.6037!4d-0.1870
  const latMatch = data.match(/!3d(-?\d+\.?\d*)/);
  const lngMatch = data.match(/!4d(-?\d+\.?\d*)/);
  if (latMatch && lngMatch) {
    const lat = parseFloat(latMatch[1]!);
    const lng = parseFloat(lngMatch[1]!);
    if (isValidCoordinate(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}
