import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import {
  updateAvailabilitySchema,
  updateLocationSchema,
  registerVehicleSchema,
  selectRiderChannelSchema,
  createInHouseInvitationSchema,
  rejectRiderApplicationSchema,
  adminClassifyRiderChannelSchema,
} from '@riderguy/validators';
import { VehicleService } from '../../services/vehicle.service';
import { OnboardingService } from '../../services/onboarding.service';
import { NotificationService } from '../../services/notification.service';
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
import type { Request } from 'express';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

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
    let existingSessionStartedAt: Date | null = null;

    // Gate: only fully approved riders with an active account can go ONLINE.
    if (availability === 'ONLINE') {
      const currentProfile = await prisma.riderProfile.findUnique({
        where: { userId: req.user!.userId },
        select: {
          onboardingStatus: true,
          isVerified: true,
          suspendedUntil: true,
          availability: true,
          sessionStartedAt: true,
          user: { select: { status: true } },
        },
      });
      if (!currentProfile) {
        throw ApiError.notFound('Rider profile not found');
      }
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

    // Build update data — always set availability
    const updateData: Record<string, unknown> = { availability };
    if (availability === 'ONLINE') {
      updateData.sessionStartedAt = resolveOnlineSessionStartedAt(existingSessionStartedAt);
    }

    // If coordinates provided (rider going ONLINE), persist initial GPS immediately
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      updateData.currentLatitude = latitude;
      updateData.currentLongitude = longitude;
      updateData.lastLocationUpdate = new Date();
    }

    const profile = await prisma.riderProfile.update({
      where: { userId: req.user!.userId },
      data: updateData,
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
    const invitation = await OnboardingService.createInHouseInvitation(req.user!.userId, req.body);
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
        vehicles: true,
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
    const existing = await prisma.riderProfile.findUnique({ where: { userId: riderId } });
    if (!existing) throw ApiError.notFound('Rider profile not found');
    if (existing.riderChannel) {
      throw ApiError.conflict('This Rider already has a verified channel classification.');
    }

    const profile = await prisma.riderProfile.update({
      where: { userId: riderId },
      data: {
        riderChannel: channel,
        requestedRiderChannel: channel,
        channelVerifiedAt: new Date(),
        channelInvitationId: null,
        applicationReviewedAt: new Date(),
        applicationReviewedById: req.user!.userId,
      },
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
    const readiness = await OnboardingService.getApprovalReadiness(riderId);
    if (!readiness.ready) {
      throw ApiError.badRequest(
        'This Rider cannot be activated until all required checks are complete.',
        'RIDER_ONBOARDING_INCOMPLETE',
        { missing: readiness.missing },
      );
    }

    const now = new Date();
    const profile = await prisma.$transaction(async (tx) => {
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
      return activated;
    });

    // Notify the rider
    await NotificationService.create({
      userId: riderId,
      title: 'Application Approved!',
      body: 'Your rider application has been approved. You can now start accepting deliveries.',
      type: 'TRAINING',
      data: { status: 'ACTIVATED' },
    });

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

    const profile = await prisma.riderProfile.update({
      where: { userId: riderId },
      data: {
        onboardingStatus: 'APPLICATION_REJECTED',
        isVerified: false,
        activatedAt: null,
        availability: 'OFFLINE',
        applicationRejectionReason: reason,
        applicationReviewedAt: new Date(),
        applicationReviewedById: req.user!.userId,
      },
    });

    await NotificationService.create({
      userId: riderId,
      title: 'Application Not Approved',
      body: reason || 'Your application was not approved at this time. Please check your documents.',
      type: 'TRAINING',
      data: { status: 'APPLICATION_REJECTED', reason },
    });

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
