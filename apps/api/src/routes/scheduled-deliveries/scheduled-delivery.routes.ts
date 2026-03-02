import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/api-error';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@riderguy/database';

// ============================================================
// Scheduled Deliveries — CRUD for recurring / future deliveries
// ============================================================

const router = Router();

router.use(authenticate);

// ── Validation schemas ──────────────────────────────────

const createScheduledDeliverySchema = z.object({
  title: z.string().max(100).optional(),
  frequency: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM']),

  // Schedule timing
  scheduledDate: z.string().datetime().optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  maxOccurrences: z.number().int().min(1).optional(),

  // Pickup
  pickupAddress: z.string().min(1).max(500),
  pickupLatitude: z.number().min(-90).max(90),
  pickupLongitude: z.number().min(-180).max(180),
  pickupContactName: z.string().max(100).optional(),
  pickupContactPhone: z.string().max(20).optional(),
  pickupInstructions: z.string().max(500).optional(),

  // Dropoff
  dropoffAddress: z.string().min(1).max(500),
  dropoffLatitude: z.number().min(-90).max(90),
  dropoffLongitude: z.number().min(-180).max(180),
  dropoffContactName: z.string().max(100).optional(),
  dropoffContactPhone: z.string().max(20).optional(),
  dropoffInstructions: z.string().max(500).optional(),

  // Package & payment
  packageType: z.enum(['DOCUMENT', 'SMALL_PARCEL', 'MEDIUM_PARCEL', 'LARGE_PARCEL', 'FOOD', 'FRAGILE', 'HIGH_VALUE']).optional(),
  packageDescription: z.string().max(500).optional(),
  paymentMethod: z.enum(['CARD', 'MOBILE_MONEY', 'WALLET', 'CASH', 'BANK_TRANSFER']).optional(),
});

const updateScheduledDeliverySchema = createScheduledDeliverySchema.partial().extend({
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).optional(),
});

// ── Helpers ─────────────────────────────────────────────

function computeNextScheduledAt(
  frequency: string,
  scheduledDate?: string | null,
  scheduledTime?: string | null,
  daysOfWeek?: number[] | null,
  dayOfMonth?: number | null,
): Date | null {
  const now = new Date();

  if (frequency === 'ONCE' && scheduledDate) {
    return new Date(scheduledDate);
  }

  // For recurring, calculate next occurrence from now
  const timeStr = scheduledTime ?? '09:00';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours!, minutes!, 0, 0);

  if (frequency === 'DAILY') {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  if (frequency === 'WEEKLY' && daysOfWeek?.length) {
    const today = now.getDay() || 7; // ISO: Mon=1
    const sorted = [...daysOfWeek].sort((a, b) => a - b);
    const nextDay = sorted.find((d) => d > today) ?? sorted[0]!;
    const daysUntil = nextDay > today ? nextDay - today : 7 - today + nextDay;
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  if (frequency === 'BIWEEKLY') {
    if (next <= now) next.setDate(next.getDate() + 14);
    return next;
  }

  if (frequency === 'MONTHLY' && dayOfMonth) {
    next.setDate(dayOfMonth);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next;
  }

  return null;
}

// ── Routes ──────────────────────────────────────────────

/** GET /scheduled-deliveries — List user's scheduled deliveries */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const status = req.query.status as string | undefined;

    const schedules = await prisma.scheduledDelivery.findMany({
      where: {
        clientId: userId,
        ...(status ? { status: status as 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { generatedOrders: true } } },
    });

    res.status(StatusCodes.OK).json({ success: true, data: schedules });
  }),
);

/** GET /scheduled-deliveries/:id — Get single scheduled delivery */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const scheduleId = req.params.id as string;
    const schedule = await prisma.scheduledDelivery.findFirst({
      where: { id: scheduleId, clientId: req.user!.userId },
      include: {
        generatedOrders: {
          select: { id: true, orderNumber: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!schedule) throw ApiError.notFound('Scheduled delivery not found');

    res.status(StatusCodes.OK).json({ success: true, data: schedule });
  }),
);

/** POST /scheduled-deliveries — Create a new scheduled delivery */
router.post(
  '/',
  validate(createScheduledDeliverySchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const {
      title, frequency,
      scheduledDate, scheduledTime, daysOfWeek, dayOfMonth,
      startDate, endDate, maxOccurrences,
      pickupAddress, pickupLatitude, pickupLongitude,
      pickupContactName, pickupContactPhone, pickupInstructions,
      dropoffAddress, dropoffLatitude, dropoffLongitude,
      dropoffContactName, dropoffContactPhone, dropoffInstructions,
      packageType, packageDescription, paymentMethod,
    } = req.body;

    const nextScheduledAt = computeNextScheduledAt(
      frequency, scheduledDate, scheduledTime, daysOfWeek, dayOfMonth,
    );

    const schedule = await prisma.scheduledDelivery.create({
      data: {
        clientId: userId,
        title,
        frequency: frequency as 'ONCE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTime,
        daysOfWeek: daysOfWeek ?? [],
        dayOfMonth,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        maxOccurrences,
        pickupAddress, pickupLatitude, pickupLongitude,
        pickupContactName, pickupContactPhone, pickupInstructions,
        dropoffAddress, dropoffLatitude, dropoffLongitude,
        dropoffContactName, dropoffContactPhone, dropoffInstructions,
        packageType,
        packageDescription,
        paymentMethod,
        nextScheduledAt,
      },
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: schedule });
  }),
);

/** PATCH /scheduled-deliveries/:id — Update a scheduled delivery */
router.patch(
  '/:id',
  validate(updateScheduledDeliverySchema),
  asyncHandler(async (req, res) => {
    const scheduleId = req.params.id as string;
    const existing = await prisma.scheduledDelivery.findFirst({
      where: { id: scheduleId, clientId: req.user!.userId },
    });
    if (!existing) throw ApiError.notFound('Scheduled delivery not found');

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot update a completed or cancelled schedule');
    }

    // Recalculate nextScheduledAt if schedule timing changed
    const frequency = req.body.frequency ?? existing.frequency;
    const scheduledDate = req.body.scheduledDate ?? existing.scheduledDate?.toISOString();
    const scheduledTime = req.body.scheduledTime ?? existing.scheduledTime;
    const daysOfWeek = req.body.daysOfWeek ?? existing.daysOfWeek;
    const dayOfMonth = req.body.dayOfMonth ?? existing.dayOfMonth;

    const nextScheduledAt = computeNextScheduledAt(
      frequency, scheduledDate, scheduledTime, daysOfWeek, dayOfMonth,
    );

    const updated = await prisma.scheduledDelivery.update({
      where: { id: existing.id },
      data: { ...req.body, nextScheduledAt },
    });

    res.status(StatusCodes.OK).json({ success: true, data: updated });
  }),
);

/** DELETE /scheduled-deliveries/:id — Cancel a scheduled delivery */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const scheduleId = req.params.id as string;
    const existing = await prisma.scheduledDelivery.findFirst({
      where: { id: scheduleId, clientId: req.user!.userId },
    });
    if (!existing) throw ApiError.notFound('Scheduled delivery not found');

    await prisma.scheduledDelivery.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED' },
    });

    res.status(StatusCodes.OK).json({ success: true, message: 'Schedule cancelled' });
  }),
);

export { router as scheduledDeliveryRouter };
