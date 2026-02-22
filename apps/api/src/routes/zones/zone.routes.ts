import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { ZoneService } from '../../services/zone.service';
import { createZoneSchema, updateZoneSchema } from '@riderguy/validators';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';

const router = Router();

router.use(authenticate);

/** GET /zones — list all zones */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const zones = await ZoneService.list(status);
    res.status(StatusCodes.OK).json({ success: true, data: zones });
  }),
);

/** POST /zones — create zone (admin only) */
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createZoneSchema),
  asyncHandler(async (req, res) => {
    const zone = await ZoneService.create(req.body);
    res.status(StatusCodes.CREATED).json({ success: true, data: zone });
  }),
);

/** PATCH /zones/:id — update zone (admin only) */
router.patch(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(updateZoneSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const zone = await ZoneService.update(id, req.body);
    res.status(StatusCodes.OK).json({ success: true, data: zone });
  }),
);

/** GET /zones/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const zone = await ZoneService.getById(id);

    if (!zone) {
      throw ApiError.notFound('Zone not found');
    }

    res.status(StatusCodes.OK).json({ success: true, data: zone });
  }),
);

/** PATCH /zones/:id/deactivate — deactivate a zone (admin) */
router.patch(
  '/:id/deactivate',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const zone = await ZoneService.deactivate(id);
    res.status(StatusCodes.OK).json({ success: true, data: zone });
  }),
);

/** PATCH /zones/:id/activate — activate a zone (admin) */
router.patch(
  '/:id/activate',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const zone = await ZoneService.activate(id);
    res.status(StatusCodes.OK).json({ success: true, data: zone });
  }),
);

/** PATCH /zones/:id/surge — update surge multiplier (admin) */
router.patch(
  '/:id/surge',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { surgeMultiplier } = req.body;

    if (typeof surgeMultiplier !== 'number') {
      throw ApiError.badRequest('surgeMultiplier must be a number');
    }

    const zone = await ZoneService.updateSurge(id, surgeMultiplier);
    res.status(StatusCodes.OK).json({ success: true, data: zone });
  }),
);

export { router as zoneRouter };
