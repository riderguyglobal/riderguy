// ============================================================
// NotificationService — In-app notifications + push via FCM
//
// Creates notifications in the database and delivers push
// notifications to registered devices via Firebase Cloud
// Messaging.
// ============================================================

import { prisma } from '@riderguy/database';
import type { Prisma } from '@riderguy/database';
import { PushService } from './push.service';
import { logger } from '../lib/logger';

// --------------- types ------------------------------------------------

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: string;         // 'document_review' | 'onboarding' | 'order' | etc.
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
          type: 'rider_application',
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
      type: 'document_review',
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
 */
export async function createOrderNotification(
  userId: string,
  title: string,
  body: string,
  orderId: string,
) {
  return NotificationService.create({
    userId,
    title,
    body,
    type: 'order',
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
  const whereClause: any = {
    availability: 'ONLINE',
    onboardingStatus: 'ACTIVATED',
  };

  if (zoneId) {
    whereClause.currentZoneId = zoneId;
  }

  const riders = await prisma.riderProfile.findMany({
    where: whereClause,
    select: { userId: true },
    take: 50,
  });

  await Promise.allSettled(
    riders.map((rider) =>
      createOrderNotification(
        rider.userId,
        'New Delivery Available',
        `New order ${orderNumber} — pickup at ${pickupAddress}. Open the job feed to accept.`,
        orderId,
      ),
    ),
  );
}
