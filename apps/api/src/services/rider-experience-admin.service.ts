import type { Prisma } from '@prisma/client';
import { prisma } from '@riderguy/database';
import type { AdminMentorshipListQuery, AdminMentorshipStatusInput } from '@riderguy/validators';
import { ApiError } from '../lib/api-error';
import type { AdminAuditContext } from './admin-audit.service';
import { AdminAuditService } from './admin-audit.service';
import { NotificationService } from './notification.service';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';

const participantSelect = {
  id: true,
  userId: true,
  currentLevel: true,
  totalDeliveries: true,
  averageRating: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.RiderProfileSelect;

export class RiderExperienceAdminService {
  static async getSummary() {
    const now = new Date();
    const [
      publishedAnnouncements,
      pendingReports,
      upcomingEvents,
      pendingMentorships,
      activeMentorships,
      openInvestigations,
      pendingAppeals,
      trainingReviews,
      financingReviews,
    ] = await Promise.all([
      prisma.announcement.count({
        where: {
          isPublished: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      prisma.contentReport.count({ where: { status: 'PENDING' } }),
      prisma.event.count({ where: { status: 'UPCOMING', date: { gte: now } } }),
      prisma.mentorship.count({ where: { status: 'PENDING' } }),
      prisma.mentorship.count({ where: { status: 'ACTIVE' } }),
      prisma.cancellationRecord.count({
        where: { requiresInvestigation: true, investigationNotes: null },
      }),
      prisma.cancellationAppeal.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
      prisma.riderTrainingCompletion.count({ where: { verifiedAt: null } }),
      prisma.assetFinancingInterest.count({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      communications: { publishedAnnouncements },
      community: { pendingReports, upcomingEvents, pendingMentorships, activeMentorships },
      welfare: { openInvestigations, pendingAppeals },
      development: { trainingReviews, financingReviews },
    };
  }

  static async listMentorships(input: AdminMentorshipListQuery) {
    const { page, limit, status, search } = input;
    const where: Prisma.MentorshipWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { mentor: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
              { mentor: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
              { mentee: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
              { mentee: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.mentorship.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        include: {
          mentor: { select: participantSelect },
          mentee: { select: participantSelect },
          zone: { select: { id: true, name: true } },
          _count: { select: { checkIns: true } },
        },
      }),
      prisma.mentorship.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async updateMentorship(
    id: string,
    input: AdminMentorshipStatusInput,
    audit: AdminAuditContext,
  ) {
    const decision = await prisma.$transaction(async (tx) => {
      await acquireTransactionAdvisoryLock(tx, 'mentorship-admin-decision', id);

      const existing = await tx.mentorship.findUnique({
        where: { id },
        include: {
          mentor: { select: { userId: true } },
          mentee: { select: { userId: true } },
        },
      });
      if (!existing) throw ApiError.notFound('Mentorship not found');

      if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
        throw ApiError.conflict(
          `A ${existing.status.toLowerCase()} mentorship cannot be changed`,
          'MENTORSHIP_ALREADY_DECIDED',
        );
      }
      if (input.status === 'ACTIVE' && existing.status !== 'PENDING') {
        throw ApiError.conflict('Only a pending mentorship can be activated');
      }
      if (input.status === 'COMPLETED' && existing.status !== 'ACTIVE') {
        throw ApiError.conflict('Only an active mentorship can be completed');
      }

      const changed = await tx.mentorship.updateMany({
        where: { id, status: existing.status },
        data: {
          status: input.status,
          completionNote: input.note,
          ...(input.status === 'ACTIVE' ? { startedAt: new Date() } : {}),
          ...(input.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        },
      });
      if (changed.count !== 1) {
        throw ApiError.conflict(
          'This mentorship changed while it was being reviewed. Refresh and try again.',
          'MENTORSHIP_DECISION_CONFLICT',
        );
      }

      const result = await tx.mentorship.findUnique({
        where: { id },
        include: {
          mentor: { select: participantSelect },
          mentee: { select: participantSelect },
          zone: { select: { id: true, name: true } },
          _count: { select: { checkIns: true } },
        },
      });
      if (!result) throw ApiError.conflict('This mentorship is no longer available');

      await AdminAuditService.record(
        {
          ...audit,
          action: 'MENTORSHIP_STATUS_CHANGED',
          entityType: 'Mentorship',
          entityId: id,
          oldData: { status: existing.status },
          newData: { status: input.status, note: input.note },
        },
        tx,
      );

      return {
        result,
        mentorUserId: existing.mentor.userId,
        menteeUserId: existing.mentee.userId,
      };
    });

    const statusLabel = input.status.toLowerCase().replace('_', ' ');
    await Promise.allSettled([
      NotificationService.create({
        userId: decision.mentorUserId,
        title: 'Mentorship updated',
        body: `RiderGuy has marked this mentorship as ${statusLabel}.`,
        type: 'SYSTEM',
        data: { mentorshipId: id, status: input.status },
      }),
      NotificationService.create({
        userId: decision.menteeUserId,
        title: 'Mentorship updated',
        body: `RiderGuy has marked this mentorship as ${statusLabel}.`,
        type: 'SYSTEM',
        data: { mentorshipId: id, status: input.status },
      }),
    ]);

    return decision.result;
  }
}
