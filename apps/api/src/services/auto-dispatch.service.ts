// ============================================================
// AutoDispatchService — Sophisticated rider-order matching
//
// Multi-factor scoring algorithm that finds the best available
// rider for each order. Uses tiered radius search, weighted
// scoring across 6 dimensions, and sequential targeted offers
// with 30-second acceptance windows.
//
// Flow:
//   1. Order created → autoDispatch(orderId) called
//   2. Find all ONLINE + ACTIVATED riders with GPS data
//   3. Score & rank by multi-factor algorithm
//   4. Emit targeted `job:offer` to top rider
//   5. If declined/timeout (30s) → try next rider
//   6. If all decline → order stays PENDING for manual pickup
// ============================================================

import { prisma } from '@riderguy/database';
import { haversineDistance } from '@riderguy/utils';
import { logger } from '../lib/logger';
import { assignRider } from './dispatch.service';
import { getIO, emitOrderStatusUpdate } from '../socket';
import { SmsService } from './sms.service';
import type { JobOffer } from '@riderguy/types';

// ── Configuration ──

const OFFER_TIMEOUT_MS = 30_000;           // 30 seconds per offer
const MAX_SEARCH_RADIUS_KM = 8;            // Maximum search radius (8 km — realistic dispatch range)
const MAX_DISPATCH_ATTEMPTS = 10;           // Max riders to try before giving up
const MIN_GPS_FRESHNESS_MS = 10 * 60_000;  // Skip riders with GPS older than 10 min

// ── Score Weights (must sum to 1.0) ──

const WEIGHTS = {
  proximity:   0.40,
  rating:      0.20,
  completion:  0.15,
  onTime:      0.10,
  experience:  0.10,
  freshness:   0.05,
} as const;

// ── In-memory dispatch state ──

interface DispatchState {
  orderId: string;
  rankedRiders: ScoredRider[];
  currentIndex: number;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  resolved: boolean;
}

interface ScoredRider {
  riderProfileId: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  distance: number;  // km to pickup
  score: number;     // 0-100
}

// Active dispatch sessions keyed by orderId
const activeDispatches = new Map<string, DispatchState>();

// ── Scoring Functions (exported for unit testing) ──

export function proximityScore(distanceKm: number): number {
  if (distanceKm <= 0.5) return 100;
  if (distanceKm <= 1)   return 95;
  if (distanceKm <= 2)   return 85;
  if (distanceKm <= 3)   return 75;
  if (distanceKm <= 5)   return 60;
  if (distanceKm <= 8)   return 30;
  return 0; // > 8 km — too far, excluded
}

export function ratingScore(avgRating: number | null): number {
  if (!avgRating || avgRating === 0) return 50; // New rider default
  return (avgRating / 5) * 100;
}

export function completionScore(rate: number | null): number {
  if (rate === null || rate === undefined) return 60; // New rider default
  return rate * 100;
}

export function onTimeScore(rate: number | null): number {
  if (rate === null || rate === undefined) return 60;
  return rate * 100;
}

export function experienceScore(totalDeliveries: number): number {
  if (totalDeliveries >= 500) return 100;
  if (totalDeliveries >= 200) return 85;
  if (totalDeliveries >= 100) return 70;
  if (totalDeliveries >= 50)  return 55;
  if (totalDeliveries >= 20)  return 40;
  if (totalDeliveries >= 5)   return 25;
  return 10; // Brand new rider
}

export function freshnessScore(lastUpdate: Date | null): number {
  if (!lastUpdate) return 10;
  const ageMs = Date.now() - lastUpdate.getTime();
  if (ageMs < 60_000)       return 100;  // <1 min
  if (ageMs < 5 * 60_000)   return 85;   // <5 min
  if (ageMs < 10 * 60_000)  return 60;   // <10 min
  if (ageMs < 15 * 60_000)  return 30;   // <15 min
  return 5;
}

export function computeOverallScore(
  distanceKm: number,
  avgRating: number | null,
  completionRate: number | null,
  onTimeRate: number | null,
  totalDeliveries: number,
  lastLocationUpdate: Date | null,
): number {
  const prox = proximityScore(distanceKm);
  const rate = ratingScore(avgRating);
  const comp = completionScore(completionRate);
  const onT  = onTimeScore(onTimeRate);
  const exp  = experienceScore(totalDeliveries);
  const fresh = freshnessScore(lastLocationUpdate);

  return Math.round(
    prox  * WEIGHTS.proximity +
    rate  * WEIGHTS.rating +
    comp  * WEIGHTS.completion +
    onT   * WEIGHTS.onTime +
    exp   * WEIGHTS.experience +
    fresh * WEIGHTS.freshness,
  );
}

// ── Core Auto-Dispatch ──

/**
 * Main entry point — find the best rider for an order and start
 * the sequential offer process.
 */
export async function autoDispatch(orderId: string): Promise<void> {
  // Prevent duplicate dispatches
  if (activeDispatches.has(orderId)) {
    logger.warn({ orderId }, '[AutoDispatch] Already dispatching for this order');
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      pickupAddress: true,
      dropoffAddress: true,
      pickupLatitude: true,
      pickupLongitude: true,
      dropoffLatitude: true,
      dropoffLongitude: true,
      distanceKm: true,
      estimatedDurationMinutes: true,
      totalPrice: true,
      serviceFee: true,
      riderEarnings: true,
      packageType: true,
      packageDescription: true,
      currency: true,
      isMultiStop: true,
      zoneId: true,
    },
  });

  if (!order) {
    logger.error({ orderId }, '[AutoDispatch] Order not found');
    return;
  }

  if (order.status !== 'PENDING' && order.status !== 'SEARCHING_RIDER') {
    logger.info({ orderId, status: order.status }, '[AutoDispatch] Order not in dispatchable status');
    return;
  }

  // Transition to SEARCHING_RIDER
  if (order.status === 'PENDING') {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SEARCHING_RIDER' },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: 'SEARCHING_RIDER',
        actor: 'system',
        note: 'Auto-dispatch started — searching for nearest rider',
      },
    });
  }

  // ── Find and score riders ──

  const riders = await prisma.riderProfile.findMany({
    where: {
      availability: 'ONLINE',
      // TODO: Re-enable after trial — temporarily bypassed for end-to-end testing
      // onboardingStatus: 'ACTIVATED',
      currentLatitude: { not: null },
      currentLongitude: { not: null },
    },
    select: {
      id: true,
      userId: true,
      user: { select: { firstName: true, lastName: true, phone: true } },
      currentLatitude: true,
      currentLongitude: true,
      lastLocationUpdate: true,
      averageRating: true,
      totalDeliveries: true,
      completionRate: true,
      onTimeRate: true,
      currentZoneId: true,
    },
    take: 100, // Reasonable upper bound
  });

  if (riders.length === 0) {
    logger.info({ orderId }, '[AutoDispatch] No online riders available');
    // Revert to PENDING — riders will see it in the job feed when they come online
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PENDING' },
    });
    // Notify the client that no riders are currently available
    try {
      const io = getIO();
      io.to(`order:${orderId}`).emit('order:no-riders', {
        orderId,
        reason: 'No riders are currently online in your area',
        timestamp: new Date().toISOString(),
      });
    } catch {}
    return;
  }

  logger.info(
    { orderId, riderCount: riders.length, riders: riders.map(r => ({ id: r.userId, lat: r.currentLatitude, lng: r.currentLongitude })) },
    '[AutoDispatch] Found online riders with GPS',
  );

  // Score each rider
  const scored: ScoredRider[] = [];

  for (const rider of riders) {
    const riderLat = rider.currentLatitude as number;
    const riderLng = rider.currentLongitude as number;

    // Skip riders with stale GPS
    if (rider.lastLocationUpdate) {
      const ageMs = Date.now() - rider.lastLocationUpdate.getTime();
      if (ageMs > MIN_GPS_FRESHNESS_MS) continue;
    }

    const distance = haversineDistance(
      riderLat,
      riderLng,
      order.pickupLatitude as number,
      order.pickupLongitude as number,
    );

    // Skip riders outside the max radius
    if (distance > MAX_SEARCH_RADIUS_KM) continue;

    // Zone preference: riders in the order's zone score slightly higher
    let zoneBonus = 0;
    if (order.zoneId && rider.currentZoneId === order.zoneId) {
      zoneBonus = 3; // Small bonus for same-zone riders
    }

    const score = computeOverallScore(
      distance,
      rider.averageRating ? Number(rider.averageRating) : null,
      rider.completionRate ? Number(rider.completionRate) : null,
      rider.onTimeRate ? Number(rider.onTimeRate) : null,
      rider.totalDeliveries,
      rider.lastLocationUpdate,
    ) + zoneBonus;

    scored.push({
      riderProfileId: rider.id,
      userId: rider.userId,
      firstName: rider.user.firstName,
      lastName: rider.user.lastName,
      phone: rider.user.phone,
      distance: Math.round(distance * 100) / 100,
      score: Math.min(score, 100),
    });
  }

  // Sort by score descending (best match first)
  scored.sort((a, b) => b.score - a.score);

  // Limit attempts
  const candidates = scored.slice(0, MAX_DISPATCH_ATTEMPTS);

  if (candidates.length === 0) {
    logger.info({ orderId }, '[AutoDispatch] No riders within search radius');
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PENDING' },
    });
    // Notify the client that no riders are nearby
    try {
      const io = getIO();
      io.to(`order:${orderId}`).emit('order:no-riders', {
        orderId,
        reason: 'No riders are available near your pickup location right now',
        timestamp: new Date().toISOString(),
      });
    } catch {}
    return;
  }

  logger.info(
    { orderId, candidateCount: candidates.length, topScore: candidates[0]?.score },
    '[AutoDispatch] Ranked riders — starting offers',
  );

  // Create dispatch state
  const state: DispatchState = {
    orderId,
    rankedRiders: candidates,
    currentIndex: 0,
    timeoutHandle: null,
    resolved: false,
  };
  activeDispatches.set(orderId, state);

  // Start offering to the first rider
  sendOfferToNextRider(state, order);
}

/**
 * Send a job offer to the next candidate rider.
 */
function sendOfferToNextRider(
  state: DispatchState,
  order: {
    id: string;
    orderNumber: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
    dropoffLatitude: number;
    dropoffLongitude: number;
    distanceKm: number;
    estimatedDurationMinutes: number;
    totalPrice: number | { toNumber(): number };
    serviceFee: number | { toNumber(): number };
    riderEarnings: number | { toNumber(): number } | null;
    packageType: string;
    packageDescription: string | null;
    currency: string;
    isMultiStop?: boolean;
  },
): void {
  if (state.resolved) return;

  const rider = state.rankedRiders[state.currentIndex];
  if (!rider) {
    // No more riders to try
    logger.info({ orderId: state.orderId }, '[AutoDispatch] All candidates exhausted — order stays PENDING');
    state.resolved = true;
    activeDispatches.delete(state.orderId);
    // Revert order to PENDING for manual pickup from the job feed
    prisma.order
      .update({ where: { id: state.orderId }, data: { status: 'PENDING' } })
      .catch(() => {});
    // Notify the client that all nearby riders were tried
    try {
      const io = getIO();
      io.to(`order:${state.orderId}`).emit('order:no-riders', {
        orderId: state.orderId,
        reason: 'All nearby riders are currently busy. Your order is still in the queue.',
        timestamp: new Date().toISOString(),
      });
    } catch {}
    return;
  }

  const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_MS).toISOString();
  const totalPriceNum = typeof order.totalPrice === 'number' ? order.totalPrice : Number(order.totalPrice);
  const serviceFeeNum = typeof order.serviceFee === 'number' ? order.serviceFee : Number(order.serviceFee);
  const riderEarningsNum = order.riderEarnings != null ? (typeof order.riderEarnings === 'number' ? order.riderEarnings : Number(order.riderEarnings)) : null;
  const earnings = riderEarningsNum ?? (totalPriceNum - serviceFeeNum);

  const offerPayload: JobOffer = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    pickupLat: order.pickupLatitude,
    pickupLng: order.pickupLongitude,
    dropoffLat: order.dropoffLatitude,
    dropoffLng: order.dropoffLongitude,
    distanceKm: order.distanceKm,
    estimatedDurationMinutes: order.estimatedDurationMinutes,
    totalPrice: totalPriceNum,
    serviceFee: serviceFeeNum,
    riderEarnings: earnings,
    packageType: order.packageType,
    packageDescription: order.packageDescription ?? undefined,
    currency: order.currency,
    distanceToPickup: rider.distance,
    expiresAt,
    isMultiStop: order.isMultiStop ?? false,
  };

  logger.info(
    {
      orderId: state.orderId,
      riderId: rider.userId,
      riderName: `${rider.firstName} ${rider.lastName}`,
      score: rider.score,
      distance: rider.distance,
      attempt: state.currentIndex + 1,
    },
    '[AutoDispatch] Sending offer to rider',
  );

  // Emit targeted offer to this specific rider
  try {
    const io = getIO();
    const room = `user:${rider.userId}`;
    const socketsInRoom = io.sockets.adapter.rooms.get(room);
    logger.info(
      {
        orderId: state.orderId,
        room,
        socketsInRoom: socketsInRoom ? [...socketsInRoom] : [],
        socketCount: socketsInRoom?.size ?? 0,
      },
      '[AutoDispatch] Emitting job:offer to room',
    );
    io.to(room).emit('job:offer', offerPayload);
  } catch (err) {
    logger.error({ err, orderId: state.orderId }, '[AutoDispatch] Failed to emit job:offer');
  }

  // Send SMS notification as a backup
  SmsService.sendNewJobAvailable(rider.phone, order.pickupAddress).catch(() => {});

  // Set timeout — if rider doesn't respond in 30s, try next
  state.timeoutHandle = setTimeout(() => {
    if (state.resolved) return;

    logger.info(
      { orderId: state.orderId, riderId: rider.userId, attempt: state.currentIndex + 1 },
      '[AutoDispatch] Offer timed out — trying next rider',
    );

    // Notify this rider that the offer expired
    try {
      const io = getIO();
      io.to(`user:${rider.userId}`).emit('job:offer:expired', { orderId: state.orderId });
    } catch {}

    // Move to next rider
    state.currentIndex++;
    sendOfferToNextRider(state, order);
  }, OFFER_TIMEOUT_MS);
}

/**
 * Called when a rider responds to a job offer.
 */
export async function handleOfferResponse(
  orderId: string,
  userId: string,
  response: 'accept' | 'decline',
): Promise<{ success: boolean; error?: string }> {
  const state = activeDispatches.get(orderId);

  if (!state || state.resolved) {
    return { success: false, error: 'No active offer for this order' };
  }

  const currentRider = state.rankedRiders[state.currentIndex];

  if (!currentRider || currentRider.userId !== userId) {
    return { success: false, error: 'This offer is not for you' };
  }

  // Clear the timeout
  if (state.timeoutHandle) {
    clearTimeout(state.timeoutHandle);
    state.timeoutHandle = null;
  }

  if (response === 'accept') {
    state.resolved = true;
    activeDispatches.delete(orderId);

    try {
      await assignRider(orderId, currentRider.riderProfileId, userId);

      logger.info(
        {
          orderId,
          riderId: userId,
          riderName: `${currentRider.firstName} ${currentRider.lastName}`,
          score: currentRider.score,
          distance: currentRider.distance,
        },
        '[AutoDispatch] Rider accepted — assigned successfully',
      );

      // Notify other riders that this job is taken
      try {
        const io = getIO();
        io.emit('job:offer:taken', { orderId });
      } catch {}

      return { success: true };
    } catch (err: any) {
      logger.error({ err, orderId, userId }, '[AutoDispatch] Assignment failed after acceptance');
      // Try next rider since assignment failed
      state.resolved = false;
      activeDispatches.set(orderId, state);
      state.currentIndex++;

      // Re-fetch order for next attempt
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, orderNumber: true, pickupAddress: true, dropoffAddress: true,
          pickupLatitude: true, pickupLongitude: true, dropoffLatitude: true, dropoffLongitude: true,
          distanceKm: true, estimatedDurationMinutes: true, totalPrice: true,
          serviceFee: true, riderEarnings: true, packageType: true,
          packageDescription: true, currency: true, isMultiStop: true,
        },
      });

      if (order) {
        sendOfferToNextRider(state, order);
      }

      return { success: false, error: 'Assignment failed — trying another rider' };
    }
  }

  // Decline — try next rider
  logger.info(
    { orderId, riderId: userId, attempt: state.currentIndex + 1 },
    '[AutoDispatch] Rider declined — trying next',
  );
  state.currentIndex++;

  // Re-fetch order data for next attempt
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderNumber: true, pickupAddress: true, dropoffAddress: true,
      pickupLatitude: true, pickupLongitude: true, dropoffLatitude: true, dropoffLongitude: true,
      distanceKm: true, estimatedDurationMinutes: true, totalPrice: true,
      serviceFee: true, riderEarnings: true, packageType: true,
      packageDescription: true, currency: true, isMultiStop: true,
    },
  });

  if (order) {
    sendOfferToNextRider(state, order);
  }

  return { success: true };
}

/**
 * Cancel an active dispatch (e.g., order was cancelled).
 */
export function cancelDispatch(orderId: string): void {
  const state = activeDispatches.get(orderId);
  if (!state) return;

  if (state.timeoutHandle) {
    clearTimeout(state.timeoutHandle);
  }
  state.resolved = true;
  activeDispatches.delete(orderId);

  logger.info({ orderId }, '[AutoDispatch] Dispatch cancelled');
}

/**
 * Check if an order has an active dispatch in progress.
 */
export function isDispatching(orderId: string): boolean {
  const state = activeDispatches.get(orderId);
  return !!state && !state.resolved;
}

/**
 * Get any pending offer currently targeting a specific rider (by userId).
 * Used to re-emit offers when a rider reconnects after being backgrounded.
 * Returns the orderId + time remaining if found, null otherwise.
 */
export function getPendingOfferForRider(userId: string): { orderId: string; remainingMs: number } | null {
  for (const [orderId, state] of activeDispatches) {
    if (state.resolved) continue;
    const rider = state.rankedRiders[state.currentIndex];
    if (rider && rider.userId === userId) {
      return { orderId, remainingMs: OFFER_TIMEOUT_MS }; // approximate
    }
  }
  return null;
}
