// ============================================================
// Document Routes — file upload, list, get, admin review
// ============================================================

import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { DocumentService } from '../../services/document.service';
import { NotificationService } from '../../services/notification.service';
import { uploadDocumentSchema, reviewDocumentSchema } from '@riderguy/validators';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Multer — store uploads in temp dir, validated & moved by the service
// ---------------------------------------------------------------------------
const tempStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `riderguy-doc-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage: tempStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (.jpg, .png, .webp) and PDFs are allowed'));
    }
  },
});

const router = Router();

router.use(authenticate);

// ────────────────────────── Rider endpoints ──────────────────────────

/** POST /documents/upload — upload a document (rider) */
router.post(
  '/upload',
  requireRole(UserRole.RIDER),
  upload.single('file'),
  validate(uploadDocumentSchema),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest('No file provided');
    }

    const { type } = req.body;
    const userId = req.user!.userId;

    // Read the temp file into a buffer and pass to DocumentService
    const buffer = await fs.readFile(req.file.path);

    const document = await DocumentService.upload({
      userId,
      type,
      buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });

    // Clean up temp file
    await fs.unlink(req.file.path).catch(() => {});

    res.status(StatusCodes.CREATED).json({ success: true, data: document });
  }),
);

/** GET /documents — list own documents */
router.get(
  '/',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const documents = await DocumentService.listByUser(req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: documents });
  }),
);

// ────────────────────────── Admin endpoints ──────────────────────────

/** GET /documents/pending — list documents pending review (admin) */
router.get(
  '/pending',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);

    const result = await DocumentService.listPending(page, pageSize);
    res.status(StatusCodes.OK).json({ success: true, ...result });
  }),
);

/** GET /documents/rider/:riderId — list documents for a specific rider (admin) */
router.get(
  '/rider/:riderId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const riderId = req.params.riderId as string;
    const documents = await DocumentService.listByRider(riderId);
    res.status(StatusCodes.OK).json({ success: true, data: documents });
  }),
);

/** GET /documents/:id — get a single document (MUST come after literal routes) */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const document = await DocumentService.getById(id);

    if (!document) {
      throw ApiError.notFound('Document not found');
    }

    // Riders can only view their own documents
    const role = req.user!.role;
    if (
      role === UserRole.RIDER &&
      document.userId !== req.user!.userId
    ) {
      throw ApiError.forbidden('You can only view your own documents');
    }

    res.status(StatusCodes.OK).json({ success: true, data: document });
  }),
);

/** PATCH /documents/:id/review — approve or reject (admin) */
router.patch(
  '/:id/review',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(reviewDocumentSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { status, rejectionReason } = req.body;

    const document = await DocumentService.review({
      documentId: id,
      reviewerId: req.user!.userId,
      status,
      rejectionReason,
    });

    // Send notification to the rider
    await NotificationService.notifyDocumentReview(
      document.userId,
      document.type,
      status,
      rejectionReason,
    );

    res.status(StatusCodes.OK).json({ success: true, data: document });
  }),
);

export { router as documentRouter };
