/**
 * Calculate the distance between two GPS coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Estimate travel duration based on distance and average speed.
 * Returns duration in minutes (minimum 10 minutes).
 *
 * @param distanceKm — effective road distance (already includes road factor)
 * @param avgSpeedKmh — average motorcycle speed for the zone type (default 20 km/h for urban Ghana)
 */
export function estimateDuration(distanceKm: number, avgSpeedKmh = 20): number {
  return Math.max(10, Math.ceil((distanceKm / avgSpeedKmh) * 60));
}

/**
 * Convert Haversine (straight-line) distance to approximate road distance
 * by applying a road factor for the given zone type.
 *
 * @param haversineKm — straight-line distance in km
 * @param roadFactor — multiplier (default 1.3 for typical urban Ghana)
 */
export function toRoadDistance(haversineKm: number, roadFactor = 1.3): number {
  return haversineKm * roadFactor;
}

/**
 * Check if a point is inside a polygon (ray-casting algorithm).
 * Each ring is an array of [longitude, latitude] pairs.
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: number[][][],
): boolean {
  // Use the outer ring (first ring) of the polygon
  const ring = polygon[0];
  if (!ring || ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ringI = ring[i];
    const ringJ = ring[j];
    if (!ringI || !ringJ) continue;
    
    const xi = ringI[1]!; // latitude
    const yi = ringI[0]!; // longitude
    const xj = ringJ[1]!;
    const yj = ringJ[0]!;

    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate the bearing between two points in degrees (0-360).
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLon = toRadians(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);
  const bearing = Math.atan2(y, x);
  return ((bearing * 180) / Math.PI + 360) % 360;
}
