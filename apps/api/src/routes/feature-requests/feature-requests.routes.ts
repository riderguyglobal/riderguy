// ============================================================
// Feature Request Routes — Sprint 12
// ============================================================

import { Router, Request, Response } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { UserRole } from '@riderguy/types';
import {
  createFeatureRequestSchema,
  updateFeatureRequestStatusSchema,
  listFeatureRequestsSchema,
} from '@riderguy/validators';
import * as FeatureRequestService from '../../services/feature-request.service';
import { StatusCodes } from 'http-status-codes';

const router = Router();

router.use(authenticate);

/** GET /feature-requests — List feature requests */
router.get(
  '/',
  validate(listFeatureRequestsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, sort, page, limit } = req.query as any;
    const data = await FeatureRequestService.listFeatureRequests({
      status,
      sort: sort || 'most_upvoted',
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      userId: req.user!.userId,
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** GET /feature-requests/:id — Get single request */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await FeatureRequestService.getFeatureRequestById(
      req.params.id as string,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** POST /feature-requests — Create a feature request */
router.post(
  '/',
  validate(createFeatureRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await FeatureRequestService.createFeatureRequest(
      req.user!.userId,
      req.body.title,
      req.body.description,
    );
    res.status(StatusCodes.CREATED).json({ success: true, data });
  }),
);

/** POST /feature-requests/:id/upvote — Toggle upvote */
router.post(
  '/:id/upvote',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await FeatureRequestService.toggleUpvote(
      req.params.id as string,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** DELETE /feature-requests/:id — Delete own request */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const data = await FeatureRequestService.deleteFeatureRequest(
      req.params.id as string,
      req.user!.userId,
      isAdmin,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** PATCH /feature-requests/:id/status — Admin: update status */
router.patch(
  '/:id/status',
  requireRole(UserRole.ADMIN),
  validate(updateFeatureRequestStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await FeatureRequestService.updateFeatureRequestStatus(
      req.params.id as string,
      req.body.status,
      req.body.adminNote,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

export { router as featureRequestRouter };
