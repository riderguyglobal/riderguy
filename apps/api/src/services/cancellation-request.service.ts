import { prisma } from '@riderguy/database';
import type { CancelRequestStatus } from '@prisma/client';
import { ApiError } from '../lib/api-error';
import { logger } from '../lib/logger';
import { createOrderNotification } from './notification.service';
import { emitCancelRequest, emitCancelResponse, emitOrderStatusUpdate } from '../socket';
import { processCancellationConsequences } from './cancellation.service';
import { transitionStatus } from './order.service';

// ============================================================
// Cancellation Request Service
//
// Handles the post-pickup cancellation authorization flow:
// 1. Rider requests cancellation (creates CancellationRequest)
// 2. Client is notified via WebSocket + push
// 3. Client authorizes: "Cancel & Return" or "Cancel Complete"
// 4. If return: rider returns package → client confirms → cancel executes
// 5. If complete: cancel executes immediately
// 6. If denied: rider must continue the delivery
// 7. If no response in 30 min: escalate to admin
// ============================================================

const POST_PICKUP_STATUSES = ['PICKED_UP', 'IN_TRANSIT'] as const;
const TIMEOUT_MINUTES = 30;

/**
 * Rider requests cancellation authorization from the client.
 * Only allowed when order status is PICKED_UP or IN_TRANSIT.
 */
export async function createCancelRequest(
  orderId: string,
  riderUserId: string,
  reason: string,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      rider: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!order) throw ApiError.notFound('Order not found');

  // Verify rider is assigned
  const riderProfile = await prisma.riderProfile.findUnique({
    where: { userId: riderUserId },
  });
  if (!riderProfile || order.riderId !== riderProfile.id) {
    throw ApiError.forbidden('You are not assigned to this order');
  }

  // Must be post-pickup
  if (!POST_PICKUP_STATUSES.includes(order.status as typeof POST_PICKUP_STATUSES[number])) {
    throw ApiError.badRequest('Cancellation requests are only required after package pickup');
  }

  // Check for existing pending request
  const existing = await prisma.cancellationRequest.findUnique({
    where: { orderId },
  });
  if (existing) {
    if (existing.status === 'PENDING') {
      throw ApiError.badRequest('A cancellation request is already pending for this order');
    }
    // If previous request was denied, allow a new one
    if (existing.status !== 'DENIED') {
      throw ApiError.badRequest('A cancellation request already exists for this order');
    }
    // Delete the denied request so a new one can be created
    await prisma.cancellationRequest.delete({ where: { id: existing.id } });
  }

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + TIMEOUT_MINUTES);

  const riderName = order.rider
    ? `${order.rider.user.firstName ?? ''} ${order.rider.user.lastName ?? ''}`.trim()
    : 'Your rider';

  const request = await prisma.cancellationRequest.create({
    data: {
      riderId: riderProfile.id,
      orderId,
      clientId: order.clientId,
      reason,
      orderStatusAtRequest: order.status,
      expiresAt,
    },
  });

  // Real-time notification to client via WebSocket
  emitCancelRequest({
    orderId,
    requestId: request.id,
    riderName,
    reason,
    orderStatusAtRequest: order.status,
    expiresAt: expiresAt.toISOString(),
  });

  // Push notification to client
  try {
    await createOrderNotification(
      order.clientId,
      'Rider Requests Cancellation ⚠️',
      `${riderName} wants to cancel order ${order.orderNumber}. Reason: ${reason}. Please authorize or deny this request.`,
      orderId,
    );
  } catch { /* non-blocking */ }

  // Record in order status history
  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: order.status,
      actor: riderUserId,
      note: `Cancel request: ${reason} (awaiting client authorization)`,
    },
  });

  return request;
}

/**
 * Client authorizes (or denies) the cancellation request.
 * - 'return': Rider must return the package, then client confirms receipt
 * - 'complete': Cancel immediately (package already returned/handed over)
 * - 'deny': Rider must continue the delivery
 */
export async function authorizeCancelRequest(
  requestId: string,
  clientUserId: string,
  decision: 'return' | 'complete' | 'deny',
  note?: string,
) {
  const request = await prisma.cancellationRequest.findUnique({
    where: { id: requestId },
    include: {
      order: { select: { id: true, orderNumber: true, clientId: true, status: true } },
      rider: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!request) throw ApiError.notFound('Cancellation request not found');
  if (request.order.clientId !== clientUserId) {
    throw ApiError.forbidden('Only the order client can authorize this request');
  }
  if (request.status !== 'PENDING') {
    throw ApiError.badRequest(`Request already resolved: ${request.status}`);
  }

  let newStatus: CancelRequestStatus;
  let riderNotifTitle: string;
  let riderNotifBody: string;

  switch (decision) {
    case 'return':
      newStatus = 'AUTHORIZED_RETURN';
      riderNotifTitle = 'Cancellation Approved — Return Package 📦';
      riderNotifBody = `Client authorized cancellation for ${request.order.orderNumber}. Please return the package to the pickup location. The client will confirm receipt.`;
      break;
    case 'complete':
      newStatus = 'AUTHORIZED_COMPLETE';
      riderNotifTitle = 'Cancellation Approved ✅';
      riderNotifBody = `Client authorized cancellation for ${request.order.orderNumber}. The delivery has been cancelled.`;
      break;
    case 'deny':
      newStatus = 'DENIED';
      riderNotifTitle = 'Cancellation Denied ❌';
      riderNotifBody = `Client denied your cancellation request for ${request.order.orderNumber}. Please continue the delivery.${note ? ` Client note: ${note}` : ''}`;
      break;
  }

  const updated = await prisma.cancellationRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      clientResponseAt: new Date(),
      clientNote: note,
    },
  });

  // Real-time notification to rider via WebSocket
  emitCancelResponse({
    orderId: request.order.id,
    requestId: request.id,
    status: newStatus,
    clientNote: note,
  });

  // Push notification to rider
  try {
    await createOrderNotification(request.rider.userId, riderNotifTitle, riderNotifBody, request.order.id);
  } catch { /* non-blocking */ }

  // If authorized complete, execute the cancellation immediately
  if (decision === 'complete') {
    await executeCancellation(request.order.id, request.rider.id, request.rider.userId, request.order.orderNumber, request.orderStatusAtRequest, request.reason, request.order.clientId);
  }

  return updated;
}

/**
 * Client confirms the package has been returned.
 * This triggers the actual cancellation.
 */
export async function confirmReturn(
  requestId: string,
  clientUserId: string,
) {
  const request = await prisma.cancellationRequest.findUnique({
    where: { id: requestId },
    include: {
      order: { select: { id: true, orderNumber: true, clientId: true, status: true } },
      rider: { select: { id: true, userId: true } },
    },
  });
  if (!request) throw ApiError.notFound('Cancellation request not found');
  if (request.order.clientId !== clientUserId) {
    throw ApiError.forbidden('Only the order client can confirm package return');
  }
  if (request.status !== 'AUTHORIZED_RETURN') {
    throw ApiError.badRequest('Package return can only be confirmed for authorized-return requests');
  }

  const updated = await prisma.cancellationRequest.update({
    where: { id: requestId },
    data: {
      status: 'RETURN_CONFIRMED',
      returnConfirmedAt: new Date(),
    },
  });

  // Execute the actual cancellation now
  await executeCancellation(request.order.id, request.rider.id, request.rider.userId, request.order.orderNumber, request.orderStatusAtRequest, request.reason, request.order.clientId);

  // Notify rider that return was confirmed and order is cancelled
  try {
    await createOrderNotification(
      request.rider.userId,
      'Return Confirmed — Order Cancelled ✅',
      `Client confirmed package return for ${request.order.orderNumber}. The delivery has been cancelled.`,
      request.order.id,
    );
  } catch { /* non-blocking */ }

  return updated;
}

/**
 * Get the active cancellation request for an order.
 */
export async function getCancelRequest(orderId: string) {
  return prisma.cancellationRequest.findUnique({
    where: { orderId },
    include: {
      rider: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  });
}

/**
 * Handle expired cancellation requests (called by cron or on-demand).
 * Requests that pass 30-min timeout without client response are escalated to admin.
 */
export async function processExpiredRequests() {
  const expired = await prisma.cancellationRequest.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lte: new Date() },
    },
    include: {
      order: { select: { id: true, orderNumber: true, clientId: true } },
      rider: { select: { id: true, userId: true } },
    },
  });

  for (const request of expired) {
    try {
      await prisma.cancellationRequest.update({
        where: { id: request.id },
        data: { status: 'EXPIRED' },
      });

      // Notify admin
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
        take: 5,
      });
      for (const admin of admins) {
        try {
          await createOrderNotification(
            admin.id,
            'Expired Cancel Request — Action Needed 🚨',
            `Cancel request for ${request.order.orderNumber} expired without client response. Rider has the package. Please investigate.`,
            request.order.id,
          );
        } catch { /* non-blocking */ }
      }

      // Also notify both rider and client
      try {
        await createOrderNotification(
          request.rider.userId,
          'Cancel Request Escalated ⏰',
          `Your cancellation request for ${request.order.orderNumber} has been escalated to admin. Please wait for instructions.`,
          request.order.id,
        );
        await createOrderNotification(
          request.order.clientId,
          'Cancel Request Escalated ⏰',
          `The cancellation request for order ${request.order.orderNumber} has been escalated to our support team.`,
          request.order.id,
        );
      } catch { /* non-blocking */ }
    } catch (err) {
      logger.error(`Failed to process expired cancel request ${request.id}: ${err}`);
    }
  }

  return expired.length;
}

// ── Internal helper: execute the actual cancellation ────────

async function executeCancellation(
  orderId: string,
  riderId: string,
  riderUserId: string,
  orderNumber: string,
  orderStatusAtCancel: string,
  reason: string,
  clientId: string,
) {
  try {
    const cancelNote = `Rider cancel (authorized): ${reason}`;
    const updated = await transitionStatus(orderId, 'CANCELLED_BY_RIDER', riderUserId, cancelNote);

    // Emit status update via WebSocket
    emitOrderStatusUpdate({
      orderId,
      orderNumber,
      status: 'CANCELLED_BY_RIDER',
      previousStatus: orderStatusAtCancel,
      actor: riderUserId,
      note: cancelNote,
    });

    // Process cancellation consequences
    await processCancellationConsequences(
      riderId,
      riderUserId,
      orderId,
      orderNumber,
      orderStatusAtCancel as Parameters<typeof processCancellationConsequences>[4],
      reason,
      clientId,
    );

    return updated;
  } catch (err) {
    logger.error(`Failed to execute authorized cancellation for order ${orderId}: ${err}`);
    throw err;
  }
}
