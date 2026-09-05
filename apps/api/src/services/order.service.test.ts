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
    orderStop: {
      count: vi.fn(),
    },
    riderProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
    auditLog: {
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
  calculateWaitTimeCharge: vi.fn().mockReturnValue({
    charge: 0,
    totalMinutes: 0,
    pickupMinutes: 0,
    dropoffMinutes: 0,
    freeMinutes: 5,
    chargeableMinutes: 0,
  }),
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
  creditWallet: vi
    .fn()
    .mockResolvedValue({ wallet: { balance: 100 }, transaction: { id: 'tx-1' } }),
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
  listOrders,
} from './order.service';
import { prisma } from '@riderguy/database';
import { creditWallet, creditTip } from './wallet.service';
import { awardXp } from './gamification.service';
import { calculatePickupDistanceBonus, calculateWaitTimeCharge } from './pricing.service';
import { enqueueReceiptJob } from '../jobs/queues';
import { cancelDispatch } from './auto-dispatch.service';

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
    pickupLatitude: 5.56,
    pickupLongitude: -0.187,
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
    actualPaymentMethod: null,
    deliveryPinCode: '4829',
    riderPaymentConfirmed: false,
    proofOfDeliveryType: null,
    proofOfDeliveryUrl: null,
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
    isVerified: true,
    user: { status: 'ACTIVE' },
    vehicles: [{ reviewStatus: 'APPROVED' }],
    totalDeliveries: 50,
    averageRating: 4.8,
    totalRatings: 45,
    totalXp: 1200,
    currentLevel: 2,
    currentZoneId: 'zone-accra',
    currentLatitude: 5.555,
    currentLongitude: -0.185,
    ...overrides,
  };
}

// ============================================================
// ORDER SERVICE — COMPREHENSIVE LIFECYCLE SIMULATION TESTS
// ============================================================

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(prisma.$executeRaw).mockResolvedValue(1);
    asMock(prisma.riderProfile.updateMany).mockResolvedValue({ count: 1 });
    asMock(prisma.$transaction).mockImplementation(async (operation: unknown) => {
      if (typeof operation === 'function') {
        return (operation as (tx: typeof prisma) => unknown)(prisma);
      }
      return Promise.all(operation as Promise<unknown>[]);
    });
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

    it('accepts only owner-scoped package photos uploaded by the creating client', async () => {
      const order = mockOrder({
        packagePhotoUrl:
          '/uploads/packages/client-1/photo-a.jpg,/uploads/packages/client-1/photo-b.jpg',
      });
      asMock(prisma.order.create).mockResolvedValue(order);

      await expect(
        createOrder('client-1', {
          pickupAddress: 'Osu Mall',
          pickupLatitude: 5.56,
          pickupLongitude: -0.187,
          dropoffAddress: 'Legon',
          dropoffLatitude: 5.65,
          dropoffLongitude: -0.186,
          packageType: 'SMALL' as any,
          packagePhotoUrl:
            '/uploads/packages/client-1/photo-a.jpg,/uploads/packages/client-1/photo-b.jpg',
          paymentMethod: 'CASH' as any,
        }),
      ).resolves.toBe(order);
    });

    it('rejects a package photo from another account before creating an order', async () => {
      await expect(
        createOrder('client-1', {
          pickupAddress: 'Osu Mall',
          pickupLatitude: 5.56,
          pickupLongitude: -0.187,
          dropoffAddress: 'Legon',
          dropoffLatitude: 5.65,
          dropoffLongitude: -0.186,
          packageType: 'SMALL' as any,
          packagePhotoUrl: '/uploads/packages/client-2/private.jpg',
          paymentMethod: 'CASH' as any,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'INVALID_PACKAGE_PHOTO',
      });

      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 4. FULL DELIVERY LIFECYCLE — PENDING → DELIVERED
  // ────────────────────────────────────────────────────────────
  describe('Full Delivery Lifecycle (Happy Path)', () => {
    it('rejects a bare PENDING → ASSIGNED transition without the dispatch workflow', async () => {
      const order = mockOrder({ status: 'PENDING' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(transitionStatus('order-1', 'ASSIGNED' as any, 'system')).rejects.toMatchObject({
        code: 'ASSIGNMENT_REQUIRES_DISPATCH',
      });

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
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
      const order = mockOrder({
        status: 'AT_DROPOFF',
        riderId: 'rider-1',
        riderPaymentConfirmed: true,
        proofOfDeliveryType: 'PIN_CODE',
        proofOfDeliveryUrl: 'pin:verified',
      });
      const delivered = mockOrder({
        status: 'DELIVERED',
        riderId: 'rider-1',
        deliveredAt: new Date(),
        riderPaymentConfirmed: true,
        proofOfDeliveryType: 'PIN_CODE',
        proofOfDeliveryUrl: 'pin:verified',
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
        prisma,
      );

      // Stats and post-work eligibility are evaluated under the Rider lock.
      expect(prisma.riderProfile.update).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        data: { totalDeliveries: { increment: 1 } },
      });
      expect(prisma.riderProfile.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: 'rider-1',
          vehicles: { some: expect.objectContaining({ reviewStatus: 'APPROVED' }) },
        }),
        data: { availability: 'ONLINE' },
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

    it('should block DELIVERED until payment is confirmed and proof is saved', async () => {
      const order = mockOrder({
        status: 'AT_DROPOFF',
        riderId: 'rider-1',
        paymentStatus: 'PENDING',
      });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1')).rejects.toThrow(
        'Electronic payment must be verified',
      );

      asMock(prisma.order.findUnique).mockResolvedValueOnce(
        mockOrder({
          status: 'AT_DROPOFF',
          riderId: 'rider-1',
          riderPaymentConfirmed: true,
        }),
      );

      await expect(transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1')).rejects.toThrow(
        'Proof of delivery is required',
      );
    });

    it('blocks multi-stop delivery completion while a required stop remains open', async () => {
      asMock(prisma.order.findUnique).mockResolvedValue(
        mockOrder({
          status: 'AT_DROPOFF',
          riderId: 'rider-1',
          isMultiStop: true,
          riderPaymentConfirmed: true,
          proofOfDeliveryType: 'PIN_CODE',
          proofOfDeliveryUrl: 'pin:verified',
        }),
      );
      asMock(prisma.orderStop.count).mockResolvedValue(2);

      await expect(
        transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1'),
      ).rejects.toMatchObject({ code: 'INCOMPLETE_DELIVERY_STOPS' });

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it.each(['CARD', 'MOBILE_MONEY', 'WALLET', 'BANK_TRANSFER'] as const)(
      'does not let rider confirmation close an unverified %s order',
      async (paymentMethod) => {
        asMock(prisma.order.findUnique).mockResolvedValue(
          mockOrder({
            status: 'AT_DROPOFF',
            riderId: 'rider-1',
            paymentMethod,
            paymentStatus: 'PENDING',
            riderPaymentConfirmed: true,
            actualPaymentMethod: paymentMethod,
            proofOfDeliveryType: 'PIN_CODE',
            proofOfDeliveryUrl: 'pin:verified',
          }),
        );

        await expect(
          transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1'),
        ).rejects.toThrow('Electronic payment must be verified');

        expect(prisma.order.updateMany).not.toHaveBeenCalled();
        expect(creditWallet).not.toHaveBeenCalled();
      },
    );

    it('does not credit a rider when a wallet order cannot be debited', async () => {
      asMock(prisma.order.findUnique).mockResolvedValue(
        mockOrder({
          status: 'AT_DROPOFF',
          riderId: 'rider-1',
          paymentMethod: 'WALLET',
          paymentStatus: 'PENDING',
          riderPaymentConfirmed: true,
          actualPaymentMethod: 'WALLET',
          proofOfDeliveryType: 'PIN_CODE',
          proofOfDeliveryUrl: 'pin:verified',
        }),
      );
      asMock(prisma.$transaction).mockResolvedValue(null);

      await expect(transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1')).rejects.toThrow(
        'Electronic payment must be verified',
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(creditWallet).not.toHaveBeenCalled();
    });

    it('allows the cash happy path after the assigned rider confirms collection', async () => {
      const cashOrder = mockOrder({
        status: 'AT_DROPOFF',
        riderId: 'rider-1',
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
        riderPaymentConfirmed: true,
        actualPaymentMethod: 'CASH',
        proofOfDeliveryType: 'PIN_CODE',
        proofOfDeliveryUrl: 'pin:verified',
      });
      const deliveredCashOrder = mockOrder({
        ...cashOrder,
        status: 'DELIVERED',
        paymentStatus: 'COMPLETED',
        deliveredAt: new Date(),
      });
      const rider = mockRiderProfile({ currentLevel: 1 });

      asMock(prisma.order.findUnique).mockResolvedValue(cashOrder);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(deliveredCashOrder);
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});
      asMock(prisma.orderStatusHistory.findMany).mockResolvedValue([]);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.riderProfile.update).mockResolvedValue(rider);
      asMock(prisma.clientProfile.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.locationHistory.findFirst).mockResolvedValue(null);

      const result = await transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1');

      expect(result.status).toBe('DELIVERED');
      expect(result.paymentStatus).toBe('COMPLETED');
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1', status: 'AT_DROPOFF', riderId: 'rider-1' },
          data: expect.objectContaining({
            status: 'DELIVERED',
            paymentStatus: 'COMPLETED',
          }),
        }),
      );
      expect(creditWallet).toHaveBeenCalledTimes(1);
    });

    it('pays wait and pickup adjustments without inflating an already-paid client total', async () => {
      const ready = mockOrder({
        status: 'AT_DROPOFF',
        riderId: 'rider-1',
        paymentMethod: 'MOBILE_MONEY',
        paymentStatus: 'COMPLETED',
        totalPrice: 13.23,
        riderEarnings: 11.25,
        proofOfDeliveryType: 'PIN_CODE',
        proofOfDeliveryUrl: 'pin:verified',
      });
      const settled = mockOrder({
        ...ready,
        status: 'DELIVERED',
        deliveredAt: new Date(),
        waitTimeCharge: 3,
        waitTimeMinutes: 8,
        riderEarnings: 16.25,
      });

      asMock(calculateWaitTimeCharge).mockReturnValueOnce({
        charge: 3,
        totalMinutes: 8,
        pickupMinutes: 0,
        dropoffMinutes: 8,
        freeMinutes: 5,
        chargeableMinutes: 3,
      });
      asMock(calculatePickupDistanceBonus).mockReturnValueOnce(2);
      asMock(prisma.order.findUnique).mockResolvedValue(ready);
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(settled);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.orderStatusHistory.findMany).mockResolvedValue([]);
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(mockRiderProfile());
      asMock(prisma.riderProfile.update).mockResolvedValue(mockRiderProfile());
      asMock(prisma.locationHistory.findFirst).mockResolvedValue({
        latitude: 5.54,
        longitude: -0.2,
      });
      asMock(prisma.clientProfile.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.zone.findUnique).mockResolvedValue({ commissionRate: 15 });

      await transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1');

      const settlementUpdate = asMock(prisma.order.updateMany).mock.calls[0][0];
      expect(settlementUpdate.data).toMatchObject({
        status: 'DELIVERED',
        waitTimeCharge: 3,
        waitTimeMinutes: 8,
        riderEarnings: 16.25,
      });
      expect(settlementUpdate.data).not.toHaveProperty('totalPrice');
      expect(creditWallet).toHaveBeenCalledWith(
        'rider-user-1',
        16.25,
        'DELIVERY_EARNING',
        expect.stringContaining('Earnings from order'),
        'order-1',
        'order',
        prisma,
      );
      expect(prisma.clientProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'client-1' },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: 13.23 },
        },
      });
    });

    it('treats a concurrent DELIVERED commit as an idempotent no-op', async () => {
      const ready = mockOrder({
        status: 'AT_DROPOFF',
        riderId: 'rider-1',
        proofOfDeliveryType: 'PIN_CODE',
        proofOfDeliveryUrl: 'pin:verified',
      });
      const alreadyDelivered = mockOrder({
        ...ready,
        status: 'DELIVERED',
        deliveredAt: new Date(),
      });

      asMock(prisma.order.findUnique)
        .mockResolvedValueOnce(ready)
        .mockResolvedValueOnce(alreadyDelivered);
      asMock(prisma.orderStatusHistory.findMany).mockResolvedValue([]);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(mockRiderProfile());
      asMock(prisma.locationHistory.findFirst).mockResolvedValue(null);

      const result = await transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1');

      expect(result.status).toBe('DELIVERED');
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      expect(prisma.riderProfile.update).not.toHaveBeenCalled();
      expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
      expect(creditWallet).not.toHaveBeenCalled();
      // Receipt/commission jobs have deterministic IDs and are safe to
      // re-submit, closing the commit-before-enqueue crash window.
      expect(enqueueReceiptJob).toHaveBeenCalledTimes(1);
      expect(awardXp).not.toHaveBeenCalled();
    });

    it('rolls every settlement write back when the rider credit fails', async () => {
      const ready = mockOrder({
        status: 'AT_DROPOFF',
        riderId: 'rider-1',
        proofOfDeliveryType: 'PIN_CODE',
        proofOfDeliveryUrl: 'pin:verified',
      });
      const durable = {
        orderStatus: 'AT_DROPOFF',
        statusHistoryCount: 0,
        riderDeliveries: 50,
        riderAvailability: 'BUSY',
        clientOrders: 7,
      };

      asMock(prisma.order.findUnique).mockResolvedValue(ready);
      asMock(prisma.orderStatusHistory.findMany).mockResolvedValue([]);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(mockRiderProfile());
      asMock(prisma.locationHistory.findFirst).mockResolvedValue(null);
      asMock(creditWallet).mockRejectedValueOnce(new Error('ledger unavailable'));

      asMock(prisma.$transaction).mockImplementationOnce(async (operation: unknown) => {
        const draft = { ...durable };
        const transactionClient = {
          ...prisma,
          order: {
            ...prisma.order,
            findUnique: vi.fn().mockResolvedValue(ready),
            updateMany: vi.fn().mockImplementation(async () => {
              draft.orderStatus = 'DELIVERED';
              return { count: 1 };
            }),
            findUniqueOrThrow: vi.fn().mockImplementation(async () =>
              mockOrder({
                ...ready,
                status: draft.orderStatus,
                deliveredAt: new Date(),
              }),
            ),
          },
          orderStatusHistory: {
            ...prisma.orderStatusHistory,
            create: vi.fn().mockImplementation(async () => {
              draft.statusHistoryCount += 1;
              return {};
            }),
          },
          riderProfile: {
            ...prisma.riderProfile,
            findUnique: vi.fn().mockResolvedValue(mockRiderProfile()),
            update: vi.fn().mockImplementation(async () => {
              draft.riderDeliveries += 1;
              return mockRiderProfile();
            }),
            updateMany: vi.fn().mockImplementation(async () => {
              draft.riderAvailability = 'ONLINE';
              return { count: 1 };
            }),
          },
          clientProfile: {
            updateMany: vi.fn().mockImplementation(async () => {
              draft.clientOrders += 1;
              return { count: 1 };
            }),
          },
          zone: {
            findUnique: vi.fn().mockResolvedValue({ commissionRate: 15 }),
          },
        };

        const result = await (operation as (tx: typeof prisma) => Promise<unknown>)(
          transactionClient as typeof prisma,
        );
        // This commit line is intentionally unreachable when the callback
        // rejects, modelling Prisma discarding transaction-local writes.
        Object.assign(durable, draft);
        return result;
      });

      await expect(transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1')).rejects.toThrow(
        'ledger unavailable',
      );

      expect(durable).toEqual({
        orderStatus: 'AT_DROPOFF',
        statusHistoryCount: 0,
        riderDeliveries: 50,
        riderAvailability: 'BUSY',
        clientOrders: 7,
      });
      expect(creditWallet).toHaveBeenCalledWith(
        'rider-user-1',
        11.25,
        'DELIVERY_EARNING',
        expect.stringContaining('Earnings from order'),
        'order-1',
        'order',
        expect.objectContaining({ order: expect.any(Object) }),
      );
      expect(enqueueReceiptJob).not.toHaveBeenCalled();
      expect(awardXp).not.toHaveBeenCalled();
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
      expect(asMock(prisma.$executeRaw).mock.calls[0]?.[1]).toBe(
        'riderguy:order-status-transition:order-1',
      );
    });

    it('re-authorizes the expected Rider inside the locked transition', async () => {
      const reassigned = mockOrder({ status: 'ASSIGNED', riderId: 'rider-2' });
      asMock(prisma.order.findUnique).mockResolvedValue(reassigned);

      await expect(
        transitionStatus('order-1', 'PICKUP_EN_ROUTE' as any, 'rider-user-1', undefined, {
          expectedRiderId: 'rider-1',
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'ORDER_RIDER_ASSIGNMENT_CHANGED',
      });

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
    });

    it('re-authorizes the expected Rider after acquiring the delivery-settlement lock', async () => {
      const initial = mockOrder({
        status: 'AT_DROPOFF',
        riderId: 'rider-1',
        proofOfDeliveryType: 'PIN_CODE',
        proofOfDeliveryUrl: 'pin:verified',
      });
      const reassigned = mockOrder({
        ...initial,
        riderId: 'rider-2',
      });
      asMock(prisma.order.findUnique)
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(reassigned);
      asMock(prisma.orderStatusHistory.findMany).mockResolvedValue([]);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(mockRiderProfile());
      asMock(prisma.locationHistory.findFirst).mockResolvedValue(null);

      await expect(
        transitionStatus('order-1', 'DELIVERED' as any, 'rider-user-1', undefined, {
          expectedRiderId: 'rider-1',
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'ORDER_RIDER_ASSIGNMENT_CHANGED',
      });

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      expect(creditWallet).not.toHaveBeenCalled();
    });

    it('binds the status CAS to both the observed status and Rider assignment', async () => {
      const assigned = mockOrder({ status: 'ASSIGNED', riderId: 'rider-1' });
      asMock(prisma.order.findUnique).mockResolvedValue(assigned);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 0 });

      await expect(
        transitionStatus('order-1', 'PICKUP_EN_ROUTE' as any, 'rider-user-1', undefined, {
          expectedRiderId: 'rider-1',
        }),
      ).rejects.toMatchObject({ code: 'CONCURRENT_STATUS_CHANGE' });

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1', status: 'ASSIGNED', riderId: 'rider-1' },
        }),
      );
    });

    it('takes the Rider lock before updating a terminal Order row', async () => {
      const current = mockOrder({ status: 'IN_TRANSIT', riderId: 'rider-1' });
      const failed = mockOrder({ status: 'FAILED', riderId: 'rider-1' });
      asMock(prisma.order.findUnique).mockResolvedValue(current);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(failed);
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});

      await transitionStatus('order-1', 'FAILED' as any, 'rider-user-1', 'Recipient unavailable', {
        expectedRiderId: 'rider-1',
      });

      expect(asMock(prisma.$executeRaw).mock.calls.map((call) => call[1])).toEqual([
        'riderguy:order-status-transition:order-1',
        'riderguy:rider-vehicle-state:rider-1',
      ]);
      expect(asMock(prisma.$executeRaw).mock.invocationCallOrder[1]).toBeLessThan(
        asMock(prisma.order.updateMany).mock.invocationCallOrder[0]!,
      );
    });

    it('rolls status, history, Rider release, and admin audit back as one decision', async () => {
      const current = mockOrder({ status: 'IN_TRANSIT', riderId: 'rider-1' });
      const durable = {
        status: 'IN_TRANSIT',
        statusHistoryRows: 0,
        riderAvailability: 'BUSY',
        auditRows: 0,
      };

      asMock(prisma.$transaction).mockImplementationOnce(async (operation: unknown) => {
        const draft = { ...durable };
        const transactionClient = {
          ...prisma,
          $executeRaw: vi.fn().mockResolvedValue(1),
          order: {
            ...prisma.order,
            findUnique: vi.fn().mockImplementation(async () => ({
              ...current,
              status: draft.status,
            })),
            updateMany: vi.fn().mockImplementation(async ({ data }) => {
              draft.status = data.status;
              return { count: 1 };
            }),
            findUniqueOrThrow: vi.fn().mockImplementation(async () => ({
              ...current,
              status: draft.status,
            })),
          },
          orderStatusHistory: {
            ...prisma.orderStatusHistory,
            create: vi.fn().mockImplementation(async () => {
              draft.statusHistoryRows += 1;
              return {};
            }),
          },
          riderProfile: {
            ...prisma.riderProfile,
            updateMany: vi.fn().mockImplementation(async () => {
              draft.riderAvailability = 'ONLINE';
              return { count: 1 };
            }),
          },
          auditLog: {
            create: vi.fn().mockImplementation(async () => {
              draft.auditRows += 1;
              throw new Error('audit unavailable');
            }),
          },
        };

        const result = await (operation as (tx: typeof prisma) => Promise<unknown>)(
          transactionClient as typeof prisma,
        );
        Object.assign(durable, draft);
        return result;
      });

      await expect(
        transitionStatus(
          'order-1',
          'CANCELLED_BY_ADMIN' as any,
          'admin-1',
          'Confirmed operations cancellation',
          {
            auditContext: {
              actorUserId: 'admin-1',
              ipAddress: '127.0.0.1',
              userAgent: 'vitest',
            },
          },
        ),
      ).rejects.toThrow('audit unavailable');

      expect(durable).toEqual({
        status: 'IN_TRANSIT',
        statusHistoryRows: 0,
        riderAvailability: 'BUSY',
        auditRows: 0,
      });
    });

    it('treats retrying an already-committed non-delivery status as a no-op', async () => {
      const cancelled = mockOrder({ status: 'CANCELLED_BY_ADMIN', riderId: 'rider-1' });
      asMock(prisma.order.findUnique).mockResolvedValue(cancelled);

      await expect(
        transitionStatus(
          'order-1',
          'CANCELLED_BY_ADMIN' as any,
          'admin-1',
          'Confirmed operations cancellation',
          { auditContext: { actorUserId: 'admin-1' } },
        ),
      ).resolves.toEqual(cancelled);

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      expect(prisma.riderProfile.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('attributes an administrator transition inside the status transaction', async () => {
      const current = mockOrder({ status: 'PENDING' });
      const cancelled = mockOrder({ status: 'CANCELLED_BY_ADMIN' });
      asMock(prisma.order.findUnique).mockResolvedValue(current);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(cancelled);
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});
      asMock(prisma.auditLog.create).mockResolvedValue({ id: 'audit-1' });

      await transitionStatus(
        'order-1',
        'CANCELLED_BY_ADMIN' as any,
        'admin-1',
        'Duplicate delivery request',
        {
          auditContext: {
            actorUserId: 'admin-1',
            ipAddress: '127.0.0.1',
            userAgent: 'vitest',
          },
        },
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'admin-1',
          action: 'ORDER_CANCELLED',
          entityType: 'Order',
          entityId: 'order-1',
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          oldData: { status: 'PENDING' },
          newData: {
            status: 'CANCELLED_BY_ADMIN',
            note: 'Duplicate delivery request',
          },
        }),
      });
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

      await expect(transitionStatus('nonexistent', 'ASSIGNED' as any, 'system')).rejects.toThrow(
        'Order not found',
      );
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
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(
        mockOrder({ status: 'CANCELLED_BY_CLIENT' }),
      );
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
        prisma,
      );
    });

    it('rolls back cancellation, Rider release, and compensation when the wallet credit fails', async () => {
      const assigned = mockOrder({ status: 'ASSIGNED', riderId: 'rider-1' });
      const durable = {
        status: 'ASSIGNED',
        statusHistoryRows: 0,
        riderAvailability: 'BUSY',
      };

      asMock(creditWallet).mockRejectedValueOnce(new Error('ledger unavailable'));
      asMock(prisma.$transaction).mockImplementationOnce(async (operation: unknown) => {
        const draft = { ...durable };
        const transactionClient = {
          ...prisma,
          $executeRaw: vi.fn().mockResolvedValue(1),
          order: {
            ...prisma.order,
            findUnique: vi.fn().mockImplementation(async () => ({
              ...assigned,
              status: draft.status,
            })),
            updateMany: vi.fn().mockImplementation(async ({ data }) => {
              draft.status = data.status;
              return { count: 1 };
            }),
            findUniqueOrThrow: vi.fn().mockImplementation(async () => ({
              ...assigned,
              status: draft.status,
            })),
          },
          orderStatusHistory: {
            ...prisma.orderStatusHistory,
            create: vi.fn().mockImplementation(async () => {
              draft.statusHistoryRows += 1;
              return {};
            }),
          },
          riderProfile: {
            ...prisma.riderProfile,
            findUnique: vi.fn().mockResolvedValue(mockRiderProfile()),
            updateMany: vi.fn().mockImplementation(async () => {
              draft.riderAvailability = 'ONLINE';
              return { count: 1 };
            }),
          },
        };

        const result = await (operation as (tx: typeof prisma) => Promise<unknown>)(
          transactionClient as typeof prisma,
        );
        Object.assign(durable, draft);
        return result;
      });

      await expect(cancelOrder('order-1', 'client-1', 'Too slow')).rejects.toThrow(
        'ledger unavailable',
      );

      expect(durable).toEqual({
        status: 'ASSIGNED',
        statusHistoryRows: 0,
        riderAvailability: 'BUSY',
      });
      expect(creditWallet).toHaveBeenCalledWith(
        'rider-user-1',
        3,
        'DELIVERY_EARNING',
        expect.stringContaining('Cancellation compensation'),
        'order-1',
        'cancellation',
        expect.objectContaining({ order: expect.any(Object) }),
      );
      expect(cancelDispatch).not.toHaveBeenCalled();
    });

    it('does not compensate or stop dispatch when the cancellation CAS loses a race', async () => {
      const assigned = mockOrder({ status: 'ASSIGNED', riderId: 'rider-1' });
      asMock(prisma.order.findUnique).mockResolvedValue(assigned);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 0 });

      await expect(cancelOrder('order-1', 'client-1', 'Too slow')).rejects.toMatchObject({
        code: 'CONCURRENT_STATUS_CHANGE',
      });

      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      expect(prisma.riderProfile.updateMany).not.toHaveBeenCalled();
      expect(creditWallet).not.toHaveBeenCalled();
      expect(cancelDispatch).not.toHaveBeenCalled();
    });

    it('does not credit cancellation compensation twice when a committed request is retried', async () => {
      const cancelled = mockOrder({
        status: 'CANCELLED_BY_CLIENT',
        riderId: 'rider-1',
      });
      asMock(prisma.order.findUnique).mockResolvedValue(cancelled);

      await expect(cancelOrder('order-1', 'client-1', 'Too slow')).resolves.toEqual(cancelled);

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      expect(creditWallet).not.toHaveBeenCalled();
      expect(cancelDispatch).toHaveBeenCalledTimes(1);
    });

    it('should reject cancel by non-owner', async () => {
      const order = mockOrder({ clientId: 'client-1' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(cancelOrder('order-1', 'other-user', 'test')).rejects.toThrow('Not your order');
    });

    it('should reject cancel after pickup', async () => {
      const order = mockOrder({ status: 'PICKED_UP', riderId: 'rider-1' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(cancelOrder('order-1', 'client-1')).rejects.toThrow(
        'can no longer be cancelled',
      );
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

      await expect(cancelOrderByRider('order-1', 'rider-user-1', 'test')).rejects.toThrow(
        'not assigned',
      );
    });

    it('should reject post-pickup cancellation by rider', async () => {
      const order = mockOrder({ status: 'PICKED_UP', riderId: 'rider-1' });
      const rider = mockRiderProfile();
      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);

      await expect(cancelOrderByRider('order-1', 'rider-user-1', 'test')).rejects.toThrow(
        'Post-pickup cancellation',
      );
    });

    it('should reject if rider is suspended', async () => {
      const { isRiderSuspended } = await import('./cancellation.service');
      asMock(isRiderSuspended).mockResolvedValueOnce(true);

      const order = mockOrder({ status: 'ASSIGNED', riderId: 'rider-1' });
      const rider = mockRiderProfile();
      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);

      await expect(cancelOrderByRider('order-1', 'rider-user-1', 'test')).rejects.toThrow(
        'suspended',
      );
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

      await expect(rateOrder('order-1', 'client-1', 5)).rejects.toThrow(
        'Can only rate delivered orders',
      );
    });

    it('should reject duplicate rating (optimistic concurrency)', async () => {
      const order = mockOrder({ status: 'DELIVERED', clientRating: 4 });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(rateOrder('order-1', 'client-1', 5)).rejects.toThrow('already rated');
    });

    it('should reject rating by non-client', async () => {
      const order = mockOrder({ status: 'DELIVERED', clientId: 'other-client' });
      asMock(prisma.order.findUnique).mockResolvedValue(order);

      await expect(rateOrder('order-1', 'attacker-1', 5)).rejects.toThrow('Not your order');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 8. AVAILABLE JOBS — rider sees pending orders
  // ────────────────────────────────────────────────────────────
  describe('Order list authorization', () => {
    it('supports an explicit Rider-only scope for multi-role accounts', async () => {
      asMock(prisma.riderProfile.findUnique).mockResolvedValue({ id: 'rider-profile-1' });
      asMock(prisma.order.findMany).mockResolvedValue([]);
      asMock(prisma.order.count).mockResolvedValue(0);

      await listOrders('user-1', ['CLIENT', 'RIDER'], { scope: 'RIDER' });

      const expectedWhere = { riderId: 'rider-profile-1' };
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.order.count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('returns the scheduling and Rider pay fields required by the Rider delivery feed', async () => {
      asMock(prisma.riderProfile.findUnique).mockResolvedValue({ id: 'rider-profile-1' });
      asMock(prisma.order.findMany).mockResolvedValue([]);
      asMock(prisma.order.count).mockResolvedValue(0);

      await listOrders('rider-1', ['RIDER'], { scope: 'RIDER' });

      const call = asMock(prisma.order.findMany).mock.calls.at(-1)?.[0] as {
        select?: Record<string, boolean>;
      };
      expect(call.select).toEqual(
        expect.objectContaining({
          riderId: true,
          riderEarnings: true,
          isScheduled: true,
          scheduledAt: true,
          assignedAt: true,
          deliveredAt: true,
          cancelledAt: true,
          updatedAt: true,
        }),
      );
    });

    it('rejects Rider-only scope for a non-rider account', async () => {
      await expect(listOrders('client-1', ['CLIENT'], { scope: 'RIDER' })).rejects.toThrow(
        'Rider order scope requires a rider account',
      );

      expect(prisma.order.findMany).not.toHaveBeenCalled();
      expect(prisma.order.count).not.toHaveBeenCalled();
    });

    it('does not fall back to an unscoped query when the Rider profile is missing', async () => {
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(null);

      await expect(listOrders('rider-1', ['RIDER'], { scope: 'RIDER' })).rejects.toThrow(
        'Rider profile not found',
      );

      expect(prisma.order.findMany).not.toHaveBeenCalled();
      expect(prisma.order.count).not.toHaveBeenCalled();
    });

    it('scopes a Client + Rider account to both of its ownership identities', async () => {
      asMock(prisma.riderProfile.findUnique).mockResolvedValue({ id: 'rider-profile-1' });
      asMock(prisma.order.findMany).mockResolvedValue([]);
      asMock(prisma.order.count).mockResolvedValue(0);

      await listOrders('user-1', ['CLIENT', 'RIDER'], {});

      const expectedWhere = {
        OR: [{ clientId: 'user-1' }, { riderId: 'rider-profile-1' }],
      };
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.order.count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('does not select Rider pay fields for a Client order list', async () => {
      asMock(prisma.order.findMany).mockResolvedValue([]);
      asMock(prisma.order.count).mockResolvedValue(0);

      await listOrders('client-1', ['CLIENT'], {});

      const call = asMock(prisma.order.findMany).mock.calls.at(-1)?.[0] as {
        select?: Record<string, boolean>;
      };
      expect(call.select).not.toHaveProperty('riderEarnings');
      expect(call.select).not.toHaveProperty('riderId');
    });

    it('never falls through to an unscoped list for an unsupported role', async () => {
      await expect(listOrders('partner-1', ['PARTNER'], {})).rejects.toThrow(
        'You do not have permission to list orders',
      );

      expect(prisma.order.findMany).not.toHaveBeenCalled();
      expect(prisma.order.count).not.toHaveBeenCalled();
    });

    it('allows an explicit admin membership to list all orders', async () => {
      asMock(prisma.order.findMany).mockResolvedValue([]);
      asMock(prisma.order.count).mockResolvedValue(0);

      await listOrders('admin-1', ['CLIENT', 'ADMIN'], {});

      expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(prisma.order.count).toHaveBeenCalledWith({ where: {} });
    });
  });

  describe('Available Jobs', () => {
    it('should return all pending orders for activated rider regardless of zone', async () => {
      const rider = mockRiderProfile();
      const jobs = [mockOrder(), mockOrder({ id: 'order-2' })];

      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);
      asMock(prisma.order.findMany).mockResolvedValue(jobs);

      const result = await getAvailableJobs('rider-user-1');

      expect(result).toHaveLength(2);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            riderId: null,
            status: { in: ['PENDING', 'SEARCHING_RIDER'] },
            OR: [
              { isScheduled: false },
              { scheduledAt: null },
              { scheduledAt: { lte: expect.any(Date) } },
            ],
          }),
        }),
      );
    });

    it('should reject for non-activated rider', async () => {
      const rider = mockRiderProfile({ onboardingStatus: 'PENDING' });
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);

      await expect(getAvailableJobs('rider-user-1')).rejects.toThrow('not yet activated');
    });

    it('should reject for offline rider', async () => {
      const rider = mockRiderProfile({ availability: 'OFFLINE' });
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(rider);

      await expect(getAvailableJobs('rider-user-1')).rejects.toThrow('must be online');
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

      expect(prisma.riderProfile.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 'rider-1' }),
        data: { availability: 'ONLINE' },
      });
    });

    it('should release rider availability when an active order fails', async () => {
      const order = mockOrder({ status: 'IN_TRANSIT', riderId: 'rider-1' });
      const failed = mockOrder({
        status: 'FAILED',
        riderId: 'rider-1',
        failureReason: 'Recipient unreachable',
      });

      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(failed);
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});
      asMock(prisma.riderProfile.update).mockResolvedValue({});

      await transitionStatus('order-1', 'FAILED' as any, 'rider-user-1', 'Recipient unreachable');

      expect(prisma.riderProfile.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 'rider-1' }),
        data: { availability: 'ONLINE' },
      });
    });

    it('leaves a Rider offline after terminal work when vehicle approval was revoked mid-delivery', async () => {
      const order = mockOrder({ status: 'IN_TRANSIT', riderId: 'rider-1' });
      const failed = mockOrder({ status: 'FAILED', riderId: 'rider-1' });

      asMock(prisma.order.findUnique).mockResolvedValue(order);
      asMock(prisma.order.updateMany).mockResolvedValue({ count: 1 });
      asMock(prisma.order.findUniqueOrThrow).mockResolvedValue(failed);
      asMock(prisma.orderStatusHistory.create).mockResolvedValue({});
      asMock(prisma.riderProfile.updateMany).mockResolvedValue({ count: 0 });
      asMock(prisma.riderProfile.update).mockResolvedValue({});

      await transitionStatus('order-1', 'FAILED' as any, 'rider-user-1', 'Recipient unreachable');

      expect(prisma.riderProfile.update).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        data: { availability: 'OFFLINE' },
      });
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
      expect(asMock(prisma.$executeRaw).mock.calls.map((call) => call[1])).toEqual([
        'riderguy:order-status-transition:order-1',
        'riderguy:rider-vehicle-state:rider-1',
      ]);
    });
  });
});
