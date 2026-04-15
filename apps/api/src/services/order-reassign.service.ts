import { prisma } from '@riderguy/database';
import type { OrderStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { autoDispatch } from './auto-dispatch.service';
import { transitionStatus } from './order.service';
import { processCancellationConsequences } from './cancellation.service';
import { createOrderNotification } from './notification.service';
import { emitOrderStatusUpdate } from '../socket';

// ============================================================
// Order Reassign & Auto-Cancel Service
//
// Handles system-initiated order recovery for edge cases:
// 1. Assigned rider loses GPS for extended period
// 2. Assigned rider goes offline and doesn't reconnect
// 3. Payment failure after rider assignment
// 4. Admin suspends rider mid-delivery
// 5. Expired cancel request (30-min timeout) resolution
// ============================================================

// ── Constants ───────────────────────────────────────────────

/** How long a rider can be GPS-dark while assigned before auto-reassign (ms) */
const GPS_DARK_THRESHOLD_MS = 10 * 60_000; // 10 minutes

/** How long after rider goes offline before auto-reassign (ms) */
const OFFLINE_REASSIGN_THRESHOLD_MS = 5 * 60_000; // 5 minutes

/** Statuses where the rider hasn't picked up yet — safe to reassign */
const PRE_PICKUP_STATUSES: OrderStatus[] = ['ASSIGNED', 'PICKUP_EN_ROUTE'];

/** Statuses where the rider has the package — requires admin intervention */
const POST_PICKUP_STATUSES: OrderStatus[] = ['PICKED_UP', 'IN_TRANSIT'];

// ── 1. GPS-dark rider reassignment ─────────────────────────

/**
 * Find orders where the assigned rider's last GPS update is older than
 * GPS_DARK_THRESHOLD_MS. For pre-pickup orders, auto-reassign to another
 * rider. For post-pickup, escalate to admin.
 *
 * Called periodically from the server's interval timers.
 */
export async function reassignGpsDarkRiders(): Promise<number> {
  const gpsCutoff = new Date(Date.now() - GPS_DARK_THRESHOLD_MS);

  // Find orders in active pre-pickup or post-pickup statuses
  // where the assigned rider's GPS is stale
  const staleOrders = await prisma.order.findMany({
    where: {
      status: { in: [...PRE_PICKUP_STATUSES, ...POST_PICKUP_STATUSES, 'AT_PICKUP'] },
      riderId: { not: null },
      rider: {
        lastLocationUpdate: { lt: gpsCutoff },
      },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      clientId: true,
      riderId: true,
      rider: {
        select: {
          id: true,
          userId: true,
          lastLocationUpdate: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (staleOrders.length === 0) return 0;

  let reassigned = 0;
  for (const order of staleOrders) {
    if (!order.rider) continue;

    try {
      // Check if we already flagged this recently (avoid duplicate actions)
      const recentFlag = await prisma.orderStatusHistory.findFirst({
        where: {
          orderId: order.id,
          actor: 'system',
          note: { startsWith: 'GPS_DARK' },
          createdAt: { gt: new Date(Date.now() - GPS_DARK_THRESHOLD_MS) },
        },
      });
      if (recentFlag) continue;

      const minutesSinceGps = order.rider.lastLocationUpdate
        ? Math.round((Date.now() - order.rider.lastLocationUpdate.getTime()) / 60_000)
        : 999;

      if (PRE_PICKUP_STATUSES.includes(order.status as OrderStatus)) {
        // Pre-pickup: safe to reassign
        await reassignOrder(
          order.id,
          order.orderNumber,
          order.status as OrderStatus,
          order.rider.id,
          order.rider.userId,
          order.clientId,
          `GPS_DARK: Rider GPS silent for ${minutesSinceGps}min. Auto-reassigning.`,
        );
        reassigned++;
      } else {
        // Post-pickup or AT_PICKUP: escalate to admin
        await escalateToAdmin(
          order.id,
          order.orderNumber,
          order.status as OrderStatus,
          order.rider.userId,
          order.clientId,
          `GPS_DARK: Rider GPS silent for ${minutesSinceGps}min while package is with rider. Requires admin intervention.`,
        );
      }
    } catch (err) {
      logger.error({ err, orderId: order.id }, '[Reassign] Failed to handle GPS-dark rider');
    }
  }

  if (reassigned > 0) {
    logger.warn({ reassigned, total: staleOrders.length }, '[Reassign] GPS-dark rider sweep completed');
  }

  return reassigned;
}

// ── 2. Offline rider reassignment ──────────────────────────

/**
 * Find orders where the assigned rider has been marked OFFLINE and
 * hasn't reconnected within the grace period.
 *
 * Called periodically from the server's interval timers.
 */
export async function reassignOfflineRiders(): Promise<number> {
  const offlineCutoff = new Date(Date.now() - OFFLINE_REASSIGN_THRESHOLD_MS);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: { in: [...PRE_PICKUP_STATUSES, ...POST_PICKUP_STATUSES, 'AT_PICKUP'] },
      riderId: { not: null },
      rider: {
        availability: 'OFFLINE',
        lastSeenAt: { lt: offlineCutoff },
      },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      clientId: true,
      riderId: true,
      rider: {
        select: {
          id: true,
          userId: true,
          lastSeenAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (staleOrders.length === 0) return 0;

  let reassigned = 0;
  for (const order of staleOrders) {
    if (!order.rider) continue;

    try {
      const recentFlag = await prisma.orderStatusHistory.findFirst({
        where: {
          orderId: order.id,
          actor: 'system',
          note: { startsWith: 'RIDER_OFFLINE' },
          createdAt: { gt: new Date(Date.now() - OFFLINE_REASSIGN_THRESHOLD_MS) },
        },
      });
      if (recentFlag) continue;

      const minutesSinceOnline = order.rider.lastSeenAt
        ? Math.round((Date.now() - order.rider.lastSeenAt.getTime()) / 60_000)
        : 999;

      if (PRE_PICKUP_STATUSES.includes(order.status as OrderStatus)) {
        await reassignOrder(
          order.id,
          order.orderNumber,
          order.status as OrderStatus,
          order.rider.id,
          order.rider.userId,
          order.clientId,
          `RIDER_OFFLINE: Rider offline for ${minutesSinceOnline}min. Auto-reassigning.`,
        );
        reassigned++;
      } else {
        await escalateToAdmin(
          order.id,
          order.orderNumber,
          order.status as OrderStatus,
          order.rider.userId,
          order.clientId,
          `RIDER_OFFLINE: Rider went offline for ${minutesSinceOnline}min while package is with rider. Requires admin intervention.`,
        );
      }
    } catch (err) {
      logger.error({ err, orderId: order.id }, '[Reassign] Failed to handle offline rider');
    }
  }

  if (reassigned > 0) {
    logger.warn({ reassigned, total: staleOrders.length }, '[Reassign] Offline rider sweep completed');
  }

  return reassigned;
}

// ── 3. Payment failure after assignment ────────────────────

/**
 * Handle payment failure for an order that already has a rider assigned.
 * Cancels the order and releases the rider.
 *
 * Called from the payment webhook when a previously-pending payment fails.
 */
export async function handlePaymentFailureAfterAssignment(
  orderId: string,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      rider: { select: { id: true, userId: true } },
    },
  });

  if (!order) return;

  // Only act if the order is still in an active status with a rider assigned
  const activeStatuses: OrderStatus[] = [
    'ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'SEARCHING_RIDER',
  ];
  if (!activeStatuses.includes(order.status) || !order.rider) return;

  const cancelNote = 'Payment failed after rider assignment. Order auto-cancelled by system.';

  try {
    await transitionStatus(orderId, 'CANCELLED_BY_ADMIN', 'system', cancelNote);

    emitOrderStatusUpdate({
      orderId,
      orderNumber: order.orderNumber,
      status: 'CANCELLED_BY_ADMIN',
      previousStatus: order.status,
      actor: 'system',
      note: cancelNote,
    });

    // Notify both parties
    await createOrderNotification(
      order.clientId,
      'Order Cancelled — Payment Failed',
      `Order ${order.orderNumber} has been cancelled because your payment could not be processed. Please try again.`,
      orderId,
    ).catch(() => {});

    await createOrderNotification(
      order.rider.userId,
      'Order Cancelled — Payment Issue',
      `Order ${order.orderNumber} has been cancelled due to a payment failure. You are now available for new orders.`,
      orderId,
    ).catch(() => {});

    logger.warn({ orderId, orderNumber: order.orderNumber }, '[Reassign] Cancelled order due to payment failure after assignment');
  } catch (err) {
    logger.error({ err, orderId }, '[Reassign] Failed to cancel order after payment failure');
  }
}

// ── 4. Admin suspension mid-delivery ───────────────────────

/**
 * Handle the case where an admin suspends a rider who currently has
 * active assigned orders. Pre-pickup orders are reassigned, post-pickup
 * orders are escalated to admin.
 *
 * Called when admin suspends a rider via the admin dashboard.
 */
export async function handleRiderSuspended(riderId: string): Promise<number> {
  const activeOrders = await prisma.order.findMany({
    where: {
      riderId,
      status: { in: [...PRE_PICKUP_STATUSES, ...POST_PICKUP_STATUSES, 'AT_PICKUP'] },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      clientId: true,
    },
  });

  if (activeOrders.length === 0) return 0;

  const rider = await prisma.riderProfile.findUnique({
    where: { id: riderId },
    select: { userId: true },
  });
  if (!rider) return 0;

  let handled = 0;
  for (const order of activeOrders) {
    try {
      if (PRE_PICKUP_STATUSES.includes(order.status as OrderStatus)) {
        await reassignOrder(
          order.id,
          order.orderNumber,
          order.status as OrderStatus,
          riderId,
          rider.userId,
          order.clientId,
          'RIDER_SUSPENDED: Admin suspended rider. Auto-reassigning.',
        );
        handled++;
      } else {
        await escalateToAdmin(
          order.id,
          order.orderNumber,
          order.status as OrderStatus,
          rider.userId,
          order.clientId,
          'RIDER_SUSPENDED: Admin suspended rider while package is with rider. Requires resolution.',
        );
        handled++;
      }
    } catch (err) {
      logger.error({ err, orderId: order.id }, '[Reassign] Failed to handle suspended rider order');
    }
  }

  return handled;
}

// ── 5. Expired cancel request resolution ───────────────────

/**
 * Extended handler for expired cancel requests. Beyond the existing
 * notification logic in cancellation-request.service, this actually
 * resolves the order state to prevent indefinite limbo.
 *
 * For expired requests where the order is post-pickup, the order
 * is marked as CANCELLED_BY_ADMIN with an admin investigation flag.
 *
 * Called periodically from the server's interval timers.
 */
export async function resolveExpiredCancelRequests(): Promise<number> {
  const expiredRequests = await prisma.cancellationRequest.findMany({
    where: {
      status: 'EXPIRED',
      // Only pick up expired requests that haven't been admin-resolved yet
      adminResolvedBy: null,
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          clientId: true,
        },
      },
      rider: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (expiredRequests.length === 0) return 0;

  let resolved = 0;
  for (const request of expiredRequests) {
    try {
      // Only act on orders still in post-pickup statuses
      if (!POST_PICKUP_STATUSES.includes(request.order.status as OrderStatus)) continue;

      const cancelNote = `System cancel: Cancel request expired without client response after 30min. Package with rider.`;

      await transitionStatus(
        request.order.id,
        'CANCELLED_BY_ADMIN',
        'system',
        cancelNote,
      );

      // Mark the cancel request as admin-resolved
      await prisma.cancellationRequest.update({
        where: { id: request.id },
        data: {
          status: 'ADMIN_RESOLVED',
          adminResolvedBy: 'system',
          adminNote: 'Auto-resolved after 30-minute timeout. Order cancelled. Investigation required.',
        },
      });

      // Process consequences for the rider
      await processCancellationConsequences(
        request.rider.id,
        request.rider.userId,
        request.order.id,
        request.order.orderNumber,
        request.orderStatusAtRequest as Parameters<typeof processCancellationConsequences>[4],
        request.reason,
        request.order.clientId,
      );

      emitOrderStatusUpdate({
        orderId: request.order.id,
        orderNumber: request.order.orderNumber,
        status: 'CANCELLED_BY_ADMIN',
        previousStatus: request.order.status,
        actor: 'system',
        note: cancelNote,
      });

      // Notify both parties
      await createOrderNotification(
        request.order.clientId,
        'Order Cancelled — Unresolved Request',
        `Order ${request.order.orderNumber} has been cancelled after the cancellation request went unanswered. Our support team will follow up.`,
        request.order.id,
      ).catch(() => {});

      await createOrderNotification(
        request.rider.userId,
        'Order Cancelled — Request Expired',
        `Order ${request.order.orderNumber} has been cancelled. The cancel request expired without a client response. This has been flagged for review.`,
        request.order.id,
      ).catch(() => {});

      resolved++;
    } catch (err) {
      logger.error({ err, requestId: request.id }, '[Reassign] Failed to resolve expired cancel request');
    }
  }

  if (resolved > 0) {
    logger.warn({ resolved }, '[Reassign] Resolved expired cancel requests');
  }

  return resolved;
}

// ── Internal: Reassign order to new rider ──────────────────

/**
 * Cancel the current rider's assignment and re-dispatch the order.
 * Only safe for pre-pickup statuses.
 */
async function reassignOrder(
  orderId: string,
  orderNumber: string,
  currentStatus: OrderStatus,
  riderId: string,
  riderUserId: string,
  clientId: string,
  systemNote: string,
): Promise<void> {
  // 1. Transition back to PENDING (which clears rider assignment via transitionStatus)
  //    We go to CANCELLED_BY_ADMIN first, then create a new PENDING state
  //    Actually: we directly revert to PENDING and re-dispatch

  // Record what happened
  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: currentStatus,
      actor: 'system',
      note: systemNote,
    },
  });

  // Unassign the rider and reset to PENDING
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'PENDING',
      riderId: null,
      assignedAt: null,
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: 'PENDING',
      actor: 'system',
      note: 'Order returned to queue for reassignment',
    },
  });

  // Release the rider back to ONLINE (if not suspended/offline)
  const rider = await prisma.riderProfile.findUnique({
    where: { id: riderId },
    select: { availability: true, suspendedUntil: true },
  });
  if (rider && rider.availability === 'ON_DELIVERY') {
    const isSuspended = rider.suspendedUntil && rider.suspendedUntil > new Date();
    await prisma.riderProfile.update({
      where: { id: riderId },
      data: { availability: isSuspended ? 'OFFLINE' : 'ONLINE' },
    });
  }

  // Notify both parties
  await createOrderNotification(
    clientId,
    'Finding You a New Rider',
    `Your rider for order ${orderNumber} became unavailable. We're assigning a new rider now.`,
    orderId,
  ).catch(() => {});

  await createOrderNotification(
    riderUserId,
    'Order Reassigned',
    `Order ${orderNumber} has been reassigned to another rider because your connection was lost.`,
    orderId,
  ).catch(() => {});

  emitOrderStatusUpdate({
    orderId,
    orderNumber,
    status: 'PENDING',
    previousStatus: currentStatus,
    actor: 'system',
    note: 'Reassigning to new rider',
  });

  // Re-dispatch the order
  try {
    await autoDispatch(orderId);
  } catch (err) {
    logger.error({ err, orderId }, '[Reassign] Failed to re-dispatch order after reassignment');
  }
}

// ── Internal: Escalate post-pickup issue to admin ──────────

async function escalateToAdmin(
  orderId: string,
  orderNumber: string,
  currentStatus: OrderStatus,
  riderUserId: string,
  clientId: string,
  systemNote: string,
): Promise<void> {
  // Record the escalation
  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: currentStatus,
      actor: 'system',
      note: systemNote,
    },
  });

  // Notify admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
    take: 5,
  });

  for (const admin of admins) {
    await createOrderNotification(
      admin.id,
      'Order Requires Intervention',
      `${systemNote} Order ${orderNumber} needs manual resolution.`,
      orderId,
    ).catch(() => {});
  }

  // Also notify rider and client of the escalation
  await createOrderNotification(
    clientId,
    'Delivery Issue — Our Team Is On It',
    `There's a temporary issue with order ${orderNumber}. Our support team has been notified and will resolve this shortly.`,
    orderId,
  ).catch(() => {});

  await createOrderNotification(
    riderUserId,
    'Delivery Issue Escalated',
    `Order ${orderNumber} has been escalated to our support team. Please wait for further instructions.`,
    orderId,
  ).catch(() => {});

  // Emit to admin socket room
  try {
    const { getIO } = await import('../socket');
    const io = getIO();
    (io.to('admins') as any).emit('admin:order-escalation', {
      orderId,
      orderNumber,
      currentStatus,
      reason: systemNote,
      timestamp: new Date().toISOString(),
    });
  } catch { /* socket might not be initialized in tests */ }

  logger.warn({ orderId, orderNumber, currentStatus }, `[Reassign] Escalated to admin: ${systemNote}`);
}
