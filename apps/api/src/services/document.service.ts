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
      'documents',
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

    if (doc.status === 'APPROVED' || doc.status === 'EXPIRED') {
      throw ApiError.badRequest('Document cannot be reviewed in its current status');
    }

    const updated = await prisma.document.update({
      where: { id: input.documentId },
      data: {
        status: input.status as DocumentStatus,
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
        rejectionReason: input.status === 'REJECTED' ? (input.rejectionReason ?? null) : null,
      },
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
    const riderProfile = await prisma.riderProfile.findUnique({
      where: { userId },
    });

    if (!riderProfile) return;

    const docs = await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (docs.length === 0) return;

    // Required document types for full approval
    const requiredTypes: DocumentType[] = [
      'NATIONAL_ID',
      'DRIVERS_LICENSE',
      'SELFIE',
    ];

    // Deduplicate — keep only the most recent document per type
    const statusMap = new Map<string, string>();
    for (const d of docs) {
      if (!statusMap.has(d.type)) {
        statusMap.set(d.type, d.status);
      }
    }
    const hasAllRequired = requiredTypes.every((t) => statusMap.has(t));
    const allApproved = requiredTypes.every((t) => statusMap.get(t) === 'APPROVED');
    const statuses = Array.from(statusMap.values());
    const anyRejected = statuses.some((s) => s === 'REJECTED');
    const anyPending = statuses.some((s) => s === 'PENDING' || s === 'UNDER_REVIEW');

    let newStatus = riderProfile.onboardingStatus;

    if (allApproved && hasAllRequired) {
      newStatus = 'DOCUMENTS_APPROVED';
    } else if (anyRejected) {
      newStatus = 'DOCUMENTS_REJECTED';
    } else if (hasAllRequired && anyPending) {
      newStatus = 'DOCUMENTS_SUBMITTED';
    } else if (docs.length > 0) {
      newStatus = 'DOCUMENTS_PENDING';
    }

    if (newStatus !== riderProfile.onboardingStatus) {
      await prisma.riderProfile.update({
        where: { userId },
        data: { onboardingStatus: newStatus },
      });
    }
  }
}
