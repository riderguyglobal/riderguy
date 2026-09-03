// ============================================================
// Event Service — Sprint 12
// Community events: CRUD, RSVP, listing
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

// ────── Create Event ──────

export async function createEvent(
  createdById: string,
  data: {
    title: string;
    description: string;
    type?: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
    date: string;
    endDate?: string;
    location?: string;
    virtualLink?: string;
    imageUrl?: string;
    zoneId?: string;
    capacity?: number;
  },
  auditContext?: AdminAuditContext,
) {
  // Validate date is in the future
  const eventDate = new Date(data.date);
  if (eventDate <= new Date()) {
    throw ApiError.badRequest('Event date must be in the future');
  }

  // Validate endDate > date if provided
  if (data.endDate && new Date(data.endDate) <= eventDate) {
    throw ApiError.badRequest('End date must be after start date');
  }

  // Validate capacity > 0 if provided
  if (data.capacity !== undefined && data.capacity !== null && data.capacity < 1) {
    throw ApiError.badRequest('Capacity must be at least 1');
  }

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type ?? 'IN_PERSON',
        date: new Date(data.date),
        endDate: data.endDate ? new Date(data.endDate) : null,
        location: data.location,
        virtualLink: data.virtualLink,
        imageUrl: data.imageUrl,
        zoneId: data.zoneId,
        capacity: data.capacity,
        createdById,
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
        zone: { select: { id: true, name: true } },
        _count: { select: { rsvps: true } },
      },
    });
    if (auditContext) {
      await AdminAuditService.record(
        {
          ...auditContext,
          action: 'RIDER_EVENT_CREATED',
          entityType: 'Event',
          entityId: created.id,
          newData: {
            title: created.title,
            type: created.type,
            date: created.date,
            status: created.status,
          },
        },
        tx,
      );
    }
    return created;
  });

  logger.info(`Event created: "${event.title}" by ${createdById}`);
  return event;
}

// ────── Update Event ──────

export async function updateEvent(
  eventId: string,
  userId: string,
  isAdmin: boolean,
  data: {
    title?: string;
    description?: string;
    type?: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
    status?: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
    date?: string;
    endDate?: string;
    location?: string;
    virtualLink?: string;
    imageUrl?: string;
    zoneId?: string;
    capacity?: number;
  },
  auditContext?: AdminAuditContext,
) {
  const updated = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) throw ApiError.notFound('Event not found');
    if (!isAdmin && event.createdById !== userId) {
      throw ApiError.forbidden('Only the event creator or an admin can update this event');
    }

    // Validate status transitions. Repeating the already-current status is a
    // safe retry, while competing terminal decisions are rejected by the CAS.
    if (data.status && data.status !== event.status) {
      const validTransitions: Record<string, string[]> = {
        UPCOMING: ['ONGOING', 'CANCELLED'],
        ONGOING: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: [],
      };
      const allowed = validTransitions[event.status] || [];
      if (!allowed.includes(data.status)) {
        throw ApiError.badRequest(`Cannot transition from ${event.status} to ${data.status}`);
      }
    }

    // Compare the effective pair, not only fields supplied together. This
    // prevents a partial edit from placing the end before the persisted start.
    const effectiveStart = data.date ? new Date(data.date) : event.date;
    const effectiveEnd = data.endDate ? new Date(data.endDate) : event.endDate;
    if (effectiveEnd && effectiveEnd <= effectiveStart) {
      throw ApiError.badRequest('End date must be after start date');
    }

    const updateData = {
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.type && { type: data.type }),
      ...(data.status && data.status !== event.status && { status: data.status }),
      ...(data.date && { date: new Date(data.date) }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null,
      }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.virtualLink !== undefined && { virtualLink: data.virtualLink }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.zoneId !== undefined && { zoneId: data.zoneId || null }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
    };

    if (Object.keys(updateData).length === 0) {
      const unchanged = await tx.event.findUnique({
        where: { id: eventId },
        include: {
          createdBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
          zone: { select: { id: true, name: true } },
          _count: { select: { rsvps: true } },
        },
      });
      if (!unchanged) throw ApiError.notFound('Event not found');
      return unchanged;
    }

    const changed = await tx.event.updateMany({
      where: { id: eventId, status: event.status, updatedAt: event.updatedAt },
      data: updateData,
    });
    if (changed.count !== 1) {
      throw ApiError.conflict(
        'This event changed while it was being edited. Refresh and try again.',
        'EVENT_CHANGED',
      );
    }

    const result = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        createdBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
        zone: { select: { id: true, name: true } },
        _count: { select: { rsvps: true } },
      },
    });
    if (!result) throw ApiError.notFound('Event not found');

    if (auditContext) {
      await AdminAuditService.record(
        {
          ...auditContext,
          action: 'RIDER_EVENT_UPDATED',
          entityType: 'Event',
          entityId: eventId,
          oldData: {
            title: event.title,
            type: event.type,
            status: event.status,
            date: event.date,
            endDate: event.endDate,
          },
          newData: data,
        },
        tx,
      );
    }

    return result;
  });

  logger.info(`Event ${eventId} updated`);
  return updated;
}

// ────── List Events ──────

export async function listEvents(opts: {
  status?: string;
  zoneId?: string;
  type?: string;
  page: number;
  limit: number;
  viewerUserId?: string;
  deriveRiderZone?: boolean;
  operationalOnly?: boolean;
}) {
  const {
    status,
    zoneId,
    type,
    page,
    limit,
    viewerUserId,
    deriveRiderZone = false,
    operationalOnly = false,
  } = opts;
  const skip = (page - 1) * limit;
  const now = new Date();

  // Rider audience scope is derived from the authenticated Rider profile.
  // A caller-supplied zone must never reveal another zone's private events.
  const riderZone = deriveRiderZone
    ? await prisma.riderProfile.findUnique({
        where: { userId: viewerUserId },
        select: { currentZoneId: true },
      })
    : null;

  const where: any = {
    ...(status
      ? { status }
      : operationalOnly
        ? {
            OR: [{ status: 'ONGOING' }, { status: 'UPCOMING', date: { gte: now } }],
          }
        : {}),
    ...(deriveRiderZone
      ? {
          OR: [
            { zoneId: null },
            ...(riderZone?.currentZoneId ? [{ zoneId: riderZone.currentZoneId }] : []),
          ],
        }
      : zoneId
        ? { zoneId }
        : {}),
    ...(type && { type }),
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: operationalOnly
        ? [{ status: 'desc' }, { date: 'asc' }]
        : [{ date: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
        zone: { select: { id: true, name: true } },
        _count: { select: { rsvps: true } },
        ...(viewerUserId
          ? {
              rsvps: {
                where: { userId: viewerUserId },
                select: { id: true },
                take: 1,
              },
            }
          : {}),
      },
    }),
    prisma.event.count({ where }),
  ]);

  const audienceEvents = events.map((event: any) => {
    const { rsvps, ...visibleEvent } = event;
    return { ...visibleEvent, hasRsvp: Array.isArray(rsvps) && rsvps.length > 0 };
  });

  return { events: audienceEvents, total, page, totalPages: Math.ceil(total / limit) };
}

// ────── Get Single Event ──────

export async function getEventById(eventId: string, userId?: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      createdBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
      zone: { select: { id: true, name: true } },
      rsvps: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      },
      _count: { select: { rsvps: true } },
    },
  });
  if (!event) throw ApiError.notFound('Event not found');

  // Check if current user has RSVP'd
  let hasRsvp = false;
  if (userId) {
    const rsvp = await prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    hasRsvp = !!rsvp;
  }

  return { ...event, hasRsvp };
}

// ────── RSVP ──────

export async function rsvpToEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound('Event not found');
  if (event.status === 'CANCELLED') throw ApiError.badRequest('Event is cancelled');
  if (event.status === 'COMPLETED') throw ApiError.badRequest('Event has already ended');

  // Block RSVP to past events
  if (new Date(event.date) < new Date()) {
    throw ApiError.badRequest('Cannot RSVP to a past event');
  }

  // Check capacity
  if (event.capacity) {
    const rsvpCount = await prisma.eventRsvp.count({ where: { eventId } });
    if (rsvpCount >= event.capacity) {
      throw ApiError.badRequest('Event is at full capacity');
    }
  }

  // Upsert (idempotent)
  const rsvp = await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId },
    update: {},
  });

  logger.info(`User ${userId} RSVP'd to event ${eventId}`);
  return rsvp;
}

export async function cancelRsvp(eventId: string, userId: string) {
  const rsvp = await prisma.eventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!rsvp) throw ApiError.notFound('RSVP not found');

  await prisma.eventRsvp.delete({
    where: { eventId_userId: { eventId, userId } },
  });

  logger.info(`User ${userId} cancelled RSVP for event ${eventId}`);
  return { success: true };
}
