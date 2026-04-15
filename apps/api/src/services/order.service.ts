import { prisma } from '@riderguy/database';
import { generateOrderNumber, generateDeliveryPin } from '@riderguy/utils';
import { XpAction } from '@riderguy/types';
import { calculatePrice, fetchRouteDistance, calculateWaitTimeCharge, calculatePickupDistanceBonus } from './pricing.service';
import { awardXp, getCommissionRate } from './gamification.service';
import { recordActivity as recordStreakActivity } from './streak.service';
import { creditWallet, creditTip } from './wallet.service';
import { cancelDispatch, getDeclinedRiderIds } from './auto-dispatch.service';
import { processCancellationConsequences, isRiderSuspended } from './cancellation.service';
import { ApiError } from '../lib/api-error';
import { logger } from '../lib/logger';
import { enqueueCommissionJob, enqueueReceiptJob, type CommissionJobData } from '../jobs/queues';
import { learnFromDelivery } from './eta-learning.service';
import type { PackageType, PaymentMethod, OrderStatus } from '@prisma/client';

// ============================================================
// Order Service — handles order creation, retrieval, status
// transitions, cancellation, and rating.
// ============================================================

// ── Valid status transitions (state machine) ────────────────

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['SEARCHING_RIDER', 'ASSIGNED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_ADMIN'],
  SEARCHING_RIDER: ['ASSIGNED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_ADMIN'],
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

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
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
  const additionalStops = input.stops ? Math.max(0, input.stops.length - 1) : 0;

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
    const drift = Math.abs(price.totalPrice - input.estimatedTotalPrice) / input.estimatedTotalPrice;
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

    // Atomic: increment usedCount only if still valid and within limits
    const claimed: number = await prisma.$executeRaw`
      UPDATE "PromoCode"
      SET "usedCount" = "usedCount" + 1
      WHERE "code" = ${code}
        AND "isActive" = true
        AND "validFrom" <= ${now}
        AND ("validUntil" IS NULL OR "validUntil" > ${now})
        AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    `;

    if (claimed === 0) {
      throw ApiError.conflict('Promo code is no longer available');
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code },
      select: { id: true },
    });
    promoCodeId = promo?.id;
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
      stops: input.stops && input.stops.length > 0
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
    },
  });

  // Record promo usage with orderId
  if (promoCodeId && price.promoDiscount > 0) {
    await prisma.promoCodeUsage.create({
      data: {
        promoCodeId,
        userId: clientId,
        orderId: order.id,
        discount: price.promoDiscount,
      },
    }).catch((err) => {
      logger.error({ err, promoCodeId, orderId: order.id }, 'Failed to record promo code usage — promo may be reusable');
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
  role: string,
  options: { page?: number; limit?: number; status?: OrderStatus },
) {
  const page = options.page ?? 1;
  const limit = Math.min(options.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  let whereClause: any = {};

  if (role === 'CLIENT' || role === 'BUSINESS_CLIENT') {
    whereClause.clientId = userId;
  } else if (role === 'RIDER') {
    const riderProfile = await prisma.riderProfile.findUnique({ where: { userId } });
    if (!riderProfile) throw ApiError.notFound('Rider profile not found');
    whereClause.riderId = riderProfile.id;
  }
  // ADMIN / SUPER_ADMIN / DISPATCHER see everything

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
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        packageType: true,
        totalPrice: true,
        currency: true,
        distanceKm: true,
        estimatedDurationMinutes: true,
        paymentMethod: true,
        createdAt: true,
        assignedAt: true,
        deliveredAt: true,
      },
    }),
    prisma.order.count({ where: whereClause }),
  ]);

  return {
    orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Transition an order to a new status.
 */
export async function transitionStatus(
  orderId: string,
  newStatus: OrderStatus,
  actor: string,
  note?: string,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');

  if (!isValidTransition(order.status, newStatus)) {
    throw ApiError.badRequest(
      `Cannot transition from ${order.status} to ${newStatus}`,
      'INVALID_STATUS_TRANSITION',
    );
  }

  // Determine timestamp fields to update
  const timestampUpdates: Record<string, Date> = {};
  if (newStatus === 'ASSIGNED') timestampUpdates.assignedAt = new Date();
  if (newStatus === 'PICKED_UP') timestampUpdates.pickedUpAt = new Date();
  if (newStatus === 'DELIVERED') timestampUpdates.deliveredAt = new Date();
  if (newStatus.startsWith('CANCELLED')) timestampUpdates.cancelledAt = new Date();

  // Optimistic concurrency: only succeeds if order still has the expected status
  const updateResult = await prisma.order.updateMany({
    where: { id: orderId, status: order.status },
    data: {
      status: newStatus,
      ...timestampUpdates,
      ...(newStatus === 'FAILED' && note ? { failureReason: note } : {}),
    },
  });

  if (updateResult.count === 0) {
    throw ApiError.badRequest(
      'Order status changed concurrently, please retry',
      'CONCURRENT_STATUS_CHANGE',
    );
  }

  // Re-read the updated order
  let updated = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: newStatus,
      actor,
      note: note ?? `Status changed to ${newStatus}`,
    },
  });

  // If an order is cancelled (by rider OR client), set rider back to ONLINE
  if (newStatus.startsWith('CANCELLED') && updated.riderId) {
    await prisma.riderProfile.update({
      where: { id: updated.riderId },
      data: { availability: 'ONLINE' },
    });
  }

  // If delivered, update rider stats + credit wallet
  if (newStatus === 'DELIVERED' && updated.riderId) {
    // ── Pre-compute all financial adjustments (read-only) ──
    let waitTimeAdjustment = 0;
    let waitTotalMinutes = 0;
    let pickupBonus = 0;

    // Wait time charge (LOGIC-05)
    try {
      const statusHistory = await prisma.orderStatusHistory.findMany({
        where: { orderId, status: { in: ['AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'DELIVERED'] } },
        orderBy: { createdAt: 'asc' },
      });
      const tsMap = new Map<string, Date>();
      for (const entry of statusHistory) {
        if (!tsMap.has(entry.status)) tsMap.set(entry.status, entry.createdAt);
      }
      const atPickup = tsMap.get('AT_PICKUP');
      const pickedUp = tsMap.get('PICKED_UP');
      const atDropoff = tsMap.get('AT_DROPOFF');
      const delivered = tsMap.get('DELIVERED');
      const pickupWaitMin = (atPickup && pickedUp)
        ? (pickedUp.getTime() - atPickup.getTime()) / 60_000
        : 0;
      const dropoffWaitMin = (atDropoff && delivered)
        ? (delivered.getTime() - atDropoff.getTime()) / 60_000
        : 0;
      const waitResult = calculateWaitTimeCharge(pickupWaitMin, dropoffWaitMin);
      if (waitResult.charge > 0) {
        waitTimeAdjustment = waitResult.charge;
        waitTotalMinutes = Math.round(waitResult.totalMinutes);
      }
    } catch (err) {
      // Don't block delivery completion if wait time calc fails
    }

    // Pickup distance bonus (LOGIC-06)
    try {
      const riderProfileForBonus = await prisma.riderProfile.findUnique({
        where: { id: updated.riderId },
        select: { currentLatitude: true, currentLongitude: true },
      });
      if (
        riderProfileForBonus?.currentLatitude != null &&
        riderProfileForBonus?.currentLongitude != null &&
        updated.pickupLatitude != null &&
        updated.pickupLongitude != null
      ) {
        const firstBreadcrumb = await prisma.locationHistory.findFirst({
          where: { orderId, riderId: updated.riderId },
          orderBy: { createdAt: 'asc' },
        });
        const riderLat = firstBreadcrumb?.latitude ?? Number(riderProfileForBonus.currentLatitude);
        const riderLng = firstBreadcrumb?.longitude ?? Number(riderProfileForBonus.currentLongitude);
        pickupBonus = calculatePickupDistanceBonus(
          riderLat,
          riderLng,
          Number(updated.pickupLatitude),
          Number(updated.pickupLongitude),
        );
      }
    } catch (err) {
      // Don't block delivery completion if bonus calc fails
    }

    // ── Apply all financial adjustments atomically ──
    const orderUpdates: Record<string, any> = {};
    if (waitTimeAdjustment > 0) {
      orderUpdates.waitTimeCharge = waitTimeAdjustment;
      orderUpdates.waitTimeMinutes = waitTotalMinutes;
    }
    if (waitTimeAdjustment > 0 || pickupBonus > 0) {
      // Apply order price/earnings adjustments in a single update
      const finalOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          ...orderUpdates,
          ...(waitTimeAdjustment > 0 ? { totalPrice: { increment: waitTimeAdjustment } } : {}),
          ...(pickupBonus > 0 ? { riderEarnings: { increment: pickupBonus } } : {}),
        },
      });
      // Use the updated order for earnings calc
      if (finalOrder.riderEarnings) {
        updated = { ...updated, riderEarnings: finalOrder.riderEarnings, totalPrice: finalOrder.totalPrice };
      }
    }

    await prisma.riderProfile.update({
      where: { id: updated.riderId! },
      data: {
        totalDeliveries: { increment: 1 },
        availability: 'ONLINE',
      },
    });

    // Credit rider wallet (includes pickup distance bonus — platform absorbs)
    const baseEarnings = updated.riderEarnings ? Number(updated.riderEarnings) : (Number(updated.totalPrice) * 0.85);
    const earnings = baseEarnings;
    const riderProfile = await prisma.riderProfile.findUnique({
      where: { id: updated.riderId! },
      select: { id: true, userId: true, currentLevel: true },
    });

    if (riderProfile) {
      await creditWallet(
        riderProfile.userId,
        earnings,
        'DELIVERY_EARNING',
        `Earnings from order ${updated.orderNumber}`,
        updated.id,
        'order',
      );

      // Tips are handled exclusively in rateOrder() to avoid double-credit

      // Level perk: reduced commission for higher-level riders
      if (riderProfile.currentLevel > 1) {
        const riderLevelCommRate = getCommissionRate(riderProfile.currentLevel);
        const zoneRate = updated.zoneId
          ? (await prisma.zone.findUnique({ where: { id: updated.zoneId }, select: { commissionRate: true } }))?.commissionRate ?? 15
          : 15;
        if (riderLevelCommRate < zoneRate) {
          const bonus = Math.round(Number(updated.totalPrice) * ((Number(zoneRate) - riderLevelCommRate) / 100));
          if (bonus > 0) {
            await creditWallet(
              riderProfile.userId,
              bonus,
              'DELIVERY_EARNING',
              `Level ${riderProfile.currentLevel} commission bonus for order ${updated.orderNumber}`,
              updated.id,
              'level_bonus',
            );
          }
        }
      }

      // Collect commission data for enqueuing AFTER writes complete
      if (updated.platformCommission && Number(updated.platformCommission) > 0) {
        const zoneCommRate = updated.zoneId
          ? (await prisma.zone.findUnique({ where: { id: updated.zoneId }, select: { commissionRate: true } }))?.commissionRate ?? 15
          : 15;

        (updated as Record<string, unknown>).__commissionEnqueue = {
          orderId: updated.id,
          riderId: riderProfile.id,
          riderUserId: riderProfile.userId,
          orderAmount: Number(updated.totalPrice),
          commissionRate: Number(zoneCommRate),
          platformCommission: Number(updated.platformCommission),
        };
      }
    }

    // Update client stats
    await prisma.clientProfile.updateMany({
      where: { userId: updated.clientId },
      data: {
        totalOrders: { increment: 1 },
        totalSpent: { increment: updated.totalPrice },
      },
    });

    // ── Post-delivery payment collection ──
    // Payment is collected AFTER delivery because the final price may differ
    // from the estimate (wait time charges, pickup distance bonuses, etc.).
    // Guard: skip if already paid (prevents double-debit on concurrent calls)
    if (updated.paymentStatus !== 'COMPLETED') {
      const finalPrice = Number(updated.totalPrice);

      if (updated.paymentMethod === 'WALLET') {
        // Auto-debit client wallet for the final amount
        try {
          const walletDebit = await prisma.$transaction(async (tx) => {
            const clientWallet = await tx.wallet.findFirst({
              where: { userId: updated.clientId },
            });
            if (!clientWallet || Number(clientWallet.balance) < finalPrice) {
              return null; // Insufficient balance
            }
            const updatedWallet = await tx.wallet.update({
              where: { id: clientWallet.id },
              data: { balance: { decrement: finalPrice } },
            });
            await tx.transaction.create({
              data: {
                walletId: clientWallet.id,
                type: 'COMMISSION_DEDUCTION',
                amount: finalPrice,
                balanceAfter: Number(updatedWallet.balance),
                description: `Payment for order ${updated.orderNumber}`,
                referenceId: updated.id,
                referenceType: 'order',
              },
            });
            await tx.order.update({
              where: { id: orderId },
              data: { paymentStatus: 'COMPLETED' },
            });
            return updatedWallet;
          });

          if (walletDebit) {
            updated = { ...updated, paymentStatus: 'COMPLETED' };
          } else {
            // Insufficient funds — leave paymentStatus PENDING so client
            // can top up and pay via the payment page
            logger.warn({ orderId, clientId: updated.clientId, finalPrice }, 'Insufficient wallet balance — client must pay manually');

            // Notify client via socket that payment is pending
            try {
              const { getIO } = await import('../socket');
              const io = getIO();
              (io.to(`user:${updated.clientId}`) as any).emit('order:payment-required', {
                orderId: updated.id,
                orderNumber: updated.orderNumber,
                amount: finalPrice,
                currency: updated.currency,
                reason: 'INSUFFICIENT_WALLET_BALANCE',
              });
            } catch {
              // Socket not available
            }
          }
        } catch (err) {
          logger.error({ err, orderId }, 'Failed to debit client wallet after delivery');
        }
      } else if (updated.paymentMethod === 'CASH') {
        // Cash is collected by the rider in person — mark as completed
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'COMPLETED' },
        });
        updated = { ...updated, paymentStatus: 'COMPLETED' };
      }
      // CARD / MOBILE_MONEY / BANK_TRANSFER: paymentStatus stays PENDING —
      // client pays via Paystack after seeing the "Pay Now" prompt on tracking page.
    }
  }

  // Enqueue background jobs AFTER writes have completed successfully
  if (newStatus === 'DELIVERED') {
    const commData = (updated as Record<string, unknown>).__commissionEnqueue as CommissionJobData | undefined;
    if (commData) {
      enqueueCommissionJob(commData).catch((err) => {
        logger.error({ err, orderId: updated.id, commData }, 'Failed to enqueue commission job — creating fallback record');
        // Fallback: persist commission data so it can be reconciled manually
        prisma.orderStatusHistory.create({
          data: {
            orderId: updated.id,
            status: 'DELIVERED',
            actor: 'system',
            note: `COMMISSION_FAILED: ${JSON.stringify(commData)}`,
          },
        }).catch(() => {});
      });
      delete (updated as Record<string, unknown>).__commissionEnqueue;
    }

    enqueueReceiptJob({
      orderId: updated.id,
      clientId: updated.clientId,
      orderNumber: updated.orderNumber,
      totalPrice: Number(updated.totalPrice),
      currency: updated.currency,
    }).catch((err) => {
      logger.error({ err, orderId: updated.id }, 'Failed to enqueue receipt job');
    });

    // Award XP for completed delivery (fire-and-forget)
    if (updated.riderId) {
      awardXp(updated.riderId, XpAction.DELIVERY_COMPLETE, undefined, {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
      }).catch(() => {});

      // Update rider delivery streak
      recordStreakActivity(updated.riderId).catch(() => {});
    }

    // Learn from this delivery to improve future ETA predictions
    learnFromDelivery(updated.id).catch(() => {});
  }

  return updated;
}

/**
 * Cancel an order (client-initiated).
 *
 * Cancellation fees (per platform policy):
 *   - Before assignment (PENDING / SEARCHING_RIDER): FREE
 *   - After assignment  (ASSIGNED / PICKUP_EN_ROUTE): GHS 3.00 → rider compensation
 */
export async function cancelOrder(orderId: string, userId: string, reason?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.clientId !== userId) throw ApiError.forbidden('Not your order');

  // Can only cancel before pickup
  const cancellableStatuses: OrderStatus[] = ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE'];
  if (!cancellableStatuses.includes(order.status)) {
    throw ApiError.badRequest('Order can no longer be cancelled');
  }

  // Stop the auto-dispatch loop if it's actively seeking riders
  cancelDispatch(orderId);

  // Determine cancellation fee based on current status
  const CANCELLATION_FEE_AFTER_ASSIGNMENT = 3.00; // GHS
  const postAssignmentStatuses: OrderStatus[] = ['ASSIGNED', 'PICKUP_EN_ROUTE'];
  const hasFee = postAssignmentStatuses.includes(order.status) && !!order.riderId;
  const feeAmount = hasFee ? CANCELLATION_FEE_AFTER_ASSIGNMENT : 0;

  // If there's a fee and an assigned rider, compensate the rider
  if (hasFee && order.riderId) {
    const riderProfile = await prisma.riderProfile.findUnique({
      where: { id: order.riderId },
      select: { userId: true },
    });

    if (riderProfile) {
      // Credit cancellation compensation to rider's wallet atomically
      await creditWallet(
        riderProfile.userId,
        feeAmount,
        'DELIVERY_EARNING',
        `Cancellation compensation for order ${order.orderNumber}`,
        order.id,
        'cancellation',
      );
    }
  }

  const cancelNote = reason ?? 'Cancelled by client';
  const noteWithFee = hasFee
    ? `${cancelNote} (cancellation fee: GHS ${feeAmount.toFixed(2)})`
    : cancelNote;

  return transitionStatus(orderId, 'CANCELLED_BY_CLIENT', userId, noteWithFee);
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

  const cancellableStatuses: OrderStatus[] = [
    'ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP',
  ];
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
  const updated = await transitionStatus(orderId, 'CANCELLED_BY_RIDER', riderUserId, cancelNote);

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
  });
  if (!riderProfile) throw ApiError.notFound('Rider profile not found');

  if (riderProfile.onboardingStatus !== 'ACTIVATED') {
    throw ApiError.forbidden('Your account is not yet activated');
  }

  if (riderProfile.availability !== 'ONLINE') {
    throw ApiError.forbidden('You must be online to see available jobs');
  }

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PENDING', 'SEARCHING_RIDER'] },
      riderId: null,
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
  const orderIds = orders.map(o => o.id);
  const declinedMap = new Map<string, Set<string>>();
  if (orderIds.length > 0) {
    const allDeclined = await Promise.all(orderIds.map(oid => getDeclinedRiderIds(oid).then(set => ({ oid, set }))));
    for (const { oid, set } of allDeclined) {
      declinedMap.set(oid, set);
    }
  }
  const filtered = orders.filter(order => {
    const declined = declinedMap.get(order.id);
    return !declined || !declined.has(userId);
  });

  // Sort by proximity to rider's current GPS (nearest first)
  const riderLat = riderProfile.currentLatitude ? Number(riderProfile.currentLatitude) : null;
  const riderLng = riderProfile.currentLongitude ? Number(riderProfile.currentLongitude) : null;

  if (riderLat != null && riderLng != null) {
    filtered.sort((a, b) => {
      const distA = (a.pickupLatitude != null && a.pickupLongitude != null)
        ? Math.hypot(Number(a.pickupLatitude) - riderLat, Number(a.pickupLongitude) - riderLng)
        : Infinity;
      const distB = (b.pickupLatitude != null && b.pickupLongitude != null)
        ? Math.hypot(Number(b.pickupLatitude) - riderLat, Number(b.pickupLongitude) - riderLng)
        : Infinity;
      return distA - distB;
    });
  }

  return filtered;
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
      status: { in: ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'] },
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
    logger.info({ deleted: result.count, cutoff: cutoff.toISOString() }, '[Retention] Cleaned old breadcrumbs');
  }

  return result.count;
}
