import { prisma } from '@riderguy/database';
import { generateOrderNumber, generateDeliveryPin } from '@riderguy/utils';
import { XpAction } from '@riderguy/types';
import {
  calculatePrice,
  fetchRouteDistance,
  calculateWaitTimeCharge,
  calculatePickupDistanceBonus,
} from './pricing.service';
import { awardXp, getCommissionRate } from './gamification.service';
import { recordActivity as recordStreakActivity } from './streak.service';
import { creditWallet, creditTip } from './wallet.service';
import { cancelDispatch, getDeclinedRiderIds } from './auto-dispatch.service';
import { processCancellationConsequences, isRiderSuspended } from './cancellation.service';
import { ApiError } from '../lib/api-error';
import { logger } from '../lib/logger';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import { enqueueCommissionJob, enqueueReceiptJob, type CommissionJobData } from '../jobs/queues';
import { learnFromDelivery } from './eta-learning.service';
import { assertRiderWorkEligible, setPostWorkRiderAvailability } from './rider-work-eligibility';
import { StorageService } from './storage.service';
import type { Order, PackageType, PaymentMethod, OrderStatus } from '@prisma/client';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

// ============================================================
// Order Service — handles order creation, retrieval, status
// transitions, cancellation, and rating.
// ============================================================

// ── Valid status transitions (state machine) ────────────────

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['SEARCHING_RIDER', 'ASSIGNED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_ADMIN'],
  SEARCHING_RIDER: ['PENDING', 'ASSIGNED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_ADMIN'],
  ASSIGNED: ['PICKUP_EN_ROUTE', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'],
  PICKUP_EN_ROUTE: ['AT_PICKUP', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'],
  AT_PICKUP: ['PICKED_UP', 'FAILED', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'],
  IN_TRANSIT: ['AT_DROPOFF', 'FAILED', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'],
  AT_DROPOFF: ['DELIVERED', 'FAILED', 'CANCELLED_BY_ADMIN'],
  DELIVERED: [],
  FAILED: [],
  CANCELLED_BY_CLIENT: [],
  CANCELLED_BY_RIDER: [],
  CANCELLED_BY_ADMIN: [],
};

export interface OrderTransitionOptions {
  auditContext?: AdminAuditContext;
  /** Bind a Rider-originated mutation to the profile authorised by the route. */
  expectedRiderId?: string;
  /** Revalidate Client ownership and settle any cancellation compensation atomically. */
  clientCancellation?: {
    requestedByClientId: string;
    reason?: string;
  };
}

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

type DeliveryPaymentState = {
  paymentMethod: PaymentMethod;
  actualPaymentMethod?: PaymentMethod | null;
  paymentStatus: string;
  riderPaymentConfirmed: boolean;
};

/**
 * Delivery can close only after money has been independently accounted for.
 * Riders may attest to cash collected at the door. Every electronic rail is
 * server-owned and must already have been completed by the provider/wallet
 * flow; a rider-supplied `actualPaymentMethod` must never make it paid.
 */
export function isDeliveryPaymentReady(order: DeliveryPaymentState): boolean {
  if (order.paymentMethod === 'CASH') {
    return (
      order.riderPaymentConfirmed === true &&
      (order.actualPaymentMethod == null || order.actualPaymentMethod === 'CASH')
    );
  }

  return order.paymentStatus === 'COMPLETED';
}

export function assertDeliveryPaymentReady(order: DeliveryPaymentState): void {
  if (isDeliveryPaymentReady(order)) return;

  throw ApiError.badRequest(
    order.paymentMethod === 'CASH'
      ? 'Cash payment must be confirmed before delivery can be completed'
      : 'Electronic payment must be verified before delivery can be completed',
    'PAYMENT_NOT_CONFIRMED',
  );
}

/**
 * Get a price estimate without creating an order.
 */
export async function getEstimate(input: {
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  packageType: PackageType;
  additionalStops?: number;
  scheduleType?: 'SAME_DAY' | 'NEXT_DAY' | 'RECURRING';
  isExpress?: boolean;
  packageWeightKg?: number;
  paymentMethod?: PaymentMethod;
  promoCode?: string;
  clientId?: string;
}) {
  // Try to get actual route distance from Google Routes
  let routeDistanceKm: number | undefined;
  const routeData = await fetchRouteDistance(
    input.pickupLatitude,
    input.pickupLongitude,
    input.dropoffLatitude,
    input.dropoffLongitude,
  );
  if (routeData) {
    routeDistanceKm = routeData.distanceKm;
  }

  const price = await calculatePrice(
    input.pickupLatitude,
    input.pickupLongitude,
    input.dropoffLatitude,
    input.dropoffLongitude,
    input.packageType,
    {
      additionalStops: input.additionalStops,
      scheduleType: input.scheduleType,
      isExpress: input.isExpress,
      packageWeightKg: input.packageWeightKg,
      paymentMethod: input.paymentMethod,
      promoCode: input.promoCode,
      clientId: input.clientId,
      routeDistanceKm,
    },
  );

  return {
    distanceKm: price.distanceKm,
    haversineDistanceKm: price.haversineDistanceKm,
    routeDistanceKm: price.routeDistanceKm,
    roadFactor: price.roadFactor,
    estimatedDurationMinutes: price.estimatedDurationMinutes,
    baseFare: price.baseFare,
    distanceCharge: price.distanceCharge,
    stopSurcharges: price.stopSurcharges,
    additionalStops: price.additionalStops,
    packageMultiplier: price.packageMultiplier,
    packageType: price.packageType,
    weightSurcharge: price.weightSurcharge,
    surgeMultiplier: price.surgeMultiplier,
    surgeLevel: price.surgeLevel,
    timeOfDayMultiplier: price.timeOfDayMultiplier,
    timeOfDayPeriod: price.timeOfDayPeriod,
    weatherMultiplier: price.weatherMultiplier,
    weatherCondition: price.weatherCondition,
    crossZoneMultiplier: price.crossZoneMultiplier,
    expressMultiplier: price.expressMultiplier,
    isExpress: price.isExpress,
    scheduleDiscount: price.scheduleDiscount,
    businessDiscount: price.businessDiscount,
    promoDiscount: price.promoDiscount,
    promoError: price.promoError,
    subtotal: price.subtotal,
    serviceFee: price.serviceFee,
    serviceFeeRate: price.serviceFeeRate,
    totalPrice: price.totalPrice,
    currency: price.currency,
    riderEarnings: price.riderEarnings,
    platformCommission: price.platformCommission,
    commissionRate: price.commissionRate,
    zoneId: price.zoneId,
    zoneName: price.zoneName,
  };
}

/**
 * Create a new delivery order.
 */
export async function createOrder(
  clientId: string,
  input: {
    pickupAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
    pickupContactName?: string;
    pickupContactPhone?: string;
    pickupInstructions?: string;
    dropoffAddress: string;
    dropoffLatitude: number;
    dropoffLongitude: number;
    dropoffContactName?: string;
    dropoffContactPhone?: string;
    dropoffInstructions?: string;
    packageType: PackageType;
    packageDescription?: string;
    packagePhotoUrl?: string;
    paymentMethod: PaymentMethod;
    isScheduled?: boolean;
    scheduledAt?: string;
    scheduleType?: 'SAME_DAY' | 'NEXT_DAY' | 'RECURRING';
    isExpress?: boolean;
    packageWeightKg?: number;
    promoCode?: string;
    estimatedTotalPrice?: number;
    stops?: Array<{
      type: 'PICKUP' | 'DROPOFF';
      sequence: number;
      address: string;
      latitude: number;
      longitude: number;
      contactName?: string;
      contactPhone?: string;
      instructions?: string;
    }>;
  },
) {
  if (
    input.packagePhotoUrl &&
    !StorageService.privateReferencesBelongTo(input.packagePhotoUrl, 'packages', clientId)
  ) {
    throw ApiError.forbidden(
      'Package photos must be uploaded by the account creating the order',
      'INVALID_PACKAGE_PHOTO',
    );
  }

  // Client sends only *extra* stops (primary pickup/dropoff are separate fields),
  // so stops.length IS the additional stop count — no subtraction needed.
  const additionalStops = input.stops ? input.stops.length : 0;

  // Try to get actual route distance from Google Routes
  let routeDistanceKm: number | undefined;
  const routeData = await fetchRouteDistance(
    input.pickupLatitude,
    input.pickupLongitude,
    input.dropoffLatitude,
    input.dropoffLongitude,
  );
  if (routeData) {
    routeDistanceKm = routeData.distanceKm;
  }

  const price = await calculatePrice(
    input.pickupLatitude,
    input.pickupLongitude,
    input.dropoffLatitude,
    input.dropoffLongitude,
    input.packageType,
    {
      additionalStops,
      scheduleType: input.scheduleType,
      isExpress: input.isExpress,
      packageWeightKg: input.packageWeightKg,
      paymentMethod: input.paymentMethod,
      promoCode: input.promoCode,
      clientId,
      routeDistanceKm,
    },
  );

  // Reject if actual price drifted >15% from client-side estimate
  if (input.estimatedTotalPrice != null && input.estimatedTotalPrice > 0) {
    const drift =
      Math.abs(price.totalPrice - input.estimatedTotalPrice) / input.estimatedTotalPrice;
    if (drift > 0.15) {
      throw new ApiError(
        409,
        `Price changed significantly since your estimate (${input.estimatedTotalPrice.toFixed(2)} → ${price.totalPrice.toFixed(2)}). Please review the updated price and try again.`,
      );
    }
  }

  // If promo code used, atomically claim it (prevents over-use races)
  let promoCodeId: string | undefined;
  if (input.promoCode && price.promoDiscount > 0) {
    const code = input.promoCode.toUpperCase().trim();
    const now = new Date();

    // Wrap in a transaction: claim globally AND enforce per-user limit atomically
    promoCodeId = await prisma.$transaction(async (tx) => {
      const promo = await tx.promoCode.findUnique({
        where: { code },
        select: {
          id: true,
          maxUsesPerUser: true,
          maxUses: true,
          usedCount: true,
          isActive: true,
          validFrom: true,
          validUntil: true,
        },
      });
      if (!promo || !promo.isActive) throw ApiError.conflict('Promo code is no longer available');
      if (promo.validUntil && promo.validUntil <= now)
        throw ApiError.conflict('Promo code has expired');
      if (promo.maxUses != null && promo.usedCount >= promo.maxUses)
        throw ApiError.conflict('Promo code usage limit reached');

      // Serialize concurrent same-user same-promo claims via a Postgres
      // transaction-scoped advisory lock keyed on (promoId, userId). Without this,
      // two parallel order-creation requests both observe `userUsages = 0` and
      // both succeed, breaking `maxUsesPerUser`. The lock is auto-released at
      // transaction end.
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
        promo.id,
        clientId,
      );

      // Per-user limit check inside transaction (now serialized)
      const userUsages = await tx.promoCodeUsage.count({
        where: { promoCodeId: promo.id, userId: clientId },
      });
      if (userUsages >= promo.maxUsesPerUser) {
        throw ApiError.conflict('You have already used this promo code');
      }

      // Atomic global claim
      await tx.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      });

      return promo.id;
    });
  }

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      clientId,
      zoneId: price.zoneId,
      pickupAddress: input.pickupAddress,
      pickupLatitude: input.pickupLatitude,
      pickupLongitude: input.pickupLongitude,
      pickupContactName: input.pickupContactName,
      pickupContactPhone: input.pickupContactPhone,
      pickupInstructions: input.pickupInstructions,
      dropoffAddress: input.dropoffAddress,
      dropoffLatitude: input.dropoffLatitude,
      dropoffLongitude: input.dropoffLongitude,
      dropoffContactName: input.dropoffContactName,
      dropoffContactPhone: input.dropoffContactPhone,
      dropoffInstructions: input.dropoffInstructions,
      packageType: input.packageType,
      packageDescription: input.packageDescription,
      packagePhotoUrl: input.packagePhotoUrl,
      paymentMethod: input.paymentMethod,
      distanceKm: price.distanceKm,
      routeDistanceKm: price.routeDistanceKm,
      estimatedDurationMinutes: price.estimatedDurationMinutes,
      baseFare: price.baseFare,
      distanceCharge: price.distanceCharge,
      surgeMultiplier: price.surgeMultiplier,
      timeOfDayMultiplier: price.timeOfDayMultiplier,
      weatherMultiplier: price.weatherMultiplier,
      crossZoneMultiplier: price.crossZoneMultiplier,
      expressMultiplier: price.expressMultiplier,
      isExpress: price.isExpress,
      weightSurcharge: price.weightSurcharge,
      packageWeightKg: input.packageWeightKg,
      businessDiscount: price.businessDiscount,
      promoDiscount: price.promoDiscount,
      promoCodeId,
      serviceFeeRate: price.serviceFeeRate,
      serviceFee: price.serviceFee,
      totalPrice: price.totalPrice,
      currency: price.currency,
      riderEarnings: price.riderEarnings,
      platformCommission: price.platformCommission,
      deliveryPinCode: generateDeliveryPin(),
      isScheduled: input.isScheduled ?? false,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      scheduleType: input.scheduleType ?? null,
      scheduleDiscount: price.scheduleDiscount,
      isMultiStop: !!(input.stops && input.stops.length > 0),
      stops:
        input.stops && input.stops.length > 0
          ? {
              create: input.stops.map((s, i) => ({
                type: s.type,
                sequence: s.sequence ?? i,
                address: s.address,
                latitude: s.latitude,
                longitude: s.longitude,
                contactName: s.contactName,
                contactPhone: s.contactPhone,
                instructions: s.instructions,
              })),
            }
          : undefined,
      status: 'PENDING',
      statusHistory: {
        create: {
          status: 'PENDING',
          actor: clientId,
          note: 'Order created',
        },
      },
    },
    include: {
      statusHistory: { orderBy: { createdAt: 'asc' } },
      stops: { orderBy: { sequence: 'asc' } },
    },
  });

  // Record promo usage with orderId
  if (promoCodeId && price.promoDiscount > 0) {
    await prisma.promoCodeUsage
      .create({
        data: {
          promoCodeId,
          userId: clientId,
          orderId: order.id,
          discount: price.promoDiscount,
        },
      })
      .catch((err) => {
        logger.error(
          { err, promoCodeId, orderId: order.id },
          'Failed to record promo code usage — promo may be reusable',
        );
      });
  }

  return order;
}

/**
 * Get a single order by ID with access control.
 */
export async function getOrderById(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      statusHistory: { orderBy: { createdAt: 'asc' } },
      client: {
        select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
      },
      rider: {
        select: {
          id: true,
          userId: true,
          user: { select: { firstName: true, lastName: true, phone: true, avatarUrl: true } },
          averageRating: true,
          totalDeliveries: true,
        },
      },
    },
  });

  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

/**
 * List orders for a specific user, scoped by role.
 */
export async function listOrders(
  userId: string,
  roleOrRoles: string | readonly string[],
  options: { page?: number; limit?: number; status?: OrderStatus; scope?: 'RIDER' },
) {
  const page = options.page ?? 1;
  const limit = Math.min(options.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const whereClause: any = {};

  const roles = new Set(Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'].some((role) => roles.has(role));
  const includeRiderOperationalFields = options.scope === 'RIDER' || isAdmin;

  if (options.scope === 'RIDER') {
    if (!roles.has('RIDER')) {
      throw ApiError.forbidden('Rider order scope requires a rider account');
    }

    const riderProfile = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!riderProfile) throw ApiError.notFound('Rider profile not found');
    whereClause.riderId = riderProfile.id;
  } else if (!isAdmin) {
    const ownership: Array<Record<string, string>> = [];
    const hasClientRole = roles.has('CLIENT') || roles.has('BUSINESS_CLIENT');
    if (hasClientRole) ownership.push({ clientId: userId });

    if (roles.has('RIDER')) {
      const riderProfile = await prisma.riderProfile.findUnique({ where: { userId } });
      if (riderProfile) {
        ownership.push({ riderId: riderProfile.id });
      } else if (!hasClientRole) {
        throw ApiError.notFound('Rider profile not found');
      }
    }

    if (ownership.length === 0) {
      throw ApiError.forbidden('You do not have permission to list orders');
    }
    whereClause.OR = ownership;
  }
  // ADMIN / SUPER_ADMIN / DISPATCHER membership sees everything.

  if (options.status) {
    // Support comma-separated status values (e.g. "ASSIGNED,PICKUP_EN_ROUTE")
    const statusStr = String(options.status);
    if (statusStr.includes(',')) {
      whereClause.status = { in: statusStr.split(',').map((s: string) => s.trim()) };
    } else {
      whereClause.status = options.status;
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        ...(includeRiderOperationalFields ? { riderId: true } : {}),
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        packageType: true,
        totalPrice: true,
        ...(includeRiderOperationalFields ? { riderEarnings: true } : {}),
        currency: true,
        distanceKm: true,
        estimatedDurationMinutes: true,
        paymentMethod: true,
        createdAt: true,
        assignedAt: true,
        deliveredAt: true,
        cancelledAt: true,
        updatedAt: true,
        isScheduled: true,
        scheduledAt: true,
      },
    }),
    prisma.order.count({ where: whereClause }),
  ]);

  return {
    orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

type DeliveryAdjustments = {
  waitTimeCharge: number;
  waitTimeMinutes: number;
  pickupBonus: number;
};

/** Calculate optional, telemetry-based adjustments before opening the settlement transaction. */
async function calculateDeliveryAdjustments(
  order: Order,
  deliveredAt: Date,
): Promise<DeliveryAdjustments> {
  let waitTimeCharge = 0;
  let waitTimeMinutes = 0;
  let pickupBonus = 0;

  try {
    const history = await prisma.orderStatusHistory.findMany({
      where: {
        orderId: order.id,
        status: { in: ['AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF'] },
      },
      orderBy: { createdAt: 'asc' },
    });
    const timestamps = new Map<string, Date>();
    for (const entry of history) {
      if (!timestamps.has(entry.status)) timestamps.set(entry.status, entry.createdAt);
    }
    const atPickup = timestamps.get('AT_PICKUP');
    const pickedUp = timestamps.get('PICKED_UP');
    const atDropoff = timestamps.get('AT_DROPOFF');
    const pickupWaitMinutes =
      atPickup && pickedUp ? (pickedUp.getTime() - atPickup.getTime()) / 60_000 : 0;
    const dropoffWaitMinutes = atDropoff
      ? (deliveredAt.getTime() - atDropoff.getTime()) / 60_000
      : 0;
    const waitResult = calculateWaitTimeCharge(pickupWaitMinutes, dropoffWaitMinutes);
    if (waitResult.charge > 0) {
      waitTimeCharge = waitResult.charge;
      waitTimeMinutes = Math.round(waitResult.totalMinutes);
    }
  } catch {
    // Telemetry is advisory and must not prevent an otherwise valid settlement.
  }

  if (order.riderId) {
    try {
      const rider = await prisma.riderProfile.findUnique({
        where: { id: order.riderId },
        select: { currentLatitude: true, currentLongitude: true },
      });
      if (
        rider?.currentLatitude != null &&
        rider.currentLongitude != null &&
        order.pickupLatitude != null &&
        order.pickupLongitude != null
      ) {
        const firstBreadcrumb = await prisma.locationHistory.findFirst({
          where: { orderId: order.id, riderId: order.riderId },
          orderBy: { createdAt: 'asc' },
        });
        pickupBonus = calculatePickupDistanceBonus(
          firstBreadcrumb?.latitude ?? Number(rider.currentLatitude),
          firstBreadcrumb?.longitude ?? Number(rider.currentLongitude),
          Number(order.pickupLatitude),
          Number(order.pickupLongitude),
        );
      }
    } catch {
      // Missing location telemetry must not prevent settlement.
    }
  }

  return { waitTimeCharge, waitTimeMinutes, pickupBonus };
}

function enqueueDeliveryReceipt(order: Order): void {
  enqueueReceiptJob({
    orderId: order.id,
    clientId: order.clientId,
    orderNumber: order.orderNumber,
    totalPrice: Number(order.totalPrice),
    currency: order.currency,
  }).catch((err) => {
    logger.error({ err, orderId: order.id }, 'Failed to enqueue receipt job');
  });
}

function enqueueDeliveryCommission(orderId: string, commission: CommissionJobData): void {
  enqueueCommissionJob(commission).catch((err) => {
    logger.error(
      { err, orderId, commData: commission },
      'Failed to enqueue commission job - creating fallback record',
    );
    prisma.orderStatusHistory
      .create({
        data: {
          orderId,
          status: 'DELIVERED',
          actor: 'system',
          note: `COMMISSION_FAILED: ${JSON.stringify(commission)}`,
        },
      })
      .catch(() => {});
  });
}

/** Re-submit only queue work whose worker-side effects are idempotent. */
async function recoverDeliveryQueueJobs(order: Order): Promise<void> {
  enqueueDeliveryReceipt(order);
  if (!order.riderId || !order.platformCommission || Number(order.platformCommission) <= 0) return;

  try {
    const [rider, zone] = await Promise.all([
      prisma.riderProfile.findUnique({
        where: { id: order.riderId },
        select: { id: true, userId: true },
      }),
      order.zoneId
        ? prisma.zone.findUnique({
            where: { id: order.zoneId },
            select: { commissionRate: true },
          })
        : Promise.resolve(null),
    ]);
    if (!rider) return;
    enqueueDeliveryCommission(order.id, {
      orderId: order.id,
      riderId: rider.id,
      riderUserId: rider.userId,
      orderAmount: Number(order.totalPrice),
      commissionRate: Number(zone?.commissionRate ?? 15),
      platformCommission: Number(order.platformCommission),
    });
  } catch (err) {
    logger.error({ err, orderId: order.id }, 'Failed to recover delivery queue jobs');
  }
}

/**
 * Commit every delivery-financial write together. Queueing and learning stay
 * post-commit so external infrastructure never extends the database lock.
 */
async function transitionToDelivered(
  initialOrder: Order,
  actor: string,
  note?: string,
  options?: OrderTransitionOptions,
) {
  if (options?.expectedRiderId && initialOrder.riderId !== options.expectedRiderId) {
    throw ApiError.forbidden(
      'You are no longer assigned to this order',
      'ORDER_RIDER_ASSIGNMENT_CHANGED',
    );
  }
  if (initialOrder.status === 'DELIVERED') {
    await recoverDeliveryQueueJobs(initialOrder);
    return initialOrder;
  }
  if (!isValidTransition(initialOrder.status, 'DELIVERED')) {
    throw ApiError.badRequest(
      `Cannot transition from ${initialOrder.status} to DELIVERED`,
      'INVALID_STATUS_TRANSITION',
    );
  }

  assertDeliveryPaymentReady(initialOrder);
  if (!initialOrder.proofOfDeliveryType || !initialOrder.proofOfDeliveryUrl) {
    throw ApiError.badRequest('Proof of delivery is required before completion', 'PROOF_REQUIRED');
  }

  const deliveredAt = new Date();
  const adjustments = await calculateDeliveryAdjustments(initialOrder, deliveredAt);
  const settlement = await prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'delivery-settlement', initialOrder.id);
    const current = await tx.order.findUnique({ where: { id: initialOrder.id } });
    if (!current) throw ApiError.notFound('Order not found');

    if (options?.expectedRiderId && current.riderId !== options.expectedRiderId) {
      throw ApiError.forbidden(
        'You are no longer assigned to this order',
        'ORDER_RIDER_ASSIGNMENT_CHANGED',
      );
    }
    // The lock serializes mobile retries. A request that lost its first HTTP
    // response returns the committed order without duplicating any side effect.
    if (current.status === 'DELIVERED') {
      return { order: current, committed: false, commission: undefined };
    }
    if (!isValidTransition(current.status, 'DELIVERED')) {
      throw ApiError.badRequest(
        'Order status changed concurrently, please retry',
        'CONCURRENT_STATUS_CHANGE',
      );
    }
    assertDeliveryPaymentReady(current);
    if (!current.proofOfDeliveryType || !current.proofOfDeliveryUrl) {
      throw ApiError.badRequest(
        'Proof of delivery is required before completion',
        'PROOF_REQUIRED',
      );
    }
    if (current.isMultiStop) {
      const incompleteStops = await tx.orderStop.count({
        where: {
          orderId: current.id,
          status: { notIn: ['COMPLETED', 'SKIPPED'] },
        },
      });
      if (incompleteStops > 0) {
        throw ApiError.badRequest(
          `Complete all delivery stops before closing this order (${incompleteStops} remaining)`,
          'INCOMPLETE_DELIVERY_STOPS',
        );
      }
    }

    // Electronic orders are fully paid before this transition. Charging their
    // total again here would create an uncollected balance. Until an explicit
    // incremental-capture flow exists, RiderGuy funds wait/pickup adjustments:
    // the Rider receives them, while the client's settled total stays exact.
    const riderAdjustment = adjustments.waitTimeCharge + adjustments.pickupBonus;
    const settledRiderEarnings = current.riderId
      ? (current.riderEarnings
          ? Number(current.riderEarnings)
          : Number(current.totalPrice) * 0.85) + riderAdjustment
      : undefined;

    // Dispatch takes the Rider lock before claiming/updating the order. Match
    // that order here so a progress/settlement transaction can never hold the
    // order row while waiting on a concurrent reassign operation.
    if (current.riderId) {
      await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', current.riderId);
    }

    const statusUpdate = await tx.order.updateMany({
      where: { id: current.id, status: current.status, riderId: current.riderId },
      data: {
        status: 'DELIVERED',
        deliveredAt,
        ...(current.paymentMethod === 'CASH' ? { paymentStatus: 'COMPLETED' } : {}),
        ...(adjustments.waitTimeCharge > 0
          ? {
              waitTimeCharge: adjustments.waitTimeCharge,
              waitTimeMinutes: adjustments.waitTimeMinutes,
            }
          : {}),
        ...(current.riderId && riderAdjustment > 0 ? { riderEarnings: settledRiderEarnings } : {}),
      },
    });
    if (statusUpdate.count === 0) {
      throw ApiError.badRequest(
        'Order status changed concurrently, please retry',
        'CONCURRENT_STATUS_CHANGE',
      );
    }

    const updated = await tx.order.findUniqueOrThrow({ where: { id: current.id } });
    await tx.orderStatusHistory.create({
      data: {
        orderId: current.id,
        status: 'DELIVERED',
        actor,
        note: note ?? 'Status changed to DELIVERED',
      },
    });

    if (options?.auditContext) {
      await AdminAuditService.record(
        {
          ...options.auditContext,
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'Order',
          entityId: current.id,
          oldData: { status: current.status },
          newData: { status: 'DELIVERED', note: note?.trim() || null },
        },
        tx,
      );
    }

    let commission: CommissionJobData | undefined;
    if (updated.riderId) {
      const rider = await tx.riderProfile.findUnique({
        where: { id: updated.riderId },
        select: { id: true, userId: true, currentLevel: true },
      });
      if (!rider) throw ApiError.notFound('Assigned Rider profile not found');

      await tx.riderProfile.update({
        where: { id: updated.riderId },
        data: { totalDeliveries: { increment: 1 } },
      });
      await setPostWorkRiderAvailability(tx, updated.riderId);

      const earnings = updated.riderEarnings
        ? Number(updated.riderEarnings)
        : Number(updated.totalPrice) * 0.85;
      await creditWallet(
        rider.userId,
        earnings,
        'DELIVERY_EARNING',
        `Earnings from order ${updated.orderNumber}`,
        updated.id,
        'order',
        tx,
      );

      const zoneRate = updated.zoneId
        ? ((
            await tx.zone.findUnique({
              where: { id: updated.zoneId },
              select: { commissionRate: true },
            })
          )?.commissionRate ?? 15)
        : 15;
      if (rider.currentLevel > 1) {
        const riderRate = getCommissionRate(rider.currentLevel);
        if (riderRate < zoneRate) {
          const bonus = Math.round(
            Number(updated.totalPrice) * ((Number(zoneRate) - riderRate) / 100),
          );
          if (bonus > 0) {
            await creditWallet(
              rider.userId,
              bonus,
              'DELIVERY_EARNING',
              `Level ${rider.currentLevel} commission bonus for order ${updated.orderNumber}`,
              updated.id,
              'level_bonus',
              tx,
            );
          }
        }
      }

      if (updated.platformCommission && Number(updated.platformCommission) > 0) {
        commission = {
          orderId: updated.id,
          riderId: rider.id,
          riderUserId: rider.userId,
          orderAmount: Number(updated.totalPrice),
          commissionRate: Number(zoneRate),
          platformCommission: Number(updated.platformCommission),
        };
      }

      await tx.clientProfile.updateMany({
        where: { userId: updated.clientId },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: updated.totalPrice },
        },
      });
    }

    return { order: updated, committed: true, commission };
  });

  const updated = settlement.order;
  if (!settlement.committed) {
    await recoverDeliveryQueueJobs(updated);
    return updated;
  }

  if (settlement.commission) {
    enqueueDeliveryCommission(updated.id, settlement.commission);
  }
  enqueueDeliveryReceipt(updated);
  if (updated.riderId) {
    awardXp(updated.riderId, XpAction.DELIVERY_COMPLETE, undefined, {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
    }).catch(() => {});
    recordStreakActivity(updated.riderId).catch(() => {});
  }
  learnFromDelivery(updated.id).catch(() => {});

  return updated;
}

/**
 * Transition an order to a new status.
 */
export async function transitionStatus(
  orderId: string,
  newStatus: OrderStatus,
  actor: string,
  note?: string,
  options?: OrderTransitionOptions,
) {
  if (newStatus === 'DELIVERED') {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Order not found');
    return transitionToDelivered(order, actor, note, options);
  }

  return prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'order-status-transition', orderId);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Order not found');

    if (options?.expectedRiderId && order.riderId !== options.expectedRiderId) {
      throw ApiError.forbidden(
        'You are no longer assigned to this order',
        'ORDER_RIDER_ASSIGNMENT_CHANGED',
      );
    }
    if (options?.clientCancellation && newStatus !== 'CANCELLED_BY_CLIENT') {
      throw ApiError.badRequest(
        'Client cancellation settlement can only be used for a Client cancellation.',
        'INVALID_CLIENT_CANCELLATION_TRANSITION',
      );
    }
    if (
      options?.clientCancellation &&
      order.clientId !== options.clientCancellation.requestedByClientId
    ) {
      throw ApiError.forbidden('Not your order');
    }

    // A retry after a committed transition is a no-op. History, Rider release
    // and administrator audit were already committed with the first request.
    if (order.status === newStatus) return order;

    if (
      options?.clientCancellation &&
      !(['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE'] as OrderStatus[]).includes(
        order.status,
      )
    ) {
      throw ApiError.badRequest('Order can no longer be cancelled');
    }

    // Assignment must claim both the Order and Rider through DispatchService.
    // A bare status transition would create an ASSIGNED order with no valid
    // Rider claim or availability update.
    if (newStatus === 'ASSIGNED') {
      throw ApiError.badRequest(
        'Use the Rider assignment workflow to assign this order.',
        'ASSIGNMENT_REQUIRES_DISPATCH',
      );
    }

    if (!isValidTransition(order.status, newStatus)) {
      throw ApiError.badRequest(
        `Cannot transition from ${order.status} to ${newStatus}`,
        'INVALID_STATUS_TRANSITION',
      );
    }

    const timestampUpdates: Record<string, Date> = {};
    if (newStatus === 'PICKED_UP') timestampUpdates.pickedUpAt = new Date();
    if (newStatus.startsWith('CANCELLED')) timestampUpdates.cancelledAt = new Date();

    const postAssignmentCancellation =
      options?.clientCancellation !== undefined &&
      (order.status === 'ASSIGNED' || order.status === 'PICKUP_EN_ROUTE') &&
      order.riderId !== null;
    const cancellationFee = postAssignmentCancellation ? 3 : 0;
    const clientCancellationReason =
      options?.clientCancellation?.reason?.trim() || 'Cancelled by client';
    const effectiveNote = options?.clientCancellation
      ? cancellationFee > 0
        ? `${clientCancellationReason} (cancellation fee: GHS ${cancellationFee.toFixed(2)})`
        : clientCancellationReason
      : note;

    // Acquire any Rider lock before the Order row update, matching dispatch's
    // rider-lock -> order-row order and eliminating the inverse wait cycle.
    const releasingRiderId =
      (newStatus.startsWith('CANCELLED') || newStatus === 'FAILED') && order.riderId
        ? order.riderId
        : null;
    if (releasingRiderId) {
      await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', releasingRiderId);
    }

    // Keep the CAS even under the advisory lock so writes from legacy or
    // non-cooperating paths cannot be silently overwritten.
    const updateResult = await tx.order.updateMany({
      where: { id: orderId, status: order.status, riderId: order.riderId },
      data: {
        status: newStatus,
        ...timestampUpdates,
        ...(newStatus === 'FAILED' && effectiveNote ? { failureReason: effectiveNote } : {}),
      },
    });
    if (updateResult.count === 0) {
      throw ApiError.badRequest(
        'Order status changed concurrently, please retry',
        'CONCURRENT_STATUS_CHANGE',
      );
    }

    const updated = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: newStatus,
        actor,
        note: effectiveNote ?? `Status changed to ${newStatus}`,
      },
    });

    // Terminal states release the Rider in this same transaction. Stuck-order
    // recovery may subsequently mark them OFFLINE for connectivity failures.
    if (releasingRiderId) {
      await setPostWorkRiderAvailability(tx, releasingRiderId);
    }

    if (cancellationFee > 0 && releasingRiderId) {
      const rider = await tx.riderProfile.findUnique({
        where: { id: releasingRiderId },
        select: { userId: true },
      });
      if (!rider) throw ApiError.notFound('Assigned Rider profile not found');
      await creditWallet(
        rider.userId,
        cancellationFee,
        'DELIVERY_EARNING',
        `Cancellation compensation for order ${order.orderNumber}`,
        order.id,
        'cancellation',
        tx,
      );
    }

    if (options?.auditContext) {
      await AdminAuditService.record(
        {
          ...options.auditContext,
          action: newStatus === 'CANCELLED_BY_ADMIN' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
          entityType: 'Order',
          entityId: orderId,
          oldData: { status: order.status },
          newData: { status: newStatus, note: effectiveNote?.trim() || null },
        },
        tx,
      );
    }

    return updated;
  });
}

/**
 * Cancel an order (client-initiated).
 *
 * Cancellation fees (per platform policy):
 *   - Before assignment (PENDING / SEARCHING_RIDER): FREE
 *   - After assignment  (ASSIGNED / PICKUP_EN_ROUTE): GHS 3.00 → rider compensation
 */
export async function cancelOrder(orderId: string, userId: string, reason?: string) {
  const updated = await transitionStatus(orderId, 'CANCELLED_BY_CLIENT', userId, reason, {
    clientCancellation: { requestedByClientId: userId, ...(reason ? { reason } : {}) },
  });

  // Dispatch is external process state, so stop it only after the cancellation
  // and any Rider compensation have committed successfully.
  cancelDispatch(orderId);
  return updated;
}

/**
 * Cancel an order (rider-initiated).
 *
 * Allowed from: ASSIGNED, PICKUP_EN_ROUTE, AT_PICKUP (pre-pickup)
 *               PICKED_UP, IN_TRANSIT (post-pickup — package must be returned)
 *
 * Rider cancel reasons are tracked for accountability.
 */
export async function cancelOrderByRider(orderId: string, riderUserId: string, reason: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');

  // Verify rider is actually assigned to this order
  const riderProfile = await prisma.riderProfile.findUnique({
    where: { userId: riderUserId },
  });
  if (!riderProfile || order.riderId !== riderProfile.id) {
    throw ApiError.forbidden('You are not assigned to this order');
  }

  // Check if rider is currently suspended
  const suspended = await isRiderSuspended(riderProfile.id);
  if (suspended) {
    throw ApiError.forbidden('Your account is currently suspended');
  }

  const cancellableStatuses: OrderStatus[] = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP'];
  const postPickupStatuses: OrderStatus[] = ['PICKED_UP', 'IN_TRANSIT'];

  if (postPickupStatuses.includes(order.status)) {
    throw ApiError.badRequest(
      'Post-pickup cancellation requires client authorization. Use the cancel request flow instead.',
      'POST_PICKUP_CANCEL_REQUIRES_AUTH',
    );
  }

  if (!cancellableStatuses.includes(order.status)) {
    throw ApiError.badRequest('Order can no longer be cancelled at this stage');
  }

  const orderStatusAtCancel = order.status;
  const cancelNote = `Rider cancel: ${reason}`;
  const updated = await transitionStatus(orderId, 'CANCELLED_BY_RIDER', riderUserId, cancelNote, {
    expectedRiderId: riderProfile.id,
  });

  // Process cancellation consequences (penalty, suspension, investigation)
  try {
    await processCancellationConsequences(
      riderProfile.id,
      riderUserId,
      orderId,
      order.orderNumber,
      orderStatusAtCancel,
      reason,
      order.clientId,
    );
  } catch (err) {
    logger.error(`Failed to process cancellation consequences for order ${orderId}: ${err}`);
  }

  return updated;
}

/**
 * Rate a completed order (client rates rider).
 */
export async function rateOrder(
  orderId: string,
  userId: string,
  rating: number,
  review?: string,
  tipAmount?: number,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.clientId !== userId) throw ApiError.forbidden('Not your order');
  if (order.status !== 'DELIVERED') throw ApiError.badRequest('Can only rate delivered orders');
  if (order.clientRating !== null) throw ApiError.badRequest('Order already rated');

  // Optimistic concurrency: only succeeds if order hasn't been rated yet
  const updateResult = await prisma.order.updateMany({
    where: { id: orderId, clientRating: null },
    data: {
      clientRating: rating,
      clientReview: review ?? null,
      tipAmount: tipAmount ?? 0,
    },
  });

  if (updateResult.count === 0) {
    throw ApiError.badRequest('Order already rated (concurrent request)');
  }

  // Re-read the updated order
  const updated = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  // Update rider's average rating
  if (updated.riderId) {
    const riderProfile = await prisma.riderProfile.findUnique({
      where: { id: updated.riderId },
    });
    if (riderProfile) {
      const newTotalRatings = riderProfile.totalRatings + 1;
      const newAvgRating =
        (riderProfile.averageRating * riderProfile.totalRatings + rating) / newTotalRatings;
      await prisma.riderProfile.update({
        where: { id: updated.riderId },
        data: {
          averageRating: Math.round(newAvgRating * 100) / 100,
          totalRatings: newTotalRatings,
        },
      });

      // Credit tip to rider wallet if tip was given
      if (tipAmount && tipAmount > 0) {
        await creditTip(
          riderProfile.userId,
          tipAmount,
          `Tip from order ${updated.orderNumber}`,
          updated.id,
          'order',
        );
      }
    }
  }

  // Award XP for high ratings (fire-and-forget)
  if (updated.riderId) {
    if (rating === 5) {
      awardXp(updated.riderId, XpAction.FIVE_STAR_RATING, undefined, {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
      }).catch(() => {});
    } else if (rating === 4) {
      awardXp(updated.riderId, XpAction.FOUR_STAR_RATING, undefined, {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
      }).catch(() => {});
    }
  }

  return updated;
}

/**
 * Get available jobs for a rider — ALL unassigned orders, sorted by proximity to rider's GPS.
 * Zones are used for pricing only, not for filtering which jobs a rider can see.
 */
export async function getAvailableJobs(userId: string) {
  const riderProfile = await prisma.riderProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { status: true } },
      vehicles: { select: { reviewStatus: true } },
    },
  });
  if (!riderProfile) throw ApiError.notFound('Rider profile not found');

  assertRiderWorkEligible(riderProfile);

  if (riderProfile.availability !== 'ONLINE') {
    throw ApiError.forbidden('You must be online to see available jobs');
  }

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PENDING', 'SEARCHING_RIDER'] },
      riderId: null,
      OR: [{ isScheduled: false }, { scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      pickupAddress: true,
      pickupLatitude: true,
      pickupLongitude: true,
      dropoffAddress: true,
      dropoffLatitude: true,
      dropoffLongitude: true,
      packageType: true,
      distanceKm: true,
      estimatedDurationMinutes: true,
      totalPrice: true,
      riderEarnings: true,
      currency: true,
      createdAt: true,
    },
  });

  // D-06: Filter out orders the rider has already declined via auto-dispatch
  // Batch query all declined rider sets at once to avoid N+1
  const orderIds = orders.map((o) => o.id);
  const declinedMap = new Map<string, Set<string>>();
  if (orderIds.length > 0) {
    const allDeclined = await Promise.all(
      orderIds.map((oid) => getDeclinedRiderIds(oid).then((set) => ({ oid, set }))),
    );
    for (const { oid, set } of allDeclined) {
      declinedMap.set(oid, set);
    }
  }
  const filtered = orders.filter((order) => {
    const declined = declinedMap.get(order.id);
    return !declined || !declined.has(userId);
  });

  // Sort by proximity to rider's current GPS (nearest first)
  const riderLat = riderProfile.currentLatitude ? Number(riderProfile.currentLatitude) : null;
  const riderLng = riderProfile.currentLongitude ? Number(riderProfile.currentLongitude) : null;

  if (riderLat != null && riderLng != null) {
    filtered.sort((a, b) => {
      const distA =
        a.pickupLatitude != null && a.pickupLongitude != null
          ? Math.hypot(Number(a.pickupLatitude) - riderLat, Number(a.pickupLongitude) - riderLng)
          : Infinity;
      const distB =
        b.pickupLatitude != null && b.pickupLongitude != null
          ? Math.hypot(Number(b.pickupLatitude) - riderLat, Number(b.pickupLongitude) - riderLng)
          : Infinity;
      return distA - distB;
    });
  }

  return filtered;
}

/**
 * Start dispatch for scheduled orders whose release window has arrived.
 */
export async function releaseDueScheduledOrders(): Promise<number> {
  const dueOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      riderId: null,
      isScheduled: true,
      scheduledAt: { lte: new Date() },
    },
    select: { id: true, orderNumber: true },
    take: 50,
  });

  if (dueOrders.length === 0) return 0;

  const { autoDispatch } = await import('./auto-dispatch.service');
  for (const order of dueOrders) {
    logger.info(
      { orderId: order.id, orderNumber: order.orderNumber },
      'Releasing scheduled order for dispatch',
    );
    autoDispatch(order.id).catch((err) => {
      logger.error({ err, orderId: order.id }, 'Scheduled order dispatch failed');
    });
  }

  return dueOrders.length;
}

// ── Stale unpaid order cleanup ──────────────────────

const STALE_ORDER_MINUTES = 30;

/**
 * Cancel orders that have been PENDING with non-CASH/WALLET payment
 * for longer than STALE_ORDER_MINUTES. Called on server startup and
 * then periodically.
 */
export async function expireStaleUnpaidOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_ORDER_MINUTES * 60 * 1000);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: { notIn: ['CASH', 'WALLET'] },
      createdAt: { lt: cutoff },
    },
    select: { id: true, orderNumber: true },
  });

  let expired = 0;
  for (const order of staleOrders) {
    try {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED_BY_ADMIN',
            cancelledAt: new Date(),
            failureReason: `Auto-cancelled: payment not received within ${STALE_ORDER_MINUTES} minutes`,
          },
        }),
        prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: 'CANCELLED_BY_ADMIN',
            actor: 'system',
            note: `Payment timeout — order expired after ${STALE_ORDER_MINUTES}m`,
          },
        }),
      ]);
      expired++;
    } catch {
      // Log but continue — don't let one failure block the rest
    }
  }

  return expired;
}

// ── D-03: Stale delivery SLA monitor ────────────────────

const STALE_DELIVERY_HOURS = 2; // Alert/escalate after 2 hours in active status

/**
 * Detect deliveries stuck in active statuses for >2 hours.
 * Logs them as warnings and creates admin-visible status history entries.
 * Called periodically from server startup.
 */
export async function escalateStaleDeliveries(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_DELIVERY_HOURS * 60 * 60 * 1000);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: {
        in: ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'],
      },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      riderId: true,
      updatedAt: true,
    },
  });

  if (staleOrders.length === 0) return 0;

  let escalated = 0;
  for (const order of staleOrders) {
    try {
      const hoursStale = Math.round((Date.now() - order.updatedAt.getTime()) / 3_600_000);

      // Check if we already flagged this order recently (avoid duplicate alerts)
      const recentFlag = await prisma.orderStatusHistory.findFirst({
        where: {
          orderId: order.id,
          actor: 'system',
          note: { startsWith: 'SLA BREACH' },
          createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) }, // within last hour
        },
      });
      if (recentFlag) continue;

      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: order.status,
          actor: 'system',
          note: `SLA BREACH — Order stuck in ${order.status} for ${hoursStale}h. Requires admin attention.`,
        },
      });

      logger.warn(
        { orderId: order.id, orderNumber: order.orderNumber, status: order.status, hoursStale },
        '[SLA] Delivery breached 2-hour SLA',
      );

      // Notify admins via socket (if available)
      try {
        const { getIO } = await import('../socket');
        const io = getIO();
        (io.to('admins') as any).emit('admin:sla-breach', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          hoursStale,
          riderId: order.riderId,
        });
      } catch {
        // Socket not initialised yet (e.g. during startup) — log-only is fine
      }

      escalated++;
    } catch {
      // Continue with remaining orders
    }
  }

  return escalated;
}

// ── D-04: Location breadcrumb retention cleanup ─────────

const BREADCRUMB_RETENTION_DAYS = 30;

/**
 * Delete location breadcrumbs older than 30 days.
 * Called periodically to prevent unbounded table growth.
 */
export async function cleanupOldBreadcrumbs(): Promise<number> {
  const cutoff = new Date(Date.now() - BREADCRUMB_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.locationHistory.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    logger.info(
      { deleted: result.count, cutoff: cutoff.toISOString() },
      '[Retention] Cleaned old breadcrumbs',
    );
  }

  return result.count;
}
