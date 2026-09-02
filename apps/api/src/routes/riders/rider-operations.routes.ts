import { Router, type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserRole } from '@riderguy/types';
import {
  listRiderAuditHistoryQuerySchema,
  listRiderOperationsCasesQuerySchema,
  revokeInHouseInvitationSchema,
} from '@riderguy/validators';
import type {
  ListRiderAuditHistoryQuery,
  ListRiderOperationsCasesQuery,
} from '@riderguy/validators';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { AdminAuditService, adminAuditContext } from '../../services/admin-audit.service';
import { OnboardingService } from '../../services/onboarding.service';
import { RiderOperationsService } from '../../services/rider-operations.service';

const router = Router();

export const requireRiderOperationsAdmin = requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);

router.use(authenticate);
router.use(requireRiderOperationsAdmin);

export async function riderOperationsSummaryHandler(_req: Request, res: Response): Promise<void> {
  const summary = await RiderOperationsService.getSummary();
  res.status(StatusCodes.OK).json({ success: true, data: summary });
}

export async function listRiderOperationsCasesHandler(req: Request, res: Response): Promise<void> {
  const result = await RiderOperationsService.listCases(
    req.query as unknown as ListRiderOperationsCasesQuery,
  );
  res.status(StatusCodes.OK).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
}

router.get('/summary', asyncHandler(riderOperationsSummaryHandler));

router.get(
  '/cases',
  validate(listRiderOperationsCasesQuerySchema, 'query'),
  asyncHandler(listRiderOperationsCasesHandler),
);

router.get(
  '/cases/:riderId',
  asyncHandler(async (req, res) => {
    const riderCase = await RiderOperationsService.getCase(String(req.params.riderId));
    res.status(StatusCodes.OK).json({ success: true, data: riderCase });
  }),
);

router.get(
  '/cases/:riderId/history',
  validate(listRiderAuditHistoryQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as ListRiderAuditHistoryQuery;
    const result = await AdminAuditService.listForRider(String(req.params.riderId), page, limit);
    res.status(StatusCodes.OK).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  }),
);

router.get(
  '/invitations',
  asyncHandler(async (_req, res) => {
    const invitations = await OnboardingService.listInHouseInvitations();
    res.status(StatusCodes.OK).json({ success: true, data: invitations });
  }),
);

router.patch(
  '/invitations/:invitationId/revoke',
  validate(revokeInHouseInvitationSchema),
  asyncHandler(async (req, res) => {
    const invitation = await OnboardingService.revokeInHouseInvitation(
      req.user!.userId,
      String(req.params.invitationId),
      req.body.reason,
      adminAuditContext(req),
    );
    res.status(StatusCodes.OK).json({ success: true, data: invitation });
  }),
);

export { router as riderOperationsRouter };
