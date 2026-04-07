import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { validate } from '../../middleware';

const router = Router();

// ============================================================
// Public — List published job postings (no auth required)
// ============================================================

/**
 * GET /job-postings
 * Returns all published job postings for the marketing careers page.
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const jobs = await prisma.jobPosting.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        type: true,
        description: true,
        requirements: true,
        publishedAt: true,
      },
    });

    res.status(StatusCodes.OK).json({ success: true, data: jobs });
  }),
);

// ============================================================
// Admin — CRUD for job postings (auth + admin role required)
// ============================================================

const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  location: z.string().min(1).max(200),
  type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']).default('FULL_TIME'),
  description: z.string().min(1).max(10000),
  requirements: z.string().max(10000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
});

const updateJobSchema = createJobSchema.partial().extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
});

/**
 * GET /job-postings/admin
 * List all job postings (any status) for admin management.
 */
router.get(
  '/admin',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (_req: Request, res: Response) => {
    const jobs = await prisma.jobPosting.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    res.status(StatusCodes.OK).json({ success: true, data: jobs });
  }),
);

/**
 * POST /job-postings/admin
 * Create a new job posting.
 */
router.post(
  '/admin',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, department, location, type, description, requirements, status } = req.body;

    const job = await prisma.jobPosting.create({
      data: {
        title,
        department,
        location,
        type,
        description,
        requirements: requirements || null,
        status,
        createdById: req.user!.userId,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: job });
  }),
);

/**
 * PATCH /job-postings/admin/:id
 * Update an existing job posting.
 */
router.patch(
  '/admin/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(updateJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const data = req.body;

    // If status is changing to PUBLISHED, set publishedAt
    if (data.status === 'PUBLISHED') {
      const existing = await prisma.jobPosting.findUnique({ where: { id } });
      if (existing && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    // If status is changing to CLOSED, set closedAt
    if (data.status === 'CLOSED') {
      data.closedAt = new Date();
    }

    const job = await prisma.jobPosting.update({
      where: { id },
      data,
    });

    res.status(StatusCodes.OK).json({ success: true, data: job });
  }),
);

/**
 * DELETE /job-postings/admin/:id
 * Delete a job posting.
 */
router.delete(
  '/admin/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    await prisma.jobPosting.delete({ where: { id } });

    res.status(StatusCodes.OK).json({ success: true, data: { message: 'Job posting deleted' } });
  }),
);

export { router as jobPostingRouter };
