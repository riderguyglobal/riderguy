import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';
import { transitionStatus } from './order.service';
import { createOrderNotification } from './notification.service';
import { emitOrderStatusUpdate } from '../socket';

// ============================================================
// Dispatch Service — handles rider assignment, reassignment,
// and unassignment for delivery orders.
// ============================================================

/**
 * Assign a rider to an order.
 * Can be called by admin (manual dispatch) or by the system (auto-dispatch).
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
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
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

  // Validate rider eligibility
  // Bypass only when BYPASS_ONBOARDING_CHECK=true (for testing)
  if (process.env.BYPASS_ONBOARDING_CHECK !== 'true' && rider.onboardingStatus !== 'ACTIVATED') {
    throw ApiError.badRequest('Rider is not activated', 'RIDER_NOT_ACTIVATED');
  }
  if (rider.availability !== 'ONLINE') {
    throw ApiError.badRequest(
      `Rider is currently ${rider.availability}`,
      'RIDER_UNAVAILABLE',
    );
  }

  // Sequential writes (interactive $transaction not supported on Neon/PgBouncer)
  // Use updateMany with a WHERE guard to prevent double-assignment
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: { in: ['PENDING', 'SEARCHING_RIDER'] }, riderId: null },
    data: {
      riderId: riderProfileId,
      status: 'ASSIGNED',
      assignedAt: new Date(),
    },
  });

  if (count === 0) {
    throw ApiError.conflict(
      'Order was already assigned or status changed — please retry',
      'ASSIGN_RACE',
    );
  }

  // Status history
  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: 'ASSIGNED',
      actor,
      note: `Assigned to rider ${rider.user.firstName} ${rider.user.lastName}`,
    },
  });

  // Set rider to ON_DELIVERY
  await prisma.riderProfile.update({
    where: { id: riderProfileId },
    data: { availability: 'ON_DELIVERY' },
  });

  // Fetch the updated order for the return value
  const updated = await prisma.order.findUnique({ where: { id: orderId } });

  // Emit real-time status update via WebSocket
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
    'Rider Assigned',
    `A rider has been assigned to your order ${order.orderNumber}.`,
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

  // Sequential writes (interactive $transaction not supported on Neon/PgBouncer)
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      riderId: null,
      status: 'PENDING',
      assignedAt: null,
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: 'PENDING',
      actor,
      note: 'Rider unassigned by admin',
    },
  });

  // Set rider back to ONLINE
  await prisma.riderProfile.update({
    where: { id: prevRiderId },
    data: { availability: 'ONLINE' },
  });

  return updated;
}

/**
 * Reassign an order to a different rider (admin action).
 */
export async function reassignRider(
  orderId: string,
  newRiderProfileId: string,
  actor: string,
) {
  // First unassign current rider
  await unassignRider(orderId, actor);

  // Then assign the new rider
  return assignRider(orderId, newRiderProfileId, actor);
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
    whereClause.status = options.status;
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
    onboardingStatus: 'ACTIVATED',
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
