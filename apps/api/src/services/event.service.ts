// ============================================================
// Event Service — Sprint 12
// Community events: CRUD, RSVP, listing
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';

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
) {
  const event = await prisma.event.create({
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
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound('Event not found');
  if (!isAdmin && event.createdById !== userId) {
    throw ApiError.forbidden('Only the event creator or an admin can update this event');
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.type && { type: data.type }),
      ...(data.status && { status: data.status }),
      ...(data.date && { date: new Date(data.date) }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.virtualLink !== undefined && { virtualLink: data.virtualLink }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.zoneId !== undefined && { zoneId: data.zoneId || null }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
    },
    include: {
      createdBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
      zone: { select: { id: true, name: true } },
      _count: { select: { rsvps: true } },
    },
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
}) {
  const { status, zoneId, type, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: any = {
    ...(status && { status }),
    ...(zoneId && { zoneId }),
    ...(type && { type }),
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'asc' },
      include: {
        createdBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
        zone: { select: { id: true, name: true } },
        _count: { select: { rsvps: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return { events, total, page, totalPages: Math.ceil(total / limit) };
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
