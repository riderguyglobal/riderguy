import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';
import { config } from '../config';
import { logger } from '../lib/logger';

// ============================================================
// Location Service — REST endpoints for rider location data
// ============================================================

/**
 * Haversine distance between two GPS coords in kilometres.
 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate ETA from rider position to destination using Mapbox Directions API.
 * Falls back to haversine estimate if Mapbox is unavailable.
 *
 * Returns duration in seconds and distance in km.
 */
export async function getETA(
  riderLat: number,
  riderLng: number,
  destLat: number,
  destLng: number,
): Promise<{ durationSeconds: number; distanceKm: number }> {
  const token = config.mapbox.accessToken;

  if (token) {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${riderLng},${riderLat};${destLng},${destLat}?access_token=${encodeURIComponent(token)}&overview=false`;
      const response = await fetch(url);
      if (response.ok) {
        const json = (await response.json()) as {
          routes?: Array<{ duration: number; distance: number }>;
        };
        const route = json.routes?.[0];
        if (route) {
          return {
            durationSeconds: Math.round(route.duration),
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
          };
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Mapbox ETA fetch failed, using haversine fallback');
    }
  }

  // Fallback: straight-line distance at average 25 km/h city speed
  const distKm = haversineKm(riderLat, riderLng, destLat, destLng);
  const AVG_SPEED_KMH = 25;
  return {
    durationSeconds: Math.round((distKm / AVG_SPEED_KMH) * 3600),
    distanceKm: Math.round(distKm * 10) / 10,
  };
}

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
