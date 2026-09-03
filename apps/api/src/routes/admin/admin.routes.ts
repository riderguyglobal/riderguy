import { Router, Request, Response } from 'express';
import { authenticate, hasAnyRole, requireRole } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../lib/logger';
import { handleRiderSuspended } from '../../services/order-reassign.service';
import { PushService } from '../../services/push.service';
import { disconnectUserSockets } from '../../socket';
import { adminAuditContext } from '../../services/admin-audit.service';
import { updateAdminManagedUserStatus } from '../../services/admin-user-status.service';
import { config } from '../../config';
import { ApiError } from '../../lib/api-error';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN));

/**
 * GET /admin/system-readiness
 * Safe configuration and dependency visibility for the Super Admin console.
 * Never returns credentials, identifiers, endpoints, or secret values.
 */
router.get(
  '/system-readiness',
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (_req: Request, res: Response) => {
    const databaseOperational = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`
      .then(() => true)
      .catch((error) => {
        logger.error({ err: error }, '[Admin] Database readiness check failed');
        return false;
      });

    const configured = (values: readonly string[]) => values.every((value) => Boolean(value));
    const services = {
      database: {
        state: databaseOperational ? 'OPERATIONAL' : 'UNAVAILABLE',
        detail: databaseOperational
          ? 'Primary datastore is responding.'
          : 'Primary datastore did not respond.',
      },
      fileStorage: {
        state: configured([
          config.s3.endpoint,
          config.s3.accessKeyId,
          config.s3.secretAccessKey,
          config.s3.bucketName,
        ])
          ? 'CONFIGURED'
          : 'FALLBACK',
        detail: config.s3.endpoint
          ? 'Durable object storage is configured.'
          : 'Uploads are using local server storage.',
      },
      googleSignIn: {
        state: config.google.clientIds.length > 0 ? 'CONFIGURED' : 'UNCONFIGURED',
        detail:
          config.google.clientIds.length > 0
            ? 'Google identity audiences are allowlisted.'
            : 'Google identity audiences are missing.',
      },
      email: {
        state: configured([config.email.user, config.email.appPassword])
          ? 'CONFIGURED'
          : 'UNCONFIGURED',
        detail: configured([config.email.user, config.email.appPassword])
          ? 'Email delivery credentials are configured.'
          : 'Automatic email delivery is unavailable.',
      },
      sms: {
        state: config.mnotify.apiKey ? 'CONFIGURED' : 'MANUAL_FALLBACK',
        detail: config.mnotify.apiKey
          ? 'Ghana SMS delivery is configured.'
          : 'SMS invitations require manual secure sharing.',
      },
      payments: {
        state: config.paystack.secretKey ? 'CONFIGURED' : 'UNCONFIGURED',
        detail: config.paystack.secretKey
          ? 'Paystack server credentials are configured.'
          : 'Payment processing credentials are missing.',
      },
      riderPush: {
        state: configured([
          config.firebase.rider.projectId,
          config.firebase.rider.clientEmail,
          config.firebase.rider.privateKey,
        ])
          ? 'CONFIGURED'
          : 'UNCONFIGURED',
        detail: configured([
          config.firebase.rider.projectId,
          config.firebase.rider.clientEmail,
          config.firebase.rider.privateKey,
        ])
          ? 'Rider push delivery is configured.'
          : 'Rider push delivery is unavailable.',
      },
      maps: {
        state:
          config.google.mapsEnabled && config.google.mapsApiKey ? 'CONFIGURED' : 'GHANA_FALLBACK',
        detail:
          config.google.mapsEnabled && config.google.mapsApiKey
            ? 'Google Maps routing is enabled.'
            : 'Local Ghana routing and geocoding fallback is active.',
      },
    } as const;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        environment: config.nodeEnv,
        generatedAt: new Date().toISOString(),
        services,
      },
    });
  }),
);

// ============================================================
// Admin Dashboard & Analytics Routes — Sprint 7
// ============================================================

/**
 * GET /admin/dashboard-stats
 * KPI cards: total riders, active riders, orders today/week/month,
 * revenue, pending applications, active deliveries, etc.
 */
router.get(
  '/dashboard-stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalRiders,
      activeRiders,
      onlineRiders,
      totalClients,
      pendingApplications,
      orderStats,
      pendingWithdrawals,
      totalZones,
    ] = await Promise.all([
      prisma.riderProfile.count(),
      prisma.riderProfile.count({ where: { onboardingStatus: 'ACTIVATED' } }),
      prisma.riderProfile.count({ where: { availability: 'ONLINE' } }),
      prisma.user.count({ where: { OR: [{ role: 'CLIENT' }, { roles: { has: 'CLIENT' } }] } }),
      prisma.riderProfile.count({
        where: { onboardingStatus: { notIn: ['ACTIVATED', 'APPLICATION_REJECTED'] } },
      }),
      // ORD-08: collapse 9 separate order count + aggregate round-trips into a
      //          single SQL pass with conditional aggregates. Cuts dashboard
      //          load latency from O(N round-trips) to O(1).
      prisma.$queryRaw<
        Array<{
          orders_today: bigint;
          orders_week: bigint;
          orders_month: bigint;
          orders_total: bigint;
          active_deliveries: bigint;
          delivered_today: bigint;
          revenue_today: string | null;
          revenue_month: string | null;
          revenue_total: string | null;
        }>
      >`
        SELECT
          COUNT(*) FILTER (WHERE "createdAt" >= ${startOfToday}) AS orders_today,
          COUNT(*) FILTER (WHERE "createdAt" >= ${startOfWeek})  AS orders_week,
          COUNT(*) FILTER (WHERE "createdAt" >= ${startOfMonth}) AS orders_month,
          COUNT(*)                                                AS orders_total,
          COUNT(*) FILTER (WHERE status IN ('ASSIGNED','PICKUP_EN_ROUTE','AT_PICKUP','PICKED_UP','IN_TRANSIT')) AS active_deliveries,
          COUNT(*) FILTER (WHERE status = 'DELIVERED' AND "deliveredAt" >= ${startOfToday}) AS delivered_today,
          COALESCE(SUM("totalPrice") FILTER (WHERE status = 'DELIVERED' AND "deliveredAt" >= ${startOfToday}), 0)::text AS revenue_today,
          COALESCE(SUM("totalPrice") FILTER (WHERE status = 'DELIVERED' AND "deliveredAt" >= ${startOfMonth}), 0)::text AS revenue_month,
          COALESCE(SUM("totalPrice") FILTER (WHERE status = 'DELIVERED'), 0)::text                              AS revenue_total
        FROM "orders"
      `,
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.zone.count({ where: { status: 'ACTIVE' } }),
    ]);

    const stat = orderStats[0] ?? {
      orders_today: 0n,
      orders_week: 0n,
      orders_month: 0n,
      orders_total: 0n,
      active_deliveries: 0n,
      delivered_today: 0n,
      revenue_today: '0',
      revenue_month: '0',
      revenue_total: '0',
    };
    const ordersToday = Number(stat.orders_today);
    const ordersThisWeek = Number(stat.orders_week);
    const ordersThisMonth = Number(stat.orders_month);
    const totalOrders = Number(stat.orders_total);
    const activeDeliveries = Number(stat.active_deliveries);
    const deliveredToday = Number(stat.delivered_today);
    const revenueToday = Number(stat.revenue_today ?? 0);
    const revenueThisMonth = Number(stat.revenue_month ?? 0);
    const totalRevenue = Number(stat.revenue_total ?? 0);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        riders: {
          total: totalRiders,
          active: activeRiders,
          online: onlineRiders,
          pendingApplications,
        },
        clients: {
          total: totalClients,
        },
        orders: {
          today: ordersToday,
          thisWeek: ordersThisWeek,
          thisMonth: ordersThisMonth,
          total: totalOrders,
          activeDeliveries,
          deliveredToday,
        },
        revenue: {
          today: revenueToday,
          thisMonth: revenueThisMonth,
          total: totalRevenue,
        },
        pendingWithdrawals,
        activeZones: totalZones,
      },
    });
  }),
);

/**
 * GET /admin/analytics
 * Time-series data for charts: deliveries, revenue, signups over time.
 * Query params:
 *   period: 'daily' | 'weekly' | 'monthly' (default: 'daily')
 *   days: number of days to look back (default: 30, max: 365)
 */
router.get(
  '/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(parseInt(String(req.query.days ?? '30')) || 30, 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Fetch raw data for the period
    const [orders, users, withdrawals] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: startDate } },
        select: {
          id: true,
          status: true,
          totalPrice: true,
          platformCommission: true,
          createdAt: true,
          deliveredAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { id: true, role: true, roles: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.withdrawal.findMany({
        where: { createdAt: { gte: startDate } },
        select: { id: true, amount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Group by day
    const dailyMap = new Map<
      string,
      {
        date: string;
        orders: number;
        deliveries: number;
        revenue: number;
        commission: number;
        newRiders: number;
        newClients: number;
        withdrawals: number;
        withdrawalAmount: number;
      }
    >();

    // Initialize all days in range
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0] as string;
      dailyMap.set(key, {
        date: key,
        orders: 0,
        deliveries: 0,
        revenue: 0,
        commission: 0,
        newRiders: 0,
        newClients: 0,
        withdrawals: 0,
        withdrawalAmount: 0,
      });
    }

    // Aggregate orders
    for (const order of orders) {
      const key = order.createdAt.toISOString().split('T')[0] as string;
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.orders++;
        if (order.status === 'DELIVERED') {
          bucket.deliveries++;
          bucket.revenue += Number(order.totalPrice);
          bucket.commission += Number(order.platformCommission ?? 0);
        }
      }
    }

    // Aggregate signups
    for (const user of users) {
      const key = user.createdAt.toISOString().split('T')[0] as string;
      const bucket = dailyMap.get(key);
      if (bucket) {
        if (hasAnyRole(user, UserRole.RIDER)) bucket.newRiders++;
        else if (hasAnyRole(user, UserRole.CLIENT, UserRole.BUSINESS_CLIENT)) bucket.newClients++;
      }
    }

    // Aggregate withdrawals
    for (const w of withdrawals) {
      const key = w.createdAt.toISOString().split('T')[0] as string;
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.withdrawals++;
        if (w.status === 'COMPLETED') bucket.withdrawalAmount += Number(w.amount);
      }
    }

    const daily = Array.from(dailyMap.values());

    // Compute summary totals
    const summary = daily.reduce(
      (acc, d) => ({
        totalOrders: acc.totalOrders + d.orders,
        totalDeliveries: acc.totalDeliveries + d.deliveries,
        totalRevenue: acc.totalRevenue + d.revenue,
        totalCommission: acc.totalCommission + d.commission,
        totalNewRiders: acc.totalNewRiders + d.newRiders,
        totalNewClients: acc.totalNewClients + d.newClients,
      }),
      {
        totalOrders: 0,
        totalDeliveries: 0,
        totalRevenue: 0,
        totalCommission: 0,
        totalNewRiders: 0,
        totalNewClients: 0,
      },
    );

    // Completion rate
    const completionRate =
      summary.totalOrders > 0
        ? Math.round((summary.totalDeliveries / summary.totalOrders) * 100)
        : 0;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        period: { days, startDate: startDate.toISOString(), endDate: new Date().toISOString() },
        summary,
        completionRate,
        daily,
      },
    });
  }),
);

/**
 * PATCH /admin/users/:id/status
 * Update a user's account status (suspend, deactivate, ban, reactivate).
 */
router.patch(
  '/users/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.params.id);
    const { status, reason } = req.body;

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'BANNED'];
    if (!status || !validStatuses.includes(status)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        },
      });
      return;
    }
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    if (status !== 'ACTIVE' && normalizedReason.length < 5) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'STATUS_REASON_REQUIRED',
          message: 'A meaningful operational reason is required for access restrictions',
        },
      });
      return;
    }

    const decision = await updateAdminManagedUserStatus({
      targetUserId: userId,
      status,
      reason: normalizedReason,
      actorIsSuperAdmin: hasAnyRole(req.user!, UserRole.SUPER_ADMIN),
      auditContext: adminAuditContext(req),
    });
    const updated = decision.user;

    if (status !== 'ACTIVE') {
      // A status change is an immediate security boundary: remove refresh
      // sessions and terminate already-connected sockets. HTTP access tokens
      // are also rejected by the live session/account check in `authenticate`.
      const cleanupResults = await Promise.allSettled([
        prisma.session.deleteMany({ where: { userId } }),
        PushService.removeAllTokens(userId),
      ]);
      for (const result of cleanupResults) {
        if (result.status === 'rejected') {
          logger.error(
            { err: result.reason, userId },
            'Post-restriction credential cleanup failed',
          );
        }
      }
      try {
        disconnectUserSockets(userId);
      } catch (error) {
        logger.error({ err: error, userId }, 'Post-restriction socket disconnect failed');
      }
    }

    logger.info(
      { userId, newStatus: status, reason: normalizedReason, adminId: req.user!.userId },
      'User status updated by admin',
    );

    // Restricting any Rider account must synchronously recover its live work.
    // Do not acknowledge success while an assigned order is unhandled.
    if (
      (status === 'SUSPENDED' || status === 'DEACTIVATED' || status === 'BANNED') &&
      decision.wasRider
    ) {
      const riderProfile = await prisma.riderProfile.findUnique({ where: { userId } });
      if (riderProfile) {
        const handledOrders = await handleRiderSuspended(
          riderProfile.id,
          status as 'SUSPENDED' | 'DEACTIVATED' | 'BANNED',
        );
        logger.info(
          { userId, riderId: riderProfile.id, status, handledOrders },
          'Restricted Rider active-order recovery completed',
        );
      }
    }

    res.status(StatusCodes.OK).json({ success: true, data: updated });
  }),
);

/**
 * GET /admin/users/:id
 * Get detailed user profile for admin view.
 */
router.get(
  '/users/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        roles: true,
        status: true,
        phoneVerified: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        riderProfile: {
          include: {
            vehicles: true,
            _count: { select: { ordersAsRider: true } },
          },
        },
        clientProfile: true,
        partnerProfile: true,
        wallet: {
          select: {
            id: true,
            balance: true,
            totalEarned: true,
            totalWithdrawn: true,
            totalTips: true,
          },
        },
        _count: {
          select: {
            ordersAsClient: true,
            documents: true,
            notifications: true,
          },
        },
      },
    });

    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    res.status(StatusCodes.OK).json({ success: true, data: user });
  }),
);

// ============================================================
// Cancellation Management — Investigations & Appeals
// ============================================================

/** GET /admin/cancellations/investigations — Cases flagged for admin review */
router.get(
  '/cancellations/investigations',
  asyncHandler(async (_req: Request, res: Response) => {
    const { getPendingInvestigations } = await import('../../services/cancellation.service');
    const investigations = await getPendingInvestigations();
    res.status(StatusCodes.OK).json({ success: true, data: investigations });
  }),
);

/** GET /admin/cancellations/appeals — Pending appeals */
router.get(
  '/cancellations/appeals',
  asyncHandler(async (_req: Request, res: Response) => {
    const { getPendingAppeals } = await import('../../services/cancellation.service');
    const appeals = await getPendingAppeals();
    res.status(StatusCodes.OK).json({ success: true, data: appeals });
  }),
);

/** POST /admin/cancellations/appeals/:id/review — Review an appeal */
router.post(
  '/cancellations/appeals/:id/review',
  asyncHandler(async (req: Request, res: Response) => {
    const { reviewAppeal } = await import('../../services/cancellation.service');
    const { decision, notes, refundPenalty, liftSuspension } = req.body;

    const validDecisions = ['APPROVED', 'PARTIALLY_APPROVED', 'DENIED'] as const;
    if (!decision || !validDecisions.includes(decision)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'decision must be APPROVED, PARTIALLY_APPROVED, or DENIED',
        },
      });
      return;
    }
    if (typeof notes !== 'string' || notes.trim().length < 5) {
      throw ApiError.badRequest('A clear appeal rationale is required');
    }
    if (refundPenalty !== undefined && typeof refundPenalty !== 'boolean') {
      throw ApiError.badRequest('refundPenalty must be a boolean');
    }
    if (liftSuspension !== undefined && typeof liftSuspension !== 'boolean') {
      throw ApiError.badRequest('liftSuspension must be a boolean');
    }

    const appeal = await reviewAppeal(
      req.params.id as string,
      decision as 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED',
      notes,
      refundPenalty === true,
      liftSuspension === true,
      adminAuditContext(req),
    );
    const rider = await prisma.riderProfile.findUnique({
      where: { id: appeal.riderId },
      select: { userId: true },
    });
    if (rider) {
      PushService.sendToUser(
        rider.userId,
        'Cancellation appeal reviewed',
        `Your RiderGuy appeal was ${String(appeal.status).toLowerCase().replace('_', ' ')}.`,
        { appealId: appeal.id, status: String(appeal.status) },
      ).catch((error) =>
        logger.warn({ err: error, appealId: appeal.id }, 'Appeal push notification failed'),
      );
    }
    res.status(StatusCodes.OK).json({ success: true, data: appeal });
  }),
);

/** PATCH /admin/cancellations/:id/investigate — Add investigation notes */
router.patch(
  '/cancellations/:id/investigate',
  asyncHandler(async (req: Request, res: Response) => {
    const { notes } = req.body;
    if (typeof notes !== 'string' || notes.trim().length < 5) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'clear investigation findings are required' },
      });
      return;
    }

    const cancellationId = req.params.id as string;
    const { closeCancellationInvestigation } = await import('../../services/cancellation.service');
    const record = await closeCancellationInvestigation(
      cancellationId,
      notes,
      adminAuditContext(req),
    );
    res.status(StatusCodes.OK).json({ success: true, data: record });
  }),
);

/**
 * POST /admin/contact-submissions
 * Receive contact form submissions from marketing site.
 * Public endpoint (no auth required) — will be mounted separately.
 */
// This is exported separately for public mounting.

export { router as adminRouter };
