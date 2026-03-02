import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@riderguy/database';
import { parseGoogleMapsUrl, parseRawCoordinates, isGoogleMapsShortLink, formatPlusCode } from '@riderguy/utils';
import axios from 'axios';
import { reverseGeocode } from '../../services/geocoding.service';

// ============================================================
// Community Places — user-contributed locations that grow the
// platform's geocoding database over time.
//
// Users can submit locations by:
// 1. Pasting a Google Maps link
// 2. Dropping a pin on the map (lat/lng)
// 3. Entering raw coordinates
//
// Each submission is reverse-geocoded, enriched with Plus Codes,
// and stored. Future autocomplete searches include these places
// as a "community" provider.
// ============================================================

const router = Router();

router.use(authenticate);

// ── Validation schemas ──────────────────────────────────

const createFromLinkSchema = z.object({
  googleMapsUrl: z.string().url().max(2000),
  name: z.string().min(1).max(200).optional(),        // user can override the name
  category: z.string().max(100).optional(),
});

const createFromPinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(100).optional(),
});

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(0.1).max(50).default(5), // km
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ── Routes ──────────────────────────────────────────────

/**
 * POST /places/resolve-link — Resolve a Google Maps short URL and extract coordinates.
 *
 * Short URLs like https://maps.app.goo.gl/abc123 redirect to a full
 * Google Maps URL containing coordinates. This endpoint follows the
 * redirect and parses the resulting URL.
 */
router.post(
  '/resolve-link',
  asyncHandler(async (req, res) => {
    const { url } = req.body as { url: string };
    if (!url || typeof url !== 'string') {
      throw ApiError.badRequest('URL is required');
    }

    // Resolve short link if needed
    const resolvedUrl = isGoogleMapsShortLink(url)
      ? await resolveGoogleMapsShortLink(url)
      : url;

    if (!resolvedUrl) {
      throw ApiError.badRequest('Could not resolve the Google Maps link.');
    }

    // Parse the resolved URL
    const parsed = parseGoogleMapsUrl(resolvedUrl);
    if (!parsed) {
      res.status(StatusCodes.OK).json({
        success: false,
        resolvedUrl,
        error: 'Could not extract coordinates from the resolved URL.',
      });
      return;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        placeName: parsed.placeName,
        resolvedUrl,
      },
    });
  }),
);

/**
 * POST /places/from-link — Create a community place from a Google Maps URL.
 *
 * Parses the URL to extract coordinates, reverse-geocodes the location,
 * generates a Plus Code, and stores it. If a place already exists within
 * ~200m, increments its usage count instead of creating a duplicate.
 */
router.post(
  '/from-link',
  validate(createFromLinkSchema),
  asyncHandler(async (req, res) => {
    const { googleMapsUrl, name, category } = req.body as z.infer<typeof createFromLinkSchema>;

    // Resolve short link if needed, then parse
    const urlToparse = isGoogleMapsShortLink(googleMapsUrl)
      ? await resolveGoogleMapsShortLink(googleMapsUrl) ?? googleMapsUrl
      : googleMapsUrl;

    const parsed = parseGoogleMapsUrl(urlToparse);
    if (!parsed) {
      throw ApiError.badRequest(
        'Could not extract coordinates from the Google Maps link. ' +
        'Please paste a valid Google Maps URL (e.g., from sharing a location).',
      );
    }

    const { latitude, longitude, placeName } = parsed;

    // Check for existing place within ~200m
    const existing = await findNearbyExisting(latitude, longitude);
    if (existing) {
      // Increment usage count
      const updated = await prisma.communityPlace.update({
        where: { id: existing.id },
        data: { usageCount: { increment: 1 }, updatedAt: new Date() },
      });
      res.status(StatusCodes.OK).json({
        success: true,
        data: updated,
        message: 'Location already exists — usage count updated.',
      });
      return;
    }

    // Reverse-geocode to get a proper address
    const geocoded = await safeReverseGeocode(latitude, longitude);

    const displayName = name || placeName || geocoded?.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    const plusCode = formatPlusCode(latitude, longitude);

    const place = await prisma.communityPlace.create({
      data: {
        name: displayName,
        address: geocoded?.address,
        latitude,
        longitude,
        plusCode: plusCode?.full ?? null,
        placeType: category ? 'poi' : 'place',
        category: category || null,
        source: 'google_maps',
        googleMapsUrl,
        contributedById: req.user!.userId,
        region: extractRegion(geocoded?.address),
      },
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: place,
      message: 'Location saved! It will now appear in future searches.',
    });
  }),
);

/**
 * POST /places/from-pin — Create a community place from map pin coordinates.
 */
router.post(
  '/from-pin',
  validate(createFromPinSchema),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, name, category } = req.body as z.infer<typeof createFromPinSchema>;

    // Check for existing place within ~200m
    const existing = await findNearbyExisting(latitude, longitude);
    if (existing) {
      const updated = await prisma.communityPlace.update({
        where: { id: existing.id },
        data: { usageCount: { increment: 1 }, updatedAt: new Date() },
      });
      res.status(StatusCodes.OK).json({
        success: true,
        data: updated,
        message: 'Location already exists — usage count updated.',
      });
      return;
    }

    const geocoded = await safeReverseGeocode(latitude, longitude);
    const displayName = name || geocoded?.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    const plusCode = formatPlusCode(latitude, longitude);

    const place = await prisma.communityPlace.create({
      data: {
        name: displayName,
        address: geocoded?.address,
        latitude,
        longitude,
        plusCode: plusCode?.full ?? null,
        placeType: category ? 'poi' : 'place',
        category: category || null,
        source: 'pin_drop',
        contributedById: req.user!.userId,
        region: extractRegion(geocoded?.address),
      },
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: place,
      message: 'Location saved! It will now appear in future searches.',
    });
  }),
);

/**
 * GET /places/search — Search community places by text.
 * Matches against name and address (case-insensitive).
 * Optionally boosts results near the given coordinates.
 */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q, lat, lng, limit } = searchSchema.parse(req.query);

    const places = await prisma.communityPlace.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
      take: limit * 2, // fetch extra for proximity sorting
    });

    // If proximity provided, sort by distance
    let sorted = places;
    if (lat != null && lng != null) {
      sorted = places
        .map((p: typeof places[number]) => ({
          ...p,
          _dist: Math.abs(p.latitude - lat) + Math.abs(p.longitude - lng),
        }))
        .sort((a: { _dist: number }, b: { _dist: number }) => a._dist - b._dist)
        .map(({ _dist, ...rest }: { _dist: number; [key: string]: unknown }) => rest) as typeof places;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: sorted.slice(0, limit),
      total: sorted.length,
    });
  }),
);

/**
 * GET /places/nearby — Find community places within a radius.
 * Uses bounding box approximation for speed (no PostGIS needed).
 */
router.get(
  '/nearby',
  asyncHandler(async (req, res) => {
    const { lat, lng, radius, limit } = nearbySchema.parse(req.query);

    // Approximate bounding box: 1 degree ≈ 111km
    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

    const places = await prisma.communityPlace.findMany({
      where: {
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      orderBy: { usageCount: 'desc' },
      take: limit,
    });

    // Sort by actual distance
    const withDist = places
      .map((p: typeof places[number]) => ({
        ...p,
        distance: haversine(lat, lng, p.latitude, p.longitude),
      }))
      .filter((p: { distance: number }) => p.distance <= radius)
      .sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance);

    res.status(StatusCodes.OK).json({
      success: true,
      data: withDist.slice(0, limit),
    });
  }),
);

/**
 * POST /places/:id/use — Increment usage count when a community 
 * place is selected for an order (called by client app).
 */
router.post(
  '/:id/use',
  asyncHandler(async (req, res) => {
    const placeId = req.params.id as string;
    if (!placeId) throw ApiError.badRequest('Place ID is required');
    const place = await prisma.communityPlace.update({
      where: { id: placeId },
      data: { usageCount: { increment: 1 } },
    });
    res.status(StatusCodes.OK).json({ success: true, data: place });
  }),
);

// ── Helpers ─────────────────────────────────────────────

/**
 * Find an existing community place within ~200m of the given coordinates.
 */
async function findNearbyExisting(lat: number, lng: number) {
  const delta = 0.002; // ~200m
  const nearby = await prisma.communityPlace.findMany({
    where: {
      latitude: { gte: lat - delta, lte: lat + delta },
      longitude: { gte: lng - delta, lte: lng + delta },
    },
    take: 1,
    orderBy: { usageCount: 'desc' },
  });
  return nearby[0] ?? null;
}

/**
 * Reverse geocode with graceful fallback — don't let geocoding
 * failures block place creation.
 */
async function safeReverseGeocode(lat: number, lng: number) {
  try {
    return await reverseGeocode(lat, lng);
  } catch {
    console.warn(`[CommunityPlaces] Reverse geocode failed for (${lat}, ${lng})`);
    return null;
  }
}

/**
 * Extract a region name from a geocoded address string.
 * e.g., "East Legon, Accra, Greater Accra Region, Ghana" → "Greater Accra"
 */
function extractRegion(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim());
  // Look for common Ghana region patterns
  const regionPart = parts.find(
    (p) =>
      p.includes('Region') ||
      p.includes('Accra') ||
      p.includes('Ashanti') ||
      p.includes('Western') ||
      p.includes('Eastern') ||
      p.includes('Central') ||
      p.includes('Northern'),
  );
  return regionPart?.replace(' Region', '') ?? null;
}

/**
 * Simple Haversine distance in km.
 */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Resolve a Google Maps short link by following its redirect chain.
 * Returns the final full URL, or null if resolution fails.
 */
async function resolveGoogleMapsShortLink(shortUrl: string): Promise<string | null> {
  try {
    // Follow redirects manually to capture the final URL
    const response = await axios.get(shortUrl, {
      maxRedirects: 5,
      timeout: 8000,
      // We just need the final URL, not the full page
      validateStatus: (status) => status < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Riderguy/1.0)',
        'Accept': 'text/html',
      },
    });

    // axios follows redirects automatically; the final URL is in response.request.res.responseUrl
    // or we can check response.config.url after redirects
    const finalUrl: string | undefined =
      response.request?.res?.responseUrl ||
      response.request?.responseURL ||
      response.config?.url;

    if (finalUrl && finalUrl !== shortUrl) {
      console.log(`[ResolveLink] ${shortUrl} → ${finalUrl}`);
      return finalUrl;
    }

    // If axios didn't capture the redirect URL, check the response data
    // for meta refresh or canonical URL
    const html = typeof response.data === 'string' ? response.data : '';
    const metaMatch = html.match(/content="\d;url=([^"]+)"/i);
    if (metaMatch?.[1]) {
      return metaMatch[1];
    }

    // Try extracting from response headers
    const locationHeader = response.headers?.['location'];
    if (locationHeader) {
      return locationHeader;
    }

    return finalUrl || null;
  } catch (error) {
    console.warn(`[ResolveLink] Failed to resolve ${shortUrl}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export { router as placesRouter };
