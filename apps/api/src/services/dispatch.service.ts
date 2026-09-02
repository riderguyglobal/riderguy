import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';
import { createOrderNotification } from './notification.service';
import { emitOrderStatusUpdate } from '../socket';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import {
  assertRiderWorkEligible,
  riderWorkEligibilityWhere,
  setPostWorkRiderAvailability,
} from './rider-work-eligibility';
import type { Prisma } from '@prisma/client';
import { OrderStatus } from '@riderguy/types';

async function lockRiderState(
  tx: Prisma.TransactionClient,
  ...riderProfileIds: string[]
): Promise<void> {
  // Stable ordering prevents simultaneous cross-reassignments from
  // deadlocking while each Rider remains serialised against vehicle review.
  for (const riderProfileId of [...new Set(riderProfileIds)].sort()) {
    await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', riderProfileId);
  }
}

// ============================================================
// Dispatch Service — handles rider assignment, reassignment,
// and unassignment for delivery orders.
// ============================================================

/**
 * Assign a rider to an order.
 * Can be called by admin (manual dispatch) or by the system (auto-dispatch).
 * Fully atomic — both order assignment and rider status update happen in one transaction.
 */
export async function assignRider(
  orderId: string,
  riderProfileId: string,
  actor: string,
) {
  const [order, rider] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId } }),
    prisma.riderProfile.findUnique({
      where: { id: riderProfileId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, status: true } },
        vehicles: { select: { reviewStatus: true } },
      },
    }),
  ]);

  if (!order) throw ApiError.notFound('Order not found');
  if (!rider) throw ApiError.notFound('Rider not found');

  // Validate order status
  if (order.status !== 'PENDING' && order.status !== 'SEARCHING_RIDER') {
    throw ApiError.badRequest(
      `Cannot assign rider to order in status ${order.status}`,
      'INVALID_ORDER_STATUS',
    );
  }
  if (order.isScheduled && order.scheduledAt && order.scheduledAt > new Date()) {
    throw ApiError.badRequest(
      'Scheduled order is not ready for dispatch yet',
      'SCHEDULED_ORDER_NOT_READY',
    );
  }

  // Validate the same central work gate used by availability and job feeds.
  assertRiderWorkEligible(rider);
  if (rider.suspendedUntil && rider.suspendedUntil > new Date()) {
    throw ApiError.forbidden('Rider is currently suspended due to cancellation violations');
  }
  if (rider.availability !== 'ONLINE') {
    throw ApiError.badRequest(
      `Rider is currently ${rider.availability}`,
      'RIDER_UNAVAILABLE',
    );
  }

  // Atomic transaction — both writes succeed or neither does
  const updated = await prisma.$transaction(async (tx) => {
    await lockRiderState(tx, riderProfileId);

    // Guard 1: Claim the rider — only succeeds if they're still ONLINE
    const riderClaim = await tx.riderProfile.updateMany({
      where: { id: riderProfileId, availability: 'ONLINE', ...riderWorkEligibilityWhere() },
      data: { availability: 'ON_DELIVERY' },
    });
    if (riderClaim.count === 0) {
      throw ApiError.conflict(
        'Rider is no longer available — they may have been assigned another order',
        'RIDER_ALREADY_CLAIMED',
      );
    }

    // Guard 2: Claim the order — only succeeds if it's still unassigned
    const orderClaim = await tx.order.updateMany({
      where: { id: orderId, status: { in: ['PENDING', 'SEARCHING_RIDER'] }, riderId: null },
      data: {
        riderId: riderProfileId,
        status: 'ASSIGNED',
        assignedAt: new Date(),
      },
    });
    if (orderClaim.count === 0) {
      // Throwing rolls the transaction back, including the Rider claim.
      throw ApiError.conflict(
        'Order was already assigned or status changed — please retry',
        'ASSIGN_RACE',
      );
    }

    // Status history
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'ASSIGNED',
        actor,
        note: `Assigned to rider ${rider.user.firstName} ${rider.user.lastName}`,
      },
    });

    return tx.order.findUnique({ where: { id: orderId } });
  });

  // Side effects outside the transaction (non-critical)
  emitOrderStatusUpdate({
    orderId,
    orderNumber: order.orderNumber,
    status: 'ASSIGNED',
    previousStatus: order.status,
    actor,
    note: `Assigned to rider ${rider.user.firstName} ${rider.user.lastName}`,
  });

  // Notify rider
  await createOrderNotification(
    rider.user.id,
    'New Delivery Assigned',
    `You have been assigned order ${order.orderNumber}. Head to the pickup location.`,
    orderId,
  ).catch(() => {}); // Don't fail if notification fails

  // Notify client
  await createOrderNotification(
    order.clientId,
    'Rider Assigned 🛵',
    `${rider.user.firstName} is heading to pick up your order ${order.orderNumber}. Track your delivery in the app.`,
    orderId,
  ).catch(() => {});

  return updated;
}

/**
 * Rider accepts a job from the feed.
 */
export async function acceptJob(orderId: string, userId: string) {
  const riderProfile = await prisma.riderProfile.findUnique({
    where: { userId },
  });
  if (!riderProfile) throw ApiError.notFound('Rider profile not found');

  return assignRider(orderId, riderProfile.id, userId);
}

/**
 * Unassign a rider from an order (admin action).
 * Uses optimistic concurrency to prevent unassigning after pickup.
 */
export async function unassignRider(orderId: string, actor: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');
  if (!order.riderId) throw ApiError.badRequest('No rider assigned to this order');

  // Can only unassign before pickup
  const unassignableStatuses = ['ASSIGNED', 'PICKUP_EN_ROUTE'] as const;
  if (!unassignableStatuses.includes(order.status as any)) {
    throw ApiError.badRequest(
      `Cannot unassign rider from order in status ${order.status}`,
    );
  }

  const prevRiderId = order.riderId;

  // Atomic — both writes in one transaction with optimistic concurrency
  const updated = await prisma.$transaction(async (tx) => {
    await lockRiderState(tx, prevRiderId);

    // Guard: only succeeds if order still has the expected status
    const result = await tx.order.updateMany({
      where: { id: orderId, status: order.status, riderId: prevRiderId },
      data: {
        riderId: null,
        status: 'PENDING',
        assignedAt: null,
      },
    });
    if (result.count === 0) {
      throw ApiError.conflict(
        'Order status changed concurrently — rider may have progressed the delivery',
        'UNASSIGN_RACE',
      );
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'PENDING',
        actor,
        note: 'Rider unassigned by admin',
      },
    });

    await setPostWorkRiderAvailability(tx, prevRiderId);

    return tx.order.findUnique({ where: { id: orderId } });
  });

  return updated;
}

/**
 * Reassign an order to a different rider (admin action).
 * Atomic — unassign + assign happen in one transaction to prevent orphaning.
 */
export async function reassignRider(
  orderId: string,
  newRiderProfileId: string,
  actor: string,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');
  if (!order.riderId) throw ApiError.badRequest('No rider currently assigned');

  const unassignableStatuses = ['ASSIGNED', 'PICKUP_EN_ROUTE'] as const;
  if (!unassignableStatuses.includes(order.status as any)) {
    throw ApiError.badRequest(
      `Cannot reassign order in status ${order.status}`,
    );
  }

  const newRider = await prisma.riderProfile.findUnique({
    where: { id: newRiderProfileId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, status: true } },
      vehicles: { select: { reviewStatus: true } },
    },
  });
  if (!newRider) throw ApiError.notFound('New rider not found');
  assertRiderWorkEligible(newRider);
  if (newRider.availability !== 'ONLINE') {
    throw ApiError.badRequest(`New rider is currently ${newRider.availability}`, 'RIDER_UNAVAILABLE');
  }

  const prevRiderId = order.riderId;

  const updated = await prisma.$transaction(async (tx) => {
    await lockRiderState(tx, prevRiderId, newRiderProfileId);

    // Release the old Rider according to their current approval state.
    await setPostWorkRiderAvailability(tx, prevRiderId);

    // Claim new rider — guard on availability
    const riderClaim = await tx.riderProfile.updateMany({
      where: { id: newRiderProfileId, availability: 'ONLINE', ...riderWorkEligibilityWhere() },
      data: { availability: 'ON_DELIVERY' },
    });
    if (riderClaim.count === 0) {
      throw ApiError.conflict('New rider is no longer available', 'RIDER_ALREADY_CLAIMED');
    }

    // Reassign order — guard on current status
    const orderUpdate = await tx.order.updateMany({
      where: { id: orderId, status: order.status, riderId: prevRiderId },
      data: {
        riderId: newRiderProfileId,
        status: 'ASSIGNED',
        assignedAt: new Date(),
      },
    });
    if (orderUpdate.count === 0) {
      throw ApiError.conflict('Order status changed concurrently', 'REASSIGN_RACE');
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'ASSIGNED',
        actor,
        note: `Reassigned to rider ${newRider.user.firstName} ${newRider.user.lastName}`,
      },
    });

    return tx.order.findUnique({ where: { id: orderId } });
  });

  // Notifications (non-critical)
  emitOrderStatusUpdate({
    orderId,
    orderNumber: order.orderNumber,
    status: 'ASSIGNED',
    previousStatus: order.status,
    actor,
    note: `Reassigned to rider ${newRider.user.firstName} ${newRider.user.lastName}`,
  });

  return updated;
}

/**
 * Get all orders that are available for dispatch (PENDING or SEARCHING_RIDER).
 */
export async function getDispatchQueue(options?: {
  status?: string;
  zoneId?: string;
  page?: number;
  limit?: number;
}) {
  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const whereClause: any = {};

  if (options?.status) {
    const requestedStatuses = [...new Set(
      options.status
        .split(',')
        .map((status) => status.trim())
        .filter(Boolean),
    )];
    const allowedStatuses = new Set<string>(Object.values(OrderStatus));
    const invalidStatus = requestedStatuses.find((status) => !allowedStatuses.has(status));
    if (invalidStatus || requestedStatuses.length === 0) {
      throw ApiError.badRequest(
        `Unknown order status filter: ${invalidStatus ?? options.status}`,
        'INVALID_ORDER_STATUS_FILTER',
      );
    }
    whereClause.status = requestedStatuses.length === 1
      ? requestedStatuses[0]
      : { in: requestedStatuses };
  } else {
    // Default: show active orders
    whereClause.status = {
      in: ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'],
    };
  }

  if (options?.zoneId) {
    whereClause.zoneId = options.zoneId;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        rider: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
        zone: { select: { id: true, name: true } },
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
 * Get available (ONLINE, ACTIVATED) riders for assignment.
 */
export async function getAvailableRiders(zoneId?: string) {
  const whereClause: any = {
    availability: 'ONLINE',
    ...riderWorkEligibilityWhere(),
  };

  if (zoneId) {
    whereClause.currentZoneId = zoneId;
  }

  return prisma.riderProfile.findMany({
    where: whereClause,
    select: {
      id: true,
      userId: true,
      user: { select: { firstName: true, lastName: true, phone: true, avatarUrl: true } },
      averageRating: true,
      totalDeliveries: true,
      currentZoneId: true,
      currentLatitude: true,
      currentLongitude: true,
    },
    orderBy: { averageRating: 'desc' },
    take: 50,
  });
}
