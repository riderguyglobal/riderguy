// ============================================================
// Mentorship Routes — Sprint 12
// ============================================================

import { Router, Request, Response } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import {
  requestMentorshipSchema,
  updateMentorshipStatusSchema,
  createMentorCheckInSchema,
  mentorSearchSchema,
} from '@riderguy/validators';
import * as MentorshipService from '../../services/mentorship.service';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../lib/api-error';

const router = Router();

router.use(authenticate);

// ────── Helper: resolve rider profile id ──────
async function getRiderProfileId(userId: string): Promise<string> {
  const rider = await prisma.riderProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!rider) throw ApiError.notFound('Rider profile not found');
  return rider.id;
}

// ============================================================
// Rider endpoints
// ============================================================

/** GET /mentorship/mentors — Search available mentors */
router.get(
  '/mentors',
  requireRole(UserRole.RIDER),
  validate(mentorSearchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const riderId = await getRiderProfileId(req.user!.userId);
    const { zoneId, minLevel, minDeliveries, page, limit } = req.query as any;
    const data = await MentorshipService.searchMentors({
      zoneId,
      minLevel: minLevel ? Number(minLevel) : undefined,
      minDeliveries: minDeliveries ? Number(minDeliveries) : undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      excludeRiderId: riderId,
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** POST /mentorship/request — Request mentorship */
router.post(
  '/request',
  requireRole(UserRole.RIDER),
  validate(requestMentorshipSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const menteeId = await getRiderProfileId(req.user!.userId);
    const data = await MentorshipService.requestMentorship(menteeId, req.body.mentorId);
    res.status(StatusCodes.CREATED).json({ success: true, data });
  }),
);

/** GET /mentorship/mine — Get my mentorships (as mentor & mentee) */
router.get(
  '/mine',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const riderId = await getRiderProfileId(req.user!.userId);
    const data = await MentorshipService.getMyMentorships(riderId);
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** GET /mentorship/:id — Get single mentorship with check-ins */
router.get(
  '/:id',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await MentorshipService.getMentorshipById(
      req.params.id as string,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** PATCH /mentorship/:id/status — Accept / complete / cancel */
router.patch(
  '/:id/status',
  requireRole(UserRole.RIDER),
  validate(updateMentorshipStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await MentorshipService.updateMentorshipStatus(
      req.params.id as string,
      req.user!.userId,
      req.body.status,
      req.body.completionNote,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** POST /mentorship/:id/check-ins — Add a check-in */
router.post(
  '/:id/check-ins',
  requireRole(UserRole.RIDER),
  validate(createMentorCheckInSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await MentorshipService.createCheckIn(
      req.params.id as string,
      req.user!.userId,
      req.body.note,
      req.body.rating,
    );
    res.status(StatusCodes.CREATED).json({ success: true, data });
  }),
);

/** GET /mentorship/:id/check-ins — Get check-ins */
router.get(
  '/:id/check-ins',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await MentorshipService.getCheckIns(
      req.params.id as string,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

export { router as mentorshipRouter };
