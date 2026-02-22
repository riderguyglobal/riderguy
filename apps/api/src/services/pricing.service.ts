import { prisma } from '@riderguy/database';
import { PACKAGE_TYPE_MULTIPLIERS, DEFAULT_SURGE_MULTIPLIER } from '@riderguy/utils';
import { haversineDistance, estimateDuration } from '@riderguy/utils';
import { isPointInPolygon } from '@riderguy/utils';
import type { PackageType } from '@prisma/client';

// ============================================================
// Pricing Engine — zone-aware, config-driven price calculation.
//
// Price = (baseFare + (distanceKm × perKmRate)) × packageMultiplier × surgeMultiplier
// serviceFee = subtotal × 0.10
// totalPrice = subtotal + serviceFee
//
// Falls back to platform defaults when no zone is matched.
// ============================================================

/** Default pricing when no zone matched */
const PLATFORM_DEFAULTS = {
  baseFare: 500,
  perKmRate: 150,
  minimumFare: 300,
  commissionRate: 15, // percentage
  currency: 'NGN',
};

export interface PriceBreakdown {
  distanceKm: number;
  estimatedDurationMinutes: number;
  baseFare: number;
  distanceCharge: number;
  packageMultiplier: number;
  surgeMultiplier: number;
  subtotal: number;
  serviceFee: number;
  totalPrice: number;
  currency: string;
  zoneId: string | null;
  zoneName: string | null;
  riderEarnings: number;
  platformCommission: number;
}

/**
 * Find the zone that contains the pickup point.
 * Returns null if the point is outside all active zones.
 */
async function findZoneForPoint(lat: number, lng: number) {
  const zones = await prisma.zone.findMany({
    where: { status: 'ACTIVE' },
  });

  for (const zone of zones) {
    const polygon = zone.polygon as number[][][];
    if (isPointInPolygon(lat, lng, polygon)) {
      return zone;
    }
  }

  return null;
}

/**
 * Calculate a full price estimate for a delivery.
 */
export async function calculatePrice(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  packageType: PackageType,
): Promise<PriceBreakdown> {
  // 1. Distance & duration
  const distanceKm = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const estimatedDurationMinutes = Math.max(10, Math.ceil(estimateDuration(distanceKm)));

  // 2. Find zone for pickup location
  const zone = await findZoneForPoint(pickupLat, pickupLng);

  const baseFare = zone?.baseFare ?? PLATFORM_DEFAULTS.baseFare;
  const perKmRate = zone?.perKmRate ?? PLATFORM_DEFAULTS.perKmRate;
  const minimumFare = zone?.minimumFare ?? PLATFORM_DEFAULTS.minimumFare;
  const surgeMultiplier = zone?.surgeMultiplier ?? DEFAULT_SURGE_MULTIPLIER;
  const commissionRate = zone?.commissionRate ?? PLATFORM_DEFAULTS.commissionRate;
  const currency = zone?.currency ?? PLATFORM_DEFAULTS.currency;

  // 3. Package multiplier
  const packageMultiplier = PACKAGE_TYPE_MULTIPLIERS[packageType] ?? 1.0;

  // 4. Calculate
  const distanceCharge = Math.round(distanceKm * perKmRate);
  const subtotal = Math.max(
    minimumFare,
    Math.round((baseFare + distanceCharge) * packageMultiplier * surgeMultiplier),
  );
  const serviceFee = Math.round(subtotal * 0.1);
  const totalPrice = subtotal + serviceFee;

  // 5. Earnings split
  const platformCommission = Math.round(totalPrice * (commissionRate / 100));
  const riderEarnings = totalPrice - platformCommission;

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    estimatedDurationMinutes,
    baseFare,
    distanceCharge,
    packageMultiplier,
    surgeMultiplier,
    subtotal,
    serviceFee,
    totalPrice,
    currency,
    zoneId: zone?.id ?? null,
    zoneName: zone?.name ?? null,
    riderEarnings,
    platformCommission,
  };
}
