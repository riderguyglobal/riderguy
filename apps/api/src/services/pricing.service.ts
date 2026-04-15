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
  EXPRESS_MULTIPLIER,
  EXPRESS_MAX_DISTANCE_KM,
  WEIGHT_SURCHARGES,
  getWeightCategory,
  getTimeOfDayMultiplier,
  WEATHER_MULTIPLIERS,
  CROSS_ZONE_MULTIPLIER,
  OUT_OF_ZONE_MULTIPLIER,
  PAYMENT_METHOD_FEE_RATES,
  getBusinessDiscount,
  SURGE_THRESHOLDS,
  RIDER_PICKUP_DISTANCE_FREE_KM,
  RIDER_PICKUP_DISTANCE_RATE,
  WAIT_TIME_FREE_MINUTES,
  WAIT_TIME_RATE_PER_MINUTE,
  MAX_WAIT_TIME_CHARGE,
} from '@riderguy/utils';
import { haversineDistance, estimateDuration, toRoadDistance } from '@riderguy/utils';
import { isPointInPolygon } from '@riderguy/utils';
import type { PackageType, PaymentMethod, Zone } from '@prisma/client';
import { correctEta } from './eta-learning.service';

// ============================================================
// Pricing Engine v2 — Comprehensive zone-aware pricing.
//
// All monetary values are in **GHS** (Ghana Cedis).
// Converted to pesewas (× 100) only at the Paystack boundary.
//
// v2 additions:
//   - Dynamic surge (demand/supply ratio per zone)
//   - Time-of-day multiplier
//   - Weather multiplier
//   - Cross-zone / out-of-zone premium
//   - Express delivery premium
//   - Package weight surcharges
//   - Payment method–specific service fee rates
//   - Business volume discounts
//   - Promo code discounts
//   - Google Routes API distance (when available)
//   - Wait time charging (post-delivery adjustment)
//   - Rider distance-to-pickup compensation
//
// Formula:
//   effectiveDistance = routeDistance ?? (haversine × roadFactor)
//   distanceCharge   = effectiveDistance × perKmRate
//   rawSubtotal      = (baseFare + distanceCharge + stopSurcharges + weightSurcharge)
//                      × packageMultiplier × surgeMultiplier × timeOfDayMultiplier
//                      × weatherMultiplier × crossZoneMultiplier × expressMultiplier
//                      × scheduleDiscount
//   subtotal         = MAX(rawSubtotal, minimumFare)
//   subtotal         = subtotal × (1 − businessDiscount)
//   subtotal         = subtotal − promoDiscount
//   serviceFee       = ROUND(subtotal × serviceFeeRate)
//   totalPrice       = subtotal + serviceFee
//   platformTake     = ROUND(totalPrice × commissionRate)
//   riderEarnings    = totalPrice − platformTake
//
// See docs/business/PRICING_STRATEGY.md for full rationale.
// ============================================================

/**
 * Normalize commission rate from zone's 0–100 percentage scale to a 0–1 decimal.
 * Guards against admin accidentally entering a decimal like 0.15 instead of 15.
 */
function normalizeCommissionRate(raw: number): number {
  if (raw > 0 && raw < 1) return raw;              // already a decimal fraction
  return Math.min(1, Math.max(0, raw / 100));       // clamp & convert
}

/** Platform defaults — used when pickup is outside any defined zone */
const PLATFORM_DEFAULTS = {
  baseFare: 5.00,
  perKmRate: 2.00,
  minimumFare: 8.00,
  commissionRate: 0.15,
  roadFactor: ROAD_FACTOR_DEFAULT,
  avgSpeedKmh: AVG_SPEED_DEFAULT,
  currency: 'GHS',
};

export interface PriceBreakdown {
  haversineDistanceKm: number;
  distanceKm: number;
  routeDistanceKm: number | null;
  roadFactor: number;
  estimatedDurationMinutes: number;

  baseFare: number;
  distanceCharge: number;
  stopSurcharges: number;
  additionalStops: number;
  packageMultiplier: number;
  packageType: string;
  weightSurcharge: number;

  surgeMultiplier: number;
  surgeLevel: string;
  timeOfDayMultiplier: number;
  timeOfDayPeriod: string;
  weatherMultiplier: number;
  weatherCondition: string;
  crossZoneMultiplier: number;
  expressMultiplier: number;
  isExpress: boolean;

  scheduleDiscount: number;
  scheduleDiscountBlockedBySurge: boolean;
  businessDiscount: number;
  promoDiscount: number;
  promoError: string | null;
  waitTimeCharge: number;

  subtotal: number;
  serviceFee: number;
  serviceFeeRate: number;
  totalPrice: number;
  currency: string;

  zoneId: string | null;
  zoneName: string | null;
  riderEarnings: number;
  platformCommission: number;
  commissionRate: number;

  expressIgnored: boolean;
}

// ── Zone lookup (cached) ────────────────────────────────

let zoneCache: Zone[] | null = null;
let zoneCacheExpiry = 0;
const ZONE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getActiveZones(): Promise<Zone[]> {
  if (zoneCache && Date.now() < zoneCacheExpiry) return zoneCache;
  const zones = await prisma.zone.findMany({ where: { status: 'ACTIVE' } });
  zoneCache = zones;
  zoneCacheExpiry = Date.now() + ZONE_CACHE_TTL_MS;
  return zoneCache;
}

async function findZoneForPoint(lat: number, lng: number): Promise<Zone | null> {
  const zones = await getActiveZones();
  for (const zone of zones) {
    const polygon = zone.polygon as number[][][];
    if (isPointInPolygon(lat, lng, polygon)) return zone;
  }
  return null;
}

// ── Dynamic Surge ───────────────────────────────────────────

function calculateDynamicSurge(pendingOrders: number, activeRiders: number): { multiplier: number; level: string } {
  if (activeRiders <= 0) return { multiplier: MAX_SURGE_MULTIPLIER, level: 'MAX' };

  const ratio = pendingOrders / activeRiders;
  if (ratio >= SURGE_THRESHOLDS.LEVEL_4.ratio) return { multiplier: SURGE_THRESHOLDS.LEVEL_4.multiplier, level: 'MAX' };
  if (ratio >= SURGE_THRESHOLDS.LEVEL_3.ratio) return { multiplier: SURGE_THRESHOLDS.LEVEL_3.multiplier, level: 'HIGH' };
  if (ratio >= SURGE_THRESHOLDS.LEVEL_2.ratio) return { multiplier: SURGE_THRESHOLDS.LEVEL_2.multiplier, level: 'MEDIUM' };
  if (ratio >= SURGE_THRESHOLDS.LEVEL_1.ratio) return { multiplier: SURGE_THRESHOLDS.LEVEL_1.multiplier, level: 'LOW' };
  return { multiplier: SURGE_THRESHOLDS.LEVEL_0.multiplier, level: 'NONE' };
}

// ── Time-of-day helpers ─────────────────────────────────────

function getTimeOfDayPeriod(hour: number): string {
  if (hour >= 22 || hour < 6) return 'Night';
  if (hour >= 6 && hour < 8) return 'Early morning';
  if (hour >= 8 && hour < 11) return 'Morning';
  if (hour >= 11 && hour < 14) return 'Lunch rush';
  if (hour >= 14 && hour < 16) return 'Afternoon';
  if (hour >= 16 && hour < 19) return 'Evening rush';
  return 'Late evening';
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
  additionalStops?: number;
  scheduleType?: 'SAME_DAY' | 'NEXT_DAY' | 'RECURRING';
  isExpress?: boolean;
  packageWeightKg?: number;
  paymentMethod?: PaymentMethod;
  promoCode?: string;
  clientId?: string;
  weatherCondition?: string;
  routeDistanceKm?: number;
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
  options?: Omit<CalculatePriceInput, 'pickupLat' | 'pickupLng' | 'dropoffLat' | 'dropoffLng' | 'packageType'>,
): Promise<PriceBreakdown> {
  const additionalStops = options?.additionalStops ?? 0;
  const scheduleType = options?.scheduleType;
  const isExpress = options?.isExpress ?? false;
  const packageWeightKg = options?.packageWeightKg;
  const paymentMethod = options?.paymentMethod;
  const promoCode = options?.promoCode;
  const clientId = options?.clientId;
  const weatherConditionInput = options?.weatherCondition;
  const routeDistanceInput = options?.routeDistanceKm;

  // ── 1. Distance ──────────────────────────────────────────
  const haversineKm = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);

  // ── 2. Zone lookup ───────────────────────────────────────
  const pickupZone = await findZoneForPoint(pickupLat, pickupLng);
  const dropoffZone = await findZoneForPoint(dropoffLat, dropoffLng);

  const baseFare = pickupZone?.baseFare ?? PLATFORM_DEFAULTS.baseFare;
  const perKmRate = pickupZone?.perKmRate ?? PLATFORM_DEFAULTS.perKmRate;
  const minimumFare = pickupZone?.minimumFare ?? PLATFORM_DEFAULTS.minimumFare;
  const roadFactor = pickupZone?.roadFactor ?? PLATFORM_DEFAULTS.roadFactor;
  const avgSpeed = pickupZone?.avgSpeedKmh ?? PLATFORM_DEFAULTS.avgSpeedKmh;
  const currency = pickupZone?.currency ?? PLATFORM_DEFAULTS.currency;
  const commissionRate = pickupZone?.commissionRate != null
    ? normalizeCommissionRate(pickupZone.commissionRate)
    : PLATFORM_DEFAULTS.commissionRate;

  // ── 3. Effective road distance & ETA ─────────────────────
  const routeDistanceKm: number | null = routeDistanceInput ?? null;
  const distanceKm = routeDistanceKm
    ? roundGhs(routeDistanceKm)
    : roundGhs(toRoadDistance(haversineKm, roadFactor));
  const etaResult = await correctEta(
    estimateDuration(distanceKm, avgSpeed),
    pickupZone?.id ?? null,
  );
  const estimatedDurationMinutes = etaResult.correctedMinutes;

  // ── 4. Dynamic Surge ─────────────────────────────────────
  let surgeResult: { multiplier: number; level: string };
  if (pickupZone) {
    const pendingOrders = pickupZone.pendingOrders ?? 0;
    const activeRiders = pickupZone.activeRiders ?? 0;
    surgeResult = calculateDynamicSurge(pendingOrders, activeRiders);
    // Admin-set static surge takes precedence if higher
    const staticSurge = pickupZone.surgeMultiplier ?? DEFAULT_SURGE_MULTIPLIER;
    if (staticSurge > surgeResult.multiplier) {
      surgeResult = {
        multiplier: staticSurge,
        level: staticSurge >= 1.6 ? 'HIGH' : staticSurge >= 1.2 ? 'LOW' : 'NONE',
      };
    }
  } else {
    surgeResult = { multiplier: DEFAULT_SURGE_MULTIPLIER, level: 'NONE' };
  }
  const surgeMultiplier = Math.min(surgeResult.multiplier, MAX_SURGE_MULTIPLIER);
  const surgeLevel = surgeResult.level;

  // ── 5. Time-of-day ───────────────────────────────────────
  // Use Ghana timezone (GMT+0) explicitly so pricing is correct
  // regardless of which timezone the server runs in.
  const ghanaHour = new Date().toLocaleString('en-US', {
    timeZone: 'Africa/Accra',
    hour: 'numeric',
    hour12: false,
  });
  const currentHour = parseInt(ghanaHour, 10);
  const timeOfDayMultiplier = getTimeOfDayMultiplier(currentHour);
  const timeOfDayPeriod = getTimeOfDayPeriod(currentHour);

  // ── 6. Weather ───────────────────────────────────────────
  const weatherCondition = weatherConditionInput ?? 'CLEAR';
  const weatherMultiplier = WEATHER_MULTIPLIERS[weatherCondition] ?? 1.0;

  // ── 7. Cross-zone / out-of-zone ──────────────────────────
  let crossZoneMultiplier = 1.0;
  if (pickupZone && dropoffZone && pickupZone.id !== dropoffZone.id) {
    crossZoneMultiplier = CROSS_ZONE_MULTIPLIER;
  } else if (pickupZone && !dropoffZone) {
    crossZoneMultiplier = OUT_OF_ZONE_MULTIPLIER;
  }

  // ── 8. Express ───────────────────────────────────────────
  let expressMultiplier = 1.0;
  if (isExpress && distanceKm <= EXPRESS_MAX_DISTANCE_KM) {
    expressMultiplier = EXPRESS_MULTIPLIER;
  }

  // ── 9. Package multiplier & weight ───────────────────────
  const packageMultiplier = PACKAGE_TYPE_MULTIPLIERS[packageType] ?? 1.0;
  const weightCategory = packageWeightKg ? getWeightCategory(packageWeightKg) : 'LIGHT';
  const weightSurcharge = packageWeightKg ? roundGhs(WEIGHT_SURCHARGES[weightCategory] ?? 0) : 0;

  // ── 10. Schedule discount (never with surge) ─────────────
  let scheduleDiscount = 1.0;
  if (scheduleType && surgeMultiplier <= 1.0) {
    scheduleDiscount = SCHEDULED_DISCOUNT[scheduleType] ?? 1.0;
  }

  // ── 11. Service fee rate ─────────────────────────────────
  const serviceFeeRate = paymentMethod
    ? (PAYMENT_METHOD_FEE_RATES[paymentMethod] ?? SERVICE_FEE_RATE)
    : SERVICE_FEE_RATE;

  // ── 12. Business discount ────────────────────────────────
  let businessDiscount = 0;
  if (clientId) {
    try {
      const businessAccount = await prisma.businessAccount.findFirst({
        where: { userId: clientId },
      });
      if (businessAccount) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthlyOrders = await prisma.order.count({
          where: {
            clientId,
            createdAt: { gte: startOfMonth },
            status: { notIn: ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'] },
          },
        });
        businessDiscount = getBusinessDiscount(monthlyOrders);
      }
    } catch {
      // Don't block pricing if business lookup fails
    }
  }

  // ── 13. Promo code discount ──────────────────────────────
  // NOTE: We need the pre-promo subtotal to check minOrderAmount,
  // so we compute the raw subtotal first, then validate the promo.
  let promoDiscount = 0;
  let promoIsPct = false;
  let promoValue = 0;
  let promoMaxDiscount: number | null = null;
  let promoError: string | null = null;

  // ── 14. Calculate ────────────────────────────────────────
  const distanceCharge = roundGhs(distanceKm * perKmRate);
  const stopSurcharges = roundGhs(additionalStops * STOP_SURCHARGE_GHS);

  const rawSubtotal =
    (baseFare + distanceCharge + stopSurcharges + weightSurcharge) *
    packageMultiplier *
    surgeMultiplier *
    timeOfDayMultiplier *
    weatherMultiplier *
    crossZoneMultiplier *
    expressMultiplier *
    scheduleDiscount;

  let subtotal = roundGhs(Math.max(minimumFare, rawSubtotal));

  // Apply business discount
  if (businessDiscount > 0) {
    subtotal = roundGhs(Math.max(minimumFare, subtotal * (1 - businessDiscount)));
  }

  // Now validate promo code against the pre-promo subtotal
  if (promoCode) {
    try {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode } });
      if (!promo || !promo.isActive) {
        promoError = 'Promo code not found or inactive';
      } else {
        const now = new Date();
        const withinValidity = (!promo.validUntil || promo.validUntil > now) && promo.validFrom <= now;
        const withinUsageLimit = promo.maxUses == null || promo.usedCount < promo.maxUses;
        let withinUserLimit = true;
        if (clientId) {
          const userUsages = await prisma.promoCodeUsage.count({
            where: { promoCodeId: promo.id, userId: clientId },
          });
          withinUserLimit = userUsages < promo.maxUsesPerUser;
        }
        const zoneOk = !promo.zoneId || (pickupZone && promo.zoneId === pickupZone.id);
        const packageOk = promo.packageTypes.length === 0 || promo.packageTypes.includes(packageType);
        const meetsMinOrder = !promo.minOrderAmount || subtotal >= Number(promo.minOrderAmount);

        if (!withinValidity) promoError = 'Promo code has expired';
        else if (!withinUsageLimit) promoError = 'Promo code usage limit reached';
        else if (!withinUserLimit) promoError = 'You have already used this promo code';
        else if (!zoneOk) promoError = 'Promo code is not valid for your zone';
        else if (!packageOk) promoError = 'Promo code is not valid for this package type';
        else if (!meetsMinOrder) promoError = `Minimum order of GHS ${Number(promo.minOrderAmount).toFixed(2)} required`;
        else {
          promoIsPct = promo.discountType === 'PERCENTAGE';
          promoValue = Number(promo.discountValue);
          promoMaxDiscount = promo.maxDiscountGhs ? Number(promo.maxDiscountGhs) : null;
        }
      }
    } catch {
      // Don't block pricing if promo lookup fails
    }
  }

  // Apply promo discount
  if (promoIsPct && promoValue > 0) {
    let pctDiscount = roundGhs(subtotal * (promoValue / 100));
    if (promoMaxDiscount && pctDiscount > promoMaxDiscount) {
      pctDiscount = promoMaxDiscount;
    }
    promoDiscount = pctDiscount;
    subtotal = roundGhs(Math.max(minimumFare, subtotal - promoDiscount));
  } else if (promoValue > 0) {
    promoDiscount = roundGhs(promoValue);
    subtotal = roundGhs(Math.max(minimumFare, subtotal - promoDiscount));
  }

  const serviceFee = roundGhs(subtotal * serviceFeeRate);
  const totalPrice = roundGhs(subtotal + serviceFee);

  // ── 15. Earnings split ───────────────────────────────────
  const platformCommission = roundGhs(totalPrice * commissionRate);
  const riderEarnings = roundGhs(totalPrice - platformCommission);

  return {
    haversineDistanceKm: roundGhs(haversineKm),
    distanceKm,
    routeDistanceKm,
    roadFactor,
    estimatedDurationMinutes,
    baseFare,
    distanceCharge,
    stopSurcharges,
    additionalStops,
    packageMultiplier,
    packageType,
    weightSurcharge,
    surgeMultiplier,
    surgeLevel,
    timeOfDayMultiplier,
    timeOfDayPeriod,
    weatherMultiplier,
    weatherCondition,
    crossZoneMultiplier,
    expressMultiplier,
    isExpress: isExpress && expressMultiplier > 1,
    expressIgnored: isExpress && expressMultiplier <= 1,
    scheduleDiscount,
    scheduleDiscountBlockedBySurge: !!scheduleType && surgeMultiplier > 1.0,
    businessDiscount,
    promoDiscount,
    promoError,
    waitTimeCharge: 0, // Adjusted post-delivery via calculateWaitTimeCharge()
    subtotal,
    serviceFee,
    serviceFeeRate,
    totalPrice,
    currency,
    zoneId: pickupZone?.id ?? null,
    zoneName: pickupZone?.name ?? null,
    riderEarnings,
    platformCommission,
    commissionRate,
  };
}

// ── Wait Time Charging (post-delivery adjustment) ──────────

/**
 * Calculate the wait time charge for an order.
 * Called when order transitions to DELIVERED to adjust final price.
 */
export function calculateWaitTimeCharge(
  waitMinutesAtPickup: number,
  waitMinutesAtDropoff: number,
): { charge: number; totalMinutes: number } {
  const chargeablePickup = Math.max(0, waitMinutesAtPickup - WAIT_TIME_FREE_MINUTES);
  const chargeableDropoff = Math.max(0, waitMinutesAtDropoff - WAIT_TIME_FREE_MINUTES);
  const totalChargeableMinutes = chargeablePickup + chargeableDropoff;
  const rawCharge = totalChargeableMinutes * WAIT_TIME_RATE_PER_MINUTE;
  const charge = roundGhs(Math.min(rawCharge, MAX_WAIT_TIME_CHARGE * 2));
  return { charge, totalMinutes: totalChargeableMinutes };
}

// ── Rider Distance-to-Pickup Compensation ──────────────────

/**
 * Calculate extra compensation for riders who travel far to reach pickup.
 * Added to rider earnings — NOT charged to the client.
 */
export function calculatePickupDistanceBonus(
  riderLat: number,
  riderLng: number,
  pickupLat: number,
  pickupLng: number,
): number {
  const distToPickup = haversineDistance(riderLat, riderLng, pickupLat, pickupLng);
  const chargeableKm = Math.max(0, distToPickup - RIDER_PICKUP_DISTANCE_FREE_KM);
  return roundGhs(chargeableKm * RIDER_PICKUP_DISTANCE_RATE);
}

// ── Google Routes Distance ──────────────────────────────────

/**
 * Fetch actual driving distance from Google Routes API.
 * Returns route distance in km, or null if API call fails.
 */
export async function fetchRouteDistance(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  try {
    const { config } = await import('../config/index');
    const apiKey = config.google?.mapsApiKey;
    if (!apiKey) return null;

    const body = {
      origin: { location: { latLng: { latitude: pickupLat, longitude: pickupLng } } },
      destination: { location: { latLng: { latitude: dropoffLat, longitude: dropoffLng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    };

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`[Pricing] Google Routes API ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      routes?: Array<{ distanceMeters: number; duration: string }>;
    };
    const route = data?.routes?.[0];
    if (!route) return null;

    const durationMatch = (route.duration ?? '0s').match(/^([\d.]+)s?$/);
    const durationSec = durationMatch ? parseFloat(durationMatch[1]!) : 0;

    return {
      distanceKm: roundGhs(route.distanceMeters / 1000),
      durationMinutes: Math.max(10, Math.ceil(durationSec / 60)),
    };
  } catch {
    return null;
  }
}
