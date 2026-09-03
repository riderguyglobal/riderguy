import { Router, type RequestHandler } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { authRouter } from './auth/auth.routes';
import { userRouter } from './users/user.routes';
import { riderRouter } from './riders/rider.routes';
import { riderOperationsRouter } from './riders/rider-operations.routes';
import { orderRouter } from './orders/order.routes';
import { walletRouter } from './wallets/wallet.routes';
import { zoneRouter } from './zones/zone.routes';
import { documentRouter } from './documents/document.routes';
import { notificationRouter } from './notifications/notification.routes';
import { paymentRouter } from './payments/payment.routes';
import { adminRouter } from './admin/admin.routes';
import { riderExperienceAdminRouter } from './admin/rider-experience.routes';
import { contactRouter } from './contact/contact.routes';
import { gamificationRouter } from './gamification/gamification.routes';
import { communityRouter } from './community/community.routes';
import { mentorshipRouter } from './mentorship/mentorship.routes';
import { eventRouter } from './events/events.routes';
import { featureRequestRouter } from './feature-requests/feature-requests.routes';
import { riderIdentityRouter } from './rider-identity/rider-identity.routes';
import { savedAddressRouter } from './saved-addresses/saved-address.routes';
import { favoriteRiderRouter } from './favorite-riders/favorite-rider.routes';
import { scheduledDeliveryRouter } from './scheduled-deliveries/scheduled-delivery.routes';
import { placesRouter } from './places/places.routes';
import { promoRouter } from './promo/promo.routes';
import { jobPostingRouter } from './job-postings/job-postings.routes';
import { authenticate } from '../middleware';
import { asyncHandler } from '../lib/async-handler';
import { ApiError } from '../lib/api-error';
import { AUTHENTICATED_UPLOAD_ROUTE, isPublicAvatarUploadPath } from './route-paths';
import { MediaAccessService } from '../services/media-access.service';
import { StorageService } from '../services/storage.service';

const router = Router();

const authenticatePrivateUpload: RequestHandler = (req, res, next) => {
  const fileSegments = (req.params as { filePath?: string[] }).filePath;
  if (isPublicAvatarUploadPath(fileSegments)) {
    next();
    return;
  }
  return authenticate(req, res, next);
};

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/riders/admin/operations', riderOperationsRouter);
router.use('/riders', riderRouter);
router.use('/orders', orderRouter);
router.use('/wallets', walletRouter);
router.use('/zones', zoneRouter);
router.use('/documents', documentRouter);
router.use('/notifications', notificationRouter);
router.use('/payments', paymentRouter);
router.use('/admin/rider-experience', riderExperienceAdminRouter);
router.use('/admin', adminRouter);
router.use('/contact', contactRouter);
router.use('/gamification', gamificationRouter);
router.use('/community', communityRouter);
router.use('/mentorship', mentorshipRouter);
router.use('/events', eventRouter);
router.use('/feature-requests', featureRequestRouter);
router.use('/rider-identity', riderIdentityRouter);
router.use('/saved-addresses', savedAddressRouter);
router.use('/favorite-riders', favoriteRiderRouter);
router.use('/scheduled-deliveries', scheduledDeliveryRouter);
router.use('/places', placesRouter);
router.use('/promo', promoRouter);
router.use('/job-postings', jobPostingRouter);

// ────── Authenticated file serving (protects PII uploads) ──────
router.get(
  AUTHENTICATED_UPLOAD_ROUTE,
  authenticatePrivateUpload,
  asyncHandler(async (req, res) => {
    // Express 5 requires named wildcards and returns their segments as an
    // array. Joining with the platform separator also keeps the route
    // portable between local Windows development and Linux production.
    const fileSegments = (req.params as { filePath?: string[] }).filePath;
    if (!Array.isArray(fileSegments) || fileSegments.length === 0) {
      throw ApiError.badRequest('No file path provided');
    }
    const fileKey = fileSegments.join('/');
    const isPublicAvatar = isPublicAvatarUploadPath(fileSegments);
    if (!isPublicAvatar) {
      if (!req.user) throw ApiError.unauthorized();
      await MediaAccessService.assertCanRead(fileKey, req.user);
    }

    // Prevent both lexical path traversal and symlink escapes. The production
    // uploads directory is itself a symlink to persistent storage, so compare
    // against both its configured path and its canonical path.
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const candidatePath = path.resolve(uploadsRoot, ...fileSegments);
    const uploadsPrefix = `${uploadsRoot}${path.sep}`;
    if (!candidatePath.startsWith(uploadsPrefix)) {
      throw ApiError.forbidden('Invalid file path');
    }

    if (!fs.existsSync(candidatePath)) {
      const storedObject = await StorageService.downloadFromS3(fileKey);
      if (!storedObject) {
        throw ApiError.notFound('File not found');
      }

      res.setHeader(
        'Cache-Control',
        isPublicAvatar ? 'public, max-age=86400' : 'private, max-age=300',
      );
      if (storedObject.contentType) res.type(storedObject.contentType);
      res.send(storedObject.buffer);
      return;
    }

    const canonicalRoot = fs.realpathSync(uploadsRoot);
    const fullPath = fs.realpathSync(candidatePath);
    if (!fullPath.startsWith(`${canonicalRoot}${path.sep}`)) {
      throw ApiError.forbidden('Invalid file path');
    }

    if (!fs.statSync(fullPath).isFile()) {
      throw ApiError.notFound('File not found');
    }

    res.setHeader(
      'Cache-Control',
      isPublicAvatar ? 'public, max-age=86400' : 'private, max-age=300',
    );
    res.sendFile(fullPath);
  }),
);

export { router as apiRouter };
