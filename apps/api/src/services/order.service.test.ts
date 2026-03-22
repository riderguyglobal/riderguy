import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Type helper ──
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// ── Mocks ──

vi.mock('../config', () => ({
  config: {
    nodeEnv: 'test',
    isProduction: false,
    jwt: {
      accessSecret: 'test-access-secret-32-chars-long-xx',
      refreshSecret: 'test-refresh-secret-32-chars-long-x',
      accessExpiresIn: '15m',
      refreshExpiresIn: '30d',
    },
  },
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    riderProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    clientProfile: {
      updateMany: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    zone: {
      findUnique: vi.fn(),
    },
    locationHistory: {
      findFirst: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    promoCode: {
      findUnique: vi.fn(),
    },
    promoCodeUsage: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./sms.service', () => ({
  SmsService: {
    sendOtp: vi.fn().mockResolvedValue({ success: true }),
    sendWelcome: vi.fn().mockResolvedValue({ success: true }),
    sendNewJobAvailable: vi.fn().mockResolvedValue({ success: true }),
    sendOrderUpdate: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../socket', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnThis(), emit: vi.fn() }),
  initSocketServer: vi.fn(),
  emitOrderStatusUpdate: vi.fn(),
  emitNewJob: vi.fn(),
}));

vi.mock('./pricing.service', () => ({
  calculatePrice: vi.fn().mockResolvedValue({
    distanceKm: 5.2,
    haversineDistanceKm: 4.8,
    routeDistanceKm: 5.2,
    roadFactor: 1.08,
    estimatedDurationMinutes: 18,
    baseFare: 5.0,
    distanceCharge: 6.5,
    stopSurcharges: 0,
    additionalStops: 0,
    packageMultiplier: 1.0,
    packageType: 'SMALL',
    weightSurcharge: 0,
    surgeMultiplier: 1.0,
    surgeLevel: 'NONE',
    timeOfDayMultiplier: 1.0,
    timeOfDayPeriod: 'STANDARD',
    weatherMultiplier: 1.0,
    weatherCondition: 'normal',
    crossZoneMultiplier: 1.0,
    expressMultiplier: 1.0,
    isExpress: false,
    scheduleDiscount: 0,
    businessDiscount: 0,
    promoDiscount: 0,
    subtotal: 11.5,
    serviceFee: 1.73,
    serviceFeeRate: 15,
    totalPrice: 13.23,
    currency: 'GHS',
    riderEarnings: 11.25,
    platformCommission: 1.98,
    commissionRate: 15,
    zoneId: 'zone-accra',
    zoneName: 'Accra Metro',
  }),
  fetchRouteDistance: vi.fn().mockResolvedValue({ distanceKm: 5.2, durationMinutes: 18 }),
  calculateWaitTimeCharge: vi.fn().mockReturnValue({ charge: 0, totalMinutes: 0, pickupMinutes: 0, dropoffMinutes: 0, freeMinutes: 5, chargeableMinutes: 0 }),
  calculatePickupDistanceBonus: vi.fn().mockReturnValue(0),
}));

vi.mock('./gamification.service', () => ({
  awardXp: vi.fn().mockResolvedValue({ pointsAwarded: 50, leveledUp: false }),
  getCommissionRate: vi.fn().mockReturnValue(15),
}));

vi.mock('./streak.service', () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./wallet.service', () => ({
  creditWallet: vi.fn().mockResolvedValue({ wallet: { balance: 100 }, transaction: { id: 'tx-1' } }),
  creditTip: vi.fn().mockResolvedValue({ wallet: { balance: 105 }, transaction: { id: 'tx-2' } }),
}));

vi.mock('./auto-dispatch.service', () => ({
  cancelDispatch: vi.fn(),
  getDeclinedRiderIds: vi.fn().mockResolvedValue(new Set()),
}));

vi.mock('./cancellation.service', () => ({
  processCancellationConsequences: vi.fn().mockResolvedValue(undefined),
  isRiderSuspended: vi.fn().mockResolvedValue(false),
}));

vi.mock('../jobs/queues', () => ({
  enqueueCommissionJob: vi.fn().mockResolvedValue(undefined),
  enqueueReceiptJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./eta-learning.service', () => ({
  learnFromDelivery: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@riderguy/utils', () => ({
  generateOrderNumber: vi.fn().mockReturnValue('RG-20240101-0001'),
  generateDeliveryPin: vi.fn().mockReturnValue('4829'),
}));

// ── Import AFTER mocks ──
import {
  isValidTransition,
  getEstimate,
  createOrder,
  transitionStatus,
  cancelOrder,
  cancelOrderByRider,
  rateOrder,
  getAvailableJobs,
} from './order.service';
import { prisma } from '@riderguy/database';
import { creditWallet, creditTip } from './wallet.service';
import { awardXp } from './gamification.service';
import { enqueueCommissionJob, enqueueReceiptJob } from '../jobs/queues';

// ── Test Data ──

function mockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'RG-20240101-0001',
    clientId: 'client-1',
    riderId: null,
    zoneId: 'zone-accra',
    status: 'PENDING',
    pickupAddress: 'Osu Mall, Accra',
    pickupLatitude: 5.5600,
    pickupLongitude: -0.1870,
    dropoffAddress: 'Legon Campus',
    dropoffLatitude: 5.6505,
    dropoffLongitude: -0.1862,
    packageType: 'SMALL',
    totalPrice: 13.23,
    riderEarnings: 11.25,
    platformCommission: 1.98,
    currency: 'GHS',
    distanceKm: 5.2,
    estimatedDurationMinutes: 18,
    paymentMethod: 'MOBILE_MONEY',
    paymentStatus: 'COMPLETED',
    deliveryPinCode: '4829',
    clientRating: null,
    tipAmount: 0,
    isScheduled: false,
    isMultiStop: false,
    isExpress: false,
    createdAt: new Date(),
    assignedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    cancelledAt: null,
    failureReason: null,
    ...overrides,
  };
}

function mockRiderProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rider-1',
    userId: 'rider-user-1',
    availability: 'ONLINE',
    onboardingStatus: 'ACTIVATED',
    totalDeliveries: 50,
    averageRating: 4.8,
    totalRatings: 45,
    totalXp: 1200,
    currentLevel: 2,
    currentZoneId: 'zone-accra',
    currentLatitude: 5.5550,
    currentLongitude: -0.1850,
    ...overrides,
  };
}

// ============================================================
// ORDER SERVICE — COMPREHENSIVE LIFECYCLE SIMULATION TESTS
// ============================================================

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────
  // 1. STATUS TRANSITIONS — State Machine validation
  // ────────────────────────────────────────────────────────────
  describe('Status Transitions (State Machine)', () => {
    it('should allow valid forward transitions', () => {
      expect(isValidTransition('PENDING', 'SEARCHING_RIDER')).toBe(true);
      expect(isValidTransition('SEARCHING_RIDER', 'ASSIGNED')).toBe(true);
      expect(isValidTransition('ASSIGNED', 'PICKUP_EN_ROUTE')).toBe(true);
      expect(isValidTransition('PICKUP_EN_ROUTE', 'AT_PICKUP')).toBe(true);
      expect(isValidTransition('AT_PICKUP', 'PICKED_UP')).toBe(true);
      expect(isValidTransition('PICKED_UP', 'IN_TRANSIT')).toBe(true);
      expect(isValidTransition('IN_TRANSIT', 'AT_DROPOFF')).toBe(true);
      expect(isValidTransition('AT_DROPOFF', 'DELIVERED')).toBe(true);
    });

    it('should allow cancellation from pre-delivery statuses', () => {
      expect(isValidTransition('PENDING', 'CANCELLED_BY_CLIENT')).toBe(true);
      expect(isValidTransition('ASSIGNED', 'CANCELLED_BY_CLIENT')).toBe(true);
      expect(isValidTransition('ASSIGNED', 'CANCELLED_BY_RIDER')).toBe(true);
      expect(isValidTransition('PICKUP_EN_ROUTE', 'CANCELLED_BY_RIDER')).toBe(true);
    });

    it('should reject backward transitions', () => {
      expect(isValidTransition('ASSIGNED', 'PENDING')).toBe(false);
      expect(isValidTransition('DELIVERED', 'IN_TRANSIT')).toBe(false);
      expect(isValidTransition('AT_PICKUP', 'ASSIGNED')).toBe(false);
    });

    it('should reject transitions from terminal states', () => {
      expect(isValidTransition('DELIVERED', 'CANCELLED_BY_CLIENT')).toBe(false);
      expect(isValidTransition('CANCELLED_BY_CLIENT', 'PENDING')).toBe(false);
      expect(isValidTransition('CANCELLED_BY_RIDER', 'ASSIGNED')).toBe(false);
      expect(isValidTransition('FAILED', 'IN_TRANSIT')).toBe(false);
    });

    it('should allow FAILED from mid-delivery statuses', () => {
      expect(isValidTransition('AT_PICKUP', 'FAILED')).toBe(true);
      expect(isValidTransition('PICKED_UP', 'FAILED')).toBe(true);
      expect(isValidTransition('IN_TRANSIT', 'FAILED')).toBe(true);
      expect(isValidTransition('AT_DROPOFF', 'FAILED')).toBe(true);
    });

    it('should not allow client cancellation after pickup', () => {
      expect(isValidTransition('PICKED_UP', 'CANCELLED_BY_CLIENT')).toBe(false);
      expect(isValidTransition('IN_TRANSIT', 'CANCELLED_BY_CLIENT')).toBe(false);
      expect(isValidTransition('AT_DROPOFF', 'CANCELLED_BY_CLIENT')).toBe(false);
    });

    it('should allow admin cancellation from any active state', () => {
      expect(isValidTransition('PENDING', 'CANCELLED_BY_ADMIN')).toBe(true);
      expect(isValidTransition('ASSIGNED', 'CANCELLED_BY_ADMIN')).toBe(true);
      expect(isValidTransition('IN_TRANSIT', 'CANCELLED_BY_ADMIN')).toBe(true);
      expect(isValidTransition('AT_DROPOFF', 'CANCELLED_BY_ADMIN')).toBe(true);
    });

    it('should handle skip transitions (PENDING → ASSIGNED)', () => {
      expect(isValidTransition('PENDING', 'ASSIGNED')).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2. GET ESTIMATE — price quote without order creation
  // ────────────────────────────────────────────────────────────
  describe('Get Estimate', () => {
    it('should return pricing breakdown for a delivery estimate', async () => {
      const result = await getEstimate({
        pickupLatitude: 5.56,
        pickupLongitude: -0.187,
        dropoffLatitude: 5.6505,
        dropoffLongitude: -0.1862,
        packageType: 'SMALL' as any,
      });

      expect(result.totalPrice).toBe(13.23);
      expect(result.distanceKm).toBe(5.2);
      expect(result.currency).toBe('GHS');
      expect(result.riderEarnings).toBe(11.25);
      expect(result.platformCommission).toBe(1.98);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3. CREATE ORDER — client places a new delivery order
  // ────────────────────────────────────────────────────────────
  describe('Create Order', () => {
    it('should create a new delivery order with PENDING status', async () => {
      const order = mockOrder();
      asMock(prisma.order.create).mockResolvedValue(order);

      const result = await createOrder('client-1', {
        pickupAddress: 'Osu Mall, Accra',
        pickupLatitude: 5.56,
        pickupLongitude: -0.187,
        dropoffAddress: 'Legon Campus',
        dropoffLatitude: 5.6505,
        dropoffLongitude: -0.1862,
        packageType: 'SMALL' as any,
        paymentMethod: 'MOBILE_MONEY' as any,
      });

      expect(result.status).toBe('PENDING');
      expect(result.clientId).toBe('client-1');
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            clientId: 'client-1',
            pickupAddress: 'Osu Mall, Accra',
          }),
        }),
      );
    });

    it('should reject if server price drifts >15% from client estimate', async () => {
      await expect(
        createOrder('client-1', {
          pickupAddress: 'Osu Mall',
          pickupLatitude: 5.56,
          pickupLongitude: -0.187,
          dropoffAddress: 'Legon',
          dropoffLatitude: 5.65,
          dropoffLongitude: -0.186,
          packageType: 'SMALL' as any,
          paymentMethod: 'CASH' as any,
          estimatedTotalPrice: 5.0, // Way lower than 13.23
        }),
      ).rejects.toThrow('Price changed significantly');
    });

    it('should accept if price drift is within 15%', async () => {
      const order = mockOrder();
      asMock(prisma.order.create).mockResolvedValue(order);

      const result = await createOrder('client-1', {
        pickupAddress: 'Osu Mall',
        pickupLatitude: 5.56,
        pickupLongitude: -0.187,
        dropoffAddress: 'Legon',
        dropoffLatitude: 5.65,
        dropoffLongitude: -0.186,
        packageType: 'SMALL' as any,
        paymentMethod: 'CASH' as any,
        estimatedTotalPrice: 13.0, // Within 15% of 13.23
      });

      expect(result).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 4. FULL DELIVERY LIFECYCLE — PENDING → DELIVERED
  // ────────────────────────────────────────────────────────────
  describe('Full Delivery Lifecycle (Happy Path)', () => {
    it('should transition PENDING → ASSIGNED', async () => {
      const order = mockOrder({ status: 'PENDING' });
      const updated = mockOrder({ status: 'ASSIGNED', riderId: 'rider-1', assignedAt: new Date() });

      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(updated);
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});

      const result = await transitionStatus('order-1', 'ASSIGNED' as any, 'system');

      expect(result.status).toBe('ASSIGNED');
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'ASSIGNED' }),
        }),
      );
    });

    it('should transition ASSIGNED → PICKUP_EN_ROUTE → AT_PICKUP → PICKED_UP → IN_TRANSIT → AT_DROPOFF', async () => {
      const transitions = [
        ['ASSIGNED', 'PICKUP_EN_ROUTE'],
        ['PICKUP_EN_ROUTE', 'AT_PICKUP'],
        ['AT_PICKUP', 'PICKED_UP'],
        ['PICKED_UP', 'IN_TRANSIT'],
        ['IN_TRANSIT', 'AT_DROPOFF'],
      ] as const;

      for (const [from, to] of transitions) {
        vi.clearAllMocks();
        const order = mockOrder({ status: from, riderId: 'rider-1' });
        const updated = mockOrder({ status: to, riderId: 'rider-1' });

        asMock(prisma.order.findUnique).mockResolvedValue(order);
        asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
        asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(updated);
        asMock(prisma.orderStatusHistory.create).mockResolvedValue({});

        const result = await transitionStatus('order-1', to as any, 'rider-user-1');

        expect(result.status).toBe(to);
      }
    });

    it('should handle DELIVERED transition with full side effects', async () => {
      const order = mockOrder({ status: 'AT_DROPOFF', riderId: 'rider-1' });
      const delivered = mockOrder({
        status: 'DELIVERED',
        riderId: 'rider-1',
        deliveredAt: new Date(),
      });
      const rider = mockRiderProfile();

      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(delivered);
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});
      asMock(prisma.orderStatusHistory.findMany).mockResolvedValue([]);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.riderProfile.update).mockResolvedValue(rider);
      asMock(prisma.clientProfile.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.locationHistory.findFirst).mockResolvedValue(null);
      asMock(prisma.zone.findUnique).mockResolvedValue({ id: 'zone-accra', commissionRate: 15 });

      const result = await transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1');

      expect(result.status).toBe('DELIVERED');

      // Should credit rider wallet
      expect(creditWallet).toHaveBeenCalledWith(
        'rider-user-1',
        11.25,
        'DELIVERY_EARNING',
        expect.stringContaining('Earnings from order'),
        'order-1',
        'order',
      );

      // Should update rider stats (increment totalDeliveries, set ONLINE)
      expect(prisma.riderProfile.update).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        data: {
          totalDeliveries: { increment: 1 },
          availability: 'ONLINE',
        },
      });

      // Should update client stats
      expect(prisma.clientProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'client-1' },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: delivered.totalPrice },
        },
      });

      // Should enqueue receipt job
      expect(enqueueReceiptJob).toHaveBeenCalled();

      // Should award XP
      expect(awardXp).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 5. OPTIMISTIC CONCURRENCY — prevents race conditions
  // ────────────────────────────────────────────────────────────
  describe('Optimistic Concurrency', () => {
    it('should detect concurrent status change and throw', async () => {
      const order = mockOrder({ status: 'ASSIGNED' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 0 }); // concurrent change

      await expect(
        transitionStatus('order-1', 'PICKUP_EN_ROUTE' as any, 'rider-user-1'),
      ).rejects.toThrow('Order status changed concurrently');
    });

    it('should reject invalid status transition', async () => {
      const order = mockOrder({ status: 'DELIVERED' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(
        transitionStatus('order-1', 'IN_TRANSIT' as any, 'rider-user-1'),
      ).rejects.toThrow('Cannot transition from DELIVERED to IN_TRANSIT');
    });

    it('should reject transition for non-existent order', async () => {
      asMock(prisma.order.findUnique).mockResolvedValue(null);

      await expect(
        transitionStatus('nonexistent', 'ASSIGNED' as any, 'system'),
      ).rejects.toThrow('Order not found');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 6. CANCELLATION — client and rider flows with fees
  // ────────────────────────────────────────────────────────────
  describe('Cancellation by Client', () => {
    it('should cancel PENDING order for free', async () => {
      const order = mockOrder({ status: 'PENDING' });
      // cancelOrder calls transitionStatus internally, so we need the full mock chain
      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(mockOrder({ status: 'CANCELLED_BY_CLIENT' }));
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});

      const result = await cancelOrder('order-1', 'client-1', 'Changed my mind');

      expect(result.status).toBe('CANCELLED_BY_CLIENT');
      // No wallet credit for cancellation fee since order was PENDING
      expect(creditWallet).not.toHaveBeenCalled();
    });

    it('should charge GHS 3 cancellation fee after rider assignment', async () => {
      const order = mockOrder({ status: 'ASSIGNED', riderId: 'rider-1' });
      const rider = mockRiderProfile();

      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      // transitionStatus mocks
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(
        mockOrder({ status: 'CANCELLED_BY_CLIENT', riderId: 'rider-1' }),
      );
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});

      await cancelOrder('order-1', 'client-1', 'Too slow');

      // GHS 3 compensation to rider
      expect(creditWallet).toHaveBeenCalledWith(
        'rider-user-1',
        3.0,
        'DELIVERY_EARNING',
        expect.stringContaining('Cancellation compensation'),
        'order-1',
        'cancellation',
      );
    });

    it('should reject cancel by non-owner', async () => {
      const order = mockOrder({ clientId: 'client-1' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(cancelOrder('order-1', 'other-user', 'test'))
        .rejects.toThrow('Not your order');
    });

    it('should reject cancel after pickup', async () => {
      const order = mockOrder({ status: 'PICKED_UP', riderId: 'rider-1' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(cancelOrder('order-1', 'client-1'))
        .rejects.toThrow('can no longer be cancelled');
    });
  });

  describe('Cancellation by Rider', () => {
    it('should allow rider to cancel ASSIGNED order', async () => {
      const order = mockOrder({ status: 'ASSIGNED', riderId: 'rider-1' });
      const rider = mockRiderProfile();

      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      // transitionStatus mocks
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(
        mockOrder({ status: 'CANCELLED_BY_RIDER', riderId: 'rider-1' }),
      );
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});

      const result = await cancelOrderByRider('order-1', 'rider-user-1', 'Vehicle broke down');

      expect(result.status).toBe('CANCELLED_BY_RIDER');
    });

    it('should reject if rider is not assigned to order', async () => {
      const order = mockOrder({ status: 'ASSIGNED', riderId: 'other-rider' });
      const rider = mockRiderProfile();
      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);

      await expect(cancelOrderByRider('order-1', 'rider-user-1', 'test'))
        .rejects.toThrow('not assigned');
    });

    it('should reject post-pickup cancellation by rider', async () => {
      const order = mockOrder({ status: 'PICKED_UP', riderId: 'rider-1' });
      const rider = mockRiderProfile();
      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);

      await expect(cancelOrderByRider('order-1', 'rider-user-1', 'test'))
        .rejects.toThrow('Post-pickup cancellation');
    });

    it('should reject if rider is suspended', async () => {
      const { isRiderSuspended } = await import('./cancellation.service');
      asMock(isRiderSuspended).mockResolvedValueOnce(true);

      const order = mockOrder({ status: 'ASSIGNED', riderId: 'rider-1' });
      const rider = mockRiderProfile();
      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);

      await expect(cancelOrderByRider('order-1', 'rider-user-1', 'test'))
        .rejects.toThrow('suspended');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 7. RATING — client rates delivered order + tip
  // ────────────────────────────────────────────────────────────
  describe('Rating & Tipping', () => {
    it('should rate a delivered order and update rider stats', async () => {
      const order = mockOrder({ status: 'DELIVERED', riderId: 'rider-1' });
      const rated = { ...order, clientRating: 5, tipAmount: 2 };
      const rider = mockRiderProfile();

      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(rated);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.riderProfile.update).mockResolvedValue(rider);

      const result = await rateOrder('order-1', 'client-1', 5, 'Great rider!', 2);

      expect(result.clientRating).toBe(5);

      // Should update rider average rating
      expect(prisma.riderProfile.update).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        data: expect.objectContaining({
          averageRating: expect.any(Number),
          totalRatings: rider.totalRatings + 1,
        }),
      });

      // Should credit tip to rider
      expect(creditTip).toHaveBeenCalledWith(
        'rider-user-1',
        2,
        expect.stringContaining('Tip from order'),
        'order-1',
        'order',
      );

      // Should award 5-star XP
      expect(awardXp).toHaveBeenCalled();
    });

    it('should reject rating non-delivered order', async () => {
      const order = mockOrder({ status: 'IN_TRANSIT' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(rateOrder('order-1', 'client-1', 5))
        .rejects.toThrow('Can only rate delivered orders');
    });

    it('should reject duplicate rating (optimistic concurrency)', async () => {
      const order = mockOrder({ status: 'DELIVERED', clientRating: 4 });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(rateOrder('order-1', 'client-1', 5))
        .rejects.toThrow('already rated');
    });

    it('should reject rating by non-client', async () => {
      const order = mockOrder({ status: 'DELIVERED', clientId: 'other-client' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(rateOrder('order-1', 'attacker-1', 5))
        .rejects.toThrow('Not your order');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 8. AVAILABLE JOBS — rider sees pending orders
  // ────────────────────────────────────────────────────────────
  describe('Available Jobs', () => {
    it('should return all pending orders for activated rider regardless of zone', async () => {
      const rider = mockRiderProfile();
      const jobs = [mockOrder(), mockOrder({ id: 'order-2' })];

      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.order.findMany).mockResolvedValue(jobs);

      const result = await getAvailableJobs('rider-user-1');

      expect(result).toHaveLength(2);
    });

    it('should reject for non-activated rider', async () => {
      const rider = mockRiderProfile({ onboardingStatus: 'PENDING' });
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);

      await expect(getAvailableJobs('rider-user-1'))
        .rejects.toThrow('not yet activated');
    });

    it('should reject for offline rider', async () => {
      const rider = mockRiderProfile({ availability: 'OFFLINE' });
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);

      await expect(getAvailableJobs('rider-user-1'))
        .rejects.toThrow('must be online');
    });

    it('should filter out orders rider has declined', async () => {
      const rider = mockRiderProfile();
      const { getDeclinedRiderIds } = await import('./auto-dispatch.service');

      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.order.findMany).mockResolvedValue([
        mockOrder({ id: 'order-1' }),
        mockOrder({ id: 'order-2' }),
      ]);
      // Rider has declined order-1
      asMock(getDeclinedRiderIds)
        .mockResolvedValueOnce(new Set(['rider-user-1']))
        .mockResolvedValueOnce(new Set());

      const result = await getAvailableJobs('rider-user-1');

      expect(result).toHaveLength(1);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 9. CANCELLATION SETS RIDER BACK ONLINE
  // ────────────────────────────────────────────────────────────
  describe('Rider status on cancellation', () => {
    it('should set rider back to ONLINE when order is cancelled', async () => {
      const order = mockOrder({ status: 'ASSIGNED', riderId: 'rider-1' });
      const cancelled = mockOrder({ status: 'CANCELLED_BY_CLIENT', riderId: 'rider-1' });

      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(cancelled);
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});
      asMock(prisma.riderProfile.update).mockResolvedValue({});

      await transitionStatus('order-1', 'CANCELLED_BY_CLIENT' as any, 'client-1');

      expect(prisma.riderProfile.update).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        data: { availability: 'ONLINE' },
      });
    });
  });
});
