import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';

// ============================================================
// Location Service — REST endpoints for rider location data
// ============================================================

/**
 * Get the latest location for a rider assigned to a given order.
 */
export async function getRiderLocationForOrder(orderId: string, requesterId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      clientId: true,
      riderId: true,
      status: true,
      rider: {
        select: {
          userId: true,
          currentLatitude: true,
          currentLongitude: true,
          lastLocationUpdate: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!order) throw ApiError.notFound('Order not found');

  // Only the client on that order or an admin can see rider location
  const isClient = order.clientId === requesterId;
  const isRider = order.rider?.userId === requesterId;
  // We'll allow admins by checking later in routes

  if (!isClient && !isRider) {
    throw ApiError.forbidden('You do not have access to this order');
  }

  if (!order.rider) {
    return { location: null };
  }

  // Only share location for active deliveries
  const activeStatuses = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'];
  if (!activeStatuses.includes(order.status)) {
    return { location: null };
  }

  return {
    location: {
      riderId: order.riderId,
      riderName: `${order.rider.user.firstName} ${order.rider.user.lastName}`,
      latitude: order.rider.currentLatitude,
      longitude: order.rider.currentLongitude,
      lastUpdated: order.rider.lastLocationUpdate?.toISOString() ?? null,
    },
  };
}

/**
 * Update rider's current location (REST fallback for when WebSocket isn't available).
 */
export async function updateRiderLocation(
  userId: string,
  latitude: number,
  longitude: number,
) {
  await prisma.riderProfile.updateMany({
    where: { userId },
    data: {
      currentLatitude: latitude,
      currentLongitude: longitude,
      lastLocationUpdate: new Date(),
    },
  });
}

/**
 * Get messages for an order.
 */
export async function getOrderMessages(
  orderId: string,
  userId: string,
  options: { page?: number; limit?: number } = {},
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { clientId: true, rider: { select: { userId: true } } },
  });

  if (!order) throw ApiError.notFound('Order not found');

  const isClient = order.clientId === userId;
  const isRider = order.rider?.userId === userId;
  if (!isClient && !isRider) {
    throw ApiError.forbidden('You do not have access to this order');
  }

  const page = options.page ?? 1;
  const limit = Math.min(options.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const [rawMessages, total] = await Promise.all([
    prisma.orderMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.orderMessage.count({ where: { orderId } }),
  ]);

  // Resolve sender info for each message
  const senderIds = [...new Set(rawMessages.map((m) => m.senderId))];
  const senders = await prisma.user.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  const senderMap = new Map(senders.map((s) => [s.id, s]));

  return {
    data: rawMessages.map((m) => {
      const sender = senderMap.get(m.senderId);
      return {
        id: m.id,
        orderId: m.orderId,
        senderId: m.senderId,
        senderName: sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown',
        senderRole: (sender?.role === 'RIDER' ? 'rider' : 'client') as 'rider' | 'client',
        content: m.content,
        timestamp: m.createdAt.toISOString(),
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
