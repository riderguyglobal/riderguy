// ============================================================
// Moderation Service — Sprint 11
// Content reports, review queue, moderation actions
// ============================================================

import { prisma } from '@riderguy/database';
import type { Prisma } from '@prisma/client';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import { NotificationService } from './notification.service';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

const moderationAuthorSelect = {
  id: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

interface ReportedContentSnapshot {
  author: { id: string; firstName: string; lastName: string };
  text: string;
  title?: string;
  mediaUrl?: string | null;
  isDeleted: boolean;
  createdAt: string;
  context?: {
    id: string;
    label: string;
    type?: string;
  };
}

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
  const reportedContent = await loadReportedContent(reports);

  return {
    reports: reports.map((report) =>
      formatReport(
        report,
        reportedContent.get(contentKey(report.entityType, report.entityId)) ?? null,
      ),
    ),
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
  audit: AdminAuditContext,
) {
  if (data.status === 'ACTION_TAKEN' && !data.actionTaken) {
    throw ApiError.badRequest('Choose a supported moderation action');
  }
  if (data.status !== 'ACTION_TAKEN' && data.actionTaken) {
    throw ApiError.badRequest('An action can only be applied with ACTION_TAKEN');
  }

  const decision = await prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'content-report-review', reportId);
    const report = await tx.contentReport.findUnique({ where: { id: reportId } });
    if (!report) throw ApiError.notFound('Report not found');
    if (!['PENDING', 'REVIEWED'].includes(report.status)) {
      throw ApiError.conflict('This content report has already been resolved');
    }

    const offenderUserId = data.actionTaken
      ? await applyModerationAction(tx, report.entityType, report.entityId, data.actionTaken)
      : null;

    const changed = await tx.contentReport.updateMany({
      where: { id: reportId, status: report.status },
      data: {
        status: data.status as any,
        moderatorId,
        moderatorNote: data.moderatorNote?.trim() || null,
        actionTaken: (data.actionTaken as any) ?? null,
        resolvedAt: new Date(),
      },
    });
    if (changed.count !== 1) {
      throw ApiError.conflict('This report changed while it was being reviewed');
    }

    const updated = await tx.contentReport.findUniqueOrThrow({
      where: { id: reportId },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    await AdminAuditService.record(
      {
        ...audit,
        action: 'COMMUNITY_REPORT_RESOLVED',
        entityType: 'ContentReport',
        entityId: reportId,
        oldData: { status: report.status },
        newData: {
          status: updated.status,
          actionTaken: updated.actionTaken,
          moderatorNote: updated.moderatorNote,
        },
      },
      tx,
    );
    return { updated, offenderUserId };
  });

  if (decision.offenderUserId && data.actionTaken) {
    const actionLabel = data.actionTaken.startsWith('MUTE_')
      ? `removed and your room access was muted for ${formatMuteDuration(data.actionTaken)}`
      : 'removed and a formal warning was recorded';
    await NotificationService.create({
      userId: decision.offenderUserId,
      title: 'Community moderation decision',
      body: `Reported content was ${actionLabel}. Please follow the RiderGuy community standards.`,
      type: 'SYSTEM',
      data: { reportId, action: data.actionTaken },
    }).catch((error) => {
      logger.error({ error, reportId }, 'Moderation notification failed after commit');
    });
  }

  logger.info(
    { reportId, status: data.status, actionTaken: data.actionTaken },
    'Content report resolved',
  );

  return formatReport(decision.updated);
}

// ────── Apply Actions ──────

async function applyModerationAction(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string,
  action: string,
): Promise<string> {
  if (entityType === 'chat_message') {
    const message = await tx.chatMessage.findUnique({
      where: { id: entityId },
      select: { senderId: true, roomId: true },
    });
    if (!message) throw ApiError.notFound('Reported chat message no longer exists');

    await tx.chatMessage.update({
      where: { id: entityId },
      data: { isDeleted: true, content: '[removed by moderator]' },
    });
    if (action.startsWith('MUTE_')) {
      const duration = getMuteDuration(action);
      if (!duration) throw ApiError.badRequest('Unsupported mute duration');
      await tx.chatMember.updateMany({
        where: { userId: message.senderId, roomId: message.roomId },
        data: { isMuted: true, mutedUntil: new Date(Date.now() + duration) },
      });
    }
    return message.senderId;
  }

  if (action !== 'WARNING') {
    throw ApiError.badRequest('Mute actions are available only for reported chat messages');
  }
  if (entityType === 'forum_post') {
    const post = await tx.forumPost.findUnique({
      where: { id: entityId },
      select: { authorId: true },
    });
    if (!post) throw ApiError.notFound('Reported forum post no longer exists');
    await tx.forumPost.update({ where: { id: entityId }, data: { isDeleted: true } });
    return post.authorId;
  }
  if (entityType === 'forum_comment') {
    const comment = await tx.forumComment.findUnique({
      where: { id: entityId },
      select: { authorId: true },
    });
    if (!comment) throw ApiError.notFound('Reported forum comment no longer exists');
    await tx.forumComment.update({
      where: { id: entityId },
      data: { isDeleted: true, body: '[removed by moderator]' },
    });
    return comment.authorId;
  }
  throw ApiError.badRequest('Unsupported reported content type');
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

function formatMuteDuration(action: string): string {
  if (action === 'MUTE_1H') return '1 hour';
  if (action === 'MUTE_24H') return '24 hours';
  if (action === 'MUTE_7D') return '7 days';
  return 'the selected period';
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

function contentKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

async function loadReportedContent(
  reports: Array<{ entityType: string; entityId: string }>,
): Promise<Map<string, ReportedContentSnapshot>> {
  const idsFor = (entityType: string) => [
    ...new Set(
      reports.filter((report) => report.entityType === entityType).map((report) => report.entityId),
    ),
  ];
  const postIds = idsFor('forum_post');
  const commentIds = idsFor('forum_comment');
  const messageIds = idsFor('chat_message');

  const [posts, comments, messages] = await Promise.all([
    postIds.length
      ? prisma.forumPost.findMany({
          where: { id: { in: postIds } },
          select: {
            id: true,
            title: true,
            body: true,
            isDeleted: true,
            createdAt: true,
            author: { select: moderationAuthorSelect },
          },
        })
      : Promise.resolve([]),
    commentIds.length
      ? prisma.forumComment.findMany({
          where: { id: { in: commentIds } },
          select: {
            id: true,
            body: true,
            isDeleted: true,
            createdAt: true,
            author: { select: moderationAuthorSelect },
            post: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    messageIds.length
      ? prisma.chatMessage.findMany({
          where: { id: { in: messageIds } },
          select: {
            id: true,
            content: true,
            mediaUrl: true,
            isDeleted: true,
            createdAt: true,
            sender: { select: moderationAuthorSelect },
            room: { select: { id: true, name: true, type: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const snapshots = new Map<string, ReportedContentSnapshot>();
  posts.forEach((post) => {
    snapshots.set(contentKey('forum_post', post.id), {
      author: post.author,
      title: post.title,
      text: post.body,
      isDeleted: post.isDeleted,
      createdAt: post.createdAt.toISOString(),
    });
  });
  comments.forEach((comment) => {
    snapshots.set(contentKey('forum_comment', comment.id), {
      author: comment.author,
      text: comment.body,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt.toISOString(),
      context: {
        id: comment.post.id,
        label: comment.post.title,
        type: 'forum_post',
      },
    });
  });
  messages.forEach((message) => {
    snapshots.set(contentKey('chat_message', message.id), {
      author: message.sender,
      text: message.content,
      mediaUrl: message.mediaUrl,
      isDeleted: message.isDeleted,
      createdAt: message.createdAt.toISOString(),
      context: {
        id: message.room.id,
        label: message.room.name,
        type: message.room.type,
      },
    });
  });

  return snapshots;
}

function formatReport(r: any, reportedContent?: ReportedContentSnapshot | null) {
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
    reportedContent: reportedContent ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}
