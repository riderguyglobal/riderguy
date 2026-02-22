// ============================================================
// Notification Routes — list, read, mark-all-read
// ============================================================

import { Router } from 'express';
import { authenticate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { NotificationService } from '../../services/notification.service';
import { StatusCodes } from 'http-status-codes';

const router = Router();

router.use(authenticate);

/** GET /notifications — list own notifications (paginated) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);

    const result = await NotificationService.list(req.user!.userId, page, pageSize);
    res.status(StatusCodes.OK).json({ success: true, ...result });
  }),
);

/** PATCH /notifications/:id/read — mark a single notification as read */
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const result = await NotificationService.markRead(id, req.user!.userId);

    if (result.count === 0) {
      throw ApiError.notFound('Notification not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'Notification marked as read' },
    });
  }),
);

/** PATCH /notifications/read-all — mark all notifications as read */
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const result = await NotificationService.markAllRead(req.user!.userId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: `${result.count} notifications marked as read` },
    });
  }),
);

export { router as notificationRouter };
