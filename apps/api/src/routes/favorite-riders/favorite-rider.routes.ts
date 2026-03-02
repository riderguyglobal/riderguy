import { Router } from 'express';
import { authenticate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@riderguy/database';

// ============================================================
// Favorite Riders — CRUD for client favorite riders
// ============================================================

const router = Router();

router.use(authenticate);

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

/** GET /favorite-riders — List all favorite riders */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const clientId = await getClientProfileId(req.user!.userId);
    const favorites = await prisma.favoriteRider.findMany({
      where: { clientId },
      include: {
        riderProfile: {
          select: {
            id: true,
            averageRating: true,
            totalDeliveries: true,
            currentLevel: true,
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(StatusCodes.OK).json({ success: true, data: favorites });
  }),
);

/** POST /favorite-riders/:riderProfileId — Add a rider to favorites */
router.post(
  '/:riderProfileId',
  asyncHandler(async (req, res) => {
    const clientId = await getClientProfileId(req.user!.userId);
    const riderProfileId = req.params.riderProfileId as string;

    // Verify rider exists
    const rider = await prisma.riderProfile.findUnique({ where: { id: riderProfileId } });
    if (!rider) throw ApiError.notFound('Rider not found');

    // Upsert to handle idempotent requests (unique constraint: [clientId, riderProfileId])
    const favorite = await prisma.favoriteRider.upsert({
      where: { clientId_riderProfileId: { clientId, riderProfileId } },
      create: { clientId, riderProfileId },
      update: {},
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: favorite });
  }),
);

/** DELETE /favorite-riders/:riderProfileId — Remove rider from favorites */
router.delete(
  '/:riderProfileId',
  asyncHandler(async (req, res) => {
    const clientId = await getClientProfileId(req.user!.userId);
    const riderProfileId = req.params.riderProfileId as string;

    const existing = await prisma.favoriteRider.findUnique({
      where: { clientId_riderProfileId: { clientId, riderProfileId } },
    });
    if (!existing) throw ApiError.notFound('Favorite not found');

    await prisma.favoriteRider.delete({ where: { id: existing.id } });
    res.status(StatusCodes.OK).json({ success: true, message: 'Removed from favorites' });
  }),
);

export { router as favoriteRiderRouter };
