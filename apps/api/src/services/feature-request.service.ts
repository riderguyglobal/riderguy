// ============================================================
// Feature Request Service — Sprint 12
// CRUD, upvoting, admin status management
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';

// ────── Create Feature Request ──────

export async function createFeatureRequest(
  authorId: string,
  title: string,
  description: string,
) {
  const request = await prisma.featureRequest.create({
    data: { authorId, title, description },
    include: {
      author: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  logger.info(`Feature request created: "${title}" by ${authorId}`);
  return request;
}

// ────── List Feature Requests ──────

export async function listFeatureRequests(opts: {
  status?: string;
  sort: string;
  page: number;
  limit: number;
  userId?: string;
}) {
  const { status, sort, page, limit, userId } = opts;
  const skip = (page - 1) * limit;

  const where: any = {
    ...(status && { status }),
  };

  const orderBy: any =
    sort === 'newest'
      ? { createdAt: 'desc' as const }
      : sort === 'oldest'
        ? { createdAt: 'asc' as const }
        : { upvoteCount: 'desc' as const };

  const [requests, total] = await Promise.all([
    prisma.featureRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        author: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    }),
    prisma.featureRequest.count({ where }),
  ]);

  // If we have a userId, check which ones the user has upvoted
  let upvotedIds: Set<string> = new Set();
  if (userId) {
    const upvotes = await prisma.featureRequestUpvote.findMany({
      where: {
        userId,
        featureRequestId: { in: requests.map((r) => r.id) },
      },
      select: { featureRequestId: true },
    });
    upvotedIds = new Set(upvotes.map((u) => u.featureRequestId));
  }

  return {
    requests: requests.map((r) => ({
      ...r,
      hasUpvoted: upvotedIds.has(r.id),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ────── Get Single Feature Request ──────

export async function getFeatureRequestById(id: string, userId?: string) {
  const request = await prisma.featureRequest.findUnique({
    where: { id },
    include: {
      author: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  });
  if (!request) throw ApiError.notFound('Feature request not found');

  let hasUpvoted = false;
  if (userId) {
    const upvote = await prisma.featureRequestUpvote.findUnique({
      where: { featureRequestId_userId: { featureRequestId: id, userId } },
    });
    hasUpvoted = !!upvote;
  }

  return { ...request, hasUpvoted };
}

// ────── Toggle Upvote ──────

export async function toggleUpvote(featureRequestId: string, userId: string) {
  const request = await prisma.featureRequest.findUnique({
    where: { id: featureRequestId },
  });
  if (!request) throw ApiError.notFound('Feature request not found');

  const existing = await prisma.featureRequestUpvote.findUnique({
    where: { featureRequestId_userId: { featureRequestId, userId } },
  });

  if (existing) {
    // Remove upvote
    await prisma.featureRequestUpvote.delete({
      where: { featureRequestId_userId: { featureRequestId, userId } },
    });
    await prisma.featureRequest.update({
      where: { id: featureRequestId },
      data: { upvoteCount: { decrement: 1 } },
    });
    logger.info(`User ${userId} removed upvote from feature request ${featureRequestId}`);
    return { upvoted: false, newCount: request.upvoteCount - 1 };
  } else {
    // Add upvote
    await prisma.featureRequestUpvote.create({
      data: { featureRequestId, userId },
    });
    await prisma.featureRequest.update({
      where: { id: featureRequestId },
      data: { upvoteCount: { increment: 1 } },
    });
    logger.info(`User ${userId} upvoted feature request ${featureRequestId}`);
    return { upvoted: true, newCount: request.upvoteCount + 1 };
  }
}

// ────── Admin: Update Status ──────

export async function updateFeatureRequestStatus(
  id: string,
  status: string,
  adminNote?: string,
) {
  const request = await prisma.featureRequest.findUnique({ where: { id } });
  if (!request) throw ApiError.notFound('Feature request not found');

  const updated = await prisma.featureRequest.update({
    where: { id },
    data: {
      status: status as any,
      ...(adminNote !== undefined && { adminNote }),
    },
    include: {
      author: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  logger.info(`Feature request ${id} status → ${status}`);
  return updated;
}

// ────── Delete Feature Request (own or admin) ──────

export async function deleteFeatureRequest(id: string, userId: string, isAdmin: boolean) {
  const request = await prisma.featureRequest.findUnique({ where: { id } });
  if (!request) throw ApiError.notFound('Feature request not found');
  if (!isAdmin && request.authorId !== userId) {
    throw ApiError.forbidden('You can only delete your own feature requests');
  }

  await prisma.featureRequest.delete({ where: { id } });
  logger.info(`Feature request ${id} deleted by ${userId}`);
  return { success: true };
}
