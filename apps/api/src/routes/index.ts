import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { authRouter } from './auth/auth.routes';
import { userRouter } from './users/user.routes';
import { riderRouter } from './riders/rider.routes';
import { orderRouter } from './orders/order.routes';
import { walletRouter } from './wallets/wallet.routes';
import { zoneRouter } from './zones/zone.routes';
import { documentRouter } from './documents/document.routes';
import { notificationRouter } from './notifications/notification.routes';
import { paymentRouter } from './payments/payment.routes';
import { adminRouter } from './admin/admin.routes';
import { contactRouter } from './contact/contact.routes';
import { gamificationRouter } from './gamification/gamification.routes';
import { authenticate } from '../middleware';
import { asyncHandler } from '../lib/async-handler';
import { ApiError } from '../lib/api-error';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/riders', riderRouter);
router.use('/orders', orderRouter);
router.use('/wallets', walletRouter);
router.use('/zones', zoneRouter);
router.use('/documents', documentRouter);
router.use('/notifications', notificationRouter);
router.use('/payments', paymentRouter);
router.use('/admin', adminRouter);
router.use('/contact', contactRouter);
router.use('/gamification', gamificationRouter);

// ────── Authenticated file serving (protects PII uploads) ──────
router.get(
  '/uploads/*',
  authenticate,
  asyncHandler(async (req, res) => {
    // Decode the path after /uploads/
    const filePath = (req.params as Record<string, string>)[0];
    if (!filePath) throw ApiError.badRequest('No file path provided');

    // Prevent path traversal
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const fullPath = path.resolve(uploadsRoot, filePath);
    if (!fullPath.startsWith(uploadsRoot)) {
      throw ApiError.forbidden('Invalid file path');
    }

    if (!fs.existsSync(fullPath)) {
      throw ApiError.notFound('File not found');
    }

    res.sendFile(fullPath);
  }),
);

export { router as apiRouter };
