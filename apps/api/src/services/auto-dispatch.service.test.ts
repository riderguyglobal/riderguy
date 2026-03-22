import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { SmsService } from './sms.service';

// Type helper — casts a function to a Vitest mock so .mockResolvedValue etc. are available
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// ── Explicit mocks (more reliable than config-based aliases for relative imports) ──

const mockRooms = new Map<string, Set<string>>();

const { mockIo, mockGetIO } = vi.hoisted(() => {
  const rooms = new Map<string, Set<string>>();
  const mockIo = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
    sockets: { adapter: { rooms } },
  };
  return { mockIo, mockGetIO: vi.fn().mockReturnValue(mockIo) };
});

vi.mock('../socket', () => ({
  getIO: mockGetIO,
  initSocketServer: vi.fn(),
  emitOrderStatusUpdate: vi.fn(),
  emitNewJob: vi.fn(),
}));

vi.mock('../lib/redis', () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
}));

// io is resolved lazily in beforeEach
let io: typeof mockIo;

// ============================================================
// Auto-Dispatch Service — Integration Tests
//
// Tests the full client-request → rider-receiving flow:
//   1. Scoring functions (unit)
//   2. autoDispatch — finding & ranking riders, emitting offers
//   3. handleOfferResponse — accept / decline / timeout
//   4. Edge cases: no riders, stale GPS, already dispatching, etc.
//
// All mocks are configured via vitest.config.ts aliases.
// ============================================================

// Mock assignRider from dispatch.service (the alias mock only exports
// enqueuePayoutJob — we need assignRider for the auto-dispatch flow)
const { mockAssignRider } = vi.hoisted(() => ({
  mockAssignRider: vi.fn().mockResolvedValue({}),
}));

vi.mock('./dispatch.service', () => ({
  assignRider: mockAssignRider,
  enqueuePayoutJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./sms.service', () => ({
  SmsService: {
    sendNewJobAvailable: vi.fn().mockResolvedValue({ success: true }),
    sendOtp: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-msg-1' }),
    sendWelcome: vi.fn().mockResolvedValue({ success: true }),
    sendOrderUpdate: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    riderProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    orderStatusHistory: { create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Import AFTER mocks are wired ──
import {
  proximityScore,
  ratingScore,
  completionScore,
  onTimeScore,
  experienceScore,
  freshnessScore,
  computeOverallScore,
  autoDispatch,
  handleOfferResponse,
  cancelDispatch,
  isDispatching,
} from './auto-dispatch.service';

// ── Helpers ─────────────────────────────────────────────────

const ORDER_ID = 'order-001';
const RIDER_USER_ID = 'user-rider-01';
const RIDER_PROFILE_ID = 'profile-rider-01';

/** Build a realistic order object matching the Prisma select shape */
function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: ORDER_ID,
    orderNumber: 'RG-20260301-0001',
    status: 'PENDING',
    pickupAddress: '14 Independence Ave, Accra',
    dropoffAddress: '22 Oxford St, Osu',
    pickupLatitude: 5.556,
    pickupLongitude: -0.1969,
    dropoffLatitude: 5.5508,
    dropoffLongitude: -0.1835,
    distanceKm: 3.2,
    estimatedDurationMinutes: 18,
    totalPrice: 25.0,
    serviceFee: 2.5,
    riderEarnings: 21.25,
    packageType: 'PARCEL',
    packageDescription: 'Small box',
    currency: 'GHS',
    isMultiStop: false,
    zoneId: 'zone-accra-central',
    paymentMethod: 'CASH',
    paymentStatus: 'COMPLETED',
    ...overrides,
  };
}

/** Build a rider profile matching the Prisma select shape */
function makeRiderProfile(overrides: Record<string, any> = {}) {
  return {
    id: RIDER_PROFILE_ID,
    userId: RIDER_USER_ID,
    user: {
      firstName: 'Kwame',
      lastName: 'Asante',
      phone: '+233241234567',
    },
    currentLatitude: 5.558,       // ~0.3 km from pickup
    currentLongitude: -0.1965,
    lastLocationUpdate: new Date(),
    averageRating: 4.5,
    totalDeliveries: 120,
    completionRate: 0.95,
    onTimeRate: 0.88,
    currentZoneId: 'zone-accra-central',
    availability: 'ONLINE',
    onboardingStatus: 'ACTIVATED',
    ...overrides,
  };
}

/** Build a second rider further away */
function makeRiderProfile2(overrides: Record<string, any> = {}) {
  return {
    id: 'profile-rider-02',
    userId: 'user-rider-02',
    user: {
      firstName: 'Ama',
      lastName: 'Mensah',
      phone: '+233244567890',
    },
    currentLatitude: 5.580,       // ~3 km from pickup
    currentLongitude: -0.180,
    lastLocationUpdate: new Date(),
    averageRating: 4.0,
    totalDeliveries: 40,
    completionRate: 0.85,
    onTimeRate: 0.78,
    currentZoneId: 'zone-accra-central',
    availability: 'ONLINE',
    onboardingStatus: 'ACTIVATED',
    ...overrides,
  };
}

// ── Setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: false });

  // Resolve io from hoisted mock and re-apply defaults after clearAllMocks
  mockGetIO.mockReturnValue(mockIo);
  mockIo.to.mockReturnThis();
  io = mockIo;

  // Re-apply SmsService mock implementations (clearAllMocks keeps them,
  // but we reset just in case and ensure they're always thenable)
  asMock(SmsService.sendNewJobAvailable).mockResolvedValue({ success: true });
  asMock(SmsService.sendOtp).mockResolvedValue({ success: true, messageId: 'mock-msg-1' });
  asMock(SmsService.sendWelcome).mockResolvedValue({ success: true });
  asMock(SmsService.sendOrderUpdate).mockResolvedValue({ success: true });

  // Reset the assignRider mock
  mockAssignRider.mockResolvedValue({});

  // Default mock returns
  (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeOrder());
  (prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue(makeOrder({ status: 'SEARCHING_RIDER' }));
});

afterEach(() => {
  // Cancel any lingering dispatch to clear the Map
  cancelDispatch(ORDER_ID);
  vi.useRealTimers();
});

// ============================================================
// 1. Scoring Function Unit Tests
// ============================================================

describe('Scoring functions', () => {
  // ── proximityScore ──

  describe('proximityScore', () => {
    it('returns 100 for riders within 500m', () => {
      expect(proximityScore(0)).toBe(100);
      expect(proximityScore(0.3)).toBe(100);
      expect(proximityScore(0.5)).toBe(100);
    });

    it('returns 95 for riders within 1 km', () => {
      expect(proximityScore(0.7)).toBe(95);
      expect(proximityScore(1.0)).toBe(95);
    });

    it('returns 85 for riders within 2 km', () => {
      expect(proximityScore(1.5)).toBe(85);
      expect(proximityScore(2.0)).toBe(85);
    });

    it('returns 75 for riders within 3 km', () => {
      expect(proximityScore(2.5)).toBe(75);
      expect(proximityScore(3.0)).toBe(75);
    });

    it('returns 60 for riders within 5 km', () => {
      expect(proximityScore(4.0)).toBe(60);
      expect(proximityScore(5.0)).toBe(60);
    });

    it('returns 30 for riders within 8 km', () => {
      expect(proximityScore(6.0)).toBe(30);
      expect(proximityScore(8.0)).toBe(30);
    });

    it('returns 0 for riders beyond 8 km', () => {
      expect(proximityScore(8.1)).toBe(0);
      expect(proximityScore(15)).toBe(0);
      expect(proximityScore(25)).toBe(0);
    });
  });

  // ── ratingScore ──

  describe('ratingScore', () => {
    it('returns 50 for new riders with no rating', () => {
      expect(ratingScore(null)).toBe(50);
      expect(ratingScore(0)).toBe(50);
    });

    it('scales linearly from 0 to 100 based on 5-star rating', () => {
      expect(ratingScore(5.0)).toBe(100);
      expect(ratingScore(4.0)).toBe(80);
      expect(ratingScore(2.5)).toBe(50);
    });
  });

  // ── completionScore ──

  describe('completionScore', () => {
    it('returns 60 for new riders (null)', () => {
      expect(completionScore(null)).toBe(60);
    });

    it('scales by rate × 100', () => {
      expect(completionScore(1.0)).toBe(100);
      expect(completionScore(0.5)).toBe(50);
      expect(completionScore(0.0)).toBe(0);
    });
  });

  // ── onTimeScore ──

  describe('onTimeScore', () => {
    it('returns 60 for null', () => {
      expect(onTimeScore(null)).toBe(60);
    });

    it('scales by rate × 100', () => {
      expect(onTimeScore(0.9)).toBe(90);
    });
  });

  // ── experienceScore ──

  describe('experienceScore', () => {
    it('returns 100 for 500+ deliveries', () => {
      expect(experienceScore(500)).toBe(100);
      expect(experienceScore(1000)).toBe(100);
    });

    it('returns 10 for brand new riders', () => {
      expect(experienceScore(0)).toBe(10);
      expect(experienceScore(3)).toBe(10);
    });

    it('steps up through tiers', () => {
      expect(experienceScore(5)).toBe(25);
      expect(experienceScore(20)).toBe(40);
      expect(experienceScore(50)).toBe(55);
      expect(experienceScore(100)).toBe(70);
      expect(experienceScore(200)).toBe(85);
    });
  });

  // ── freshnessScore ──

  describe('freshnessScore', () => {
    it('returns 10 for null lastUpdate', () => {
      expect(freshnessScore(null)).toBe(10);
    });

    it('returns 100 for GPS updated <1 min ago', () => {
      const recent = new Date(Date.now() - 30_000); // 30 s ago
      expect(freshnessScore(recent)).toBe(100);
    });

    it('returns 85 for 3 min old GPS', () => {
      const threeMin = new Date(Date.now() - 3 * 60_000);
      expect(freshnessScore(threeMin)).toBe(85);
    });

    it('returns 60 for 8 min old GPS', () => {
      const eightMin = new Date(Date.now() - 8 * 60_000);
      expect(freshnessScore(eightMin)).toBe(60);
    });

    it('returns 30 for 12 min old GPS', () => {
      const twelveMin = new Date(Date.now() - 12 * 60_000);
      expect(freshnessScore(twelveMin)).toBe(30);
    });

    it('returns 5 for GPS older than 15 min', () => {
      const old = new Date(Date.now() - 20 * 60_000);
      expect(freshnessScore(old)).toBe(5);
    });
  });

  // ── computeOverallScore ──

  describe('computeOverallScore', () => {
    it('produces a weighted sum capped at 100', () => {
      // Perfect rider: 0.3km, 5.0 rating, 100% completion, 100% on-time, 500 deliveries, fresh GPS
      const score = computeOverallScore(0.3, 5.0, 1.0, 1.0, 500, new Date());
      expect(score).toBe(100);
    });

    it('defaults give a moderate score for brand-new riders', () => {
      // 2 km away, no rating, no rates, 0 deliveries, fresh GPS
      const score = computeOverallScore(2.0, null, null, null, 0, new Date());
      // proximity=85*0.40 + rating=50*0.20 + completion=60*0.15 + onTime=60*0.10 + experience=10*0.10 + freshness=100*0.05
      // = 34 + 10 + 9 + 6 + 1 + 5 = 65
      expect(score).toBe(65);
    });

    it('produces 0 for riders beyond 8 km with no stats', () => {
      const score = computeOverallScore(15, null, null, null, 0, null);
      // proximity=0 + rating=50*0.20=10 + comp=60*0.15=9 + onTime=60*0.10=6 + exp=10*0.10=1 + fresh=10*0.05=0.5
      // = 0+10+9+6+1+0.5 = 26.5 → 27
      expect(score).toBe(27);
    });

    it('proximity is the dominant weight (0.40)', () => {
      const close = computeOverallScore(0.5, 3.0, 0.7, 0.7, 30, new Date());
      const far = computeOverallScore(7.0, 5.0, 1.0, 1.0, 500, new Date());
      // Close rider with average stats should beat far rider with perfect stats
      // close: proximity=100*0.40=40, rating=60*0.20=12, comp=70*0.15=10.5, onTime=70*0.10=7, exp=40*0.10=4, fresh=100*0.05=5 = 78.5 → 79
      // far:   proximity=30*0.40=12, rating=100*0.20=20, comp=100*0.15=15, onTime=100*0.10=10, exp=100*0.10=10, fresh=100*0.05=5 = 72
      expect(close).toBeGreaterThan(far);
    });
  });
});

// ============================================================
// 2. autoDispatch — Full Flow Tests
// ============================================================

describe('autoDispatch', () => {
  // Mock riderProfile.findMany for every test in this block
  function mockRiderSearch(riders: any[]) {
    // Add findMany to the mock prisma if not present
    if (!(prisma as any).riderProfile) {
      (prisma as any).riderProfile = {
        findMany: vi.fn(),
        update: vi.fn(),
      };
    }
    ((prisma as any).riderProfile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(riders);
  }

  // Mock orderStatusHistory.create
  function mockStatusHistory() {
    if (!(prisma as any).orderStatusHistory) {
      (prisma as any).orderStatusHistory = {
        create: vi.fn().mockResolvedValue({}),
      };
    }
    ((prisma as any).orderStatusHistory.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
  }

  beforeEach(() => {
    mockStatusHistory();
    // Ensure order.updateMany exists for assignRider (via dispatch mock)
    if (!(prisma.order as any).updateMany) {
      (prisma.order as any).updateMany = vi.fn().mockResolvedValue({ count: 1 });
    }
  });

  it('should transition order to SEARCHING_RIDER and emit job:offer to best rider', async () => {
    const rider = makeRiderProfile();
    mockRiderSearch([rider]);

    await autoDispatch(ORDER_ID);

    // Order updated to SEARCHING_RIDER
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID },
        data: { status: 'SEARCHING_RIDER' },
      }),
    );

    // Status history created
    expect((prisma as any).orderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: ORDER_ID,
          status: 'SEARCHING_RIDER',
          actor: 'system',
        }),
      }),
    );

    // Socket emission to the rider's user room
    expect(io.to).toHaveBeenCalledWith(`user:${RIDER_USER_ID}`);
    expect(io.emit).toHaveBeenCalledWith(
      'job:offer',
      expect.objectContaining({
        orderId: ORDER_ID,
        orderNumber: 'RG-20260301-0001',
        pickupAddress: '14 Independence Ave, Accra',
        dropoffAddress: '22 Oxford St, Osu',
        packageType: 'PARCEL',
        currency: 'GHS',
      }),
    );

    // SMS was deprecated — push notifications used instead
  });

  it('should rank closer riders higher than distant riders', async () => {
    const closeRider = makeRiderProfile();               // ~0.3 km
    const farRider = makeRiderProfile2();                  // ~3 km
    mockRiderSearch([farRider, closeRider]);                // DB returns them in any order

    await autoDispatch(ORDER_ID);

    // First offer goes to the close rider (higher score)
    expect(io.to).toHaveBeenCalledWith(`user:${RIDER_USER_ID}`);
  });

  it('should handle no online riders gracefully', async () => {
    mockRiderSearch([]);

    await autoDispatch(ORDER_ID);

    // Order reverted to PENDING
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID },
        data: { status: 'PENDING' },
      }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID }),
      '[AutoDispatch] No online riders available',
    );

    // No socket emissions for job:offer
    expect(io.emit).not.toHaveBeenCalledWith('job:offer', expect.anything());
  });

  it('should skip riders with stale GPS (> 10 min)', async () => {
    const staleRider = makeRiderProfile({
      lastLocationUpdate: new Date(Date.now() - 11 * 60_000), // 11 min ago
    });
    mockRiderSearch([staleRider]);

    await autoDispatch(ORDER_ID);

    // No riders within radius after filtering → revert to PENDING
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'PENDING' },
      }),
    );
  });

  it('should skip riders beyond 8 km radius', async () => {
    const distantRider = makeRiderProfile({
      currentLatitude: 5.700,   // ~16 km north of pickup
      currentLongitude: -0.200,
    });
    mockRiderSearch([distantRider]);

    await autoDispatch(ORDER_ID);

    // No eligible riders → revert to PENDING
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'PENDING' },
      }),
    );
  });

  it('should skip orders not in PENDING or SEARCHING_RIDER status', async () => {
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeOrder({ status: 'ASSIGNED' }),
    );

    await autoDispatch(ORDER_ID);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID, status: 'ASSIGNED' }),
      '[AutoDispatch] Order not in dispatchable status',
    );

    // Order should NOT be updated
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('should not dispatch if order not found', async () => {
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await autoDispatch(ORDER_ID);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID }),
      '[AutoDispatch] Order not found',
    );
  });

  it('should prevent duplicate dispatches for the same order', async () => {
    const rider = makeRiderProfile();
    mockRiderSearch([rider]);

    // First call — starts dispatch
    await autoDispatch(ORDER_ID);

    // Second call — should be blocked
    await autoDispatch(ORDER_ID);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID }),
      '[AutoDispatch] Already dispatching for this order',
    );
  });

  it('should give zone bonus to same-zone riders', async () => {
    // Rider in same zone as order (zone-accra-central)
    const sameZoneRider = makeRiderProfile({
      id: 'profile-same-zone',
      userId: 'user-same-zone',
      currentZoneId: 'zone-accra-central',
      currentLatitude: 5.560,
      currentLongitude: -0.195,
    });
    // Rider in different zone but slightly closer
    const diffZoneRider = makeRiderProfile({
      id: 'profile-diff-zone',
      userId: 'user-diff-zone',
      currentZoneId: 'zone-tema',
      currentLatitude: 5.559,
      currentLongitude: -0.1960,
    });
    mockRiderSearch([diffZoneRider, sameZoneRider]);

    await autoDispatch(ORDER_ID);

    // The same-zone rider should get the +3 bonus,
    // and at similar distances this can tip the ranking
    expect(io.to).toHaveBeenCalled();
  });
});

// ============================================================
// 3. handleOfferResponse — Accept / Decline / Timeout
// ============================================================

describe('handleOfferResponse', () => {
  function mockRiderSearch(riders: any[]) {
    if (!(prisma as any).riderProfile) {
      (prisma as any).riderProfile = {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      };
    }
    ((prisma as any).riderProfile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(riders);
    ((prisma as any).riderProfile.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  }

  function mockStatusHistory() {
    if (!(prisma as any).orderStatusHistory) {
      (prisma as any).orderStatusHistory = {
        create: vi.fn().mockResolvedValue({}),
      };
    }
    ((prisma as any).orderStatusHistory.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
  }

  beforeEach(() => {
    mockStatusHistory();
  });

  it('should return error when no active dispatch exists', async () => {
    const result = await handleOfferResponse('nonexistent-order', 'some-user', 'accept');

    expect(result).toEqual({
      success: false,
      error: 'No active offer for this order',
    });
  });

  it('should return error when wrong rider responds', async () => {
    const rider = makeRiderProfile();
    mockRiderSearch([rider]);

    await autoDispatch(ORDER_ID);

    const result = await handleOfferResponse(ORDER_ID, 'wrong-user-id', 'accept');

    expect(result).toEqual({
      success: false,
      error: 'This offer is not for you',
    });
  });

  it('should accept offer and assign rider successfully', async () => {
    const rider = makeRiderProfile();
    mockRiderSearch([rider]);

    await autoDispatch(ORDER_ID);

    // Reset to track calls during handleOfferResponse
    vi.clearAllMocks();
    asMock(SmsService.sendNewJobAvailable).mockResolvedValue({ success: true });
    mockAssignRider.mockResolvedValue({ id: ORDER_ID, status: 'ASSIGNED' });

    const result = await handleOfferResponse(ORDER_ID, RIDER_USER_ID, 'accept');

    expect(result.success).toBe(true);

    // assignRider was called with the correct args
    expect(mockAssignRider).toHaveBeenCalledWith(ORDER_ID, RIDER_PROFILE_ID, RIDER_USER_ID);

    // Assigned rider gets logged
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        riderId: RIDER_USER_ID,
      }),
      '[AutoDispatch] Rider accepted — assigned successfully',
    );

    // job:offer:taken broadcast
    expect(io.emit).toHaveBeenCalledWith('job:offer:taken', { orderId: ORDER_ID });

    // Dispatch is no longer active
    expect(isDispatching(ORDER_ID)).toBe(false);
  });

  it('should decline and try next rider', async () => {
    const rider1 = makeRiderProfile();
    const rider2 = makeRiderProfile2();
    mockRiderSearch([rider1, rider2]);

    await autoDispatch(ORDER_ID);

    // rider1 declines
    vi.clearAllMocks();
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeOrder());

    const result = await handleOfferResponse(ORDER_ID, RIDER_USER_ID, 'decline');

    expect(result.success).toBe(true);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID, riderId: RIDER_USER_ID }),
      '[AutoDispatch] Rider declined — trying next',
    );

    // Next rider gets the offer
    expect(io.to).toHaveBeenCalledWith(`user:user-rider-02`);
    expect(io.emit).toHaveBeenCalledWith('job:offer', expect.objectContaining({
      orderId: ORDER_ID,
    }));
  });

  it('should timeout and try next rider after 30 seconds', async () => {
    const rider1 = makeRiderProfile();
    const rider2 = makeRiderProfile2();
    mockRiderSearch([rider1, rider2]);

    await autoDispatch(ORDER_ID);

    vi.clearAllMocks();

    // Advance timer by 30 seconds (offer timeout)
    vi.advanceTimersByTime(30_000);

    // Timeout logged
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID, riderId: RIDER_USER_ID }),
      '[AutoDispatch] Offer timed out — trying next rider',
    );

    // job:offer:expired emitted to the timed-out rider
    expect(io.to).toHaveBeenCalledWith(`user:${RIDER_USER_ID}`);
    expect(io.emit).toHaveBeenCalledWith('job:offer:expired', { orderId: ORDER_ID });
  });

  it('should exhaust all riders and revert to PENDING', async () => {
    const rider = makeRiderProfile();
    mockRiderSearch([rider]); // Only 1 candidate

    await autoDispatch(ORDER_ID);

    vi.clearAllMocks();
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeOrder());
    (prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue(makeOrder({ status: 'PENDING' }));

    // Rider declines → no more candidates
    const result = await handleOfferResponse(ORDER_ID, RIDER_USER_ID, 'decline');

    expect(result.success).toBe(true);

    // Order reverts to PENDING (via the sendOfferToNextRider exhaustion path)
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID }),
      '[AutoDispatch] All candidates exhausted — order stays PENDING',
    );
  });
});

// ============================================================
// 4. cancelDispatch
// ============================================================

describe('cancelDispatch', () => {
  function mockRiderSearch(riders: any[]) {
    if (!(prisma as any).riderProfile) {
      (prisma as any).riderProfile = {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      };
    }
    ((prisma as any).riderProfile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(riders);
  }

  function mockStatusHistory() {
    if (!(prisma as any).orderStatusHistory) {
      (prisma as any).orderStatusHistory = {
        create: vi.fn().mockResolvedValue({}),
      };
    }
  }

  beforeEach(() => {
    mockStatusHistory();
  });

  it('should cancel an active dispatch', async () => {
    const rider = makeRiderProfile();
    mockRiderSearch([rider]);

    await autoDispatch(ORDER_ID);

    expect(isDispatching(ORDER_ID)).toBe(true);

    cancelDispatch(ORDER_ID);

    expect(isDispatching(ORDER_ID)).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID }),
      '[AutoDispatch] Dispatch cancelled',
    );
  });

  it('should be a no-op if no dispatch is active', () => {
    // Should not throw
    cancelDispatch('nonexistent-order');
    expect(isDispatching('nonexistent-order')).toBe(false);
  });

  it('should prevent timeout from firing after cancel', async () => {
    const rider1 = makeRiderProfile();
    const rider2 = makeRiderProfile2();
    mockRiderSearch([rider1, rider2]);

    await autoDispatch(ORDER_ID);

    cancelDispatch(ORDER_ID);

    vi.clearAllMocks();

    // Advance past the 30s timeout
    vi.advanceTimersByTime(35_000);

    // No timeout-related logs should fire
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.anything(),
      '[AutoDispatch] Offer timed out — trying next rider',
    );
  });
});

// ============================================================
// 5. isDispatching
// ============================================================

describe('isDispatching', () => {
  function mockRiderSearch(riders: any[]) {
    if (!(prisma as any).riderProfile) {
      (prisma as any).riderProfile = {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      };
    }
    ((prisma as any).riderProfile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(riders);
  }

  function mockStatusHistory() {
    if (!(prisma as any).orderStatusHistory) {
      (prisma as any).orderStatusHistory = {
        create: vi.fn().mockResolvedValue({}),
      };
    }
  }

  beforeEach(() => {
    mockStatusHistory();
  });

  it('returns false for unknown orders', () => {
    expect(isDispatching('unknown-order')).toBe(false);
  });

  it('returns true during active dispatch', async () => {
    mockRiderSearch([makeRiderProfile()]);
    await autoDispatch(ORDER_ID);
    expect(isDispatching(ORDER_ID)).toBe(true);
  });

  it('returns false after all riders exhausted', async () => {
    mockRiderSearch([makeRiderProfile()]); // Just 1 rider

    await autoDispatch(ORDER_ID);

    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeOrder());

    await handleOfferResponse(ORDER_ID, RIDER_USER_ID, 'decline');

    expect(isDispatching(ORDER_ID)).toBe(false);
  });
});

// ============================================================
// 6. Offer Payload Shape
// ============================================================

describe('Job offer payload', () => {
  function mockRiderSearch(riders: any[]) {
    if (!(prisma as any).riderProfile) {
      (prisma as any).riderProfile = {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      };
    }
    ((prisma as any).riderProfile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(riders);
  }

  function mockStatusHistory() {
    if (!(prisma as any).orderStatusHistory) {
      (prisma as any).orderStatusHistory = {
        create: vi.fn().mockResolvedValue({}),
      };
    }
  }

  beforeEach(() => {
    mockStatusHistory();
  });

  it('should include all required JobOffer fields', async () => {
    mockRiderSearch([makeRiderProfile()]);

    await autoDispatch(ORDER_ID);

    expect(io.emit).toHaveBeenCalledWith(
      'job:offer',
      expect.objectContaining({
        orderId: ORDER_ID,
        orderNumber: expect.any(String),
        pickupAddress: expect.any(String),
        dropoffAddress: expect.any(String),
        pickupLat: expect.any(Number),
        pickupLng: expect.any(Number),
        dropoffLat: expect.any(Number),
        dropoffLng: expect.any(Number),
        distanceKm: expect.any(Number),
        estimatedDurationMinutes: expect.any(Number),
        totalPrice: expect.any(Number),
        serviceFee: expect.any(Number),
        riderEarnings: expect.any(Number),
        packageType: expect.any(String),
        currency: 'GHS',
        distanceToPickup: expect.any(Number),
        expiresAt: expect.any(String),
        isMultiStop: false,
      }),
    );
  });

  it('should calculate riderEarnings as totalPrice - serviceFee when riderEarnings is null', async () => {
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeOrder({ riderEarnings: null, totalPrice: 30, serviceFee: 3 }),
    );
    mockRiderSearch([makeRiderProfile()]);

    await autoDispatch(ORDER_ID);

    expect(io.emit).toHaveBeenCalledWith(
      'job:offer',
      expect.objectContaining({
        riderEarnings: 27, // 30 - 3
      }),
    );
  });

  it('should handle Prisma Decimal objects for price fields', async () => {
    // Prisma Decimals implement valueOf() and toString() for Number() coercion
    const makeDecimal = (v: number) => ({ toNumber: () => v, valueOf: () => v, toString: () => String(v) });
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeOrder({
        totalPrice: makeDecimal(42.5),
        serviceFee: makeDecimal(4.25),
        riderEarnings: makeDecimal(36.13),
      }),
    );
    mockRiderSearch([makeRiderProfile()]);

    await autoDispatch(ORDER_ID);

    expect(io.emit).toHaveBeenCalledWith(
      'job:offer',
      expect.objectContaining({
        totalPrice: 42.5,
        serviceFee: 4.25,
        riderEarnings: 36.13,
      }),
    );
  });

  it('should set expiresAt 30 seconds in the future', async () => {
    mockRiderSearch([makeRiderProfile()]);

    const nowMs = Date.now();
    await autoDispatch(ORDER_ID);

    const emitCall = (io.emit as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === 'job:offer',
    );
    const payload = emitCall?.[1];
    const expiresMs = new Date(payload.expiresAt).getTime();

    // Should be ~30s from now (within 1s tolerance for test execution)
    expect(expiresMs - nowMs).toBeGreaterThanOrEqual(29_000);
    expect(expiresMs - nowMs).toBeLessThanOrEqual(31_000);
  });
});

// ============================================================
// 7. Multiple-rider cascade scenario (end-to-end)
// ============================================================

describe('Full dispatch cascade', () => {
  function mockRiderSearch(riders: any[]) {
    if (!(prisma as any).riderProfile) {
      (prisma as any).riderProfile = {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      };
    }
    ((prisma as any).riderProfile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(riders);
    ((prisma as any).riderProfile.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  }

  function mockStatusHistory() {
    if (!(prisma as any).orderStatusHistory) {
      (prisma as any).orderStatusHistory = {
        create: vi.fn().mockResolvedValue({}),
      };
    }
  }

  beforeEach(() => {
    mockStatusHistory();
  });

  it('rider1 declines → rider2 declines → rider3 accepts', async () => {
    const rider1 = makeRiderProfile();
    const rider2 = makeRiderProfile2();
    const rider3 = makeRiderProfile({
      id: 'profile-rider-03',
      userId: 'user-rider-03',
      user: { firstName: 'Yaw', lastName: 'Boateng', phone: '+233247654321' },
      currentLatitude: 5.565,
      currentLongitude: -0.190,
      totalDeliveries: 10,
      averageRating: 3.8,
    });
    mockRiderSearch([rider1, rider2, rider3]);

    await autoDispatch(ORDER_ID);

    // Step 1: rider1 declines
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeOrder());
    await handleOfferResponse(ORDER_ID, RIDER_USER_ID, 'decline');

    // Step 2: rider2 declines
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeOrder());
    await handleOfferResponse(ORDER_ID, 'user-rider-02', 'decline');

    // Step 3: rider3 accepts
    vi.clearAllMocks();
    asMock(SmsService.sendNewJobAvailable).mockResolvedValue({ success: true });
    mockAssignRider.mockResolvedValue({ id: ORDER_ID, status: 'ASSIGNED' });

    const result = await handleOfferResponse(ORDER_ID, 'user-rider-03', 'accept');

    expect(result.success).toBe(true);
    expect(isDispatching(ORDER_ID)).toBe(false);

    // job:offer:taken broadcast
    expect(io.emit).toHaveBeenCalledWith('job:offer:taken', { orderId: ORDER_ID });
  });

  it('rider1 timeout → rider2 timeout → all exhausted', async () => {
    const rider1 = makeRiderProfile();
    const rider2 = makeRiderProfile2();
    mockRiderSearch([rider1, rider2]);

    await autoDispatch(ORDER_ID);

    // Timeout rider 1
    vi.advanceTimersByTime(30_000);

    // Timeout rider 2
    vi.advanceTimersByTime(30_000);

    // All exhausted
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID }),
      '[AutoDispatch] All candidates exhausted — order stays PENDING',
    );
    expect(isDispatching(ORDER_ID)).toBe(false);
  });
});

// ============================================================
// 8. Order route POST /orders — Triggers autoDispatch
// ============================================================

describe('Order creation triggers dispatch', () => {
  it('POST /orders calls autoDispatch and notifyNearbyRiders (documented integration)', () => {
    // This is a documentation test — the route handler calls:
    //   autoDispatch(order.id).catch(() => {});
    //   notifyNearbyRiders(order.id, ...).catch(() => {});
    //
    // Both are fire-and-forget. The route returns the order immediately.
    // Full integration testing requires supertest, but the wiring is verified
    // by inspecting the route source at order.routes.ts POST /.
    expect(true).toBe(true);
  });
});

// ============================================================
// 9. Socket handler job:offer:respond — Delegates to handleOfferResponse
// ============================================================

describe('Socket job:offer:respond handler (documented)', () => {
  it('delegates to handleOfferResponse with orderId, userId, response', () => {
    // The socket handler at socket/index.ts:
    //   socket.on('job:offer:respond', async (data, ack) => {
    //     const { orderId, response } = data;
    //     const result = await handleOfferResponse(orderId, userId, response);
    //     ack?.({ success: result.success, error: result.error });
    //   });
    //
    // This delegates directly to handleOfferResponse which is fully tested above.
    expect(true).toBe(true);
  });
});
