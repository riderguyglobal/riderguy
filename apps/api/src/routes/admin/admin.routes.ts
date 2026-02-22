import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../lib/logger';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN));

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
      ordersToday,
      ordersThisWeek,
      ordersThisMonth,
      totalOrders,
      activeDeliveries,
      deliveredToday,
      revenueToday,
      revenueThisMonth,
      totalRevenue,
      pendingWithdrawals,
      totalZones,
    ] = await Promise.all([
      prisma.riderProfile.count(),
      prisma.riderProfile.count({ where: { onboardingStatus: 'ACTIVATED' } }),
      prisma.riderProfile.count({ where: { availability: 'ONLINE' } }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.riderProfile.count({
        where: { onboardingStatus: { in: ['DOCUMENTS_SUBMITTED', 'DOCUMENTS_UNDER_REVIEW'] } },
      }),
      prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count(),
      prisma.order.count({
        where: { status: { in: ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT'] } },
      }),
      prisma.order.count({ where: { status: 'DELIVERED', deliveredAt: { gte: startOfToday } } }),
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { status: 'DELIVERED', deliveredAt: { gte: startOfToday } },
      }),
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { status: 'DELIVERED', deliveredAt: { gte: startOfMonth } },
      }),
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { status: 'DELIVERED' },
      }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.zone.count({ where: { status: 'ACTIVE' } }),
    ]);

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
          today: revenueToday._sum.totalPrice ?? 0,
          thisMonth: revenueThisMonth._sum.totalPrice ?? 0,
          total: totalRevenue._sum.totalPrice ?? 0,
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
        select: { id: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.withdrawal.findMany({
        where: { createdAt: { gte: startDate } },
        select: { id: true, amount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Group by day
    const dailyMap = new Map<string, {
      date: string;
      orders: number;
      deliveries: number;
      revenue: number;
      commission: number;
      newRiders: number;
      newClients: number;
      withdrawals: number;
      withdrawalAmount: number;
    }>();

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
          bucket.revenue += order.totalPrice;
          bucket.commission += order.platformCommission ?? 0;
        }
      }
    }

    // Aggregate signups
    for (const user of users) {
      const key = user.createdAt.toISOString().split('T')[0] as string;
      const bucket = dailyMap.get(key);
      if (bucket) {
        if (user.role === 'RIDER') bucket.newRiders++;
        else if (user.role === 'CLIENT' || user.role === 'BUSINESS_CLIENT') bucket.newClients++;
      }
    }

    // Aggregate withdrawals
    for (const w of withdrawals) {
      const key = w.createdAt.toISOString().split('T')[0] as string;
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.withdrawals++;
        if (w.status === 'COMPLETED') bucket.withdrawalAmount += w.amount;
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
      { totalOrders: 0, totalDeliveries: 0, totalRevenue: 0, totalCommission: 0, totalNewRiders: 0, totalNewClients: 0 },
    );

    // Completion rate
    const completionRate = summary.totalOrders > 0
      ? Math.round((summary.totalDeliveries / summary.totalOrders) * 100)
      : 0;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        period: { days, startDate: startDate.toISOString(), endDate: new Date().toISOString() },
        summary: { ...summary, completionRate },
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
        error: { code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` },
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    // Prevent admins from modifying other admins (only super_admin can)
    if (
      (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only super admins can modify admin accounts' },
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
      },
    });

    logger.info({ userId, newStatus: status, reason, adminId: req.user!.userId }, 'User status updated by admin');

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
      include: {
        riderProfile: {
          include: {
            vehicles: true,
            _count: { select: { ordersAsRider: true } },
          },
        },
        clientProfile: true,
        partnerProfile: true,
        wallet: { select: { id: true, balance: true, totalEarned: true, totalWithdrawn: true, totalTips: true } },
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

/**
 * POST /admin/contact-submissions
 * Receive contact form submissions from marketing site.
 * Public endpoint (no auth required) — will be mounted separately.
 */
// This is exported separately for public mounting.

export { router as adminRouter };
