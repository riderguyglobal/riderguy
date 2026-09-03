import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import type { OrderStatus, StopStatus } from '@prisma/client';
import { ApiError } from '../../lib/api-error';
import { logger } from '../../lib/logger';
import { acquireTransactionAdvisoryLock } from '../../lib/postgres-advisory-lock';
import * as OrderService from '../../services/order.service';
import { StorageService } from '../../services/storage.service';

const ORDER_PIN_PRIVILEGED_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.DISPATCHER,
]);

function omitDeliveryPin(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitDeliveryPin);
  if (!value || typeof value !== 'object') return value;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'deliveryPinCode' && key !== 'pinCode')
      .map(([key, nestedValue]) => {
        if (
          (key === 'proofOfDeliveryUrl' || key === 'proofUrl') &&
          typeof nestedValue === 'string' &&
          /^pin:\d{6}$/.test(nestedValue)
        ) {
          return [key, 'pin:verified'];
        }
        return [key, omitDeliveryPin(nestedValue)];
      }),
  );
}

/**
 * Delivery PINs are client secrets. Rider-only API flows must never echo them,
 * even when a returned order is nested inside another response object.
 * Administrators/dispatchers retain access; client ownership is established by
 * the calling route rather than inferred from a user's potentially multi-role account.
 */
export function sanitizeOrderPayloadForRequester<T>(
  value: T,
  roles: readonly string[],
  options: { clientOwnsOrder?: boolean } = {},
): T {
  const isRider = roles.includes(UserRole.RIDER);
  const hasOperationalAccess = roles.some((role) => ORDER_PIN_PRIVILEGED_ROLES.has(role));

  if (!isRider || hasOperationalAccess || options.clientOwnsOrder === true) return value;
  return omitDeliveryPin(value) as T;
}

type PersistRiderOrderProofInput = {
  orderId: string;
  riderProfileId: string;
  expectedStatus: OrderStatus;
  expectedProofUrl: string | null;
  proofType: 'PHOTO' | 'PIN_CODE';
  proofUrl: string;
  submittedPin?: string;
  uploadedStorageKey?: string;
};

/**
 * Re-authorize and persist a Rider's proof after any external object upload.
 * The uploaded object is compensating-deleted when the protected DB write does
 * not commit, preventing both assignment races and abandoned private objects.
 */
export async function persistRiderOrderProof(input: PersistRiderOrderProofInput): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await acquireTransactionAdvisoryLock(tx, 'order-status-transition', input.orderId);
      const current = await tx.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          riderId: true,
          status: true,
          paymentMethod: true,
          actualPaymentMethod: true,
          paymentStatus: true,
          riderPaymentConfirmed: true,
          deliveryPinCode: true,
          proofOfDeliveryUrl: true,
        },
      });

      if (!current) throw ApiError.notFound('Order not found');
      if (current.riderId !== input.riderProfileId) {
        throw ApiError.forbidden('You are no longer assigned to this order');
      }
      if (current.status !== input.expectedStatus || current.status !== 'AT_DROPOFF') {
        throw ApiError.conflict(
          'Order status changed before proof could be saved, please retry',
          'PROOF_STATUS_CHANGED',
        );
      }
      if (current.proofOfDeliveryUrl !== input.expectedProofUrl) {
        throw ApiError.conflict(
          'Delivery proof changed concurrently, please refresh before replacing it',
          'PROOF_CHANGED',
        );
      }

      OrderService.assertDeliveryPaymentReady(current);

      if (
        input.proofType === 'PIN_CODE' &&
        (!input.submittedPin || current.deliveryPinCode !== input.submittedPin)
      ) {
        throw ApiError.badRequest('Incorrect delivery PIN', 'INVALID_PIN');
      }

      const result = await tx.order.updateMany({
        where: {
          id: input.orderId,
          riderId: input.riderProfileId,
          status: input.expectedStatus,
          proofOfDeliveryUrl: input.expectedProofUrl,
        },
        data: {
          proofOfDeliveryUrl: input.proofType === 'PIN_CODE' ? 'pin:verified' : input.proofUrl,
          proofOfDeliveryType: input.proofType,
        },
      });

      if (result.count !== 1) {
        throw ApiError.conflict(
          'Order assignment, status, or proof changed concurrently, please retry',
          'PROOF_WRITE_RACE',
        );
      }
    });
  } catch (error) {
    if (input.uploadedStorageKey) {
      await StorageService.delete(input.uploadedStorageKey).catch((cleanupError) => {
        logger.error(
          { cleanupError, orderId: input.orderId, storageKey: input.uploadedStorageKey },
          'Failed to remove uncommitted proof upload',
        );
      });
    }
    throw error;
  }
}

type CompleteRiderOrderStopInput = {
  orderId: string;
  stopId: string;
  riderProfileId: string;
  expectedOrderStatus: OrderStatus;
  expectedStopStatus: StopStatus;
  expectedSequence: number;
  proofType?: 'PHOTO' | 'PIN_CODE';
  proofUrl?: string;
  submittedPin?: string;
  uploadedStorageKey?: string;
};

const ACTIVE_STOP_COMPLETION_STATUSES = new Set<OrderStatus>([
  'PICKUP_EN_ROUTE',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DROPOFF',
]);

/** Apply multi-stop proof/completion only while Rider, Order and Stop still match. */
export async function completeRiderOrderStop(input: CompleteRiderOrderStopInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      await acquireTransactionAdvisoryLock(tx, 'order-status-transition', input.orderId);
      await acquireTransactionAdvisoryLock(tx, 'rider-vehicle-state', input.riderProfileId);
      const currentOrder = await tx.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          riderId: true,
          status: true,
          isMultiStop: true,
          deliveryPinCode: true,
        },
      });
      if (!currentOrder) throw ApiError.notFound('Order not found');
      if (currentOrder.riderId !== input.riderProfileId) {
        throw ApiError.forbidden('You are no longer assigned to this order');
      }
      if (
        currentOrder.status !== input.expectedOrderStatus ||
        !ACTIVE_STOP_COMPLETION_STATUSES.has(currentOrder.status)
      ) {
        throw ApiError.conflict(
          'Order status changed before the stop could be completed, please retry',
          'STOP_ORDER_STATUS_CHANGED',
        );
      }
      if (!currentOrder.isMultiStop) {
        throw ApiError.badRequest('This order is not a multi-stop delivery');
      }

      const currentStop = await tx.orderStop.findFirst({
        where: { id: input.stopId, orderId: input.orderId },
      });
      if (!currentStop) throw ApiError.notFound('Stop not found');
      if (
        currentStop.status !== input.expectedStopStatus ||
        currentStop.sequence !== input.expectedSequence
      ) {
        throw ApiError.conflict(
          'Stop changed concurrently, please refresh and retry',
          'STOP_CHANGED',
        );
      }
      if (['COMPLETED', 'SKIPPED', 'FAILED'].includes(currentStop.status)) {
        throw ApiError.badRequest(`This stop has already been ${currentStop.status.toLowerCase()}`);
      }
      if (
        currentStop.type === 'DROPOFF' &&
        !['PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(currentOrder.status)
      ) {
        throw ApiError.badRequest('Package must be picked up before completing dropoff stops');
      }

      if (currentStop.sequence > 1) {
        const incompleteEarlierStops = await tx.orderStop.count({
          where: {
            orderId: input.orderId,
            sequence: { lt: currentStop.sequence },
            status: { notIn: ['COMPLETED', 'SKIPPED'] },
          },
        });
        if (incompleteEarlierStops > 0) {
          throw ApiError.badRequest(
            `Complete all earlier stops before stop #${currentStop.sequence}. ${incompleteEarlierStops} prior stop(s) still pending.`,
          );
        }
      }

      if (
        input.proofType === 'PIN_CODE' &&
        (!input.submittedPin || currentOrder.deliveryPinCode !== input.submittedPin)
      ) {
        throw ApiError.badRequest('Incorrect delivery PIN', 'INVALID_PIN');
      }

      const result = await tx.orderStop.updateMany({
        where: {
          id: input.stopId,
          orderId: input.orderId,
          status: input.expectedStopStatus,
          sequence: input.expectedSequence,
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          ...(input.proofType ? { proofType: input.proofType } : {}),
          ...(input.proofType === 'PIN_CODE'
            ? { proofUrl: 'pin:verified', pinCode: 'verified' }
            : input.proofUrl
              ? { proofUrl: input.proofUrl }
              : {}),
        },
      });
      if (result.count !== 1) {
        throw ApiError.conflict(
          'Stop changed concurrently, please refresh and retry',
          'STOP_WRITE_RACE',
        );
      }

      return tx.orderStop.findUniqueOrThrow({ where: { id: input.stopId } });
    });
  } catch (error) {
    if (input.uploadedStorageKey) {
      await StorageService.delete(input.uploadedStorageKey).catch((cleanupError) => {
        logger.error(
          { cleanupError, orderId: input.orderId, storageKey: input.uploadedStorageKey },
          'Failed to remove uncommitted stop-proof upload',
        );
      });
    }
    throw error;
  }
}
