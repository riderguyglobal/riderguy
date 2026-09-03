import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tx: {
    document: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  storage: {
    isAllowedDocumentType: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
    ownerFolder: vi.fn(),
  },
  recalculateStatus: vi.fn(),
  recordAudit: vi.fn(),
  acquireLock: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx)),
    document: { findUnique: vi.fn() },
  },
}));

vi.mock('./storage.service', () => ({ StorageService: mocks.storage }));
vi.mock('./onboarding.service', () => ({
  OnboardingService: { recalculateStatus: mocks.recalculateStatus },
}));
vi.mock('./admin-audit.service', () => ({
  AdminAuditService: { record: mocks.recordAudit },
}));
vi.mock('../lib/postgres-advisory-lock', () => ({
  acquireTransactionAdvisoryLock: mocks.acquireLock,
}));

import { prisma } from '@riderguy/database';
import { DocumentService, hasExpectedDocumentSignature } from './document.service';

const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('DocumentService compliance synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.isAllowedDocumentType.mockReturnValue(true);
    mocks.storage.ownerFolder.mockReturnValue('documents/rider-1');
    mocks.storage.upload.mockResolvedValue({ url: 'storage://new-document', sizeBytes: 1234 });
    mocks.storage.delete.mockResolvedValue(undefined);
    mocks.recalculateStatus.mockResolvedValue(undefined);
  });

  it('replaces approved evidence and recalculates the work gate in one database transaction', async () => {
    const approved = { id: 'document-old', fileUrl: 'storage://approved-document' };
    const pending = { id: 'document-new', status: 'PENDING' };
    mocks.tx.document.findFirst.mockResolvedValue(approved);
    mocks.tx.document.create.mockResolvedValue(pending);

    await expect(
      DocumentService.upload({
        userId: 'rider-user-1',
        type: 'NATIONAL_ID',
        buffer: jpegBuffer,
        originalName: 'ghana-card.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 8,
      }),
    ).resolves.toEqual(pending);

    expect(mocks.tx.document.delete).toHaveBeenCalledWith({ where: { id: approved.id } });
    expect(mocks.tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'rider-user-1',
        type: 'NATIONAL_ID',
        status: 'PENDING',
      }),
    });
    expect(mocks.recalculateStatus).toHaveBeenCalledWith('rider-user-1', mocks.tx);
    expect(mocks.acquireLock).toHaveBeenCalledWith(
      mocks.tx,
      'rider-document-upload',
      'rider-user-1:NATIONAL_ID',
    );
    expect(mocks.storage.delete).toHaveBeenCalledWith(approved.fileUrl);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('removes the new upload and preserves the old stored file when compliance persistence fails', async () => {
    mocks.tx.document.findFirst.mockResolvedValue({
      id: 'document-old',
      fileUrl: 'storage://approved-document',
    });
    mocks.tx.document.create.mockResolvedValue({ id: 'document-new' });
    mocks.recalculateStatus.mockRejectedValue(new Error('database failure'));

    await expect(
      DocumentService.upload({
        userId: 'rider-user-1',
        type: 'NATIONAL_ID',
        buffer: jpegBuffer,
        originalName: 'ghana-card.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 8,
      }),
    ).rejects.toThrow('database failure');

    expect(mocks.storage.delete).toHaveBeenCalledTimes(1);
    expect(mocks.storage.delete).toHaveBeenCalledWith('storage://new-document');
    expect(mocks.storage.delete).not.toHaveBeenCalledWith('storage://approved-document');
  });

  it('rejects executable or arbitrary content disguised with an allowed MIME type', async () => {
    await expect(
      DocumentService.upload({
        userId: 'rider-user-1',
        type: 'NATIONAL_ID',
        buffer: Buffer.from('MZ executable payload'),
        originalName: 'ghana-card.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 21,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'FILE_CONTENT_MISMATCH',
    });

    expect(mocks.storage.upload).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recognises the signatures of every supported document format', () => {
    expect(hasExpectedDocumentSignature(jpegBuffer, 'image/jpeg')).toBe(true);
    expect(
      hasExpectedDocumentSignature(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        'image/png',
      ),
    ).toBe(true);
    expect(hasExpectedDocumentSignature(Buffer.from('RIFF0000WEBP'), 'image/webp')).toBe(true);
    expect(hasExpectedDocumentSignature(Buffer.from('\n%PDF-1.7'), 'application/pdf')).toBe(true);
    expect(
      hasExpectedDocumentSignature(Buffer.from('MZ executable %PDF-1.7'), 'application/pdf'),
    ).toBe(false);
  });

  it('recalculates compliance in the same transaction as an evidence rejection', async () => {
    const pending = {
      id: 'document-pending',
      userId: 'rider-user-1',
      type: 'SELFIE',
      status: 'PENDING',
    };
    const rejected = { ...pending, status: 'REJECTED', rejectionReason: 'Image is not clear' };
    (prisma.document.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pending);
    mocks.tx.document.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.document.findUnique.mockResolvedValue(rejected);

    await expect(
      DocumentService.review({
        documentId: pending.id,
        reviewerId: 'admin-user-1',
        status: 'REJECTED',
        rejectionReason: 'Image is not clear',
      }),
    ).resolves.toEqual(rejected);

    expect(mocks.recordAudit).toHaveBeenCalled();
    expect(mocks.recalculateStatus).toHaveBeenCalledWith('rider-user-1', mocks.tx);
  });
});
