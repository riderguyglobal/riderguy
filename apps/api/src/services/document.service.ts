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
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';

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

export function hasExpectedDocumentSignature(buffer: Buffer, mimeType: string): boolean {
  const normalizedMimeType = mimeType.toLowerCase();
  if (normalizedMimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (normalizedMimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (normalizedMimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (normalizedMimeType === 'application/pdf') {
    let offset =
      buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? 3 : 0;
    const headerLimit = Math.min(buffer.length, offset + 16);
    while (offset < headerLimit && [0x09, 0x0a, 0x0c, 0x0d, 0x20].includes(buffer[offset] ?? -1)) {
      offset += 1;
    }
    return buffer.subarray(offset, offset + 5).equals(Buffer.from('%PDF-'));
  }
  return false;
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
    if (!hasExpectedDocumentSignature(input.buffer, input.mimeType)) {
      throw ApiError.badRequest(
        'The uploaded file content does not match its declared file type.',
        'FILE_CONTENT_MISMATCH',
      );
    }

    // Upload to storage
    const uploadResult = await StorageService.upload(
      input.buffer,
      input.originalName,
      input.mimeType,
      StorageService.ownerFolder('documents', input.userId),
    );

    let replacedFileUrl: string | null = null;
    let doc;
    try {
      doc = await prisma.$transaction(async (tx) => {
        await acquireTransactionAdvisoryLock(
          tx,
          'rider-document-upload',
          `${input.userId}:${input.type}`,
        );
        // Replacing approved evidence and closing the work gate must commit as
        // one database change. Otherwise an activated Rider could retain work
        // access after the approved record has gone away.
        const existing = await tx.document.findFirst({
          where: {
            userId: input.userId,
            type: input.type,
            status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (existing) {
          replacedFileUrl = existing.fileUrl;
          await tx.document.delete({ where: { id: existing.id } });
        }

        const created = await tx.document.create({
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

        await OnboardingService.recalculateStatus(input.userId, tx);
        return created;
      });
    } catch (error) {
      // The database rejected the replacement; remove the now-unreferenced
      // upload while preserving the previously approved file and record.
      await StorageService.delete(uploadResult.url).catch(() => {});
      throw error;
    }

    if (replacedFileUrl) {
      await StorageService.delete(replacedFileUrl).catch(() => {});
    }

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
        throw ApiError.conflict(
          'This document was reviewed by another administrator. Refresh the case.',
        );
      }
      const reviewed = await tx.document.findUnique({ where: { id: input.documentId } });
      if (!reviewed) throw ApiError.notFound('Document not found');
      await AdminAuditService.record(
        {
          actorUserId: input.reviewerId,
          ipAddress: input.auditContext?.ipAddress,
          userAgent: input.auditContext?.userAgent,
          action:
            input.status === 'APPROVED' ? 'rider_document.approved' : 'rider_document.rejected',
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
        },
        tx,
      );
      await OnboardingService.recalculateStatus(doc.userId, tx);
      return reviewed;
    });

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
}
