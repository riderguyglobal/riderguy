import { prisma } from '@riderguy/database';
import { generateOrderNumber, generateDeliveryPin } from '@riderguy/utils';
import { XpAction } from '@riderguy/types';
import { calculatePrice, fetchRouteDistance } from './pricing.service';
import { awardXp, getCommissionRate } from './gamification.service';
import { cancelDispatch } from './auto-dispatch.service';
import { ApiError } from '../lib/api-error';
import { enqueueCommissionJob, enqueueReceiptJob, type CommissionJobData } from '../jobs/queues';
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
  PICKUP_EN_ROUTE: ['AT_PICKUP', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'],
  AT_PICKUP: ['PICKED_UP', 'FAILED', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED', 'CANCELLED_BY_ADMIN'],
  IN_TRANSIT: ['AT_DROPOFF', 'FAILED', 'CANCELLED_BY_ADMIN'],
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
  // Try to get actual route distance from Mapbox
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
    isExpress?: boolean;
    packageWeightKg?: number;
    promoCode?: string;
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

  // Try to get actual route distance from Mapbox
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
      isExpress: input.isExpress,
      packageWeightKg: input.packageWeightKg,
      paymentMethod: input.paymentMethod,
      promoCode: input.promoCode,
      clientId,
      routeDistanceKm,
    },
  );

  // If promo code used, record usage
  let promoCodeId: string | undefined;
  if (input.promoCode && price.promoDiscount > 0) {
    const promo = await prisma.promoCode.findUnique({
      where: { code: input.promoCode.toUpperCase().trim() },
    });
    if (promo) {
      promoCodeId = promo.id;
      await prisma.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      });
    }
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
    }).catch(() => {}); // Don't block order creation
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
  const updated = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: newStatus,
      actor,
      note: note ?? `Status changed to ${newStatus}`,
    },
  });

  // If the rider cancels, set them back to ONLINE
  if (newStatus === 'CANCELLED_BY_RIDER' && updated.riderId) {
    await prisma.riderProfile.update({
      where: { id: updated.riderId },
      data: { availability: 'ONLINE' },
    });
  }

  // If delivered, update rider stats + credit wallet
  if (newStatus === 'DELIVERED' && updated.riderId) {
    await prisma.riderProfile.update({
      where: { id: updated.riderId },
      data: {
        totalDeliveries: { increment: 1 },
        availability: 'ONLINE',
      },
    });

    // Credit rider wallet
    const earnings = updated.riderEarnings ? Number(updated.riderEarnings) : (Number(updated.totalPrice) * 0.85);
    const riderProfile = await prisma.riderProfile.findUnique({
      where: { id: updated.riderId },
      select: { id: true, userId: true, currentLevel: true },
    });

    if (riderProfile) {
      const wallet = await prisma.wallet.upsert({
        where: { userId: riderProfile.userId },
        create: {
          userId: riderProfile.userId,
          balance: earnings,
          totalEarned: earnings,
        },
        update: {
          balance: { increment: earnings },
          totalEarned: { increment: earnings },
        },
      });

      // Re-read wallet to get accurate post-increment balance
      const walletAfterEarning = await prisma.wallet.findUnique({ where: { id: wallet.id } });
      const earningBalance = walletAfterEarning?.balance ?? wallet.balance;

      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'DELIVERY_EARNING',
          amount: earnings,
          balanceAfter: earningBalance,
          description: `Earnings from order ${updated.orderNumber}`,
          referenceId: updated.id,
          referenceType: 'order',
        },
      });

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
            await prisma.wallet.update({
              where: { id: wallet.id },
              data: {
                balance: { increment: bonus },
                totalEarned: { increment: bonus },
              },
            });
            const walletAfterBonus = await prisma.wallet.findUnique({ where: { id: wallet.id } });
            await prisma.transaction.create({
              data: {
                walletId: wallet.id,
                type: 'DELIVERY_EARNING',
                amount: bonus,
                balanceAfter: walletAfterBonus?.balance ? Number(walletAfterBonus.balance) : (Number(earningBalance) + bonus),
                description: `Level ${riderProfile.currentLevel} commission bonus for order ${updated.orderNumber}`,
                referenceId: updated.id,
                referenceType: 'level_bonus',
              },
            });
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
  }

  // Enqueue background jobs AFTER writes have completed successfully
  if (newStatus === 'DELIVERED') {
    const commData = (updated as Record<string, unknown>).__commissionEnqueue as CommissionJobData | undefined;
    if (commData) {
      enqueueCommissionJob(commData).catch(() => {});
      delete (updated as Record<string, unknown>).__commissionEnqueue;
    }

    enqueueReceiptJob({
      orderId: updated.id,
      clientId: updated.clientId,
      orderNumber: updated.orderNumber,
      totalPrice: Number(updated.totalPrice),
      currency: updated.currency,
    }).catch(() => {});

    // Award XP for completed delivery (fire-and-forget)
    if (updated.riderId) {
      awardXp(updated.riderId, XpAction.DELIVERY_COMPLETE, undefined, {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
      }).catch(() => {});
    }
  }

  return updated;
}

/**
 * Cancel an order (client-initiated).
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

  return transitionStatus(orderId, 'CANCELLED_BY_CLIENT', userId, reason ?? 'Cancelled by client');
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
        const wallet = await prisma.wallet.upsert({
          where: { userId: riderProfile.userId },
          create: {
            userId: riderProfile.userId,
            balance: tipAmount,
            totalTips: tipAmount,
          },
          update: {
            balance: { increment: tipAmount },
            totalTips: { increment: tipAmount },
          },
        });

        // Re-read wallet to get accurate post-increment balance
        const walletAfterTip = await prisma.wallet.findUnique({ where: { id: wallet.id } });

        await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'TIP',
            amount: tipAmount,
            balanceAfter: walletAfterTip?.balance ?? wallet.balance,
            description: `Tip from order ${updated.orderNumber}`,
            referenceId: updated.id,
            referenceType: 'order',
          },
        });
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
 * Get available jobs for a rider — orders in their zone that are PENDING or SEARCHING_RIDER.
 */
export async function getAvailableJobs(userId: string) {
  const riderProfile = await prisma.riderProfile.findUnique({
    where: { userId },
  });
  if (!riderProfile) throw ApiError.notFound('Rider profile not found');

  if (riderProfile.onboardingStatus !== 'ACTIVATED') {
    throw ApiError.forbidden('Your account is not yet activated');
  }

  // Build where clause — rider's zone or no zone (unzoned orders)
  const whereClause: any = {
    status: { in: ['PENDING', 'SEARCHING_RIDER'] },
    riderId: null,
  };

  if (riderProfile.currentZoneId) {
    whereClause.OR = [
      { zoneId: riderProfile.currentZoneId },
      { zoneId: null },
    ];
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
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

  return orders;
}
