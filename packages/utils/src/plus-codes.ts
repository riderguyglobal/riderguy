// ══════════════════════════════════════════════════════════
// Plus Codes (Open Location Code) — Universal address
// codes for Ghana where street addresses are incomplete
//
// Uses Google's open-source Open Location Code library.
// Encodes any GPS coordinate into a short, shareable code
// like "9G5M8Q4V+7W" that works offline, without any API.
//
// Plus Codes can be shortened relative to a city reference
// (e.g. "8Q4V+7W Accra") making them easy to share locally.
// ══════════════════════════════════════════════════════════

import { OpenLocationCode } from 'open-location-code';

// ── Reference locations for shortening codes ────────────

/** Major Ghana city reference points for Plus Code shortening */
export const PLUS_CODE_REFERENCES: Record<string, { lat: number; lng: number }> = {
  accra: { lat: 5.603, lng: -0.187 },
  kumasi: { lat: 6.688, lng: -1.624 },
  tamale: { lat: 9.401, lng: -0.839 },
  takoradi: { lat: 4.898, lng: -1.755 },
  capeCoast: { lat: 5.106, lng: -1.247 },
  tema: { lat: 5.670, lng: -0.017 },
  sunyani: { lat: 7.339, lng: -2.328 },
  koforidua: { lat: 6.094, lng: -0.261 },
  ho: { lat: 6.601, lng: 0.471 },
  bolgatanga: { lat: 10.787, lng: -0.851 },
};

/** Default reference point (Accra) */
const DEFAULT_REF = PLUS_CODE_REFERENCES.accra!;

// ── Core encoding/decoding ──────────────────────────────

/**
 * Encode latitude/longitude into a full Plus Code.
 *
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 * @param codeLength Code length (10 = ~14m area, 11 = ~3m area). Default 10.
 * @returns Full Plus Code e.g. "9G5M8Q4V+7W"
 *
 * @example
 * encodePlusCode(5.603, -0.187) // "9G5M8QGJ+XX"
 */
export function encodePlusCode(lat: number, lng: number, codeLength = 10): string {
  return OpenLocationCode.encode(lat, lng, codeLength);
}

/**
 * Decode a Plus Code back to coordinates.
 *
 * @param code A valid full Plus Code (e.g. "9G5M8Q4V+7W")
 * @returns Decoded area with center, bounds, and code length
 */
export function decodePlusCode(code: string): PlusCodeArea {
  const decoded = OpenLocationCode.decode(code);
  return {
    latitudeCenter: decoded.latitudeCenter,
    longitudeCenter: decoded.longitudeCenter,
    latitudeLo: decoded.latitudeLo,
    latitudeHi: decoded.latitudeHi,
    longitudeLo: decoded.longitudeLo,
    longitudeHi: decoded.longitudeHi,
    codeLength: decoded.codeLength,
  };
}

// ── Shortening for local use ────────────────────────────

/**
 * Create a short Plus Code relative to a nearby city.
 * If the location is close enough to the reference,
 * the code is shortened (e.g. "8Q4V+7W" instead of "9G5M8Q4V+7W").
 *
 * @param lat Latitude
 * @param lng Longitude
 * @param refLat Reference city latitude (default: Accra)
 * @param refLng Reference city longitude (default: Accra)
 * @returns Shortened code if possible, otherwise full code
 *
 * @example
 * shortenPlusCode(5.603, -0.187)
 * // → "8QGJ+XX" (relative to Accra)
 */
export function shortenPlusCode(
  lat: number,
  lng: number,
  refLat = DEFAULT_REF.lat,
  refLng = DEFAULT_REF.lng,
): string {
  const fullCode = OpenLocationCode.encode(lat, lng);
  try {
    return OpenLocationCode.shorten(fullCode, refLat, refLng);
  } catch {
    // If reference is too far, return full code
    return fullCode;
  }
}

/**
 * Recover a full Plus Code from a short code and reference location.
 *
 * @param shortCode Short Plus Code (e.g. "8Q4V+7W")
 * @param refLat Reference latitude (default: Accra)
 * @param refLng Reference longitude (default: Accra)
 * @returns Full Plus Code
 *
 * @example
 * recoverPlusCode("8QGJ+XX")
 * // → "9G5M8QGJ+XX"
 */
export function recoverPlusCode(
  shortCode: string,
  refLat = DEFAULT_REF.lat,
  refLng = DEFAULT_REF.lng,
): string {
  return OpenLocationCode.recoverNearest(shortCode, refLat, refLng);
}

// ── Formatting helpers ──────────────────────────────────

/**
 * Find the nearest reference city for a given coordinate.
 * Used to create "8Q4V+7W Accra"-style display strings.
 *
 * @param lat Latitude
 * @param lng Longitude
 * @returns The nearest city name and its coordinates
 */
export function findNearestCity(lat: number, lng: number): {
  city: string;
  lat: number;
  lng: number;
  distanceKm: number;
} {
  const R = 6371; // Earth's radius in km
  let nearest = { city: 'Accra', lat: 5.603, lng: -0.187, distanceKm: Infinity };

  for (const [city, coords] of Object.entries(PLUS_CODE_REFERENCES)) {
    const dLat = ((coords.lat - lat) * Math.PI) / 180;
    const dLng = ((coords.lng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((coords.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (d < nearest.distanceKm) {
      // Capitalize city name for display (camelCase → Title Case)
      const displayName = city.charAt(0).toUpperCase() + city.slice(1).replace(/([A-Z])/g, ' $1');
      nearest = { city: displayName, lat: coords.lat, lng: coords.lng, distanceKm: d };
    }
  }

  return nearest;
}

/**
 * Generate a display-friendly Plus Code with city name.
 * This is the primary function for showing Plus Codes in the app UI.
 *
 * @param lat Latitude
 * @param lng Longitude
 * @returns Object with full code, short code, display string, and city
 *
 * @example
 * formatPlusCode(5.603, -0.187)
 * // → {
 * //   full: "9G5M8QGJ+XX",
 * //   short: "8QGJ+XX",
 * //   display: "8QGJ+XX Accra",
 * //   city: "Accra"
 * // }
 */
export function formatPlusCode(lat: number, lng: number): PlusCodeFormatted {
  const full = OpenLocationCode.encode(lat, lng);
  const nearestCity = findNearestCity(lat, lng);

  let short: string;
  try {
    short = OpenLocationCode.shorten(full, nearestCity.lat, nearestCity.lng);
  } catch {
    short = full;
  }

  // If the code wasn't actually shortened, use the full code
  const isShortened = short !== full;
  const display = isShortened ? `${short} ${nearestCity.city}` : full;

  return {
    full,
    short: isShortened ? short : full,
    display,
    city: nearestCity.city,
  };
}

// ── Validation ──────────────────────────────────────────

/**
 * Check if a string is a valid Plus Code (full or short).
 */
export function isValidPlusCode(code: string): boolean {
  return OpenLocationCode.isValid(code);
}

/**
 * Check if a string is a valid full Plus Code.
 */
export function isFullPlusCode(code: string): boolean {
  return OpenLocationCode.isFull(code);
}

/**
 * Check if a string is a valid short Plus Code.
 */
export function isShortPlusCode(code: string): boolean {
  return OpenLocationCode.isShort(code);
}

// ── Types ───────────────────────────────────────────────

/** Decoded Plus Code area bounds and center */
export interface PlusCodeArea {
  latitudeCenter: number;
  longitudeCenter: number;
  latitudeLo: number;
  latitudeHi: number;
  longitudeLo: number;
  longitudeHi: number;
  codeLength: number;
}

/** Formatted Plus Code with display variants */
export interface PlusCodeFormatted {
  /** Full 10+ character code (e.g. "9G5M8QGJ+XX") */
  full: string;
  /** Shortened code relative to nearest city (e.g. "8QGJ+XX") */
  short: string;
  /** Display string with city name (e.g. "8QGJ+XX Accra") */
  display: string;
  /** Reference city used for shortening */
  city: string;
}
