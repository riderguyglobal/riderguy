import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@riderguy/database';
import { z } from 'zod';

// ============================================================
// Promo Code Routes — CRUD for promotional codes
// ============================================================

const router = Router();
router.use(authenticate);

// ── Validation schemas ──────────────────────────────────────

const createPromoSchema = z.object({
  code: z.string().min(3).max(20).transform((v) => v.toUpperCase().trim()),
  discountType: z.enum(['PERCENTAGE', 'FLAT']),
  discountValue: z.number().positive(),
  maxDiscountGhs: z.number().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().default(1),
  zoneId: z.string().uuid().optional(),
  packageTypes: z.array(z.string()).default([]),
  forNewUsersOnly: z.boolean().default(false),
  description: z.string().max(200).optional(),
});

const updatePromoSchema = createPromoSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ── Admin: Create promo code ────────────────────────────────

/** POST /promo — Create a new promo code */
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const data = createPromoSchema.parse(req.body);

    // Check for duplicate code
    const existing = await prisma.promoCode.findUnique({ where: { code: data.code } });
    if (existing) {
      throw ApiError.conflict('Promo code already exists');
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscountGhs: data.maxDiscountGhs,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        maxUses: data.maxUses,
        maxUsesPerUser: data.maxUsesPerUser,
        zoneId: data.zoneId,
        packageTypes: data.packageTypes,
        forNewUsersOnly: data.forNewUsersOnly,
        description: data.description,
      },
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: promo });
  }),
);

// ── Admin: List promo codes ─────────────────────────────────

/** GET /promo — List all promo codes */
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const isActive = req.query.active !== undefined
      ? req.query.active === 'true'
      : undefined;

    const where = isActive !== undefined ? { isActive } : {};

    const [promos, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.promoCode.count({ where }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: promos,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

// ── Admin: Update promo code ─────────────────────────────────

/** PATCH /promo/:id — Update a promo code */
router.patch(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const data = updatePromoSchema.parse(req.body);
    const id = req.params.id as string;

    const promo = await prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw ApiError.notFound('Promo code not found');

    const updated = await prisma.promoCode.update({
      where: { id },
      data: {
        ...data,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      },
    });

    res.status(StatusCodes.OK).json({ success: true, data: updated });
  }),
);

// ── Admin: Delete promo code ─────────────────────────────────

/** DELETE /promo/:id — Delete a promo code */
router.delete(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const promo = await prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw ApiError.notFound('Promo code not found');

    await prisma.promoCode.delete({ where: { id } });
    res.status(StatusCodes.OK).json({ success: true, message: 'Promo code deleted' });
  }),
);

// ── Client: Validate promo code ─────────────────────────────

/** POST /promo/validate — Check if a promo code is valid for the user */
router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    const { code, packageType, zoneId } = req.body;
    if (!code) throw ApiError.badRequest('Promo code is required');

    const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase().trim() } });
    if (!promo || !promo.isActive) {
      throw ApiError.notFound('Invalid or expired promo code');
    }

    const now = new Date();
    if (promo.validUntil && promo.validUntil < now) {
      throw ApiError.badRequest('This promo code has expired');
    }
    if (promo.validFrom > now) {
      throw ApiError.badRequest('This promo code is not yet active');
    }
    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
      throw ApiError.badRequest('This promo code has reached its usage limit');
    }

    // Check per-user limit
    const userId = req.user!.userId;
    const userUsages = await prisma.promoCodeUsage.count({
      where: { promoCodeId: promo.id, userId },
    });
    if (userUsages >= promo.maxUsesPerUser) {
      throw ApiError.badRequest('You have already used this promo code');
    }

    // Check zone restriction
    if (promo.zoneId && zoneId && promo.zoneId !== zoneId) {
      throw ApiError.badRequest('This promo code is not valid in your zone');
    }

    // Check package type restriction
    if (promo.packageTypes.length > 0 && packageType && !promo.packageTypes.includes(packageType)) {
      throw ApiError.badRequest('This promo code is not valid for this package type');
    }

    // Check new-user restriction
    if (promo.forNewUsersOnly) {
      const userOrderCount = await prisma.order.count({ where: { clientId: userId } });
      if (userOrderCount > 0) {
        throw ApiError.badRequest('This promo code is for new users only');
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        code: promo.code,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue),
        maxDiscountGhs: promo.maxDiscountGhs ? Number(promo.maxDiscountGhs) : null,
        description: promo.description,
      },
    });
  }),
);

export { router as promoRouter };
