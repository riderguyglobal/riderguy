import { Router } from 'express';
import { authenticate, requireRole, sensitiveUserRateLimit, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { logger } from '../../lib/logger';
import { acquireTransactionAdvisoryLock } from '../../lib/postgres-advisory-lock';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import {
  updateAvailabilitySchema,
  updateLocationSchema,
  registerVehicleSchema,
  updateVehicleSchema,
  reviewVehicleSchema,
  selectRiderChannelSchema,
  createInHouseInvitationSchema,
  rejectRiderApplicationSchema,
  adminClassifyRiderChannelSchema,
  createAssetFinancingInterestSchema,
  listAssetFinancingInterestsQuerySchema,
  updateAssetFinancingInterestStatusSchema,
  reviewTrainingModuleSchema,
} from '@riderguy/validators';
import type { ListAssetFinancingInterestsQuery } from '@riderguy/validators';
import { VehicleService } from '../../services/vehicle.service';
import { OnboardingService } from '../../services/onboarding.service';
import { AssetFinancingService } from '../../services/asset-financing.service';
import { NotificationService } from '../../services/notification.service';
import { AdminAuditService, adminAuditContext } from '../../services/admin-audit.service';
import {
  recordHeartbeat,
  forceRiderOffline,
  resolveOnlineSessionStartedAt,
} from '../../services/presence.service';
import {
  assertRiderWorkEligible,
  riderWorkEligibilityWhere,
} from '../../services/rider-work-eligibility';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';
import type { Request, Response } from 'express';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Multer config for vehicle photo uploads
// ---------------------------------------------------------------------------

/** Resolve User.id → RiderProfile.id (Vehicle FK needs the profile id) */
async function getRiderProfileId(userId: string): Promise<string> {
  const profile = await prisma.riderProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw ApiError.notFound('Rider profile not found');
  return profile.id;
}

const tempStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, os.tmpdir()),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `riderguy-veh-${crypto.randomUUID()}${ext}`);
  },
});

const vehiclePhotoUpload = multer({
  storage: tempStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();

router.use(authenticate);

/** Resolve User.id and lock the canonical RiderProfile identity used by Vehicle.riderId. */
export async function lockRiderVehicleStateForUser(
  tx: Prisma.TransactionClient,
  riderUserId: string,
): Promise<string> {
  const identity = await tx.riderProfile.findUnique({
    where: { userId: riderUserId },
    select: { id: true },
  });
  if (!identity) throw ApiError.notFound('Rider profile not found');

  await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', identity.id);
  return identity.id;
}

/** Exported for a focused authorization regression test; this exact middleware guards the route below. */
export const requireVehicleReviewAdmin = requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);
export const requireAssetFinancingAdmin = requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);

export async function getCurrentAssetFinancingInterestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const state = await AssetFinancingService.getCurrentState(req.user!.userId);
  res.status(StatusCodes.OK).json({ success: true, data: state });
}

export async function registerAssetFinancingInterestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await AssetFinancingService.registerInterest(req.user!.userId, {
    assetType: req.body.assetType,
    ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
  });
  const statusCode = result.outcome === 'CREATED' ? StatusCodes.CREATED : StatusCodes.OK;
  res.status(statusCode).json({
    success: true,
    data: {
      ...result,
      message: result.outcome === 'UNCHANGED'
        ? 'Your existing asset-financing interest is already registered.'
        : 'Your interest has been registered for eligibility review.',
    },
  });
}

export async function listAssetFinancingInterestsForAdminHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await AssetFinancingService.listForAdmin(
    req.query as unknown as ListAssetFinancingInterestsQuery,
  );
  res.status(StatusCodes.OK).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
}

export async function updateAssetFinancingInterestStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const interest = await AssetFinancingService.updateStatus(
    String(req.params.interestId),
    req.user!.userId,
    req.body,
    adminAuditContext(req),
  );
  res.status(StatusCodes.OK).json({ success: true, data: interest });
}

export async function reviewVehicleHandler(req: Request, res: Response): Promise<void> {
  const riderUserId = String(req.params.riderId);
  const vehicleId = String(req.params.vehicleId);
  const { status, rejectionReason } = req.body as {
    status: 'APPROVED' | 'REJECTED';
    rejectionReason?: string;
  };

  const vehicle = await VehicleService.review({
    vehicleId,
    riderUserId,
    reviewerUserId: req.user!.userId,
    status,
    rejectionReason,
    auditContext: adminAuditContext(req),
  });

  const approved = status === 'APPROVED';
  try {
    await NotificationService.create({
      userId: riderUserId,
      title: approved ? 'Vehicle Approved' : 'Vehicle Not Approved',
      body: approved
        ? 'Your delivery vehicle has been approved by RiderGuy.'
        : `Your delivery vehicle was not approved: ${rejectionReason}`,
      type: 'SYSTEM',
      data: {
        vehicleId,
        status,
        ...(rejectionReason ? { rejectionReason } : {}),
      },
    });
  } catch (error) {
    // The vehicle decision is already persisted. A transient notification
    // failure must not produce a misleading 500 that invites a duplicate
    // review; log it for operational retry instead.
    logger.error(
      { error, riderUserId, vehicleId, status },
      'Vehicle review notification failed after the decision was persisted',
    );
  }

  res.status(StatusCodes.OK).json({ success: true, data: vehicle });
}

/** GET /riders/profile — get own rider profile */
router.get(
  '/profile',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const profile = await prisma.riderProfile.findUnique({
      where: { userId: req.user!.userId },
      include: {
        vehicles: true,
        currentZone: { select: { id: true, name: true } },
      },
    });

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  })
);

/** PATCH /riders/availability — also accepts initial GPS so lat/lng is never null */
router.patch(
  '/availability',
  requireRole(UserRole.RIDER),
  validate(updateAvailabilitySchema),
  asyncHandler(async (req, res) => {
    const { availability, latitude, longitude } = req.body;
    const profile = await prisma.$transaction(async (tx) => {
      const riderProfileId = await lockRiderVehicleStateForUser(tx, req.user!.userId);

      let existingSessionStartedAt: Date | null = null;
      // Re-read the complete gate after taking the same RiderProfile-scoped
      // lock used by vehicle review and dispatch.
      if (availability === 'ONLINE') {
        const currentProfile = await tx.riderProfile.findUnique({
          where: { id: riderProfileId },
          select: {
            onboardingStatus: true,
            isVerified: true,
            suspendedUntil: true,
            availability: true,
            sessionStartedAt: true,
            user: { select: { status: true } },
            vehicles: { select: { reviewStatus: true } },
          },
        });
        if (!currentProfile) throw ApiError.notFound('Rider profile not found');

        assertRiderWorkEligible(currentProfile);
        if (currentProfile.suspendedUntil && currentProfile.suspendedUntil > new Date()) {
          throw ApiError.forbidden(
            `Your account is suspended until ${currentProfile.suspendedUntil.toISOString()}. You cannot go online during a suspension.`,
          );
        }
        if (currentProfile.availability === 'ONLINE' || currentProfile.availability === 'ON_DELIVERY') {
          existingSessionStartedAt = currentProfile.sessionStartedAt;
        }
      }

      const updateData: Record<string, unknown> = { availability };
      if (availability === 'ONLINE') {
        updateData.sessionStartedAt = resolveOnlineSessionStartedAt(existingSessionStartedAt);
      }
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        updateData.currentLatitude = latitude;
        updateData.currentLongitude = longitude;
        updateData.lastLocationUpdate = new Date();
      }

      return tx.riderProfile.update({
        where: { id: riderProfileId },
        data: updateData,
      });
    });

    // Sync presence manager when rider toggles availability
    if (availability === 'OFFLINE') {
      await forceRiderOffline(req.user!.userId);
    }

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  })
);

/** POST /riders/location — update rider location */
router.post(
  '/location',
  requireRole(UserRole.RIDER),
  validate(updateLocationSchema),
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.body;

    const profile = await prisma.riderProfile.update({
      where: { userId: req.user!.userId },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationUpdate: new Date(),
      },
    });

    // Record heartbeat — keeps presence alive for the rider session
    recordHeartbeat(req.user!.userId, { latitude, longitude });

    // Write LocationHistory breadcrumbs for any active orders (REST fallback)
    const activeOrders = await prisma.order.findMany({
      where: { riderId: profile.id, status: { in: ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'] } },
      select: { id: true },
    });
    if (activeOrders.length > 0) {
      prisma.locationHistory.createMany({
        data: activeOrders.map((o) => ({
          riderId: profile.id,
          orderId: o.id,
          latitude,
          longitude,
        })),
      }).catch(() => {});
    }

    res.status(StatusCodes.OK).json({ success: true, data: { latitude, longitude } });
  })
);

/** GET /riders/nearby — Get online riders near a given location (for client maps) */
router.get(
  '/nearby',
  asyncHandler(async (req, res) => {
    const latitude = parseFloat(req.query.latitude as string);
    const longitude = parseFloat(req.query.longitude as string);
    const radiusKm = Math.min(parseFloat(req.query.radius as string) || 5, 50);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw ApiError.badRequest('Valid latitude and longitude are required');
    }

    // Find riders who are ONLINE with recent GPS data (last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const riders = await prisma.riderProfile.findMany({
      where: {
        availability: 'ONLINE',
        ...riderWorkEligibilityWhere(),
        currentLatitude: { not: null },
        currentLongitude: { not: null },
        lastLocationUpdate: { gte: thirtyMinutesAgo },
      },
      select: {
        id: true,
        currentLatitude: true,
        currentLongitude: true,
        user: { select: { firstName: true } },
      },
    });

    // Filter by distance (haversine approximation)
    const DEG_TO_RAD = Math.PI / 180;
    const nearbyRiders = riders
      .map((r) => {
        const rLat = r.currentLatitude!;
        const rLng = r.currentLongitude!;
        const dLat = (rLat - latitude) * DEG_TO_RAD;
        const dLng = (rLng - longitude) * DEG_TO_RAD;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(latitude * DEG_TO_RAD) *
            Math.cos(rLat * DEG_TO_RAD) *
            Math.sin(dLng / 2) ** 2;
        const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { id: r.id, latitude: rLat, longitude: rLng, firstName: r.user?.firstName, distKm };
      })
      .filter((r) => r.distKm <= radiusKm)
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 50); // cap at 50

    res.status(StatusCodes.OK).json({ success: true, data: nearbyRiders });
  })
);

/** GET /riders (admin only) — list all riders */
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPATCHER),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [riders, total] = await Promise.all([
      prisma.riderProfile.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              status: true,
            },
          },
        },
      }),
      prisma.riderProfile.count(),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: riders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  })
);

// ────────────────────────── Onboarding ──────────────────────────

/** GET /riders/onboarding — get onboarding progress checklist */
router.get(
  '/onboarding',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const progress = await OnboardingService.getProgress(req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: progress });
  }),
);

/** POST /riders/onboarding/channel — confirm Guest or redeem an In-House invitation */
router.post(
  '/onboarding/channel',
  requireRole(UserRole.RIDER),
  validate(selectRiderChannelSchema),
  asyncHandler(async (req, res) => {
    const profile = await OnboardingService.selectChannel(
      req.user!.userId,
      req.body.channel,
      req.body.invitationCode,
    );
    res.status(StatusCodes.OK).json({ success: true, data: profile });
  }),
);

/** GET /riders/training — persisted RiderGuy training progress */
router.get(
  '/training',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const training = await OnboardingService.getTraining(req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: training });
  }),
);

/** GET /riders/asset-financing/interests — get the signed-in Rider's current interest state */
router.get(
  '/asset-financing/interests',
  requireRole(UserRole.RIDER),
  asyncHandler(getCurrentAssetFinancingInterestHandler),
);

/** POST /riders/asset-financing/interests — idempotently register verified In-House Rider interest */
router.post(
  '/asset-financing/interests',
  requireRole(UserRole.RIDER),
  // The app-level global limiter remains IP-based; this second budget follows
  // the authenticated Rider so shared mobile-carrier IPs do not block peers.
  sensitiveUserRateLimit,
  validate(createAssetFinancingInterestSchema),
  asyncHandler(registerAssetFinancingInterestHandler),
);

/** GET /riders/asset-financing/interests/admin — discoverable admin review queue */
router.get(
  '/asset-financing/interests/admin',
  requireAssetFinancingAdmin,
  validate(listAssetFinancingInterestsQuerySchema, 'query'),
  asyncHandler(listAssetFinancingInterestsForAdminHandler),
);

/** PATCH /riders/asset-financing/interests/:interestId/status — manage an interest (admin) */
router.patch(
  '/asset-financing/interests/:interestId/status',
  requireAssetFinancingAdmin,
  validate(updateAssetFinancingInterestStatusSchema),
  asyncHandler(updateAssetFinancingInterestStatusHandler),
);

/** POST /riders/training/:moduleKey/complete — idempotently record completion */
router.post(
  '/training/:moduleKey/complete',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const completion = await OnboardingService.completeTrainingModule(
      req.user!.userId,
      String(req.params.moduleKey).toUpperCase(),
    );
    res.status(StatusCodes.OK).json({ success: true, data: completion });
  }),
);

// ────────────────────────── Vehicles ──────────────────────────

/** POST /riders/vehicles — register a new vehicle */
router.post(
  '/vehicles',
  requireRole(UserRole.RIDER),
  validate(registerVehicleSchema),
  asyncHandler(async (req, res) => {
    const profileId = await getRiderProfileId(req.user!.userId);
    const vehicle = await VehicleService.register({ riderId: profileId, ...req.body });
    res.status(StatusCodes.CREATED).json({ success: true, data: vehicle });
  }),
);

/** GET /riders/vehicles — list rider's vehicles */
router.get(
  '/vehicles',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const profileId = await getRiderProfileId(req.user!.userId);
    const vehicles = await VehicleService.listByRider(profileId);
    res.status(StatusCodes.OK).json({ success: true, data: vehicles });
  }),
);

/** GET /riders/vehicles/:vehicleId — get a single vehicle */
router.get(
  '/vehicles/:vehicleId',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const vehicleId = req.params.vehicleId as string;
    const vehicle = await VehicleService.getById(vehicleId);

    if (!vehicle) {
      throw ApiError.notFound('Vehicle not found');
    }

    // Riders can only view their own vehicles
    const profileId = await getRiderProfileId(req.user!.userId);
    if (vehicle.riderId !== profileId) {
      throw ApiError.forbidden('Access denied');
    }

    res.status(StatusCodes.OK).json({ success: true, data: vehicle });
  }),
);

/** PATCH /riders/vehicles/:vehicleId — update vehicle details */
router.patch(
  '/vehicles/:vehicleId',
  requireRole(UserRole.RIDER),
  validate(updateVehicleSchema),
  asyncHandler(async (req, res) => {
    const vehicleId = req.params.vehicleId as string;

    // Verify ownership
    const profileId = await getRiderProfileId(req.user!.userId);
    const existing = await VehicleService.getById(vehicleId);
    if (!existing || existing.riderId !== profileId) {
      throw ApiError.notFound('Vehicle not found');
    }

    const vehicle = await VehicleService.update(vehicleId, profileId, req.body);
    res.status(StatusCodes.OK).json({ success: true, data: vehicle });
  }),
);

/** DELETE /riders/vehicles/:vehicleId — remove vehicle */
router.delete(
  '/vehicles/:vehicleId',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const vehicleId = req.params.vehicleId as string;

    const profileId = await getRiderProfileId(req.user!.userId);
    const existing = await VehicleService.getById(vehicleId);
    if (!existing || existing.riderId !== profileId) {
      throw ApiError.notFound('Vehicle not found');
    }

    await VehicleService.remove(vehicleId, profileId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'Vehicle removed' },
    });
  }),
);

/** POST /riders/vehicles/:vehicleId/photos — upload vehicle photos */
router.post(
  '/vehicles/:vehicleId/photos',
  requireRole(UserRole.RIDER),
  vehiclePhotoUpload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest('No photo file provided');
    }

    const vehicleId = req.params.vehicleId as string;
    const position = req.body.position as 'front' | 'back' | 'left' | 'right';

    if (!['front', 'back', 'left', 'right'].includes(position)) {
      throw ApiError.badRequest('Position must be one of: front, back, left, right');
    }

    // Verify ownership
    const profileId = await getRiderProfileId(req.user!.userId);
    const existing = await VehicleService.getById(vehicleId);
    if (!existing || existing.riderId !== profileId) {
      throw ApiError.notFound('Vehicle not found');
    }

    // Read file buffer for upload
    const fsSync = await import('node:fs');
    const buffer = fsSync.readFileSync(req.file.path);

    // Upload photo via VehicleService
    const vehicle = await VehicleService.uploadPhoto({
      vehicleId,
      riderId: profileId,
      position,
      buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    // Clean up temp file
    fsSync.unlinkSync(req.file.path);
    res.status(StatusCodes.OK).json({ success: true, data: vehicle });
  }),
);

/** PATCH /riders/vehicles/:vehicleId/primary — set as primary vehicle */
router.patch(
  '/vehicles/:vehicleId/primary',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const vehicleId = req.params.vehicleId as string;

    const profileId = await getRiderProfileId(req.user!.userId);
    const existing = await VehicleService.getById(vehicleId);
    if (!existing || existing.riderId !== profileId) {
      throw ApiError.notFound('Vehicle not found');
    }

    const vehicle = await VehicleService.setPrimary(vehicleId, profileId);
    res.status(StatusCodes.OK).json({ success: true, data: vehicle });
  }),
);

// ──────────── Admin — rider application management ────────────

/** POST /riders/invitations — issue a targeted one-time In-House invitation */
router.post(
  '/invitations',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createInHouseInvitationSchema),
  asyncHandler(async (req, res) => {
    const invitation = await OnboardingService.createInHouseInvitation(
      req.user!.userId,
      req.body,
      adminAuditContext(req),
    );
    res.status(StatusCodes.CREATED).json({ success: true, data: invitation });
  }),
);

/** GET /riders/invitations — list invitation metadata (plaintext codes are never stored) */
router.get(
  '/invitations',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (_req, res) => {
    const invitations = await OnboardingService.listInHouseInvitations();
    res.status(StatusCodes.OK).json({ success: true, data: invitations });
  }),
);

/** GET /riders/profile/:riderId — get a single rider profile by userId (admin) */
router.get(
  '/profile/:riderId',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const riderId = req.params.riderId as string;

    const profile = await prisma.riderProfile.findUnique({
      where: { userId: riderId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        vehicles: {
          include: {
            reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        trainingCompletions: { orderBy: { moduleKey: 'asc' } },
        channelInvitation: {
          select: { id: true, targetEmail: true, targetPhone: true, expiresAt: true, usedAt: true },
        },
      },
    });

    if (!profile) {
      throw ApiError.notFound('Rider profile not found');
    }

    const readiness = await OnboardingService.getApprovalReadiness(riderId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { ...profile, approvalReadiness: { ready: readiness.ready, missing: readiness.missing } },
    });
  }),
);

/** PATCH /riders/:riderId/vehicles/:vehicleId/review — approve or reject a Rider's vehicle (admin) */
router.patch(
  '/:riderId/vehicles/:vehicleId/review',
  requireVehicleReviewAdmin,
  validate(reviewVehicleSchema),
  asyncHandler(reviewVehicleHandler),
);

/** GET /riders/applications — list riders with pending onboarding (admin) */
router.get(
  '/applications',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const channel = req.query.channel === 'GUEST' || req.query.channel === 'IN_HOUSE'
      ? req.query.channel
      : undefined;
    const requestedChannel = req.query.requestedChannel === 'GUEST' || req.query.requestedChannel === 'IN_HOUSE'
      ? req.query.requestedChannel
      : undefined;
    const requestedStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
    const allowedStatuses = new Set([
      'REGISTERED', 'DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'DOCUMENTS_UNDER_REVIEW',
      'DOCUMENTS_APPROVED', 'DOCUMENTS_REJECTED', 'TRAINING_PENDING', 'TRAINING_COMPLETE',
      'APPLICATION_REJECTED', 'ACTIVATED',
    ]);
    const status = requestedStatus && allowedStatuses.has(requestedStatus) ? requestedStatus : undefined;
    const where: any = {
      ...(status
        ? { onboardingStatus: status }
        : { OR: [{ onboardingStatus: { not: 'ACTIVATED' } }, { riderChannel: null }] }),
      ...(channel
        ? { AND: [{ OR: [{ riderChannel: channel }, { riderChannel: null, requestedRiderChannel: channel }] }] }
        : {}),
      ...(requestedChannel ? { requestedRiderChannel: requestedChannel } : {}),
    };

    const [riders, total] = await Promise.all([
      prisma.riderProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              createdAt: true,
            },
          },
          vehicles: true,
          trainingCompletions: { orderBy: { moduleKey: 'asc' } },
        },
      }),
      prisma.riderProfile.count({ where }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: riders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

/** PATCH /riders/:riderId/approve — approve a rider application (admin) */
router.patch(
  '/:riderId/training/:moduleKey/verify',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const completion = await OnboardingService.verifyTrainingModule(
      req.user!.userId,
      String(req.params.riderId),
      String(req.params.moduleKey).toUpperCase(),
      adminAuditContext(req),
    );
    res.status(StatusCodes.OK).json({ success: true, data: completion });
  }),
);

/** PATCH /riders/:riderId/training/:moduleKey/review — verify or revoke verification. */
router.patch(
  '/:riderId/training/:moduleKey/review',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(reviewTrainingModuleSchema),
  asyncHandler(async (req, res) => {
    const completion = await OnboardingService.reviewTrainingModule(
      req.user!.userId,
      String(req.params.riderId),
      String(req.params.moduleKey).toUpperCase(),
      req.body.decision,
      req.body.reason,
      adminAuditContext(req),
    );
    res.status(StatusCodes.OK).json({ success: true, data: completion });
  }),
);

/** PATCH /riders/:riderId/channel — explicit admin classification for legacy Riders. */
router.patch(
  '/:riderId/channel',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(adminClassifyRiderChannelSchema),
  asyncHandler(async (req, res) => {
    const riderId = String(req.params.riderId);
    const channel = req.body.channel as 'GUEST' | 'IN_HOUSE';

    const profile = await prisma.$transaction(async (tx) => {
      await lockRiderVehicleStateForUser(tx, riderId);
      const existing = await tx.riderProfile.findUnique({ where: { userId: riderId } });
      if (!existing) throw ApiError.notFound('Rider profile not found');
      if (existing.riderChannel) {
        throw ApiError.conflict('This Rider already has a verified channel classification.');
      }
      const now = new Date();
      const updated = await tx.riderProfile.update({
        where: { userId: riderId },
        data: {
          riderChannel: channel,
          requestedRiderChannel: channel,
          channelVerifiedAt: now,
          channelInvitationId: null,
          applicationReviewedAt: now,
          applicationReviewedById: req.user!.userId,
        },
      });
      const context = adminAuditContext(req);
      await AdminAuditService.record({
        ...context,
        action: 'rider_channel.classified',
        entityType: 'RiderProfile',
        entityId: existing.id,
        oldData: {
          riderChannel: existing.riderChannel,
          requestedRiderChannel: existing.requestedRiderChannel,
        },
        newData: { riderChannel: channel, classifiedAt: now },
      }, tx);
      return updated;
    });
    if (profile.onboardingStatus !== 'ACTIVATED') {
      await OnboardingService.recalculateStatus(riderId);
    }

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  }),
);

router.patch(
  '/:riderId/approve',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const riderId = req.params.riderId as string;
    const now = new Date();
    const profile = await prisma.$transaction(async (tx) => {
      // Vehicle writes lock RiderProfile.id (the Vehicle FK), so activation
      // must use that exact identity rather than User.id.
      await lockRiderVehicleStateForUser(tx, riderId);
      const readiness = await OnboardingService.getApprovalReadiness(riderId, tx);
      if (readiness.rider.onboardingStatus === 'ACTIVATED') {
        throw ApiError.conflict('This Rider application is already activated.');
      }
      if (!readiness.ready) {
        throw ApiError.badRequest(
          'This Rider cannot be activated until all required checks are complete.',
          'RIDER_ONBOARDING_INCOMPLETE',
          { missing: readiness.missing },
        );
      }

      const activated = await tx.riderProfile.update({
        where: { userId: riderId },
        data: {
          onboardingStatus: 'ACTIVATED',
          isVerified: true,
          activatedAt: now,
          availability: 'OFFLINE',
          applicationRejectionReason: null,
          applicationReviewedAt: now,
          applicationReviewedById: req.user!.userId,
        },
      });
      await tx.user.update({ where: { id: riderId }, data: { status: 'ACTIVE' } });
      const context = adminAuditContext(req);
      await AdminAuditService.record({
        ...context,
        action: 'rider_application.activated',
        entityType: 'RiderProfile',
        entityId: activated.id,
        oldData: {
          onboardingStatus: readiness.rider.onboardingStatus,
          isVerified: readiness.rider.isVerified,
          accountStatus: readiness.rider.user.status,
        },
        newData: {
          riderUserId: riderId,
          onboardingStatus: activated.onboardingStatus,
          isVerified: activated.isVerified,
          accountStatus: 'ACTIVE',
          activatedAt: activated.activatedAt,
        },
      }, tx);
      return activated;
    });

    try {
      await NotificationService.create({
        userId: riderId,
        title: 'Application Approved!',
        body: 'Your rider application has been approved. You can now start accepting deliveries.',
        type: 'TRAINING',
        data: { status: 'ACTIVATED' },
      });
    } catch (error) {
      logger.error({ error, riderId }, 'Rider activation notification failed after the decision was persisted');
    }

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  }),
);

/** PATCH /riders/:riderId/reject — reject a rider application (admin) */
router.patch(
  '/:riderId/reject',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(rejectRiderApplicationSchema),
  asyncHandler(async (req, res) => {
    const riderId = req.params.riderId as string;
    const { reason } = req.body;

    const profile = await prisma.$transaction(async (tx) => {
      await lockRiderVehicleStateForUser(tx, riderId);
      const existing = await tx.riderProfile.findUnique({ where: { userId: riderId } });
      if (!existing) throw ApiError.notFound('Rider profile not found');
      if (existing.onboardingStatus === 'ACTIVATED') {
        throw ApiError.conflict('An activated Rider cannot be rejected. Suspend or deactivate the account instead.');
      }
      const reviewedAt = new Date();
      const rejected = await tx.riderProfile.update({
        where: { userId: riderId },
        data: {
          onboardingStatus: 'APPLICATION_REJECTED',
          isVerified: false,
          activatedAt: null,
          availability: 'OFFLINE',
          applicationRejectionReason: reason,
          applicationReviewedAt: reviewedAt,
          applicationReviewedById: req.user!.userId,
        },
      });
      const context = adminAuditContext(req);
      await AdminAuditService.record({
        ...context,
        action: 'rider_application.rejected',
        entityType: 'RiderProfile',
        entityId: existing.id,
        oldData: {
          onboardingStatus: existing.onboardingStatus,
          isVerified: existing.isVerified,
          applicationRejectionReason: existing.applicationRejectionReason,
        },
        newData: {
          riderUserId: riderId,
          onboardingStatus: rejected.onboardingStatus,
          reason,
          reviewedAt,
        },
      }, tx);
      return rejected;
    });

    try {
      await NotificationService.create({
        userId: riderId,
        title: 'Application Not Approved',
        body: reason,
        type: 'TRAINING',
        data: { status: 'APPLICATION_REJECTED', reason },
      });
    } catch (error) {
      logger.error({ error, riderId }, 'Rider rejection notification failed after the decision was persisted');
    }

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  }),
);

// ============================================================
// Cancellation History & Appeals
// ============================================================

/** GET /riders/cancellations — Rider's cancellation history */
router.get(
  '/cancellations',
  authenticate,
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const { getRiderCancellationHistory } = await import('../../services/cancellation.service');
    const riderProfile = await prisma.riderProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { id: true, cancellationCount: true, suspendedUntil: true },
    });
    if (!riderProfile) throw ApiError.notFound('Rider profile not found');

    const records = await getRiderCancellationHistory(riderProfile.id);
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        totalCancellations: riderProfile.cancellationCount,
        suspendedUntil: riderProfile.suspendedUntil,
        records,
      },
    });
  }),
);

/** POST /riders/cancellations/:recordId/appeal — Rider submits appeal */
router.post(
  '/cancellations/:recordId/appeal',
  authenticate,
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const { submitAppeal } = await import('../../services/cancellation.service');
    const { statement, evidenceUrls } = req.body;
    if (!statement || typeof statement !== 'string' || !statement.trim()) {
      throw ApiError.badRequest('Appeal statement is required');
    }

    const appeal = await submitAppeal(
      req.params.recordId as string,
      req.user!.userId,
      statement.trim(),
      Array.isArray(evidenceUrls) ? evidenceUrls : [],
    );
    res.status(StatusCodes.CREATED).json({ success: true, data: appeal });
  }),
);

export { router as riderRouter };
