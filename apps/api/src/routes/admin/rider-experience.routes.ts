import { Router, type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserRole } from '@riderguy/types';
import {
  adminMentorshipListSchema,
  adminMentorshipStatusSchema,
  type AdminMentorshipListQuery,
  type AdminMentorshipStatusInput,
} from '@riderguy/validators';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { adminAuditContext } from '../../services/admin-audit.service';
import { RiderExperienceAdminService } from '../../services/rider-experience-admin.service';

const router = Router();

export const requireRiderExperienceAdmin = requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);

router.use(authenticate);
router.use(requireRiderExperienceAdmin);

export async function riderExperienceSummaryHandler(_req: Request, res: Response): Promise<void> {
  const summary = await RiderExperienceAdminService.getSummary();
  res.status(StatusCodes.OK).json({ success: true, data: summary });
}

export async function listMentorshipsAdminHandler(req: Request, res: Response): Promise<void> {
  const result = await RiderExperienceAdminService.listMentorships(
    req.query as unknown as AdminMentorshipListQuery,
  );
  res.status(StatusCodes.OK).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
}

export async function updateMentorshipAdminHandler(req: Request, res: Response): Promise<void> {
  const mentorship = await RiderExperienceAdminService.updateMentorship(
    String(req.params.id),
    req.body as AdminMentorshipStatusInput,
    adminAuditContext(req),
  );
  res.status(StatusCodes.OK).json({ success: true, data: mentorship });
}

router.get('/summary', asyncHandler(riderExperienceSummaryHandler));
router.get(
  '/mentorships',
  validate(adminMentorshipListSchema, 'query'),
  asyncHandler(listMentorshipsAdminHandler),
);
router.patch(
  '/mentorships/:id/status',
  validate(adminMentorshipStatusSchema),
  asyncHandler(updateMentorshipAdminHandler),
);

export { router as riderExperienceAdminRouter };
