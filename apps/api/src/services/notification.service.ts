// ============================================================
// NotificationService — In-app notifications + push via FCM
//
// Creates notifications in the database and delivers push
// notifications to registered devices via Firebase Cloud
// Messaging.
// ============================================================

import { prisma } from '@riderguy/database';
import type { Prisma, NotificationType } from '@riderguy/database';
import { PushService } from './push.service';
import { SmsService } from './sms.service';
import { emitNewJob } from '../socket';
import { logger } from '../lib/logger';

// --------------- types ------------------------------------------------

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown>;
}

// --------------- service class ----------------------------------------

export class NotificationService {
  // ---- Create a notification ----
  static async create(input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: input.type,
        data: (input.data as Prisma.InputJsonValue) ?? undefined,
      },
    });

    // Send push notification via FCM (fire-and-forget)
    PushService.sendToUser(
      input.userId,
      input.title,
      input.body,
      input.data
        ? Object.fromEntries(
            Object.entries(input.data)
              .filter(([, v]) => v != null)
              .map(([k, v]) => [k, String(v)]),
          )
        : undefined,
    ).catch((err) => {
      logger.error({ err, userId: input.userId }, 'Push notification delivery failed');
    });

    return notification;
  }

  // ---- Notify admin(s) when a new rider application is submitted ----
  static async notifyAdminsNewApplication(riderUserId: string) {
    const rider = await prisma.user.findUnique({
      where: { id: riderUserId },
      select: { firstName: true, lastName: true },
    });

    if (!rider) return;

    // Find all admins/super_admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
      select: { id: true },
    });

    await Promise.allSettled(
      admins.map((admin) =>
        NotificationService.create({
          userId: admin.id,
          title: 'New Rider Application',
          body: `${rider.firstName} ${rider.lastName} has submitted documents for review.`,
          type: 'SYSTEM',
          data: { riderUserId },
        }),
      ),
    );
  }

  // ---- Notify rider when document status changes ----
  static async notifyDocumentReview(
    userId: string,
    documentType: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
  ) {
    const friendlyType = documentType.replace(/_/g, ' ').toLowerCase();
    const isApproved = status === 'APPROVED';

    await NotificationService.create({
      userId,
      title: isApproved ? 'Document Approved' : 'Document Rejected',
      body: isApproved
        ? `Your ${friendlyType} has been approved.`
        : `Your ${friendlyType} was rejected${rejectionReason ? `: ${rejectionReason}` : '. Please re-upload.'}`,
      type: 'SYSTEM',
      data: { documentType, status, rejectionReason },
    });
  }

  // ---- List notifications for a user ----
  static async list(userId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications,
      unreadCount,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ---- Mark notification as read ----
  static async markRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ---- Mark all as read ----
  static async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}

// ---- Convenience helpers for order notifications ----

/**
 * Create a notification related to an order.
 * Also sends an SMS to the user for critical order updates.
 */
export async function createOrderNotification(
  userId: string,
  title: string,
  body: string,
  orderId: string,
) {
  // Send SMS for order updates (fire-and-forget)
  prisma.user
    .findUnique({ where: { id: userId }, select: { phone: true } })
    .then((user) => {
      if (user?.phone) {
        SmsService.sendOrderUpdate(user.phone, orderId.slice(0, 8).toUpperCase(), body).catch(
          (err) => logger.error({ err, userId }, 'Order SMS delivery failed'),
        );
      }
    })
    .catch((err) => logger.error({ err, userId }, 'Failed to look up user for order SMS'));

  return NotificationService.create({
    userId,
    title,
    body,
    type: 'ORDER',
    data: { orderId },
  });
}

/**
 * Notify nearby riders about a new available order.
 */
export async function notifyNearbyRiders(
  orderId: string,
  orderNumber: string,
  zoneId: string | null,
  pickupAddress: string,
) {
  const baseWhere: any = {
    availability: 'ONLINE',
    onboardingStatus: 'ACTIVATED',
  };

  // Try zone-specific riders first, fallback to all online riders
  let riders = zoneId
    ? await prisma.riderProfile.findMany({
        where: { ...baseWhere, currentZoneId: zoneId },
        select: { userId: true },
        take: 50,
      })
    : [];

  // Fallback: if no zone-specific riders found, notify all online riders
  if (riders.length === 0) {
    riders = await prisma.riderProfile.findMany({
      where: baseWhere,
      select: { userId: true },
      take: 50,
    });
  }

  // Fetch rider phone numbers for SMS delivery
  const riderUsers = await prisma.user.findMany({
    where: { id: { in: riders.map((r) => r.userId) } },
    select: { id: true, phone: true },
  });
  const phoneMap = new Map(riderUsers.map((u) => [u.id, u.phone]));

  logger.info(
    { orderId, orderNumber, riderCount: riders.length, zoneId },
    '[NotifyRiders] Broadcasting job:new + SMS to riders',
  );

  // Also emit socket broadcast so riders' Jobs tab auto-refreshes
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        distanceKm: true,
        totalPrice: true,
        packageType: true,
        dropoffAddress: true,
        pickupLatitude: true,
        pickupLongitude: true,
        isMultiStop: true,
        isScheduled: true,
      },
    });
    if (order) {
      emitNewJob(zoneId, {
        orderId,
        orderNumber,
        pickupAddress,
        dropoffAddress: order.dropoffAddress,
        pickupLat: order.pickupLatitude,
        pickupLng: order.pickupLongitude,
        distanceKm: order.distanceKm,
        totalPrice: typeof order.totalPrice === 'number' ? order.totalPrice : Number(order.totalPrice),
        packageType: order.packageType,
        isMultiStop: order.isMultiStop,
        isScheduled: order.isScheduled,
      });
    }
  } catch (err) {
    logger.error({ err, orderId }, '[NotifyRiders] Failed to emit job:new broadcast');
  }

  await Promise.allSettled(
    riders.map((rider) => {
      // Send SMS to rider for new job (fire-and-forget)
      const phone = phoneMap.get(rider.userId);
      if (phone) {
        SmsService.sendNewJobAvailable(phone, pickupAddress).catch((err) =>
          logger.error({ err, userId: rider.userId }, 'New job SMS to rider failed'),
        );
      }

      return createOrderNotification(
        rider.userId,
        'New Delivery Available',
        `New order ${orderNumber} — pickup at ${pickupAddress}. Open the job feed to accept.`,
        orderId,
      );
    }),
  );
}
