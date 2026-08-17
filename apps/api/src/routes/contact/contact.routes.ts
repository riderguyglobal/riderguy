import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../lib/async-handler';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../lib/logger';
import { z } from 'zod';
import { validate, authRateLimit, authenticate, requireRole } from '../../middleware';
import { EmailService } from '../../services/email.service';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';

const router = Router();

const contactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  email:     z.string().email(),
  subject:   z.enum(['general', 'rider', 'business', 'partner', 'support', 'other']),
  message:   z.string().min(10).max(5000),
});

// ─────────────────────────────────────────────────────────────
// POST /contact  — public, receives marketing site submissions
// ─────────────────────────────────────────────────────────────
router.post(
  '/',
  authRateLimit,
  validate(contactSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { firstName, lastName, email, subject, message } = req.body;

    // Persist to DB so admin can see it in the inbox
    const submission = await prisma.contactSubmission.create({
      data: { firstName, lastName, email, subject, message },
    });

    logger.info(
      { id: submission.id, firstName, lastName, email, subject, messageLength: message.length },
      'Contact form submission saved',
    );

    // Fire-and-forget emails
    EmailService.sendContactAck(email, firstName, subject).catch(() => {});
    EmailService.sendContactNotification({ firstName, lastName, email, subject, message }).catch(() => {});

    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: "Thank you for reaching out! We'll get back to you within 24 hours." },
    });
  }),
);

// ─────────────────────────────────────────────────────────────
// GET /contact  — admin: paginated inbox list
// ─────────────────────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip  = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';
    const where = unreadOnly ? { read: false } : {};

    const [submissions, total, unreadCount] = await Promise.all([
      prisma.contactSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contactSubmission.count({ where }),
      prisma.contactSubmission.count({ where: { read: false } }),
    ]);

    res.json({
      success: true,
      data: {
        submissions,
        total,
        unreadCount,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  }),
);

// ─────────────────────────────────────────────────────────────
// PATCH /contact/:id/read  — admin: mark a submission as read
// ─────────────────────────────────────────────────────────────
router.patch(
  '/:id/read',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const submission = await prisma.contactSubmission.update({
      where: { id },
      data:  { read: true },
    });
    res.json({ success: true, data: submission });
  }),
);

export { router as contactRouter };
