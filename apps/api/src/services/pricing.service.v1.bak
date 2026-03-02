import { prisma } from '@riderguy/database';
import {
  PACKAGE_TYPE_MULTIPLIERS,
  DEFAULT_SURGE_MULTIPLIER,
  MAX_SURGE_MULTIPLIER,
  SERVICE_FEE_RATE,
  ROAD_FACTOR_DEFAULT,
  AVG_SPEED_DEFAULT,
  STOP_SURCHARGE_GHS,
  SCHEDULED_DISCOUNT,
} from '@riderguy/utils';
import { haversineDistance, estimateDuration, toRoadDistance } from '@riderguy/utils';
import { isPointInPolygon } from '@riderguy/utils';
import type { PackageType } from '@prisma/client';

// ============================================================
// Pricing Engine — zone-aware, config-driven price calculation.
//
// All monetary values are in **GHS** (Ghana Cedis).
// Converted to pesewas (× 100) only at the Paystack boundary.
//
// Formula:
//   effectiveDistance = haversine × roadFactor
//   distanceCharge   = effectiveDistance × perKmRate
//   subtotal         = MAX((baseFare + distanceCharge + stopSurcharges)
//                        × packageMultiplier × surgeMultiplier
//                        × scheduleDiscount,
//                      minimumFare)
//   serviceFee       = ROUND(subtotal × serviceFeeRate)
//   totalPrice       = subtotal + serviceFee
//   platformTake     = ROUND(totalPrice × commissionRate)
//   riderEarnings    = totalPrice − platformTake
//
// See docs/PRICING_STRATEGY.md for full rationale.
// ============================================================

/** Platform defaults — used when pickup is outside any defined zone */
const PLATFORM_DEFAULTS = {
  baseFare: 5.00,       // GHS — rider mobilisation cost
  perKmRate: 2.00,      // GHS per km of effective (road) distance
  minimumFare: 8.00,    // GHS — floor price for very short deliveries
  commissionRate: 0.15, // 15% of totalPrice → platform revenue
  roadFactor: ROAD_FACTOR_DEFAULT,
  avgSpeedKmh: AVG_SPEED_DEFAULT,
  currency: 'GHS',
};

export interface PriceBreakdown {
  /** Straight-line distance in km */
  haversineDistanceKm: number;
  /** Effective road distance in km (haversine × roadFactor) */
  distanceKm: number;
  /** Road factor applied */
  roadFactor: number;
  /** Estimated travel time in minutes */
  estimatedDurationMinutes: number;

  /** Flat base fee (GHS) */
  baseFare: number;
  /** Distance-based charge (GHS) */
  distanceCharge: number;
  /** Surcharge for additional stops (GHS, 0 for standard A→B) */
  stopSurcharges: number;
  /** Number of extra stops beyond the first pair */
  additionalStops: number;
  /** Package type multiplier applied */
  packageMultiplier: number;
  /** Package type name */
  packageType: string;
  /** Surge multiplier (1.0 = no surge) */
  surgeMultiplier: number;
  /** Schedule discount multiplier (1.0 = none) */
  scheduleDiscount: number;

  /** (baseFare + distanceCharge + stopSurcharges) × multipliers, floored at minimumFare */
  subtotal: number;
  /** Service fee added on top (10% of subtotal, shown to client) */
  serviceFee: number;
  /** Final price the client pays (subtotal + serviceFee) */
  totalPrice: number;
  /** Currency code */
  currency: string;

  /** Zone that matched the pickup, if any */
  zoneId: string | null;
  zoneName: string | null;

  /** Rider's portion after commission */
  riderEarnings: number;
  /** Platform's commission */
  platformCommission: number;
  /** Commission rate applied (0–1) */
  commissionRate: number;
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

/** Round to 2 decimal places (nearest pesewa) */
function roundGhs(value: number): number {
  return Math.round(value * 100) / 100;
}

// ── Public API ──────────────────────────────────────────────

export interface CalculatePriceInput {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  packageType: PackageType;
  /** Number of extra stops beyond the standard pickup→dropoff (default 0) */
  additionalStops?: number;
  /** Schedule type for discount calculation */
  scheduleType?: 'SAME_DAY' | 'NEXT_DAY' | 'RECURRING';
}

/**
 * Calculate a full price estimate for a delivery.
 *
 * Can be called for estimates (before order creation) or for final
 * pricing at order creation time — same formula either way.
 */
export async function calculatePrice(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  packageType: PackageType,
  options?: {
    additionalStops?: number;
    scheduleType?: 'SAME_DAY' | 'NEXT_DAY' | 'RECURRING';
  },
): Promise<PriceBreakdown> {
  const additionalStops = options?.additionalStops ?? 0;
  const scheduleType = options?.scheduleType;

  // ── 1. Distance ──────────────────────────────────────────
  const haversineKm = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);

  // ── 2. Zone lookup ───────────────────────────────────────
  const zone = await findZoneForPoint(pickupLat, pickupLng);

  const baseFare = zone?.baseFare ?? PLATFORM_DEFAULTS.baseFare;
  const perKmRate = zone?.perKmRate ?? PLATFORM_DEFAULTS.perKmRate;
  const minimumFare = zone?.minimumFare ?? PLATFORM_DEFAULTS.minimumFare;
  const roadFactor = PLATFORM_DEFAULTS.roadFactor; // future: store on zone
  const avgSpeed = PLATFORM_DEFAULTS.avgSpeedKmh;
  const currency = zone?.currency ?? PLATFORM_DEFAULTS.currency;

  // Surge: clamp to MAX to protect affordability
  const rawSurge = zone?.surgeMultiplier ?? DEFAULT_SURGE_MULTIPLIER;
  const surgeMultiplier = Math.min(rawSurge, MAX_SURGE_MULTIPLIER);

  // Commission rate: zone stores as percentage (0–100), normalise to 0–1
  const commissionRate =
    zone?.commissionRate != null
      ? zone.commissionRate / 100
      : PLATFORM_DEFAULTS.commissionRate;

  // ── 3. Effective road distance & ETA ─────────────────────
  const distanceKm = roundGhs(toRoadDistance(haversineKm, roadFactor));
  const estimatedDurationMinutes = estimateDuration(distanceKm, avgSpeed);

  // ── 4. Multipliers ──────────────────────────────────────
  const packageMultiplier = PACKAGE_TYPE_MULTIPLIERS[packageType] ?? 1.0;

  // Schedule discount (never applied with surge)
  let scheduleDiscount = 1.0;
  if (scheduleType && surgeMultiplier <= 1.0) {
    scheduleDiscount = SCHEDULED_DISCOUNT[scheduleType] ?? 1.0;
  }

  // ── 5. Calculate ─────────────────────────────────────────
  const distanceCharge = roundGhs(distanceKm * perKmRate);
  const stopSurcharges = roundGhs(additionalStops * STOP_SURCHARGE_GHS);
  const rawSubtotal =
    (baseFare + distanceCharge + stopSurcharges) *
    packageMultiplier *
    surgeMultiplier *
    scheduleDiscount;

  const subtotal = roundGhs(Math.max(minimumFare, rawSubtotal));
  const serviceFee = roundGhs(subtotal * SERVICE_FEE_RATE);
  const totalPrice = roundGhs(subtotal + serviceFee);

  // ── 6. Earnings split ────────────────────────────────────
  const platformCommission = roundGhs(totalPrice * commissionRate);
  const riderEarnings = roundGhs(totalPrice - platformCommission);

  return {
    haversineDistanceKm: roundGhs(haversineKm),
    distanceKm,
    roadFactor,
    estimatedDurationMinutes,
    baseFare,
    distanceCharge,
    stopSurcharges,
    additionalStops,
    packageMultiplier,
    packageType,
    surgeMultiplier,
    scheduleDiscount,
    subtotal,
    serviceFee,
    totalPrice,
    currency,
    zoneId: zone?.id ?? null,
    zoneName: zone?.name ?? null,
    riderEarnings,
    platformCommission,
    commissionRate,
  };
}
