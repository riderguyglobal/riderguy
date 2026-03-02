import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@riderguy/database';

// ============================================================
// Saved Addresses — CRUD for client saved locations
// ============================================================

const router = Router();

router.use(authenticate);

// ── Validation schemas ──────────────────────────────────

const createAddressSchema = z.object({
  label: z.string().min(1).max(50),
  address: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  instructions: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
});

const updateAddressSchema = createAddressSchema.partial();

// ── Helpers ─────────────────────────────────────────────

async function getClientProfileId(userId: string): Promise<string> {
  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw ApiError.notFound('Client profile not found');
  return profile.id;
}

// ── Routes ──────────────────────────────────────────────

/** GET /saved-addresses — List all saved addresses */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const clientId = await getClientProfileId(req.user!.userId);
    const addresses = await prisma.savedAddress.findMany({
      where: { clientId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.status(StatusCodes.OK).json({ success: true, data: addresses });
  }),
);

/** POST /saved-addresses — Create a new saved address */
router.post(
  '/',
  validate(createAddressSchema),
  asyncHandler(async (req, res) => {
    const clientId = await getClientProfileId(req.user!.userId);
    const { label, address, latitude, longitude, instructions, isDefault } = req.body;

    // If setting as default, unset existing default
    if (isDefault) {
      await prisma.savedAddress.updateMany({
        where: { clientId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const saved = await prisma.savedAddress.create({
      data: { clientId, label, address, latitude, longitude, instructions, isDefault: isDefault ?? false },
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: saved });
  }),
);

/** PATCH /saved-addresses/:id — Update a saved address */
router.patch(
  '/:id',
  validate(updateAddressSchema),
  asyncHandler(async (req, res) => {
    const clientId = await getClientProfileId(req.user!.userId);
    const addressId = req.params.id as string;
    const existing = await prisma.savedAddress.findFirst({
      where: { id: addressId, clientId },
    });
    if (!existing) throw ApiError.notFound('Saved address not found');

    // If setting as default, unset existing default
    if (req.body.isDefault) {
      await prisma.savedAddress.updateMany({
        where: { clientId, isDefault: true, id: { not: existing.id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.savedAddress.update({
      where: { id: existing.id },
      data: req.body,
    });

    res.status(StatusCodes.OK).json({ success: true, data: updated });
  }),
);

/** DELETE /saved-addresses/:id — Delete a saved address */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const clientId = await getClientProfileId(req.user!.userId);
    const addressId = req.params.id as string;
    const existing = await prisma.savedAddress.findFirst({
      where: { id: addressId, clientId },
    });
    if (!existing) throw ApiError.notFound('Saved address not found');

    await prisma.savedAddress.delete({ where: { id: existing.id } });
    res.status(StatusCodes.OK).json({ success: true, message: 'Address deleted' });
  }),
);

export { router as savedAddressRouter };
