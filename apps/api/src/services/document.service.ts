// ============================================================
// DocumentService — Document upload, retrieval, and review
//
// Handles rider document uploads (ID, licence, insurance, etc.)
// with file validation, storage delegation, and admin review.
// ============================================================

import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';
import { StorageService } from './storage.service';
import type { DocumentType, DocumentStatus } from '@prisma/client';
import { OnboardingService } from './onboarding.service';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

// --------------- types ------------------------------------------------

export interface CreateDocumentInput {
  userId: string;
  type: DocumentType;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ReviewDocumentInput {
  documentId: string;
  reviewerId: string;
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  auditContext?: AdminAuditContext;
}

// --------------- service class ----------------------------------------

export class DocumentService {
  // ---- Upload a document ----
  static async upload(input: CreateDocumentInput) {
    // Validate file type
    if (!StorageService.isAllowedDocumentType(input.mimeType)) {
      throw ApiError.badRequest(
        'Invalid file type. Allowed: JPEG, PNG, WebP, PDF.',
        'INVALID_FILE_TYPE',
      );
    }

    // Check for existing document of same type (replace flow)
    const existing = await prisma.document.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] },
      },
    });

    // Upload to storage
    const uploadResult = await StorageService.upload(
      input.buffer,
      input.originalName,
      input.mimeType,
      StorageService.ownerFolder('documents', input.userId),
    );

    // If replacing, delete old file & record first, then create new
    if (existing) {
      await StorageService.delete(existing.fileUrl).catch(() => {});
      await prisma.document.delete({ where: { id: existing.id } });
    }

    const doc = await prisma.document.create({
      data: {
        userId: input.userId,
        type: input.type,
        fileUrl: uploadResult.url,
        fileName: input.originalName,
        fileSizeBytes: uploadResult.sizeBytes,
        mimeType: input.mimeType,
        status: 'PENDING',
      },
    });

    // Update rider onboarding status if appropriate
    await DocumentService.updateOnboardingStatus(input.userId);

    return doc;
  }

  // ---- List documents for a user ----
  static async listByUser(userId: string) {
    return prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- Get single document ----
  static async getById(documentId: string) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    });

    if (!doc) {
      throw ApiError.notFound('Document not found');
    }

    return doc;
  }

  // ---- Admin: review a document ----
  static async review(input: ReviewDocumentInput) {
    const doc = await prisma.document.findUnique({
      where: { id: input.documentId },
    });

    if (!doc) {
      throw ApiError.notFound('Document not found');
    }

    if (doc.status !== 'PENDING' && doc.status !== 'UNDER_REVIEW') {
      throw ApiError.badRequest('Document cannot be reviewed in its current status');
    }

    const rejectionReason = input.rejectionReason?.trim();
    if (input.status === 'REJECTED' && (!rejectionReason || rejectionReason.length < 5)) {
      throw ApiError.badRequest('A meaningful rejection reason is required.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reviewedAt = new Date();
      const changed = await tx.document.updateMany({
        where: { id: input.documentId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
        data: {
          status: input.status as DocumentStatus,
          reviewedBy: input.reviewerId,
          reviewedAt,
          rejectionReason: input.status === 'REJECTED' ? rejectionReason! : null,
        },
      });
      if (changed.count !== 1) {
        throw ApiError.conflict('This document was reviewed by another administrator. Refresh the case.');
      }
      const reviewed = await tx.document.findUnique({ where: { id: input.documentId } });
      if (!reviewed) throw ApiError.notFound('Document not found');
      await AdminAuditService.record({
        actorUserId: input.reviewerId,
        ipAddress: input.auditContext?.ipAddress,
        userAgent: input.auditContext?.userAgent,
        action: input.status === 'APPROVED' ? 'rider_document.approved' : 'rider_document.rejected',
        entityType: 'Document',
        entityId: doc.id,
        oldData: { riderUserId: doc.userId, type: doc.type, status: doc.status },
        newData: {
          riderUserId: doc.userId,
          type: doc.type,
          status: reviewed.status,
          rejectionReason: reviewed.rejectionReason,
          reviewedAt,
        },
      }, tx);
      return reviewed;
    });

    // Update rider onboarding status
    await DocumentService.updateOnboardingStatus(doc.userId);

    return updated;
  }

  // ---- Admin: list pending documents for review ----
  static async listPending(page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const [docs, total] = await Promise.all([
      prisma.document.findMany({
        where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatarUrl: true,
              riderProfile: { select: { id: true, onboardingStatus: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.document.count({
        where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      }),
    ]);

    return {
      data: docs,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ---- Admin: list all documents for a specific rider ----
  static async listByRider(userId: string) {
    return prisma.document.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // ---- Update onboarding status based on document states ----
  private static async updateOnboardingStatus(userId: string) {
    await OnboardingService.recalculateStatus(userId);
  }
}
