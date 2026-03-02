import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import {
  createOrderSchema,
  priceEstimateSchema,
  cancelOrderSchema,
  rateOrderSchema,
} from '@riderguy/validators';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';
import * as OrderService from '../../services/order.service';
import * as DispatchService from '../../services/dispatch.service';
import * as GeocodingService from '../../services/geocoding.service';
import { formatPlusCode, decodePlusCode, isValidPlusCode, isFullPlusCode, recoverPlusCode } from '@riderguy/utils';
import * as TrackingService from '../../services/tracking.service';
import { notifyNearbyRiders } from '../../services/notification.service';
import { autoDispatch } from '../../services/auto-dispatch.service';
import { emitOrderStatusUpdate } from '../../socket';
import { prisma } from '@riderguy/database';
import type { OrderStatus } from '@prisma/client';
import multer from 'multer';
import type { Request } from 'express';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';

// ============================================================
// Multer config for package photo & proof-of-delivery uploads
// ============================================================

const tempStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) =>
    cb(null, os.tmpdir()),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `riderguy-order-${crypto.randomUUID()}${ext}`);
  },
});

const packagePhotoUpload = multer({
  storage: tempStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB for videos
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
    cb(null, ALLOWED.includes(file.mimetype));
  },
});

const proofUpload = multer({
  storage: tempStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, ALLOWED.includes(file.mimetype));
  },
});

// ============================================================
// Order Routes — Sprint 4+5: Core Delivery Flow + Tracking
// ============================================================

const router = Router();

router.use(authenticate);

// ─────────────────────────────────────────────────────────────
// Price Estimation & Geocoding (public to authenticated users)
// ─────────────────────────────────────────────────────────────

/** POST /orders/upload-photo — Upload a package photo/video (multipart) */
router.post(
  '/upload-photo',
  packagePhotoUpload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest('No file uploaded');

    // Move from temp → uploads/packages/
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const storedName = `pkg-${crypto.randomUUID()}${ext}`;
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'packages');
    await fs.mkdir(uploadsDir, { recursive: true });
    const destPath = path.join(uploadsDir, storedName);
    await fs.rename(file.path, destPath);

    const photoUrl = `/api/v1/uploads/packages/${storedName}`;
    res.status(StatusCodes.OK).json({ success: true, data: { url: photoUrl } });
  }),
);

/** POST /orders/estimate — Get a price estimate */
router.post(
  '/estimate',
  validate(priceEstimateSchema),
  asyncHandler(async (req, res) => {
    const estimate = await OrderService.getEstimate(req.body);
    res.status(StatusCodes.OK).json({ success: true, data: estimate });
  }),
);

/** GET /orders/geocode — Forward geocode an address */
router.get(
  '/geocode',
  asyncHandler(async (req, res) => {
    const address = req.query.address as string;
    if (!address || address.length < 2) {
      throw ApiError.badRequest('Address query parameter is required');
    }
    const results = await GeocodingService.forwardGeocode(address);
    res.status(StatusCodes.OK).json({ success: true, data: results });
  }),
);

/** GET /orders/autocomplete — Address autocomplete (Search Box v1 suggest) */
router.get(
  '/autocomplete',
  asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      res.status(StatusCodes.OK).json({ success: true, data: [] });
      return;
    }

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const proximity = !isNaN(lat) && !isNaN(lng) ? { lat, lng } : undefined;
    const sessionToken = req.query.session_token as string | undefined;

    const suggestions = await GeocodingService.autocomplete(query, { proximity, sessionToken });
    res.status(StatusCodes.OK).json({ success: true, data: suggestions });
  }),
);

/** GET /orders/retrieve-place/:id — Retrieve full place details (coordinates, address, Plus Code) */
router.get(
  '/retrieve-place/:id',
  asyncHandler(async (req, res) => {
    const mapboxId = req.params.id as string;
    if (!mapboxId) {
      throw ApiError.badRequest('Mapbox place ID is required');
    }

    const sessionToken = String(req.query.session_token ?? '') || undefined;
    const place = await GeocodingService.retrievePlace(mapboxId, sessionToken);

    if (!place) {
      throw ApiError.notFound('Place not found');
    }

    res.status(StatusCodes.OK).json({ success: true, data: place });
  }),
);

/** GET /orders/reverse-geocode — Reverse geocode coordinates to address */
router.get(
  '/reverse-geocode',
  asyncHandler(async (req, res) => {
    const latitude = parseFloat(req.query.latitude as string);
    const longitude = parseFloat(req.query.longitude as string);
    if (isNaN(latitude) || isNaN(longitude)) {
      throw ApiError.badRequest('Valid latitude and longitude query parameters are required');
    }
    const result = await GeocodingService.reverseGeocode(latitude, longitude);
    res.status(StatusCodes.OK).json({ success: true, data: result });
  }),
);

/** GET /orders/plus-code — Encode coordinates to Plus Code or decode a Plus Code */
router.get(
  '/plus-code',
  asyncHandler(async (req, res) => {
    const code = req.query.code as string | undefined;
    const latStr = req.query.latitude as string | undefined;
    const lngStr = req.query.longitude as string | undefined;

    // Decode: Plus Code → coordinates
    if (code) {
      if (!isValidPlusCode(code)) {
        throw ApiError.badRequest('Invalid Plus Code format');
      }
      let fullCode = code;
      if (!isFullPlusCode(code)) {
        // Short code — recover using Accra as reference
        const refLat = parseFloat(req.query.refLat as string) || 5.603;
        const refLng = parseFloat(req.query.refLng as string) || -0.187;
        fullCode = recoverPlusCode(code, refLat, refLng);
      }
      const area = decodePlusCode(fullCode);
      // Also reverse geocode the center to get an address
      const geocoded = await GeocodingService.reverseGeocode(area.latitudeCenter, area.longitudeCenter);
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          code: fullCode,
          latitude: area.latitudeCenter,
          longitude: area.longitudeCenter,
          address: geocoded?.address ?? null,
          bounds: {
            latLo: area.latitudeLo,
            latHi: area.latitudeHi,
            lngLo: area.longitudeLo,
            lngHi: area.longitudeHi,
          },
        },
      });
      return;
    }

    // Encode: coordinates → Plus Code
    const latitude = parseFloat(latStr ?? '');
    const longitude = parseFloat(lngStr ?? '');
    if (isNaN(latitude) || isNaN(longitude)) {
      throw ApiError.badRequest('Provide either "code" (Plus Code) or "latitude" & "longitude" query parameters');
    }
    const plusCode = formatPlusCode(latitude, longitude);
    res.status(StatusCodes.OK).json({ success: true, data: plusCode });
  }),
);

/** GET /orders/directions — Proxy Mapbox Directions API (keeps token server-side) */
router.get(
  '/directions',
  asyncHandler(async (req, res) => {
    const { coordinates, profile: driveProfile } = req.query;
    if (!coordinates || typeof coordinates !== 'string') {
      throw ApiError.badRequest('coordinates query parameter is required (format: lng,lat;lng,lat;...)');
    }

    const mapboxToken = (await import('../../config')).config.mapbox?.accessToken;
    if (!mapboxToken) throw ApiError.internal('Map service not configured');

    const routeProfile = driveProfile === 'cycling' ? 'cycling' : driveProfile === 'walking' ? 'walking' : 'driving-traffic';
    const url = `https://api.mapbox.com/directions/v5/mapbox/${routeProfile}/${coordinates}?geometries=geojson&overview=full&steps=true&alternatives=true&annotations=congestion,duration,distance&language=en&access_token=${mapboxToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw ApiError.internal('Directions service unavailable');
    }

    const data = await response.json();
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

// ─────────────────────────────────────────────────────────────
// Available Jobs (Rider Feed)
// ─────────────────────────────────────────────────────────────

/** GET /orders/available — Jobs available for the rider */
router.get(
  '/available',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const jobs = await OrderService.getAvailableJobs(req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: jobs });
  }),
);

// ─────────────────────────────────────────────────────────────
// Dispatch Queue (Admin)
// ─────────────────────────────────────────────────────────────

/** GET /orders/dispatch — Get dispatch queue for admin */
router.get(
  '/dispatch',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPATCHER),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const zoneId = req.query.zoneId as string | undefined;

    const result = await DispatchService.getDispatchQueue({ status, zoneId, page, limit });
    res.status(StatusCodes.OK).json({ success: true, ...result });
  }),
);

/** GET /orders/dispatch/riders — Get available riders for assignment */
router.get(
  '/dispatch/riders',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPATCHER),
  asyncHandler(async (req, res) => {
    const zoneId = req.query.zoneId as string | undefined;
    const riders = await DispatchService.getAvailableRiders(zoneId);
    res.status(StatusCodes.OK).json({ success: true, data: riders });
  }),
);

// ─────────────────────────────────────────────────────────────
// Order CRUD
// ─────────────────────────────────────────────────────────────

/** POST /orders — Create a new delivery order */
router.post(
  '/',
  requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT),
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await OrderService.createOrder(req.user!.userId, req.body);

    // Auto-dispatch: find the best nearby rider and send targeted offer
    autoDispatch(order.id).catch(() => {});

    // Also broadcast to job feed as a fallback
    notifyNearbyRiders(
      order.id,
      order.orderNumber,
      order.zoneId,
      order.pickupAddress,
    ).catch(() => {}); // fire-and-forget

    res.status(StatusCodes.CREATED).json({ success: true, data: order });
  }),
);

/** GET /orders — List orders (scoped by role) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as OrderStatus | undefined;

    const result = await OrderService.listOrders(req.user!.userId, req.user!.role, {
      page,
      limit,
      status,
    });

    res.status(StatusCodes.OK).json({ success: true, data: result.orders, pagination: result.pagination });
  }),
);

/** GET /orders/:id — Get order details */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const order = await OrderService.getOrderById(orderId);

    // Access control
    const role = req.user!.role;
    const userId = req.user!.userId;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'DISPATCHER';

    if (!isAdmin) {
      const isClient = order.clientId === userId;
      let isRider = false;
      if (order.rider) {
        isRider = order.rider.userId === userId;
      }
      if (!isClient && !isRider) {
        throw ApiError.forbidden('You do not have access to this order');
      }
    }

    res.status(StatusCodes.OK).json({ success: true, data: order });
  }),
);

// ─────────────────────────────────────────────────────────────
// Order Actions
// ─────────────────────────────────────────────────────────────

/** POST /orders/:id/accept — Rider accepts a job */
router.post(
  '/:id/accept',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const order = await DispatchService.acceptJob(req.params.id as string, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: order });
  }),
);

/** POST /orders/:id/assign — Admin assigns a rider */
router.post(
  '/:id/assign',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPATCHER),
  asyncHandler(async (req, res) => {
    const { riderProfileId } = req.body;
    if (!riderProfileId) throw ApiError.badRequest('riderProfileId is required');

    const order = await DispatchService.assignRider(
      req.params.id as string,
      riderProfileId,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data: order });
  }),
);

/** POST /orders/:id/unassign — Admin unassigns a rider */
router.post(
  '/:id/unassign',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPATCHER),
  asyncHandler(async (req, res) => {
    const order = await DispatchService.unassignRider(req.params.id as string, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: order });
  }),
);

/** POST /orders/:id/reassign — Admin reassigns to a different rider */
router.post(
  '/:id/reassign',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPATCHER),
  asyncHandler(async (req, res) => {
    const { riderProfileId } = req.body;
    if (!riderProfileId) throw ApiError.badRequest('riderProfileId is required');

    const order = await DispatchService.reassignRider(
      req.params.id as string,
      riderProfileId,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data: order });
  }),
);

/** PATCH /orders/:id/status — Update order status (rider or admin) */
router.patch(
  '/:id/status',
  requireRole(UserRole.RIDER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPATCHER),
  asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    if (!status) throw ApiError.badRequest('status is required');

    const orderId = req.params.id as string;

    // If rider, verify they're assigned to this order
    const role = req.user!.role;
    let previousStatus = '';
    if (role === 'RIDER') {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw ApiError.notFound('Order not found');
      previousStatus = order.status;

      const riderProfile = await prisma.riderProfile.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!riderProfile || order.riderId !== riderProfile.id) {
        throw ApiError.forbidden('You are not assigned to this order');
      }
    } else {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      previousStatus = order?.status ?? '';
    }

    const order = await OrderService.transitionStatus(
      orderId,
      status as OrderStatus,
      req.user!.userId,
      note as string | undefined,
    );

    // Emit real-time status update via WebSocket
    emitOrderStatusUpdate({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      previousStatus,
      actor: req.user!.userId,
      note: note as string | undefined,
    });

    res.status(StatusCodes.OK).json({ success: true, data: order });
  }),
);

/** POST /orders/:id/cancel — Client cancels order */
router.post(
  '/:id/cancel',
  requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT),
  validate(cancelOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await OrderService.cancelOrder(
      req.params.id as string,
      req.user!.userId,
      req.body.reason,
    );
    res.status(StatusCodes.OK).json({ success: true, data: order });
  }),
);

/** POST /orders/:id/rate — Client rates the delivery */
router.post(
  '/:id/rate',
  requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT),
  validate(rateOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await OrderService.rateOrder(
      req.params.id as string,
      req.user!.userId,
      req.body.rating,
      req.body.review,
      req.body.tipAmount,
    );
    res.status(StatusCodes.OK).json({ success: true, data: order });
  }),
);

// ─────────────────────────────────────────────────────────────
// Sprint 5: Tracking, Messaging & Proof of Delivery
// ─────────────────────────────────────────────────────────────

/** GET /orders/:id/location — Get rider's current location for this order */
router.get(
  '/:id/location',
  asyncHandler(async (req, res) => {
    const result = await TrackingService.getRiderLocationForOrder(
      req.params.id as string,
      req.user!.userId,
    );
    res.status(StatusCodes.OK).json({ success: true, data: result });
  }),
);

/** GET /orders/:id/messages — Get chat messages for an order */
router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await TrackingService.getOrderMessages(
      req.params.id as string,
      req.user!.userId,
      { page, limit },
    );
    res.status(StatusCodes.OK).json({ success: true, ...result });
  }),
);

/** POST /orders/:id/proof — Upload proof of delivery (multipart photo or JSON signature/PIN) */
router.post(
  '/:id/proof',
  requireRole(UserRole.RIDER),
  proofUpload.single('file'),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const proofType = (req.body.proofType ?? req.query.proofType) as string;

    if (!proofType) throw ApiError.badRequest('proofType is required');

    const ALLOWED_PROOF_TYPES = ['PHOTO', 'SIGNATURE', 'PIN_CODE'];
    if (!ALLOWED_PROOF_TYPES.includes(proofType)) {
      throw ApiError.badRequest(`proofType must be one of: ${ALLOWED_PROOF_TYPES.join(', ')}`);
    }

    // Verify rider is assigned
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Order not found');

    const riderProfile = await prisma.riderProfile.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!riderProfile || order.riderId !== riderProfile.id) {
      throw ApiError.forbidden('You are not assigned to this order');
    }

    let proofUrl: string;

    if (proofType === 'PIN_CODE') {
      // PIN code doesn't need a file — just validate the pin
      const proofData = req.body.proofData as string;
      if (!proofData || proofData.length < 4) throw ApiError.badRequest('Valid PIN code required');
      proofUrl = `pin:${proofData}`;
    } else if (req.file) {
      // Multipart file upload (PHOTO or SIGNATURE)
      const fileName = `proof-${orderId}-${Date.now()}${path.extname(req.file.originalname) || '.png'}`;
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'proofs');
      await fs.mkdir(uploadsDir, { recursive: true });
      const destPath = path.join(uploadsDir, fileName);
      await fs.rename(req.file.path, destPath);
      proofUrl = `/api/v1/uploads/proofs/${fileName}`;
    } else if (req.body.proofData) {
      // Fallback: accept base64 for backward compatibility (signatures)
      const base64Data = (req.body.proofData as string).replace(/^data:image\/\w+;base64,/, '');
      const estimatedSize = Math.ceil(base64Data.length * 0.75);
      if (estimatedSize > 5 * 1024 * 1024) throw ApiError.badRequest('Proof exceeds 5MB');

      const fileName = `proof-${orderId}-${Date.now()}.png`;
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'proofs');
      await fs.mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, fileName);
      await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));
      proofUrl = `/api/v1/uploads/proofs/${fileName}`;
    } else {
      throw ApiError.badRequest('File upload or proofData is required');
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        proofOfDeliveryUrl: proofUrl,
        proofOfDeliveryType: proofType as 'PHOTO' | 'SIGNATURE' | 'PIN_CODE',
      },
    });

    res.status(StatusCodes.OK).json({ success: true, data: { proofUrl } });
  }),
);

/** POST /orders/:id/fail — Rider marks delivery as failed with evidence */
router.post(
  '/:id/fail',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const { reason, photoData } = req.body;

    if (!reason) throw ApiError.badRequest('Failure reason is required');

    // Verify rider is assigned
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Order not found');

    const riderProfile = await prisma.riderProfile.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!riderProfile || order.riderId !== riderProfile.id) {
      throw ApiError.forbidden('You are not assigned to this order');
    }

    // Save failure photo if provided
    let failurePhotoUrl: string | undefined;
    if (photoData) {
      // Validate base64 payload size (max 5MB decoded)
      const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
      const base64Data = photoData.replace(/^data:image\/\w+;base64,/, '');
      const estimatedSize = Math.ceil(base64Data.length * 0.75);
      if (estimatedSize > MAX_PHOTO_SIZE) {
        throw ApiError.badRequest('Failure photo exceeds maximum size of 5MB');
      }

      const fileName = `fail-${orderId}-${Date.now()}.png`;
      const fs = await import('fs/promises');
      const pathMod = await import('path');
      const uploadsDir = pathMod.resolve(process.cwd(), 'uploads', 'failures');
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(pathMod.join(uploadsDir, fileName), Buffer.from(base64Data, 'base64'));
      failurePhotoUrl = `/api/v1/uploads/failures/${fileName}`;
    }

    // Update failure photo URL if present
    if (failurePhotoUrl) {
      await prisma.order.update({
        where: { id: orderId },
        data: { failurePhotoUrl },
      });
    }

    // Transition to FAILED
    const previousStatus = order.status;
    const updated = await OrderService.transitionStatus(
      orderId,
      'FAILED' as OrderStatus,
      req.user!.userId,
      reason,
    );

    emitOrderStatusUpdate({
      orderId,
      orderNumber: updated.orderNumber,
      status: 'FAILED',
      previousStatus,
      actor: req.user!.userId,
      note: reason,
    });

    res.status(StatusCodes.OK).json({ success: true, data: updated });
  }),
);

export { router as orderRouter };
