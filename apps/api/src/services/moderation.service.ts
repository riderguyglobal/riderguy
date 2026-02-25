// ============================================================
// Moderation Service — Sprint 11
// Content reports, review queue, moderation actions
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';

// ────── Report Creation ──────

export async function createReport(data: {
  reporterId: string;
  entityType: 'chat_message' | 'forum_post' | 'forum_comment';
  entityId: string;
  reason: string;
  description?: string;
}) {
  // Check if user already reported this entity
  const existing = await prisma.contentReport.findFirst({
    where: {
      reporterId: data.reporterId,
      entityType: data.entityType,
      entityId: data.entityId,
      status: 'PENDING',
    },
  });

  if (existing) {
    throw ApiError.conflict('You have already reported this content');
  }

  // Verify the entity exists
  if (data.entityType === 'chat_message') {
    const msg = await prisma.chatMessage.findUnique({ where: { id: data.entityId } });
    if (!msg) throw ApiError.notFound('Message not found');
  } else if (data.entityType === 'forum_post') {
    const post = await prisma.forumPost.findUnique({ where: { id: data.entityId } });
    if (!post) throw ApiError.notFound('Post not found');
  } else if (data.entityType === 'forum_comment') {
    const comment = await prisma.forumComment.findUnique({ where: { id: data.entityId } });
    if (!comment) throw ApiError.notFound('Comment not found');
  }

  const report = await prisma.contentReport.create({
    data: {
      reporterId: data.reporterId,
      entityType: data.entityType,
      entityId: data.entityId,
      reason: data.reason as any,
      description: data.description ?? null,
    },
    include: {
      reporter: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  logger.info(
    { reportId: report.id, entityType: data.entityType, entityId: data.entityId },
    'Content report created',
  );

  return formatReport(report);
}

// ────── Admin Queue ──────

export async function listReports(options: {
  status?: string;
  entityType?: string;
  page?: number;
  limit?: number;
}) {
  const { status, entityType, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (entityType) where.entityType = entityType;

  const [reports, total] = await Promise.all([
    prisma.contentReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.contentReport.count({ where }),
  ]);

  return {
    reports: reports.map(formatReport),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function resolveReport(
  reportId: string,
  moderatorId: string,
  data: {
    status: 'REVIEWED' | 'ACTION_TAKEN' | 'DISMISSED';
    moderatorNote?: string;
    actionTaken?: string;
  },
) {
  const report = await prisma.contentReport.findUnique({ where: { id: reportId } });
  if (!report) throw ApiError.notFound('Report not found');

  const updated = await prisma.contentReport.update({
    where: { id: reportId },
    data: {
      status: data.status as any,
      moderatorId,
      moderatorNote: data.moderatorNote ?? null,
      actionTaken: data.actionTaken as any ?? null,
      resolvedAt: new Date(),
    },
    include: {
      reporter: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // If action taken, apply the moderation action
  if (data.actionTaken && data.status === 'ACTION_TAKEN') {
    await applyModerationAction(report.entityType, report.entityId, data.actionTaken);
  }

  logger.info(
    { reportId, status: data.status, actionTaken: data.actionTaken },
    'Content report resolved',
  );

  return formatReport(updated);
}

// ────── Apply Actions ──────

async function applyModerationAction(entityType: string, entityId: string, action: string) {
  try {
    if (entityType === 'chat_message') {
      // Delete the offending message
      await prisma.chatMessage.update({
        where: { id: entityId },
        data: { isDeleted: true, content: '[removed by moderator]' },
      });

      // Apply mute if needed
      if (action.startsWith('MUTE_')) {
        const message = await prisma.chatMessage.findUnique({
          where: { id: entityId },
          select: { senderId: true, roomId: true },
        });
        if (message) {
          const duration = getMuteDuration(action);
          if (duration) {
            await prisma.chatMember.updateMany({
              where: { userId: message.senderId, roomId: message.roomId },
              data: { isMuted: true, mutedUntil: new Date(Date.now() + duration) },
            });
          }
        }
      }
    } else if (entityType === 'forum_post') {
      await prisma.forumPost.update({
        where: { id: entityId },
        data: { isDeleted: true },
      });
    } else if (entityType === 'forum_comment') {
      await prisma.forumComment.update({
        where: { id: entityId },
        data: { isDeleted: true, body: '[removed by moderator]' },
      });
    }
  } catch (err) {
    logger.error({ err, entityType, entityId, action }, 'Failed to apply moderation action');
  }
}

function getMuteDuration(action: string): number | null {
  switch (action) {
    case 'MUTE_1H':
      return 60 * 60 * 1000;
    case 'MUTE_24H':
      return 24 * 60 * 60 * 1000;
    case 'MUTE_7D':
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

// ────── Stats ──────

export async function getModerationStats() {
  const [pending, reviewedToday, actionsTaken] = await Promise.all([
    prisma.contentReport.count({ where: { status: 'PENDING' } }),
    prisma.contentReport.count({
      where: {
        resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        status: { in: ['REVIEWED', 'ACTION_TAKEN', 'DISMISSED'] },
      },
    }),
    prisma.contentReport.count({
      where: { status: 'ACTION_TAKEN' },
    }),
  ]);

  return { pending, reviewedToday, actionsTaken };
}

// ────── Helper ──────

function formatReport(r: any) {
  return {
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    reason: r.reason,
    description: r.description,
    status: r.status,
    moderatorId: r.moderatorId,
    moderatorNote: r.moderatorNote,
    actionTaken: r.actionTaken,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    reporter: r.reporter
      ? { id: r.reporter.id, firstName: r.reporter.firstName, lastName: r.reporter.lastName }
      : null,
    createdAt: r.createdAt.toISOString(),
  };
}
