// ============================================================
// Mentorship Service — Sprint 12
// Mentor matching, pairing, check-ins
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';
import { riderWorkEligibilityWhere } from './rider-work-eligibility';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import { NotificationService } from './notification.service';

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
    ...riderWorkEligibilityWhere(),
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

  // Both sides must still satisfy the same live work/compliance boundary used
  // by dispatch. An administrator restriction or evidence revocation must not
  // leave a Rider discoverable or able to start a new mentorship by direct API.
  const [mentee, mentor] = await Promise.all([
    prisma.riderProfile.findFirst({
      where: { id: menteeRiderId, ...riderWorkEligibilityWhere() },
      select: { id: true, currentZoneId: true },
    }),
    prisma.riderProfile.findFirst({
      where: {
        id: mentorRiderId,
        currentLevel: { gte: 3 },
        ...riderWorkEligibilityWhere(),
      },
      select: { id: true, currentLevel: true, userId: true },
    }),
  ]);
  if (!mentee) throw ApiError.forbidden('Complete Rider activation before requesting mentorship');
  if (!mentor) throw ApiError.notFound('An eligible mentor was not found');

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
  await NotificationService.create({
    userId: mentor.userId,
    title: 'New mentorship request',
    body: 'A Rider has asked you to be their RiderGuy mentor. Open Mentorship to respond.',
    type: 'COMMUNITY',
    data: { mentorshipId: mentorship.id, status: 'PENDING' },
  }).catch((error) => {
    logger.error({ error, mentorshipId: mentorship.id }, 'Mentorship request notification failed');
  });

  return mentorship;
}

// ────── Update Mentorship Status ──────

export async function updateMentorshipStatus(
  mentorshipId: string,
  userId: string,
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
  completionNote?: string,
) {
  const decision = await prisma.$transaction(async (tx) => {
    // Participant and administrator decisions share one lock namespace, so
    // accept/complete/cancel cannot overwrite a simultaneous admin outcome.
    await acquireTransactionAdvisoryLock(tx, 'mentorship-admin-decision', mentorshipId);

    const mentorship = await tx.mentorship.findUnique({
      where: { id: mentorshipId },
      include: {
        mentor: { select: { userId: true } },
        mentee: { select: { userId: true } },
      },
    });
    if (!mentorship) throw ApiError.notFound('Mentorship not found');

    const isMentor = mentorship.mentor.userId === userId;
    const isMentee = mentorship.mentee.userId === userId;
    if (!isMentor && !isMentee) {
      throw ApiError.forbidden('Not a participant of this mentorship');
    }
    if (status === 'ACTIVE' && !isMentor) {
      throw ApiError.forbidden('Only the mentor can accept a mentorship request');
    }
    if (status === 'ACTIVE' && mentorship.status !== 'PENDING') {
      throw ApiError.conflict('Can only accept pending mentorships');
    }
    if (status === 'COMPLETED' && mentorship.status !== 'ACTIVE') {
      throw ApiError.conflict('Can only complete active mentorships');
    }
    if (status === 'CANCELLED' && !['PENDING', 'ACTIVE'].includes(mentorship.status)) {
      throw ApiError.conflict(
        `A ${mentorship.status.toLowerCase()} mentorship cannot be cancelled`,
      );
    }

    const now = new Date();
    const changed = await tx.mentorship.updateMany({
      where: { id: mentorshipId, status: mentorship.status },
      data: {
        status,
        ...(status === 'ACTIVE' ? { startedAt: now } : {}),
        ...(status === 'COMPLETED' ? { completedAt: now, completionNote } : {}),
        ...(status === 'CANCELLED' ? { completionNote } : {}),
      },
    });
    if (changed.count !== 1) {
      throw ApiError.conflict(
        'This mentorship changed while you were updating it. Refresh and try again.',
        'MENTORSHIP_DECISION_CONFLICT',
      );
    }

    const updated = await tx.mentorship.findUnique({
      where: { id: mentorshipId },
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
    if (!updated) throw ApiError.conflict('This mentorship is no longer available');

    return {
      updated,
      counterpartUserId: isMentor ? mentorship.mentee.userId : mentorship.mentor.userId,
    };
  });

  await NotificationService.create({
    userId: decision.counterpartUserId,
    title: 'Mentorship updated',
    body: `Your RiderGuy mentorship was marked ${status.toLowerCase()} by the other participant.`,
    type: 'COMMUNITY',
    data: { mentorshipId, status },
  }).catch((error) => {
    logger.error({ error, mentorshipId }, 'Mentorship notification failed after commit');
  });

  logger.info(`Mentorship ${mentorshipId} status → ${status}`);
  return decision.updated;
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

  const isParticipant = mentorship.mentor.userId === userId || mentorship.mentee.userId === userId;
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

  const isParticipant = mentorship.mentor.userId === userId || mentorship.mentee.userId === userId;
  if (!isParticipant) throw ApiError.forbidden('Not a participant');

  return mentorship;
}
