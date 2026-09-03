// ============================================================
// Announcement Service — Sprint 11
// Admin-published announcements for riders
// ============================================================

import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';
import { NotificationService } from './notification.service';
import { logger } from '../lib/logger';

const NOTIFICATION_BATCH_SIZE = 200;

type RiderAnnouncementNotification = {
  id: string;
  title: string;
  body: string;
  priority: number;
  targetZones: string[];
  targetRoles: string[];
  isPublished: boolean;
  expiresAt: string | null;
};

// ────── Admin CRUD ──────

export async function createAnnouncement(
  data: {
    authorId: string;
    title: string;
    body: string;
    priority?: number;
    targetZones?: string[];
    targetRoles?: string[];
    isPublished?: boolean;
    expiresAt?: string;
  },
  auditContext: AdminAuditContext,
) {
  const announcement = await prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.create({
      data: {
        authorId: data.authorId,
        title: data.title,
        body: data.body,
        priority: data.priority ?? 0,
        targetZones: data.targetZones ?? [],
        targetRoles: (data.targetRoles ?? ['RIDER']) as any,
        isPublished: data.isPublished ?? false,
        publishedAt: data.isPublished ? new Date() : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const formatted = formatAnnouncement(announcement);
    await AdminAuditService.record(
      {
        ...auditContext,
        action: announcement.isPublished ? 'RIDER_BROADCAST_PUBLISHED' : 'RIDER_BROADCAST_DRAFTED',
        entityType: 'Announcement',
        entityId: announcement.id,
        newData: formatted,
      },
      tx,
    );
    return formatted;
  });

  await notifyTargetedRiders(announcement);
  return announcement;
}

export async function updateAnnouncement(
  id: string,
  data: {
    title?: string;
    body?: string;
    priority?: number;
    targetZones?: string[];
    targetRoles?: string[];
    isPublished?: boolean;
    expiresAt?: string | null;
  },
  auditContext: AdminAuditContext,
) {
  const announcement = await prisma.$transaction(async (tx) => {
    const existing = await tx.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!existing) throw ApiError.notFound('Announcement not found');

    const wasPublished = existing.isPublished;
    const nowPublished = data.isPublished ?? existing.isPublished;

    const changed = await tx.announcement.updateMany({
      where: { id, updatedAt: existing.updatedAt },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.targetZones !== undefined ? { targetZones: data.targetZones } : {}),
        ...(data.targetRoles !== undefined ? { targetRoles: data.targetRoles as any } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        // Set publishedAt when first published
        ...(!wasPublished && nowPublished ? { publishedAt: new Date() } : {}),
        ...(data.expiresAt !== undefined
          ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
          : {}),
      },
    });
    if (changed.count !== 1) {
      throw ApiError.conflict(
        'This announcement changed while it was being edited. Refresh and try again.',
        'ANNOUNCEMENT_CHANGED',
      );
    }
    const announcement = await tx.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!announcement) throw ApiError.notFound('Announcement not found');

    const formatted = formatAnnouncement(announcement);
    await AdminAuditService.record(
      {
        ...auditContext,
        action: 'RIDER_BROADCAST_UPDATED',
        entityType: 'Announcement',
        entityId: announcement.id,
        oldData: formatAnnouncement(existing),
        newData: formatted,
      },
      tx,
    );
    return formatted;
  });

  await notifyTargetedRiders(announcement);
  return announcement;
}

export async function deleteAnnouncement(id: string, auditContext: AdminAuditContext) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!existing) throw ApiError.notFound('Announcement not found');

    const deleted = await tx.announcement.deleteMany({
      where: { id, updatedAt: existing.updatedAt },
    });
    if (deleted.count !== 1) {
      throw ApiError.conflict(
        'This announcement changed while it was being deleted. Refresh and try again.',
        'ANNOUNCEMENT_CHANGED',
      );
    }
    await AdminAuditService.record(
      {
        ...auditContext,
        action: 'RIDER_BROADCAST_DELETED',
        entityType: 'Announcement',
        entityId: id,
        oldData: formatAnnouncement(existing),
      },
      tx,
    );
  });
}

export async function getAnnouncementAdmin(id: string) {
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return formatAnnouncement(announcement);
}

export async function listAnnouncementsAdmin(options: { page?: number; limit?: number }) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      skip,
      take: limit,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.announcement.count(),
  ]);

  return {
    announcements: announcements.map(formatAnnouncement),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ────── Public (Rider / Client) ──────

export async function getPublishedAnnouncements(options: {
  role?: string;
  roles?: readonly string[];
  zoneId?: string;
  page?: number;
  limit?: number;
}) {
  const { role, roles, zoneId, page = 1, limit = 20 } = options;
  const targetRoles = roles?.length ? [...new Set(roles)] : role ? [role] : [];
  const skip = (page - 1) * limit;
  const now = new Date();

  const where: any = {
    isPublished: true,
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ...(targetRoles.length
        ? [{ OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { hasSome: targetRoles } }] }]
        : []),
      // A zone-targeted announcement must never fall through to an account
      // whose current zone is unknown. Global messages have an empty target.
      {
        OR: [
          { targetZones: { isEmpty: true } },
          ...(zoneId ? [{ targetZones: { has: zoneId } }] : []),
        ],
      },
    ],
  };

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.announcement.count({ where }),
  ]);

  return {
    announcements: announcements.map(formatAnnouncement),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ────── Helper ──────

function formatAnnouncement(a: any) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    priority: a.priority,
    targetZones: a.targetZones,
    targetRoles: a.targetRoles,
    isPublished: a.isPublished,
    publishedAt: a.publishedAt?.toISOString() ?? null,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    author: a.author
      ? { id: a.author.id, firstName: a.author.firstName, lastName: a.author.lastName }
      : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

/**
 * Persist and push a Rider-facing copy only after the announcement and its
 * administrator audit have committed. Delivery failures remain observable in
 * logs without turning a successfully committed broadcast into a false 500.
 */
async function notifyTargetedRiders(announcement: RiderAnnouncementNotification): Promise<void> {
  const riderIsTargeted =
    announcement.targetRoles.length === 0 || announcement.targetRoles.includes('RIDER');
  const isExpired =
    announcement.expiresAt !== null && new Date(announcement.expiresAt).getTime() <= Date.now();
  if (!announcement.isPublished || !riderIsTargeted || isExpired) return;

  try {
    let cursor: string | undefined;
    do {
      const riders = await prisma.riderProfile.findMany({
        where: {
          user: { status: 'ACTIVE', deletedAt: null },
          ...(announcement.targetZones.length > 0
            ? { currentZoneId: { in: announcement.targetZones } }
            : {}),
        },
        select: { id: true, userId: true },
        orderBy: { id: 'asc' },
        take: NOTIFICATION_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const deliveries = await Promise.allSettled(
        riders.map((rider) =>
          NotificationService.create({
            userId: rider.userId,
            title: announcement.title,
            body: announcement.body,
            type: 'SYSTEM',
            data: {
              context: 'ANNOUNCEMENT',
              announcementId: announcement.id,
              priority: announcement.priority,
            },
          }),
        ),
      );
      const failed = deliveries.filter((delivery) => delivery.status === 'rejected').length;
      if (failed > 0) {
        logger.warn(
          { announcementId: announcement.id, failed, attempted: riders.length },
          'Some Rider announcement notifications failed after commit',
        );
      }

      cursor = riders.length === NOTIFICATION_BATCH_SIZE ? riders.at(-1)?.id : undefined;
    } while (cursor);
  } catch (error) {
    logger.error(
      { error, announcementId: announcement.id },
      'Rider announcement notification fan-out failed after commit',
    );
  }
}
