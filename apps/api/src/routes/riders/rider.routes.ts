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
} from '@riderguy/validators';
import { VehicleService } from '../../services/vehicle.service';
import { OnboardingService } from '../../services/onboarding.service';
import { NotificationService } from '../../services/notification.service';
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

/** PATCH /riders/availability */
router.patch(
  '/availability',
  requireRole(UserRole.RIDER),
  validate(updateAvailabilitySchema),
  asyncHandler(async (req, res) => {
    const { availability } = req.body;

    const profile = await prisma.riderProfile.update({
      where: { userId: req.user!.userId },
      data: { availability },
    });

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

    // Find riders who are ONLINE with recent GPS data (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const riders = await prisma.riderProfile.findMany({
      where: {
        availability: 'ONLINE',
        onboardingStatus: 'ACTIVATED',
        currentLatitude: { not: null },
        currentLongitude: { not: null },
        lastLocationUpdate: { gte: tenMinutesAgo },
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
      },
    });

    if (!profile) {
      throw ApiError.notFound('Rider profile not found');
    }

    res.status(StatusCodes.OK).json({ success: true, data: profile });
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

    const [riders, total] = await Promise.all([
      prisma.riderProfile.findMany({
        where: {
          onboardingStatus: {
            in: ['DOCUMENTS_SUBMITTED', 'DOCUMENTS_UNDER_REVIEW'],
          },
        },
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
        },
      }),
      prisma.riderProfile.count({
        where: {
          onboardingStatus: {
            in: ['DOCUMENTS_SUBMITTED', 'DOCUMENTS_UNDER_REVIEW'],
          },
        },
      }),
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
  '/:riderId/approve',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const riderId = req.params.riderId as string;

    const profile = await prisma.riderProfile.update({
      where: { userId: riderId },
      data: {
        onboardingStatus: 'ACTIVATED',
        isVerified: true,
        activatedAt: new Date(),
      },
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
  asyncHandler(async (req, res) => {
    const riderId = req.params.riderId as string;
    const { reason } = req.body;

    const profile = await prisma.riderProfile.update({
      where: { userId: riderId },
      data: { onboardingStatus: 'DOCUMENTS_REJECTED' },
    });

    await NotificationService.create({
      userId: riderId,
      title: 'Application Not Approved',
      body: reason || 'Your application was not approved at this time. Please check your documents.',
      type: 'TRAINING',
      data: { status: 'DOCUMENTS_REJECTED', reason },
    });

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  }),
);

export { router as riderRouter };
