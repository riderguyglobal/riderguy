// ============================================================
// Announcement Service — Sprint 11
// Admin-published announcements for riders
// ============================================================

import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';

// ────── Admin CRUD ──────

export async function createAnnouncement(data: {
  authorId: string;
  title: string;
  body: string;
  priority?: number;
  targetZones?: string[];
  targetRoles?: string[];
  isPublished?: boolean;
  expiresAt?: string;
}) {
  const announcement = await prisma.announcement.create({
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

  return formatAnnouncement(announcement);
}

export async function updateAnnouncement(id: string, data: {
  title?: string;
  body?: string;
  priority?: number;
  targetZones?: string[];
  targetRoles?: string[];
  isPublished?: boolean;
  expiresAt?: string | null;
}) {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Announcement not found');

  const wasPublished = existing.isPublished;
  const nowPublished = data.isPublished ?? existing.isPublished;

  const announcement = await prisma.announcement.update({
    where: { id },
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
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return formatAnnouncement(announcement);
}

export async function deleteAnnouncement(id: string) {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Announcement not found');

  await prisma.announcement.delete({ where: { id } });
}

export async function listAnnouncementsAdmin(options: {
  page?: number;
  limit?: number;
}) {
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
  zoneId?: string;
  page?: number;
  limit?: number;
}) {
  const { role, zoneId, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const now = new Date();

  const where: any = {
    isPublished: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  // Role filtering — show announcements that include this role, or have no role filter
  if (role) {
    where.OR = [
      { targetRoles: { isEmpty: true } },
      { targetRoles: { has: role } },
    ];
    // Re-add the expires filter
    where.AND = [
      { isPublished: true },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ];
  }

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
