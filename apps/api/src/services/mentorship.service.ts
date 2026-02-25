// ============================================================
// Mentorship Service — Sprint 12
// Mentor matching, pairing, check-ins
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';

// ────── Search for Mentors ──────

export async function searchMentors(opts: {
  zoneId?: string;
  minLevel?: number;
  minDeliveries?: number;
  page: number;
  limit: number;
  excludeRiderId?: string;
}) {
  const { zoneId, minLevel, minDeliveries, page, limit, excludeRiderId } = opts;
  const skip = (page - 1) * limit;

  const effectiveMinLevel = Math.max(minLevel ?? 3, 3); // Mentors must be level 3+
  const where: any = {
    isVerified: true,
    onboardingStatus: 'COMPLETED',
    ...(zoneId && { currentZoneId: zoneId }),
    ...(minDeliveries && { totalDeliveries: { gte: minDeliveries } }),
    ...(excludeRiderId && { id: { not: excludeRiderId } }),
    currentLevel: { gte: effectiveMinLevel },
  };

  const [mentors, total] = await Promise.all([
    prisma.riderProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ currentLevel: 'desc' }, { totalDeliveries: 'desc' }],
      select: {
        id: true,
        userId: true,
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        currentLevel: true,
        totalDeliveries: true,
        averageRating: true,
        currentZone: { select: { id: true, name: true } },
        bio: true,
        // Count active menteeships
        mentorships: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
    }),
    prisma.riderProfile.count({ where }),
  ]);

  return {
    mentors: mentors.map((m) => ({
      ...m,
      activeMenteeCount: m.mentorships.length,
      mentorships: undefined,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ────── Request Mentorship ──────

export async function requestMentorship(menteeRiderId: string, mentorRiderId: string) {
  // Can't mentor yourself
  if (menteeRiderId === mentorRiderId) {
    throw ApiError.badRequest('You cannot mentor yourself');
  }

  // Check mentor exists and is level 3+
  const mentor = await prisma.riderProfile.findUnique({
    where: { id: mentorRiderId },
    select: { id: true, currentLevel: true, userId: true },
  });
  if (!mentor) throw ApiError.notFound('Mentor not found');
  if (mentor.currentLevel < 3) throw ApiError.badRequest('Mentor must be level 3 or above');

  // Check for existing mentorship between these two
  const existing = await prisma.mentorship.findUnique({
    where: { mentorId_menteeId: { mentorId: mentorRiderId, menteeId: menteeRiderId } },
  });
  if (existing && (existing.status === 'PENDING' || existing.status === 'ACTIVE')) {
    throw ApiError.conflict('You already have a pending or active mentorship with this rider');
  }

  // Limit mentees per mentor (max 5 active)
  const activeMenteeCount = await prisma.mentorship.count({
    where: { mentorId: mentorRiderId, status: 'ACTIVE' },
  });
  if (activeMenteeCount >= 5) {
    throw ApiError.badRequest('This mentor has reached their maximum number of mentees');
  }

  // Get mentee's zone for auto-tagging
  const mentee = await prisma.riderProfile.findUnique({
    where: { id: menteeRiderId },
    select: { currentZoneId: true },
  });

  // Use upsert to handle re-requesting after CANCELLED/COMPLETED
  const mentorship = await prisma.mentorship.upsert({
    where: { mentorId_menteeId: { mentorId: mentorRiderId, menteeId: menteeRiderId } },
    create: {
      mentorId: mentorRiderId,
      menteeId: menteeRiderId,
      zoneId: mentee?.currentZoneId ?? null,
      status: 'PENDING',
    },
    update: {
      status: 'PENDING',
      zoneId: mentee?.currentZoneId ?? null,
      startedAt: null,
      completedAt: null,
      completionNote: null,
    },
    include: {
      mentor: {
        select: {
          user: { select: { firstName: true, lastName: true } },
          currentLevel: true,
        },
      },
      mentee: {
        select: {
          user: { select: { firstName: true, lastName: true } },
          currentLevel: true,
        },
      },
    },
  });

  logger.info(`Mentorship requested: mentee ${menteeRiderId} → mentor ${mentorRiderId}`);
  return mentorship;
}

// ────── Update Mentorship Status ──────

export async function updateMentorshipStatus(
  mentorshipId: string,
  userId: string,
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
  completionNote?: string,
) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    include: {
      mentor: { select: { userId: true } },
      mentee: { select: { userId: true } },
    },
  });
  if (!mentorship) throw ApiError.notFound('Mentorship not found');

  // Only the mentor can accept (ACTIVE), both can cancel, both can complete
  const isMentor = mentorship.mentor.userId === userId;
  const isMentee = mentorship.mentee.userId === userId;
  if (!isMentor && !isMentee) throw ApiError.forbidden('Not a participant of this mentorship');

  if (status === 'ACTIVE' && !isMentor) {
    throw ApiError.forbidden('Only the mentor can accept a mentorship request');
  }

  // Validate transitions
  if (status === 'ACTIVE' && mentorship.status !== 'PENDING') {
    throw ApiError.badRequest('Can only accept pending mentorships');
  }
  if (status === 'COMPLETED' && mentorship.status !== 'ACTIVE') {
    throw ApiError.badRequest('Can only complete active mentorships');
  }
  if (status === 'CANCELLED' && mentorship.status === 'COMPLETED') {
    throw ApiError.badRequest('Cannot cancel a completed mentorship');
  }
  if (status === 'CANCELLED' && mentorship.status === 'CANCELLED') {
    throw ApiError.badRequest('Mentorship is already cancelled');
  }

  const updated = await prisma.mentorship.update({
    where: { id: mentorshipId },
    data: {
      status,
      ...(status === 'ACTIVE' && { startedAt: new Date() }),
      ...(status === 'COMPLETED' && { completedAt: new Date(), completionNote }),
      ...(status === 'CANCELLED' && { completionNote }),
    },
    include: {
      mentor: {
        select: {
          user: { select: { firstName: true, lastName: true } },
          currentLevel: true,
        },
      },
      mentee: {
        select: {
          user: { select: { firstName: true, lastName: true } },
          currentLevel: true,
        },
      },
    },
  });

  logger.info(`Mentorship ${mentorshipId} status → ${status}`);
  return updated;
}

// ────── Get Rider's Mentorships ──────

export async function getMyMentorships(riderId: string) {
  const [asMentor, asMentee] = await Promise.all([
    prisma.mentorship.findMany({
      where: { mentorId: riderId },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        mentee: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            currentLevel: true,
            totalDeliveries: true,
          },
        },
        zone: { select: { id: true, name: true } },
        _count: { select: { checkIns: true } },
      },
    }),
    prisma.mentorship.findMany({
      where: { menteeId: riderId },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        mentor: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            currentLevel: true,
            totalDeliveries: true,
            averageRating: true,
          },
        },
        zone: { select: { id: true, name: true } },
        _count: { select: { checkIns: true } },
      },
    }),
  ]);

  return { asMentor, asMentee };
}

// ────── Check-ins ──────

export async function createCheckIn(
  mentorshipId: string,
  authorUserId: string,
  note: string,
  rating?: number,
) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    include: {
      mentor: { select: { userId: true } },
      mentee: { select: { userId: true } },
    },
  });
  if (!mentorship) throw ApiError.notFound('Mentorship not found');
  if (mentorship.status !== 'ACTIVE') throw ApiError.badRequest('Mentorship is not active');

  const isParticipant =
    mentorship.mentor.userId === authorUserId || mentorship.mentee.userId === authorUserId;
  if (!isParticipant) throw ApiError.forbidden('Not a participant');

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    throw ApiError.badRequest('Rating must be between 1 and 5');
  }

  const checkIn = await prisma.mentorCheckIn.create({
    data: {
      mentorshipId,
      authorId: authorUserId,
      note,
      rating,
    },
  });

  logger.info(`Check-in created for mentorship ${mentorshipId}`);
  return checkIn;
}

export async function getCheckIns(mentorshipId: string, userId: string) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    include: {
      mentor: { select: { userId: true } },
      mentee: { select: { userId: true } },
    },
  });
  if (!mentorship) throw ApiError.notFound('Mentorship not found');

  const isParticipant =
    mentorship.mentor.userId === userId || mentorship.mentee.userId === userId;
  if (!isParticipant) throw ApiError.forbidden('Not a participant');

  return prisma.mentorCheckIn.findMany({
    where: { mentorshipId },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
}

// ────── Get single mentorship ──────

export async function getMentorshipById(mentorshipId: string, userId: string) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    include: {
      mentor: {
        select: {
          id: true,
          userId: true,
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          currentLevel: true,
          totalDeliveries: true,
          averageRating: true,
          bio: true,
        },
      },
      mentee: {
        select: {
          id: true,
          userId: true,
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          currentLevel: true,
          totalDeliveries: true,
        },
      },
      zone: { select: { id: true, name: true } },
      checkIns: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!mentorship) throw ApiError.notFound('Mentorship not found');

  const isParticipant =
    mentorship.mentor.userId === userId || mentorship.mentee.userId === userId;
  if (!isParticipant) throw ApiError.forbidden('Not a participant');

  return mentorship;
}
