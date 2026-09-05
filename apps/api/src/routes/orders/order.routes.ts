import { Router } from 'express';
import {
  authenticate,
  getAuthRoles,
  hasAnyRole,
  requireRole,
  validate,
  sensitiveRateLimit,
} from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { z } from 'zod';
import {
  createOrderSchema,
  priceEstimateSchema,
  cancelOrderSchema,
  rateOrderSchema,
  ghanaOrderLatitudeSchema,
  ghanaOrderLongitudeSchema,
} from '@riderguy/validators';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';
import * as OrderService from '../../services/order.service';
import * as DispatchService from '../../services/dispatch.service';
import * as GeocodingService from '../../services/geocoding.service';
import {
  formatPlusCode,
  decodePlusCode,
  isValidPlusCode,
  isFullPlusCode,
  recoverPlusCode,
} from '@riderguy/utils';
import * as TrackingService from '../../services/tracking.service';
import { notifyNearbyRiders, createOrderNotification } from '../../services/notification.service';
import { autoDispatch, cancelDispatch } from '../../services/auto-dispatch.service';
import { emitOrderStatusUpdate } from '../../socket';
import * as CancelRequestService from '../../services/cancellation-request.service';
import { StorageService } from '../../services/storage.service';
import { prisma } from '@riderguy/database';
import { logger } from '../../lib/logger';
import type { OrderStatus } from '@prisma/client';
import multer from 'multer';
import type { Request } from 'express';
import os from 'node:os';
import path from 'node:path';
import { adminAuditContext } from '../../services/admin-audit.service';
import {
  completeRiderOrderStop,
  persistRiderOrderProof,
  sanitizeOrderPayloadForRequester,
} from './order-route-security';

// ── Google Routes API helpers ───────────────────────────

/** Decode a Google encoded polyline into GeoJSON LineString */
function decodeGooglePolyline(encoded: string): {
  type: 'LineString';
  coordinates: [number, number][];
} {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lng / 1e5, lat / 1e5]);
  }

  return { type: 'LineString', coordinates };
}

/** Parse Google duration string like "123s" or "123.456s" to seconds number */
function parseDuration(d: string): number {
  if (!d) return 0;
  const match = d.match(/^([\d.]+)s?$/);
  return match ? parseFloat(match[1]!) : 0;
}

type RoutePoint = { latitude: number; longitude: number };

/**
 * Deterministic no-provider route used when paid routing is disabled.
 * It intentionally describes the geometry as an estimate; rider navigation
 * is handed off to the installed navigation app for real road guidance.
 */
function buildEstimatedRoutes(points: RoutePoint[], travelMode: 'DRIVE' | 'BICYCLE' | 'WALK') {
  const speedKmh = travelMode === 'WALK' ? 5 : travelMode === 'BICYCLE' ? 15 : 25;
  const legs = points.slice(0, -1).map((origin, index) => {
    const destination = points[index + 1]!;
    const distance = Math.round(
      TrackingService.haversineKm(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude,
      ) * 1000,
    );
    const duration = Math.max(60, Math.round((distance / 1000 / speedKmh) * 3600));
    return {
      duration,
      distance,
      summary: 'Estimated direct route',
      steps: [],
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [origin.longitude, origin.latitude],
          [destination.longitude, destination.latitude],
        ] as [number, number][],
      },
    };
  });
  const distance = legs.reduce((total, leg) => total + leg.distance, 0);
  const duration = legs.reduce((total, leg) => total + leg.duration, 0);

  return [
    {
      geometry: {
        type: 'LineString' as const,
        coordinates: points.map((point) => [point.longitude, point.latitude] as [number, number]),
      },
      duration,
      distance,
      weight: duration,
      weight_name: 'estimated',
      legs,
      estimated: true,
    },
  ];
}
import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';

// ============================================================
// Multer config for package photo & proof-of-delivery uploads
// ============================================================

// Magic byte signatures for allowed file types
const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }[]> = {
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  'image/webp': [{ offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }], // after RIFF header
  'video/mp4': [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }], // ftyp box
  'video/quicktime': [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
  'video/webm': [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }], // EBML header
};

/** Verify file content matches declared MIME type via magic bytes */
function verifyMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const signatures = MAGIC_BYTES[declaredMime];
  if (!signatures) return false;
  return signatures.some((sig) => {
    if (buffer.length < sig.offset + sig.bytes.length) return false;
    return sig.bytes.every((b, i) => buffer[sig.offset + i] === b);
  });
}

const tempStorage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => cb(null, os.tmpdir()),
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `riderguy-order-${crypto.randomUUID()}${ext}`);
  },
});

const packagePhotoUpload = multer({
  storage: tempStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB for videos
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ALLOWED = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ];
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
  sensitiveRateLimit,
  requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT),
  packagePhotoUpload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest('No file uploaded');

    // Verify magic bytes match declared MIME type (prevents spoofed extensions)
    const header = Buffer.alloc(16);
    const fd = fsSync.openSync(file.path, 'r');
    try {
      fsSync.readSync(fd, header, 0, 16, 0);
    } finally {
      fsSync.closeSync(fd);
    }
    if (!verifyMagicBytes(header, file.mimetype)) {
      await fs.unlink(file.path).catch(() => {});
      throw ApiError.badRequest('File content does not match declared type');
    }

    // Upload via StorageService (S3/R2 in production, local disk in dev)
    const result = await StorageService.uploadFromPath(
      file.path,
      file.originalname,
      file.mimetype,
      StorageService.ownerFolder('packages', req.user!.userId),
    );

    res.status(StatusCodes.OK).json({ success: true, data: { url: result.url } });
  }),
);

/** POST /orders/estimate — Get a price estimate */
router.post(
  '/estimate',
  validate(priceEstimateSchema),
  asyncHandler(async (req, res) => {
    const estimate = await OrderService.getEstimate({
      ...req.body,
      clientId: req.user?.userId,
    });
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
    const placeId = req.params.id as string;
    if (!placeId) {
      throw ApiError.badRequest('Place ID is required');
    }

    const sessionToken = String(req.query.session_token ?? '') || undefined;
    const place = await GeocodingService.retrievePlace(placeId, sessionToken);

    if (!place) {
      throw ApiError.notFound('Place not found');
    }

    // Record the selection for usage-based learning (fire-and-forget)
    const query = req.query.q as string;
    if (query && place) {
      // Infer provider from ID prefix (gaz-, nom-, com-, or Google place ID)
      const source = placeId.startsWith('gaz-')
        ? ('gazetteer' as const)
        : placeId.startsWith('nom-')
          ? ('nominatim' as const)
          : placeId.startsWith('com-')
            ? ('community' as const)
            : ('google' as const);
      GeocodingService.recordSelection(query, {
        id: placeId,
        text: place.name,
        placeName: place.fullAddress || place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        source,
      }).catch(() => {});
    }

    res.status(StatusCodes.OK).json({ success: true, data: place });
  }),
);

/** POST /orders/record-selection — Record a location selection for usage-based learning.
 *  Called when the client selects a suggestion that already has coordinates
 *  (so the retrieve-place endpoint is never called). */
const recordSelectionSchema = z.object({
  query: z.string().min(2).max(200),
  suggestion: z.object({
    id: z.string().max(500).optional(),
    text: z.string().min(1).max(300),
    placeName: z.string().min(1).max(500).optional(),
    latitude: ghanaOrderLatitudeSchema,
    longitude: ghanaOrderLongitudeSchema,
    source: z.enum(['google', 'nominatim', 'gazetteer', 'community']).optional(),
  }),
});

router.post(
  '/record-selection',
  sensitiveRateLimit,
  validate(recordSelectionSchema),
  asyncHandler(async (req, res) => {
    const { query, suggestion } = req.body as z.infer<typeof recordSelectionSchema>;
    const userId = req.user!.userId;

    // Record popularity for boosting future search results
    GeocodingService.recordSelection(query, {
      id: suggestion.id ?? '',
      text: suggestion.text,
      placeName: suggestion.placeName ?? suggestion.text,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      source: suggestion.source,
    }).catch((err) => {
      logger.warn({ err, query }, '[Orders/RecordSelection] Failed to record popularity');
    });

    // Auto-create a CommunityPlace entry (if not from the community provider already)
    // so the location becomes searchable in future autocomplete queries.
    if (suggestion.source !== 'community') {
      prisma.communityPlace
        .upsert({
          where: {
            // Use a deterministic key based on coords (snap to ~11m grid)
            id: `auto-${Math.round(suggestion.latitude * 10000)}-${Math.round(suggestion.longitude * 10000)}`,
          },
          create: {
            id: `auto-${Math.round(suggestion.latitude * 10000)}-${Math.round(suggestion.longitude * 10000)}`,
            name: suggestion.text,
            address: suggestion.placeName ?? suggestion.text,
            latitude: suggestion.latitude,
            longitude: suggestion.longitude,
            source: 'auto_learned',
            contributedById: userId,
            usageCount: 1,
            verified: false,
          },
          update: {
            usageCount: { increment: 1 },
          },
        })
        .catch((err) => {
          logger.warn(
            { err, query },
            '[Orders/RecordSelection] Failed to auto-create community place',
          );
        });
    }

    res.status(StatusCodes.OK).json({ success: true });
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
      const geocoded = await GeocodingService.reverseGeocode(
        area.latitudeCenter,
        area.longitudeCenter,
      );
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
      throw ApiError.badRequest(
        'Provide either "code" (Plus Code) or "latitude" & "longitude" query parameters',
      );
    }
    if (
      !ghanaOrderLatitudeSchema.safeParse(latitude).success ||
      !ghanaOrderLongitudeSchema.safeParse(longitude).success
    ) {
      throw ApiError.badRequest('Location must be within Ghana');
    }
    const plusCode = formatPlusCode(latitude, longitude);
    res.status(StatusCodes.OK).json({ success: true, data: plusCode });
  }),
);

/** GET /orders/directions — Proxy Google Routes API (keeps API key server-side) */
router.get(
  '/directions',
  asyncHandler(async (req, res) => {
    const { coordinates, profile: driveProfile } = req.query;
    if (!coordinates || typeof coordinates !== 'string') {
      throw ApiError.badRequest(
        'coordinates query parameter is required (format: lng,lat;lng,lat;...)',
      );
    }

    const googleConfig = (await import('../../config')).config.google;
    const googleApiKey = googleConfig.mapsEnabled ? googleConfig.mapsApiKey : '';

    // Parse coordinate pairs: "lng,lat;lng,lat;..."
    const pairs = coordinates.split(';').map((p) => {
      const [lng, lat] = p.split(',').map(Number);
      return { latitude: lat, longitude: lng };
    });
    if (pairs.length < 2) throw ApiError.badRequest('At least 2 coordinate pairs required');

    // Validate every route point against the Ghana launch boundary.
    for (const p of pairs) {
      if (
        p.latitude == null ||
        p.longitude == null ||
        isNaN(p.latitude) ||
        isNaN(p.longitude) ||
        !ghanaOrderLatitudeSchema.safeParse(p.latitude).success ||
        !ghanaOrderLongitudeSchema.safeParse(p.longitude).success
      ) {
        throw ApiError.badRequest('Invalid coordinates: every route point must be within Ghana');
      }
    }

    const travelMode =
      driveProfile === 'cycling' ? 'BICYCLE' : driveProfile === 'walking' ? 'WALK' : 'DRIVE';

    if (!googleApiKey) {
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          routes: buildEstimatedRoutes(pairs as RoutePoint[], travelMode),
          waypoints: [],
          provider: 'local-estimate',
        },
      });
      return;
    }

    // Build intermediates (waypoints between origin and destination)
    const intermediates =
      pairs.length > 2 ? pairs.slice(1, -1).map((p) => ({ location: { latLng: p } })) : undefined;

    const body = {
      origin: { location: { latLng: pairs[0] } },
      destination: { location: { latLng: pairs[pairs.length - 1] } },
      ...(intermediates ? { intermediates } : {}),
      travelMode,
      routingPreference: travelMode === 'DRIVE' ? 'TRAFFIC_AWARE_OPTIMAL' : undefined,
      computeAlternativeRoutes: true,
      routeModifiers: { avoidTolls: false, avoidHighways: false, avoidFerries: false },
      extraComputations: ['TRAFFIC_ON_POLYLINE'],
      languageCode: 'en',
      units: 'METRIC',
    };

    const fieldMask =
      'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.routeLabels,routes.travelAdvisory';

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': fieldMask,
        Referer: 'https://api.myriderguy.com/',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`[Directions] Google Routes API ${response.status}: ${errBody.slice(0, 500)}`);
      throw ApiError.internal(
        `Routes service unavailable: ${response.status} ${errBody.slice(0, 200)}`,
      );
    }

    const googleData = (await response.json()) as { routes?: Array<Record<string, unknown>> };

    // Transform Google Routes response to match frontend expectations
    const routes = (googleData.routes ?? []).map((route: Record<string, unknown>) => {
      const legs = ((route.legs as Array<Record<string, unknown>>) ?? []).map(
        (leg: Record<string, unknown>) => {
          const steps = ((leg.steps as Array<Record<string, unknown>>) ?? []).map(
            (step: Record<string, unknown>) => ({
              geometry: decodeGooglePolyline(
                (step.polyline as Record<string, string>)?.encodedPolyline ?? '',
              ),
              duration: parseDuration(
                (step.staticDuration as string) ?? (step.duration as string) ?? '0s',
              ),
              distance: (step.distanceMeters as number) ?? 0,
              name: (step.navigationInstruction as Record<string, string>)?.instructions ?? '',
              maneuver: {
                type: (step.navigationInstruction as Record<string, string>)?.maneuver ?? '',
                instruction:
                  (step.navigationInstruction as Record<string, string>)?.instructions ?? '',
              },
            }),
          );

          // Extract congestion from traffic-aware polyline
          const travelAdvisory = leg.travelAdvisory as Record<string, unknown> | undefined;
          const speedReadings =
            (travelAdvisory?.speedReadingIntervals as Array<Record<string, unknown>>) ?? [];
          const congestion = speedReadings.map((s: Record<string, unknown>) => {
            const speed = s.speed as string;
            if (speed === 'SLOW') return 'heavy';
            if (speed === 'TRAFFIC_JAM') return 'severe';
            if (speed === 'NORMAL') return 'low';
            return 'moderate';
          });

          return {
            duration: parseDuration(
              (leg.staticDuration as string) ?? (leg.duration as string) ?? '0s',
            ),
            distance: (leg.distanceMeters as number) ?? 0,
            summary: '',
            steps,
            annotation: congestion.length > 0 ? { congestion } : undefined,
          };
        },
      );

      return {
        geometry: decodeGooglePolyline(
          (route.polyline as Record<string, string>)?.encodedPolyline ?? '',
        ),
        duration: parseDuration((route as Record<string, string>).duration ?? '0s'),
        distance: (route as Record<string, number>).distanceMeters ?? 0,
        weight: 0,
        weight_name: 'auto',
        legs,
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: { routes, waypoints: [] },
    });
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
    res.status(StatusCodes.OK).json({
      success: true,
      data: sanitizeOrderPayloadForRequester(jobs, getAuthRoles(req.user!)),
    });
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
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
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
  sensitiveRateLimit,
  requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT),
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await OrderService.createOrder(req.user!.userId, req.body);
    const scheduledForFuture =
      order.isScheduled && order.scheduledAt && order.scheduledAt > new Date();

    if (!scheduledForFuture) {
      // Dispatch immediate orders now. Future scheduled orders stay PENDING
      // until their release worker/window explicitly starts dispatch.
      autoDispatch(order.id).catch((err) => {
        logger.error({ err, orderId: order.id }, '[Orders] autoDispatch failed silently');
      });

      notifyNearbyRiders(order.id, order.orderNumber, order.zoneId, order.pickupAddress).catch(
        (err) => {
          logger.error({ err, orderId: order.id }, '[Orders] notifyNearbyRiders failed silently');
        },
      );
    }

    res.status(StatusCodes.CREATED).json({ success: true, data: order });
  }),
);

/** GET /orders — List orders (scoped by role) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const roles = getAuthRoles(req.user!);
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as OrderStatus | undefined;
    const scope = req.query.scope === 'rider' ? 'RIDER' : undefined;

    const result = await OrderService.listOrders(req.user!.userId, roles, {
      page,
      limit,
      status,
      ...(scope ? { scope } : {}),
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: sanitizeOrderPayloadForRequester(result.orders, roles),
      pagination: result.pagination,
    });
  }),
);

/** GET /orders/:id — Get order details */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const order = await OrderService.getOrderById(orderId);

    // Access control
    const userId = req.user!.userId;
    const isAdmin = hasAnyRole(
      req.user!,
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.DISPATCHER,
    );
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

    res.status(StatusCodes.OK).json({
      success: true,
      data: sanitizeOrderPayloadForRequester(order, getAuthRoles(req.user!), {
        clientOwnsOrder: order.clientId === userId,
      }),
    });
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
    cancelDispatch(req.params.id as string);
    res.status(StatusCodes.OK).json({
      success: true,
      data: sanitizeOrderPayloadForRequester(order, getAuthRoles(req.user!)),
    });
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
    cancelDispatch(req.params.id as string);
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
    const { status, note, latitude, longitude } = req.body;
    if (!status) throw ApiError.badRequest('status is required');

    const orderId = req.params.id as string;

    // If rider, verify they're assigned to this order
    const isAdmin = hasAnyRole(
      req.user!,
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.DISPATCHER,
    );
    if (!isAdmin && (String(status).startsWith('CANCELLED_') || status === 'FAILED')) {
      throw ApiError.forbidden('Use the Rider cancellation workflow for cancellation requests');
    }
    if (isAdmin && ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER'].includes(String(status))) {
      throw ApiError.badRequest('Administrator cancellations must use CANCELLED_BY_ADMIN');
    }
    if (
      isAdmin &&
      status === 'CANCELLED_BY_ADMIN' &&
      (typeof note !== 'string' || note.trim().length < 8)
    ) {
      throw ApiError.badRequest('A clear administrator cancellation reason is required');
    }
    let previousStatus = '';
    let expectedRiderId: string | undefined;
    if (!isAdmin) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          riderId: true,
          isMultiStop: true,
          pickupLatitude: true,
          pickupLongitude: true,
          dropoffLatitude: true,
          dropoffLongitude: true,
        },
      });
      if (!order) throw ApiError.notFound('Order not found');
      previousStatus = order.status;

      const riderProfile = await prisma.riderProfile.findUnique({
        where: { userId: req.user!.userId },
        select: { id: true, currentLatitude: true, currentLongitude: true },
      });
      if (!riderProfile || order.riderId !== riderProfile.id) {
        throw ApiError.forbidden('You are not assigned to this order');
      }
      expectedRiderId = riderProfile.id;

      // If the rider sent a fresh GPS fix (e.g. after returning from
      // Google Maps navigation), persist it so the geofence check
      // uses up-to-date coordinates instead of stale ones.
      const freshLat = typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : null;
      const freshLng =
        typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : null;

      // Validate GPS range
      if (freshLat !== null && (freshLat < -90 || freshLat > 90)) {
        throw ApiError.badRequest('Latitude must be between -90 and 90');
      }
      if (freshLng !== null && (freshLng < -180 || freshLng > 180)) {
        throw ApiError.badRequest('Longitude must be between -180 and 180');
      }

      if (freshLat !== null && freshLng !== null) {
        await prisma.riderProfile.update({
          where: { id: riderProfile.id },
          data: {
            currentLatitude: freshLat,
            currentLongitude: freshLng,
            lastLocationUpdate: new Date(),
          },
        });
        riderProfile.currentLatitude = freshLat;
        riderProfile.currentLongitude = freshLng;
      }

      // Geofence validation: rider must be within 200m of target location
      const GEOFENCE_RADIUS_KM = 0.2; // 200 metres

      // For multi-stop orders with AT_DROPOFF, geofence against the current active stop
      let dropoffTarget = { lat: order.dropoffLatitude, lng: order.dropoffLongitude };
      if (status === 'AT_DROPOFF' && (order as any).isMultiStop) {
        const currentStop = await prisma.orderStop.findFirst({
          where: { orderId, type: 'DROPOFF', status: { not: 'COMPLETED' } },
          orderBy: { sequence: 'asc' },
          select: { latitude: true, longitude: true },
        });
        if (currentStop) {
          dropoffTarget = { lat: currentStop.latitude, lng: currentStop.longitude };
        }
      }

      const geofenceStatuses: Record<string, { lat: number; lng: number } | null> = {
        AT_PICKUP: { lat: order.pickupLatitude, lng: order.pickupLongitude },
        AT_DROPOFF: dropoffTarget,
      };
      const target = geofenceStatuses[status as string] ?? null;
      if (target) {
        // GPS is required for geofenced transitions — reject if missing
        if (riderProfile.currentLatitude == null || riderProfile.currentLongitude == null) {
          throw ApiError.badRequest(
            'Your GPS location is required to confirm arrival. Please enable location services and try again.',
            'GPS_REQUIRED',
          );
        }
        const dist = TrackingService.haversineKm(
          riderProfile.currentLatitude,
          riderProfile.currentLongitude,
          target.lat,
          target.lng,
        );
        if (dist > GEOFENCE_RADIUS_KM) {
          throw ApiError.badRequest(
            `You must be within 200m of the ${status === 'AT_PICKUP' ? 'pickup' : 'dropoff'} location (currently ${Math.round(dist * 1000)}m away)`,
            'GEOFENCE_VIOLATION',
          );
        }
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
      isAdmin
        ? { auditContext: adminAuditContext(req) }
        : expectedRiderId
          ? { expectedRiderId }
          : undefined,
    );

    if (status === 'CANCELLED_BY_ADMIN') {
      cancelDispatch(orderId);
      const rider = order.riderId
        ? await prisma.riderProfile.findUnique({
            where: { id: order.riderId },
            select: { userId: true },
          })
        : null;
      await Promise.allSettled([
        createOrderNotification(
          order.clientId,
          'Delivery cancelled by RiderGuy',
          `Order ${order.orderNumber} was cancelled by operations. ${String(note).trim()}`,
          order.id,
        ),
        ...(rider
          ? [
              createOrderNotification(
                rider.userId,
                'Delivery cancelled by RiderGuy',
                `Order ${order.orderNumber} was cancelled by operations. ${String(note).trim()}`,
                order.id,
              ),
            ]
          : []),
      ]);
    }

    // Emit real-time status update via WebSocket
    emitOrderStatusUpdate({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      previousStatus,
      actor: req.user!.userId,
      note: note as string | undefined,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: sanitizeOrderPayloadForRequester(order, getAuthRoles(req.user!)),
    });
  }),
);

/** POST /orders/:id/cancel — Client cancels order */
router.post(
  '/:id/cancel',
  requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT),
  validate(cancelOrderSchema),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    // Read previous status + rider before mutation (single query)
    const beforeCancel = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, riderId: true },
    });
    if (!beforeCancel) throw ApiError.notFound('Order not found');
    const previousStatus = beforeCancel.status;

    const order = await OrderService.cancelOrder(orderId, req.user!.userId, req.body.reason);
    const riderId = order.riderId;

    // Emit real-time status update via WebSocket (includes reason for rider UI)
    emitOrderStatusUpdate({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      previousStatus,
      actor: req.user!.userId,
      note: req.body.reason,
    });

    // Notify the assigned rider via push notification
    if (riderId) {
      try {
        const riderProfile = await prisma.riderProfile.findUnique({
          where: { id: riderId },
          select: { userId: true },
        });
        if (riderProfile) {
          await createOrderNotification(
            riderProfile.userId,
            'Order Cancelled ❌',
            `Order ${order.orderNumber} was cancelled by the client.${req.body.reason ? ` Reason: ${req.body.reason}` : ''} You've been compensated.`,
            order.id,
          );
        }
      } catch {
        logger.warn(`Failed to notify rider of cancellation for order ${order.id}`);
      }
    }

    res.status(StatusCodes.OK).json({ success: true, data: order });
  }),
);

/** POST /orders/:id/rider-cancel — Rider cancels an order */
router.post(
  '/:id/rider-cancel',
  requireRole(UserRole.RIDER),
  validate(cancelOrderSchema),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const reason = req.body.reason;
    if (!reason || !reason.trim()) throw ApiError.badRequest('A cancellation reason is required');

    // Read order before mutation for socket/notification context
    const beforeCancel = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, clientId: true, orderNumber: true },
    });
    if (!beforeCancel) throw ApiError.notFound('Order not found');
    const previousStatus = beforeCancel.status;

    const order = await OrderService.cancelOrderByRider(orderId, req.user!.userId, reason.trim());

    // Emit real-time status update via WebSocket
    emitOrderStatusUpdate({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      previousStatus,
      actor: req.user!.userId,
      note: reason.trim(),
    });

    // Client notification is now handled by the cancellation consequence service
    // (includes penalty context and better messaging)

    res.status(StatusCodes.OK).json({
      success: true,
      data: sanitizeOrderPayloadForRequester(order, getAuthRoles(req.user!)),
    });
  }),
);

// ─────────────────────────────────────────────────────────────
// Post-Pickup Cancellation Authorization Flow
// ─────────────────────────────────────────────────────────────

/** POST /orders/:id/cancel-request — Rider requests cancellation authorization from client (post-pickup only) */
router.post(
  '/:id/cancel-request',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const reason = req.body.reason;
    if (!reason || !reason.trim()) throw ApiError.badRequest('A cancellation reason is required');

    const request = await CancelRequestService.createCancelRequest(
      orderId,
      req.user!.userId,
      reason.trim(),
    );

    res.status(StatusCodes.CREATED).json({ success: true, data: request });
  }),
);

/** POST /orders/:id/cancel-authorize — Client authorizes or denies cancellation request */
router.post(
  '/:id/cancel-authorize',
  requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const { decision, note } = req.body;

    if (!decision || !['return', 'complete', 'deny'].includes(decision)) {
      throw ApiError.badRequest('Decision must be "return", "complete", or "deny"');
    }

    // Find the cancel request for this order
    const cancelRequest = await CancelRequestService.getCancelRequest(orderId);
    if (!cancelRequest) throw ApiError.notFound('No cancellation request found for this order');

    const updated = await CancelRequestService.authorizeCancelRequest(
      cancelRequest.id,
      req.user!.userId,
      decision,
      note,
    );

    res.status(StatusCodes.OK).json({ success: true, data: updated });
  }),
);

/** POST /orders/:id/cancel-return-confirm — Client confirms package was returned */
router.post(
  '/:id/cancel-return-confirm',
  requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;

    const cancelRequest = await CancelRequestService.getCancelRequest(orderId);
    if (!cancelRequest) throw ApiError.notFound('No cancellation request found for this order');

    const updated = await CancelRequestService.confirmReturn(cancelRequest.id, req.user!.userId);

    res.status(StatusCodes.OK).json({ success: true, data: updated });
  }),
);

/** GET /orders/:id/cancel-request — Get the cancellation request for an order */
router.get(
  '/:id/cancel-request',
  asyncHandler(async (req, res) => {
    const cancelRequest = await CancelRequestService.getCancelRequest(req.params.id as string);
    res.status(StatusCodes.OK).json({ success: true, data: cancelRequest });
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

/** GET /orders/:id/eta — Get estimated time of arrival for rider */
router.get(
  '/:id/eta',
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        clientId: true,
        riderId: true,
        status: true,
        pickupLatitude: true,
        pickupLongitude: true,
        dropoffLatitude: true,
        dropoffLongitude: true,
        rider: {
          select: {
            userId: true,
            currentLatitude: true,
            currentLongitude: true,
          },
        },
      },
    });

    if (!order) throw ApiError.notFound('Order not found');

    const isClient = order.clientId === req.user!.userId;
    const isRider = order.rider?.userId === req.user!.userId;
    if (!isClient && !isRider) {
      throw ApiError.forbidden('You do not have access to this order');
    }

    if (!order.rider?.currentLatitude || !order.rider?.currentLongitude) {
      res.status(StatusCodes.OK).json({ success: true, data: { eta: null } });
      return;
    }

    // Determine destination: pickup if not yet picked up, dropoff otherwise
    const prePickupStatuses = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP'];
    const destLat = prePickupStatuses.includes(order.status)
      ? order.pickupLatitude
      : order.dropoffLatitude;
    const destLng = prePickupStatuses.includes(order.status)
      ? order.pickupLongitude
      : order.dropoffLongitude;

    const eta = await TrackingService.getETA(
      order.rider.currentLatitude,
      order.rider.currentLongitude,
      destLat,
      destLng,
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        eta: {
          durationSeconds: eta.durationSeconds,
          distanceKm: eta.distanceKm,
          destination: prePickupStatuses.includes(order.status) ? 'PICKUP' : 'DROPOFF',
        },
      },
    });
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

/** POST /orders/:id/confirm-payment — Rider confirms payment received at delivery point */
router.post(
  '/:id/confirm-payment',
  requireRole(UserRole.RIDER),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const { actualPaymentMethod } = req.body;

    // Only cash can be attested by the rider. Electronic payment state is
    // provider/wallet-owned and may only move through the payment routes.
    if (actualPaymentMethod !== 'CASH') {
      throw ApiError.badRequest(
        'Riders can only confirm cash collected at dropoff. Electronic payments must be verified in the customer app.',
        'ELECTRONIC_PAYMENT_REQUIRES_VERIFICATION',
      );
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Order not found');

    // Verify rider is assigned
    const riderProfile = await prisma.riderProfile.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!riderProfile || order.riderId !== riderProfile.id) {
      throw ApiError.forbidden('You are not assigned to this order');
    }

    if (order.status !== 'AT_DROPOFF') {
      throw ApiError.badRequest('Payment can only be confirmed at the delivery point');
    }

    if (order.paymentMethod !== 'CASH') {
      throw ApiError.badRequest(
        'This order uses electronic payment and must be verified before delivery can be completed',
        'ELECTRONIC_PAYMENT_REQUIRES_VERIFICATION',
      );
    }

    if (order.riderPaymentConfirmed) {
      throw ApiError.badRequest('Payment already confirmed');
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        riderPaymentConfirmed: true,
        actualPaymentMethod: 'CASH',
      },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: { riderPaymentConfirmed: true, actualPaymentMethod },
    });
  }),
);

/** POST /orders/:id/proof — Upload proof of delivery (photo or PIN) */
router.post(
  '/:id/proof',
  requireRole(UserRole.RIDER),
  proofUpload.single('file'),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    try {
      const proofType = (req.body.proofType ?? req.query.proofType) as string;

      if (!proofType) throw ApiError.badRequest('proofType is required');

      const ALLOWED_PROOF_TYPES = ['PHOTO', 'PIN_CODE'];
      if (!ALLOWED_PROOF_TYPES.includes(proofType)) {
        throw ApiError.badRequest(`proofType must be one of: ${ALLOWED_PROOF_TYPES.join(', ')}`);
      }
      const normalizedProofType = proofType as 'PHOTO' | 'PIN_CODE';

      // Verify rider is assigned
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw ApiError.notFound('Order not found');

      const riderProfile = await prisma.riderProfile.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!riderProfile || order.riderId !== riderProfile.id) {
        throw ApiError.forbidden('You are not assigned to this order');
      }
      if (order.status !== 'AT_DROPOFF') {
        throw ApiError.badRequest(
          'Proof of delivery can only be submitted at the delivery point',
          'INVALID_PROOF_STATUS',
        );
      }

      OrderService.assertDeliveryPaymentReady(order);

      let proofUrl: string;
      let submittedPin: string | undefined;
      let uploadedStorageKey: string | undefined;

      if (normalizedProofType === 'PIN_CODE') {
        // PIN code — validate against the order's actual delivery PIN
        const proofData = req.body.proofData;
        if (typeof proofData !== 'string' || !/^\d{6}$/.test(proofData))
          throw ApiError.badRequest('Valid 6-digit PIN code required');
        if (!order.deliveryPinCode) {
          throw ApiError.badRequest('No delivery PIN was set for this order');
        }
        if (proofData !== order.deliveryPinCode) {
          throw ApiError.badRequest('Incorrect delivery PIN', 'INVALID_PIN');
        }
        submittedPin = proofData;
        proofUrl = 'pin:verified';
      } else if (req.file) {
        const header = Buffer.alloc(16);
        const fd = fsSync.openSync(req.file.path, 'r');
        try {
          fsSync.readSync(fd, header, 0, 16, 0);
        } finally {
          fsSync.closeSync(fd);
        }
        if (!verifyMagicBytes(header, req.file.mimetype)) {
          throw ApiError.badRequest('File content does not match declared type');
        }

        const result = await StorageService.uploadFromPath(
          req.file.path,
          req.file.originalname,
          req.file.mimetype,
          StorageService.ownerFolder('proofs', req.user!.userId),
        );
        proofUrl = result.url;
        uploadedStorageKey = result.key;
      } else if (typeof req.body.proofData === 'string' && req.body.proofData) {
        // Fallback: accept base64 for backward compatibility (signatures)
        const base64Data = (req.body.proofData as string).replace(/^data:image\/\w+;base64,/, '');
        const estimatedSize = Math.ceil(base64Data.length * 0.75);
        if (estimatedSize > 5 * 1024 * 1024) throw ApiError.badRequest('Proof exceeds 5MB');

        const proofBuffer = Buffer.from(base64Data, 'base64');
        if (!verifyMagicBytes(proofBuffer, 'image/png')) {
          throw ApiError.badRequest('Base64 proof must contain a valid PNG image');
        }
        const result = await StorageService.upload(
          proofBuffer,
          `proof-${orderId}.png`,
          'image/png',
          StorageService.ownerFolder('proofs', req.user!.userId),
        );
        proofUrl = result.url;
        uploadedStorageKey = result.key;
      } else {
        throw ApiError.badRequest('File upload or proofData is required');
      }

      await persistRiderOrderProof({
        orderId,
        riderProfileId: riderProfile.id,
        expectedStatus: order.status,
        expectedProofUrl: order.proofOfDeliveryUrl,
        proofType: normalizedProofType,
        proofUrl,
        ...(submittedPin ? { submittedPin } : {}),
        ...(uploadedStorageKey ? { uploadedStorageKey } : {}),
      });

      // Preserve the existing optional completion behavior after proof persistence.
      const completeDelivery =
        req.body.completeDelivery === true || req.body.completeDelivery === 'true';
      if (completeDelivery) {
        const updated = await OrderService.transitionStatus(
          orderId,
          'DELIVERED',
          req.user!.userId,
          undefined,
          { expectedRiderId: riderProfile.id },
        );
        res.status(StatusCodes.OK).json({
          success: true,
          data: {
            proofUrl,
            delivered: true,
            order: sanitizeOrderPayloadForRequester(updated, getAuthRoles(req.user!)),
          },
        });
        return;
      }

      res.status(StatusCodes.OK).json({ success: true, data: { proofUrl } });
    } finally {
      if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    }
  }),
);

/** POST /orders/:id/stops/:stopId/complete — Complete an individual multi-stop delivery stop */
router.post(
  '/:id/stops/:stopId/complete',
  requireRole(UserRole.RIDER),
  proofUpload.single('file'),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id as string;
    const stopId = req.params.stopId as string;
    try {
      // Verify rider is assigned
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, riderId: true, status: true, isMultiStop: true, deliveryPinCode: true },
      });
      if (!order) throw ApiError.notFound('Order not found');

      const riderProfile = await prisma.riderProfile.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!riderProfile || order.riderId !== riderProfile.id) {
        throw ApiError.forbidden('You are not assigned to this order');
      }

      if (!order.isMultiStop) {
        throw ApiError.badRequest('This order is not a multi-stop delivery');
      }

      // Only allow stop completion during active delivery statuses
      const activeStatuses = [
        'PICKUP_EN_ROUTE',
        'AT_PICKUP',
        'PICKED_UP',
        'IN_TRANSIT',
        'AT_DROPOFF',
      ];
      if (!activeStatuses.includes(order.status)) {
        throw ApiError.badRequest(`Cannot complete stops while order is ${order.status}`);
      }

      // Find the stop
      const stop = await prisma.orderStop.findFirst({
        where: { id: stopId, orderId },
      });
      if (!stop) throw ApiError.notFound('Stop not found');

      // Dropoff stops cannot be completed before package is picked up
      if (stop.type === 'DROPOFF') {
        const postPickupStatuses = ['PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'];
        if (!postPickupStatuses.includes(order.status)) {
          throw ApiError.badRequest('Package must be picked up before completing dropoff stops');
        }
      }

      if (stop.status === 'COMPLETED') {
        throw ApiError.badRequest('This stop is already completed');
      }
      if (stop.status === 'SKIPPED' || stop.status === 'FAILED') {
        throw ApiError.badRequest(`This stop has been ${stop.status.toLowerCase()}`);
      }

      // D-07: Enforce multi-stop sequence — all prior stops must be completed first
      if (stop.sequence > 1) {
        const incompleteEarlierStops = await prisma.orderStop.count({
          where: {
            orderId,
            sequence: { lt: stop.sequence },
            status: { notIn: ['COMPLETED', 'SKIPPED'] },
          },
        });
        if (incompleteEarlierStops > 0) {
          throw ApiError.badRequest(
            `Complete all earlier stops before stop #${stop.sequence}. ${incompleteEarlierStops} prior stop(s) still pending.`,
          );
        }
      }

      // Handle proof submission for the stop
      const proofType = (req.body.proofType ?? req.query.proofType) as string | undefined;
      if (proofType && !['PHOTO', 'PIN_CODE'].includes(proofType)) {
        throw ApiError.badRequest('proofType must be one of: PHOTO, PIN_CODE');
      }
      if ((req.file || req.body.proofData) && !proofType) {
        throw ApiError.badRequest('proofType is required when proof data is provided');
      }
      const normalizedProofType = proofType as 'PHOTO' | 'PIN_CODE' | undefined;
      if (
        normalizedProofType === 'PHOTO' &&
        !req.file &&
        (typeof req.body.proofData !== 'string' || !req.body.proofData)
      ) {
        throw ApiError.badRequest('Photo proof data is required');
      }
      let proofUrl: string | undefined;
      let submittedPin: string | undefined;
      let uploadedStorageKey: string | undefined;

      if (normalizedProofType === 'PIN_CODE') {
        const proofData = req.body.proofData;
        if (typeof proofData !== 'string' || !/^\d{6}$/.test(proofData))
          throw ApiError.badRequest('Valid 6-digit PIN code required');
        if (!order.deliveryPinCode) {
          throw ApiError.badRequest('No delivery PIN was set for this order');
        }
        if (proofData !== order.deliveryPinCode) {
          throw ApiError.badRequest('Incorrect delivery PIN', 'INVALID_PIN');
        }
        submittedPin = proofData;
      } else if (req.file) {
        const header = Buffer.alloc(16);
        const fd = fsSync.openSync(req.file.path, 'r');
        try {
          fsSync.readSync(fd, header, 0, 16, 0);
        } finally {
          fsSync.closeSync(fd);
        }
        if (!verifyMagicBytes(header, req.file.mimetype)) {
          throw ApiError.badRequest('File content does not match declared type');
        }
        const result = await StorageService.uploadFromPath(
          req.file.path,
          req.file.originalname,
          req.file.mimetype,
          StorageService.ownerFolder('proofs', req.user!.userId),
        );
        proofUrl = result.url;
        uploadedStorageKey = result.key;
      } else if (typeof req.body.proofData === 'string' && req.body.proofData && proofType) {
        const base64Data = req.body.proofData.replace(/^data:image\/\w+;base64,/, '');
        const estimatedSize = Math.ceil(base64Data.length * 0.75);
        if (estimatedSize > 5 * 1024 * 1024) throw ApiError.badRequest('Proof exceeds 5MB');

        const proofBuffer = Buffer.from(base64Data, 'base64');
        if (!verifyMagicBytes(proofBuffer, 'image/png')) {
          throw ApiError.badRequest('Base64 proof must contain a valid PNG image');
        }
        const result = await StorageService.upload(
          proofBuffer,
          `stop-proof-${stopId}.png`,
          'image/png',
          StorageService.ownerFolder('proofs', req.user!.userId),
        );
        proofUrl = result.url;
        uploadedStorageKey = result.key;
      }

      const updatedStop = await completeRiderOrderStop({
        orderId,
        stopId,
        riderProfileId: riderProfile.id,
        expectedOrderStatus: order.status,
        expectedStopStatus: stop.status,
        expectedSequence: stop.sequence,
        ...(normalizedProofType ? { proofType: normalizedProofType } : {}),
        ...(proofUrl ? { proofUrl } : {}),
        ...(submittedPin ? { submittedPin } : {}),
        ...(uploadedStorageKey ? { uploadedStorageKey } : {}),
      });

      logger.info({ orderId, stopId, sequence: stop.sequence }, 'Multi-stop completed');

      res.status(StatusCodes.OK).json({
        success: true,
        data: sanitizeOrderPayloadForRequester(updatedStop, getAuthRoles(req.user!)),
      });
    } finally {
      if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    }
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
      const result = await StorageService.upload(
        Buffer.from(base64Data, 'base64'),
        fileName,
        'image/png',
        StorageService.ownerFolder('failures', req.user!.userId),
      );
      failurePhotoUrl = result.url;
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
      { expectedRiderId: riderProfile.id },
    );

    emitOrderStatusUpdate({
      orderId,
      orderNumber: updated.orderNumber,
      status: 'FAILED',
      previousStatus,
      actor: req.user!.userId,
      note: reason,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: sanitizeOrderPayloadForRequester(updated, getAuthRoles(req.user!)),
    });
  }),
);

export { router as orderRouter };
