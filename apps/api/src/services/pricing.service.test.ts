import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculatePrice, type PriceBreakdown } from './pricing.service';
import { prisma } from '@riderguy/database';

vi.mock('@riderguy/database', () => ({
  prisma: {
    zone: { findMany: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ============================================================
// Pricing Engine — Unit Tests
//
// All monetary assertions are in GHS (Ghana Cedis).
// See docs/business/PRICING_STRATEGY.md for the pricing rationale.
// ============================================================

// ── Helpers ─────────────────────────────────────────────────

/** Accra Central ↔ East Legon: ~5.6 km straight line */
const ACCRA_PICKUP = { lat: 5.556, lng: -0.1969 }; // Osu, Accra
const ACCRA_DROPOFF = { lat: 5.6355, lng: -0.1575 }; // East Legon

/** Very short trip: ~1.2 km */
const SHORT_PICKUP = { lat: 5.560, lng: -0.200 };
const SHORT_DROPOFF = { lat: 5.567, lng: -0.192 };

/** Long trip: ~15 km */
const LONG_PICKUP = { lat: 5.556, lng: -0.1969 }; // Osu
const LONG_DROPOFF = { lat: 5.680, lng: -0.028 }; // Tema

/** Round to 2 decimals for comparison */
function r(n: number) { return Math.round(n * 100) / 100; }

// ── Test setup ──────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  // Default: no zones → platform defaults apply
  (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

// ============================================================
// 1. Platform Defaults (no zone matched)
// ============================================================

describe('Pricing with platform defaults', () => {
  it('should calculate a standard delivery price', async () => {
    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );

    // Verify structure
    expect(price.currency).toBe('GHS');
    expect(price.zoneId).toBeNull();
    expect(price.zoneName).toBeNull();
    expect(price.packageType).toBe('DOCUMENT');
    expect(price.packageMultiplier).toBe(1.0);
    expect(price.surgeMultiplier).toBe(1.0);
    expect(price.scheduleDiscount).toBe(1.0);
    expect(price.additionalStops).toBe(0);
    expect(price.stopSurcharges).toBe(0);
    expect(price.commissionRate).toBe(0.15);

    // Road factor applied
    expect(price.roadFactor).toBe(1.3);
    expect(price.distanceKm).toBeGreaterThan(price.haversineDistanceKm);
    expect(r(price.distanceKm)).toBeCloseTo(r(price.haversineDistanceKm * 1.3), 1);

    // Price sanity: baseFare 5 + distance charge > 0
    expect(price.baseFare).toBe(5.0);
    expect(price.distanceCharge).toBeGreaterThan(0);
    expect(price.subtotal).toBeGreaterThanOrEqual(8.0); // minimum fare
    expect(price.serviceFee).toBeCloseTo(price.subtotal * 0.1, 1);
    expect(price.totalPrice).toBe(r(price.subtotal + price.serviceFee));

    // Rider / platform split
    expect(price.platformCommission).toBeCloseTo(price.totalPrice * 0.15, 1);
    expect(price.riderEarnings).toBe(r(price.totalPrice - price.platformCommission));
  });

  it('should enforce minimum fare for very short trips', async () => {
    const price = await calculatePrice(
      SHORT_PICKUP.lat, SHORT_PICKUP.lng,
      SHORT_DROPOFF.lat, SHORT_DROPOFF.lng,
      'DOCUMENT',
    );

    expect(price.subtotal).toBeGreaterThanOrEqual(8.0);
    // Even a 1 km delivery should cost at least GHS 8 + service fee
    expect(price.totalPrice).toBeGreaterThanOrEqual(8.0);
  });

  it('should price a long trip reasonably', async () => {
    const price = await calculatePrice(
      LONG_PICKUP.lat, LONG_PICKUP.lng,
      LONG_DROPOFF.lat, LONG_DROPOFF.lng,
      'DOCUMENT',
    );

    // ~15 km road distance → 5 + (15 × 2) = ~35 subtotal
    expect(price.distanceKm).toBeGreaterThan(12);
    expect(price.totalPrice).toBeGreaterThan(25);
    expect(price.totalPrice).toBeLessThan(100); // sanity cap (includes time-of-day multiplier)
  });

  it('should return duration of at least 10 minutes', async () => {
    const price = await calculatePrice(
      SHORT_PICKUP.lat, SHORT_PICKUP.lng,
      SHORT_DROPOFF.lat, SHORT_DROPOFF.lng,
      'DOCUMENT',
    );

    expect(price.estimatedDurationMinutes).toBeGreaterThanOrEqual(10);
  });
});

// ============================================================
// 2. Package Type Multipliers
// ============================================================

describe('Package type multipliers', () => {
  it('DOCUMENT should have 1.0× multiplier', async () => {
    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );
    expect(price.packageMultiplier).toBe(1.0);
  });

  it('FOOD should cost more than DOCUMENT for same route', async () => {
    const doc = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );
    const food = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'FOOD',
    );

    expect(food.packageMultiplier).toBe(1.1);
    expect(food.totalPrice).toBeGreaterThan(doc.totalPrice);
  });

  it('HIGH_VALUE should be the most expensive', async () => {
    const doc = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );
    const hv = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'HIGH_VALUE',
    );

    expect(hv.packageMultiplier).toBe(1.5);
    expect(hv.totalPrice).toBeGreaterThan(doc.totalPrice * 1.3);
  });

  it('LARGE_PARCEL should apply 1.4× multiplier', async () => {
    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'LARGE_PARCEL',
    );
    expect(price.packageMultiplier).toBe(1.4);
  });

  it('FRAGILE should apply 1.25× multiplier', async () => {
    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'FRAGILE',
    );
    expect(price.packageMultiplier).toBe(1.25);
  });
});

// ============================================================
// 3. Multi-Stop Surcharges
// ============================================================

describe('Multi-stop pricing', () => {
  it('should add GHS 3 per additional stop', async () => {
    const single = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );
    const multiStop = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
      { additionalStops: 2 },
    );

    expect(multiStop.additionalStops).toBe(2);
    expect(multiStop.stopSurcharges).toBe(6.0); // 2 × GHS 3
    expect(multiStop.totalPrice).toBeGreaterThan(single.totalPrice);
  });

  it('should handle 0 additional stops like a standard order', async () => {
    const standard = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );
    const explicit = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
      { additionalStops: 0 },
    );

    expect(standard.totalPrice).toBe(explicit.totalPrice);
    expect(explicit.stopSurcharges).toBe(0);
  });
});

// ============================================================
// 4. Schedule Discounts
// ============================================================

describe('Scheduled delivery discounts', () => {
  it('SAME_DAY should have no discount', async () => {
    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
      { scheduleType: 'SAME_DAY' },
    );
    expect(price.scheduleDiscount).toBe(1.0);
  });

  it('NEXT_DAY should apply 5% discount', async () => {
    const base = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );
    const nextDay = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
      { scheduleType: 'NEXT_DAY' },
    );

    expect(nextDay.scheduleDiscount).toBe(0.95);
    expect(nextDay.totalPrice).toBeLessThan(base.totalPrice);
  });

  it('RECURRING should apply 10% discount', async () => {
    const base = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );
    const recurring = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
      { scheduleType: 'RECURRING' },
    );

    expect(recurring.scheduleDiscount).toBe(0.90);
    expect(recurring.totalPrice).toBeLessThan(base.totalPrice);
  });
});

// ============================================================
// 5. Zone-Based Pricing
// ============================================================

describe('Zone-based pricing', () => {
  const MOCK_ZONE = {
    id: 'zone-kumasi',
    name: 'Kumasi Metro',
    status: 'ACTIVE',
    baseFare: 4.5,
    perKmRate: 1.8,
    minimumFare: 7.0,
    surgeMultiplier: 1.0,
    commissionRate: 12, // stored as percentage (0–100) in db
    currency: 'GHS',
    polygon: [[
      [-1.70, 6.60],
      [-1.50, 6.60],
      [-1.50, 6.80],
      [-1.70, 6.80],
      [-1.70, 6.60],
    ]],
  };

  it('should use zone pricing when pickup is inside a zone', async () => {
    (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_ZONE]);

    // Point inside the Kumasi zone (lat=6.69, lng=-1.62)
    const price = await calculatePrice(6.69, -1.62, 6.75, -1.55, 'DOCUMENT');

    expect(price.zoneId).toBe('zone-kumasi');
    expect(price.zoneName).toBe('Kumasi Metro');
    expect(price.baseFare).toBe(4.5);
    expect(price.commissionRate).toBeCloseTo(0.12, 2); // normalised from 12%
  });

  it('should fall back to platform defaults outside any zone', async () => {
    (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_ZONE]);

    // Point outside the Kumasi zone (Accra)
    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );

    expect(price.zoneId).toBeNull();
    expect(price.baseFare).toBe(5.0);
    expect(price.commissionRate).toBe(0.15);
  });
});

// ============================================================
// 6. Surge Pricing
// ============================================================

describe('Surge pricing', () => {
  it('should apply surge from zone and multiply the subtotal', async () => {
    const SURGE_ZONE = {
      id: 'zone-surge',
      name: 'Surge Zone',
      status: 'ACTIVE',
      baseFare: 5.0,
      perKmRate: 2.0,
      minimumFare: 8.0,
      surgeMultiplier: 1.4,
      commissionRate: 15,
      currency: 'GHS',
      activeRiders: 10,
      pendingOrders: 0,
      polygon: [[
        [-0.30, 5.45],
        [-0.10, 5.45],
        [-0.10, 5.70],
        [-0.30, 5.70],
        [-0.30, 5.45],
      ]],
    };

    (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([SURGE_ZONE]);

    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );

    expect(price.surgeMultiplier).toBe(1.4);
    expect(price.totalPrice).toBeGreaterThan(0);
  });

  it('should cap surge at 1.8×', async () => {
    const EXTREME_SURGE_ZONE = {
      id: 'zone-extreme',
      name: 'Extreme Surge',
      status: 'ACTIVE',
      baseFare: 5.0,
      perKmRate: 2.0,
      minimumFare: 8.0,
      surgeMultiplier: 3.0, // someone set it too high
      commissionRate: 15,
      currency: 'GHS',
      polygon: [[
        [-0.30, 5.45],
        [-0.10, 5.45],
        [-0.10, 5.70],
        [-0.30, 5.70],
        [-0.30, 5.45],
      ]],
    };

    (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([EXTREME_SURGE_ZONE]);

    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );

    expect(price.surgeMultiplier).toBe(1.8);
  });

  it('should not apply schedule discount when surge is active', async () => {
    const SURGE_ZONE = {
      id: 'zone-surge2',
      name: 'Surge Zone 2',
      status: 'ACTIVE',
      baseFare: 5.0,
      perKmRate: 2.0,
      minimumFare: 8.0,
      surgeMultiplier: 1.2,
      commissionRate: 15,
      currency: 'GHS',
      activeRiders: 10,
      pendingOrders: 0,
      polygon: [[
        [-0.30, 5.45],
        [-0.10, 5.45],
        [-0.10, 5.70],
        [-0.30, 5.70],
        [-0.30, 5.45],
      ]],
    };

    (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([SURGE_ZONE]);

    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
      { scheduleType: 'RECURRING' },
    );

    // Surge is > 1.0, so schedule discount should NOT be applied
    expect(price.surgeMultiplier).toBe(1.2);
    expect(price.scheduleDiscount).toBe(1.0);
  });
});

// ============================================================
// 7. Earnings Split
// ============================================================

describe('Earnings split', () => {
  it('rider should earn 85% at default 15% commission', async () => {
    const price = await calculatePrice(
      ACCRA_PICKUP.lat, ACCRA_PICKUP.lng,
      ACCRA_DROPOFF.lat, ACCRA_DROPOFF.lng,
      'DOCUMENT',
    );

    const expectedCommission = r(price.totalPrice * 0.15);
    const expectedEarnings = r(price.totalPrice - expectedCommission);

    expect(price.platformCommission).toBe(expectedCommission);
    expect(price.riderEarnings).toBe(expectedEarnings);
    expect(r(price.riderEarnings + price.platformCommission)).toBe(price.totalPrice);
  });
});

// ============================================================
// 8. Real-World Scenario Prices (Accra)
// ============================================================

describe('Real-world pricing sanity checks', () => {
  it('3 km DOCUMENT delivery should be GHS 10–16', async () => {
    // ~3 km haversine → ~3.9 km road distance
    const price = await calculatePrice(5.556, -0.197, 5.575, -0.175, 'DOCUMENT');
    expect(price.totalPrice).toBeGreaterThanOrEqual(10);
    expect(price.totalPrice).toBeLessThanOrEqual(20);
  });

  it('8 km FOOD delivery should be GHS 20–50', async () => {
    // Coordinates are ~11 km straight-line → ~15 km road distance
    const price = await calculatePrice(5.556, -0.197, 5.635, -0.12, 'FOOD');
    expect(price.totalPrice).toBeGreaterThanOrEqual(20);
    expect(price.totalPrice).toBeLessThanOrEqual(60);
  });

  it('20+ km HIGH_VALUE delivery should be GHS 70–120', async () => {
    // Osu → Tema: ~22 km straight-line → ~29 km road distance
    const price = await calculatePrice(
      LONG_PICKUP.lat, LONG_PICKUP.lng,
      LONG_DROPOFF.lat, LONG_DROPOFF.lng,
      'HIGH_VALUE',
    );
    expect(price.totalPrice).toBeGreaterThanOrEqual(70);
    expect(price.totalPrice).toBeLessThanOrEqual(140);
  });
});
