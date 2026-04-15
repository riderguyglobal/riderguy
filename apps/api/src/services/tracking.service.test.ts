import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Type helper ──
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// ── Mocks ──

vi.mock('../config', () => ({
  config: {
    nodeEnv: 'test',
    google: { mapsApiKey: '' }, // no Google Maps in tests — will use haversine fallback
  },
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    riderProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
    riderBadge: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    badge: {
      findMany: vi.fn(),
    },
    xpEvent: {
      groupBy: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    locationHistory: {
      findFirst: vi.fn(),
    },
    zone: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/api-error', async () => {
  const actual = await vi.importActual('../lib/api-error') as any;
  return actual;
});

// ── Import AFTER mocks ──
import { haversineKm, getETA, getRiderLocationForOrder, updateRiderLocation } from './tracking.service';
import { prisma } from '@riderguy/database';

// ============================================================
// RIDER FLOW & TRACKING — COMPREHENSIVE SIMULATION TESTS
//
// Simulates real rider scenarios:
//   - Haversine distance calculations
//   - GPS updates and location sharing
//   - ETA calculation (fallback)
//   - Location access control
// ============================================================

describe('Tracking & Rider Location', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────
  // 1. HAVERSINE DISTANCE — GPS calculations
  // ────────────────────────────────────────────────────────────
  describe('haversineKm', () => {
    it('should calculate distance between two Accra points correctly', () => {
      // Osu (5.560, -0.187) to Legon (5.650, -0.186) ≈ 10 km
      const dist = haversineKm(5.560, -0.187, 5.650, -0.186);
      expect(dist).toBeGreaterThan(9);
      expect(dist).toBeLessThan(11);
    });

    it('should return 0 for same point', () => {
      const dist = haversineKm(5.56, -0.187, 5.56, -0.187);
      expect(dist).toBe(0);
    });

    it('should handle short distances (within 200m geofence)', () => {
      // Two points ~100m apart in Accra
      const dist = haversineKm(5.5600, -0.1870, 5.5609, -0.1870);
      expect(dist).toBeLessThan(0.2); // within 200m
      expect(dist).toBeGreaterThan(0.05);
    });

    it('should handle cross-city distance (Accra to Kumasi ≈ 200km)', () => {
      const dist = haversineKm(5.56, -0.19, 6.69, -1.62);
      expect(dist).toBeGreaterThan(180);
      expect(dist).toBeLessThan(220);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2. ETA CALCULATION — haversine fallback (no Google Maps in tests)
  // ────────────────────────────────────────────────────────────
  describe('getETA', () => {
    it('should calculate ETA using haversine fallback at 25 km/h', async () => {
      // ~10 km distance → ~24 minutes at 25 km/h
      const eta = await getETA(5.560, -0.187, 5.650, -0.186);

      expect(eta.distanceKm).toBeGreaterThan(9);
      expect(eta.distanceKm).toBeLessThan(11);
      expect(eta.durationSeconds).toBeGreaterThan(1200); // > 20 min
      expect(eta.durationSeconds).toBeLessThan(2000); // < 33 min
    });

    it('should return small ETA for nearby points', async () => {
      const eta = await getETA(5.56, -0.187, 5.562, -0.187);

      expect(eta.distanceKm).toBeLessThan(1);
      expect(eta.durationSeconds).toBeLessThan(300); // < 5 min
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3. RIDER LOCATION FOR ORDER — access control
  // ────────────────────────────────────────────────────────────
  describe('getRiderLocationForOrder', () => {
    it('should return rider location to client during active delivery', async () => {
      asMock(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        riderId: 'rider-1',
        status: 'IN_TRANSIT',
        rider: {
          userId: 'rider-user-1',
          currentLatitude: 5.5600,
          currentLongitude: -0.1870,
          lastLocationUpdate: new Date(),
          user: { firstName: 'Kwame', lastName: 'Mensah' },
        },
      });

      const result = await getRiderLocationForOrder('order-1', 'client-1');

      expect(result.location).toBeDefined();
      expect(result.location!.riderName).toBe('Kwame Mensah');
      expect(result.location!.latitude).toBe(5.5600);
    });

    it('should return null location for DELIVERED orders (delivery complete)', async () => {
      asMock(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        riderId: 'rider-1',
        status: 'DELIVERED',
        rider: {
          userId: 'rider-user-1',
          currentLatitude: 5.56,
          currentLongitude: -0.187,
          lastLocationUpdate: new Date(),
          user: { firstName: 'Kwame', lastName: 'Mensah' },
        },
      });

      const result = await getRiderLocationForOrder('order-1', 'client-1');

      expect(result.location).toBeNull();
    });

    it('should reject access from unauthorized user', async () => {
      asMock(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        riderId: 'rider-1',
        status: 'IN_TRANSIT',
        rider: {
          userId: 'rider-user-1',
          currentLatitude: 5.56,
          currentLongitude: -0.187,
          lastLocationUpdate: new Date(),
          user: { firstName: 'Kwame', lastName: 'Mensah' },
        },
      });

      await expect(getRiderLocationForOrder('order-1', 'attacker'))
        .rejects.toThrow('do not have access');
    });

    it('should allow rider to see their own location data', async () => {
      asMock(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        riderId: 'rider-1',
        status: 'PICKUP_EN_ROUTE',
        rider: {
          userId: 'rider-user-1',
          currentLatitude: 5.56,
          currentLongitude: -0.187,
          lastLocationUpdate: new Date(),
          user: { firstName: 'Kwame', lastName: 'Mensah' },
        },
      });

      const result = await getRiderLocationForOrder('order-1', 'rider-user-1');

      expect(result.location).toBeDefined();
    });

    it('should throw for non-existent order', async () => {
      asMock(prisma.order.findUnique).mockResolvedValue(null);

      await expect(getRiderLocationForOrder('ghost', 'client-1'))
        .rejects.toThrow('Order not found');
    });

    it('should return null when no rider is assigned', async () => {
      asMock(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        riderId: null,
        status: 'PENDING',
        rider: null,
      });

      const result = await getRiderLocationForOrder('order-1', 'client-1');

      expect(result.location).toBeNull();
    });

    it('should share location for all active delivery statuses', async () => {
      const activeStatuses = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'];

      for (const status of activeStatuses) {
        asMock(prisma.order.findUnique).mockResolvedValue({
          id: 'order-1',
          clientId: 'client-1',
          riderId: 'rider-1',
          status,
          rider: {
            userId: 'rider-user-1',
            currentLatitude: 5.56,
            currentLongitude: -0.187,
            lastLocationUpdate: new Date(),
            user: { firstName: 'K', lastName: 'M' },
          },
        });

        const result = await getRiderLocationForOrder('order-1', 'client-1');
        expect(result.location).not.toBeNull();
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // 4. UPDATE RIDER LOCATION — GPS position update
  // ────────────────────────────────────────────────────────────
  describe('updateRiderLocation', () => {
    it('should update rider GPS coordinates and auto-detect zone', async () => {
      asMock(prisma.zone.findMany).mockResolvedValue([]);
      asMock(prisma.riderProfile.updateMany).mockResolvedValue({ count: 1 });

      await updateRiderLocation('rider-user-1', 5.5650, -0.1875);

      expect(prisma.riderProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'rider-user-1' },
        data: {
          currentLatitude: 5.5650,
          currentLongitude: -0.1875,
          lastLocationUpdate: expect.any(Date),
          currentZoneId: null,
        },
      });
    });

    it('should set currentZoneId when rider is inside a zone', async () => {
      // Mock a zone polygon that contains the test point
      asMock(prisma.zone.findMany).mockResolvedValue([{
        id: 'zone-osu',
        name: 'Osu',
        status: 'ACTIVE',
        polygon: [
          { lat: 5.55, lng: -0.20 },
          { lat: 5.55, lng: -0.17 },
          { lat: 5.58, lng: -0.17 },
          { lat: 5.58, lng: -0.20 },
        ],
      }]);
      asMock(prisma.riderProfile.updateMany).mockResolvedValue({ count: 1 });

      await updateRiderLocation('rider-user-1', 5.5650, -0.1875);

      expect(prisma.riderProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'rider-user-1' },
        data: {
          currentLatitude: 5.5650,
          currentLongitude: -0.1875,
          lastLocationUpdate: expect.any(Date),
          currentZoneId: 'zone-osu',
        },
      });
    });
  });
});
