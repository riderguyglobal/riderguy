// ============================================================
// Rider Identity Routes — Sprint 12
// Profile upgrade, public rider card, spotlights
// ============================================================

import { Router, Request, Response } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { UserRole } from '@riderguy/types';
import {
  updateRiderProfileSchema,
  createSpotlightSchema,
  updateSpotlightSchema,
} from '@riderguy/validators';
import * as RiderIdentityService from '../../services/rider-identity.service';
import { StatusCodes } from 'http-status-codes';

const router = Router();

// ============================================================
// Public (no auth) — Public rider card
// ============================================================

/** GET /rider-identity/card/:slug — Public rider profile card */
router.get(
  '/card/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiderIdentityService.getPublicRiderCard(req.params.slug as string);
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

// ============================================================
// Spotlights — Public listing
// ============================================================

/** GET /rider-identity/spotlights — List rider spotlights */
router.get(
  '/spotlights',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const data = await RiderIdentityService.listSpotlights(page, limit);
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** GET /rider-identity/spotlights/latest — Get latest spotlight */
router.get(
  '/spotlights/latest',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiderIdentityService.getLatestSpotlight();
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

// ─── Authenticated routes below ───
router.use(authenticate);

// ============================================================
// Rider-owned identity routes
// ============================================================

/** GET /rider-identity/me — Get own rider identity */
router.get(
  '/me',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiderIdentityService.getMyRiderIdentity(req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** PATCH /rider-identity/me — Update bio / public profile URL */
router.patch(
  '/me',
  requireRole(UserRole.RIDER),
  validate(updateRiderProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiderIdentityService.updateRiderIdentity(
      req.user!.userId,
      req.body,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

// ============================================================
// Admin — Spotlight management
// ============================================================

/** POST /rider-identity/spotlights — Create spotlight (admin) */
router.post(
  '/spotlights',
  requireRole(UserRole.ADMIN),
  validate(createSpotlightSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiderIdentityService.createSpotlight(req.body);
    res.status(StatusCodes.CREATED).json({ success: true, data });
  }),
);

/** PATCH /rider-identity/spotlights/:id — Update spotlight (admin) */
router.patch(
  '/spotlights/:id',
  requireRole(UserRole.ADMIN),
  validate(updateSpotlightSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiderIdentityService.updateSpotlight(
      req.params.id as string,
      req.body,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

export { router as riderIdentityRouter };
