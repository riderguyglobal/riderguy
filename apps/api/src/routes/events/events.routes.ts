// ============================================================
// Event Routes — Sprint 12
// ============================================================

import { Router, Request, Response } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { UserRole } from '@riderguy/types';
import {
  createEventSchema,
  updateEventSchema,
  listEventsSchema,
} from '@riderguy/validators';
import * as EventService from '../../services/event.service';
import { StatusCodes } from 'http-status-codes';

const router = Router();

router.use(authenticate);

// ============================================================
// Public (authenticated) endpoints
// ============================================================

/** GET /events — List events */
router.get(
  '/',
  validate(listEventsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, zoneId, type, page, limit } = req.query as any;
    const data = await EventService.listEvents({
      status,
      zoneId,
      type,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** GET /events/:id — Get single event */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await EventService.getEventById(
      req.params.id as string,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** POST /events — Create event (rider or admin) */
router.post(
  '/',
  requireRole(UserRole.RIDER, UserRole.ADMIN),
  validate(createEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await EventService.createEvent(req.user!.userId, req.body);
    res.status(StatusCodes.CREATED).json({ success: true, data });
  }),
);

/** PATCH /events/:id — Update event */
router.patch(
  '/:id',
  requireRole(UserRole.RIDER, UserRole.ADMIN),
  validate(updateEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const data = await EventService.updateEvent(
      req.params.id as string,
      req.user!.userId,
      isAdmin,
      req.body,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** POST /events/:id/rsvp — RSVP to event */
router.post(
  '/:id/rsvp',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await EventService.rsvpToEvent(
      req.params.id as string,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** DELETE /events/:id/rsvp — Cancel RSVP */
router.delete(
  '/:id/rsvp',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await EventService.cancelRsvp(
      req.params.id as string,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

export { router as eventRouter };
