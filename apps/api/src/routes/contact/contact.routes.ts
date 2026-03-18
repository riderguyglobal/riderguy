import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../lib/async-handler';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../lib/logger';
import { z } from 'zod';
import { validate, authRateLimit } from '../../middleware';
import { EmailService } from '../../services/email.service';

const router = Router();

// ============================================================
// Contact Form — Public endpoint (no auth required)
// ============================================================

const contactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  subject: z.enum(['general', 'rider', 'business', 'partner', 'support', 'other']),
  message: z.string().min(10).max(5000),
});

/**
 * POST /contact
 * Receive contact form submissions from marketing site.
 */
router.post(
  '/',
  authRateLimit,
  validate(contactSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { firstName, lastName, email, subject, message } = req.body;

    logger.info(
      { firstName, lastName, email, subject, messageLength: message.length },
      'Contact form submission received',
    );

    // Send acknowledgement to submitter (non-blocking)
    EmailService.sendContactAck(email, firstName, subject).catch(() => {});

    // Notify support team (non-blocking)
    EmailService.sendContactNotification({
      firstName,
      lastName,
      email,
      subject,
      message,
    }).catch(() => {});

    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'Thank you for reaching out! We\'ll get back to you within 24 hours.' },
    });
  }),
);

export { router as contactRouter };
