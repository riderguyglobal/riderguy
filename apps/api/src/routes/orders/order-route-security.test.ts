import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@riderguy/types';

const mocks = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn() },
  tx: {
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    orderStop: {
      findFirst: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
  acquireLock: vi.fn(),
  assertDeliveryPaymentReady: vi.fn(),
  deleteStorageObject: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({ prisma: mocks.prisma }));
vi.mock('../../lib/postgres-advisory-lock', () => ({
  acquireTransactionAdvisoryLock: mocks.acquireLock,
}));
vi.mock('../../services/order.service', () => ({
  assertDeliveryPaymentReady: mocks.assertDeliveryPaymentReady,
}));
vi.mock('../../services/storage.service', () => ({
  StorageService: { delete: mocks.deleteStorageObject },
}));
vi.mock('../../lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

import {
  completeRiderOrderStop,
  persistRiderOrderProof,
  sanitizeOrderPayloadForRequester,
} from './order-route-security';

const currentOrder = {
  id: 'order-1',
  riderId: 'rider-profile-1',
  status: 'AT_DROPOFF',
  paymentMethod: 'CASH',
  actualPaymentMethod: 'CASH',
  paymentStatus: 'PENDING',
  riderPaymentConfirmed: true,
  deliveryPinCode: '123456',
  proofOfDeliveryUrl: null,
};

function photoProof(overrides: Record<string, unknown> = {}) {
  return persistRiderOrderProof({
    orderId: 'order-1',
    riderProfileId: 'rider-profile-1',
    expectedStatus: 'AT_DROPOFF',
    expectedProofUrl: null,
    proofType: 'PHOTO',
    proofUrl: '/uploads/proofs/rider-user-1/proof.jpg',
    uploadedStorageKey: 'proofs/rider-user-1/proof.jpg',
    ...overrides,
  });
}

describe('Rider order response security', () => {
  it('recursively removes deliveryPinCode from Rider payloads without mutating source data', () => {
    const payload = {
      id: 'order-1',
      deliveryPinCode: '123456',
      proofOfDeliveryUrl: 'pin:123456',
      nested: {
        deliveryPinCode: '654321',
        pinCode: '222222',
        proofUrl: 'pin:222222',
        safe: true,
      },
      orders: [{ id: 'order-2', deliveryPinCode: '111111' }],
    };

    const result = sanitizeOrderPayloadForRequester(payload, [UserRole.RIDER]);

    expect(result).toEqual({
      id: 'order-1',
      proofOfDeliveryUrl: 'pin:verified',
      nested: { proofUrl: 'pin:verified', safe: true },
      orders: [{ id: 'order-2' }],
    });
    expect(payload.deliveryPinCode).toBe('123456');
  });

  it('preserves the PIN for administrators and an explicitly authorized client owner', () => {
    const payload = { id: 'order-1', deliveryPinCode: '123456' };

    expect(sanitizeOrderPayloadForRequester(payload, [UserRole.RIDER, UserRole.ADMIN])).toBe(
      payload,
    );
    expect(
      sanitizeOrderPayloadForRequester(payload, [UserRole.RIDER, UserRole.CLIENT], {
        clientOwnsOrder: true,
      }),
    ).toBe(payload);
  });

  it('does not let a CLIENT role on a Rider action reveal the PIN without ownership context', () => {
    const result = sanitizeOrderPayloadForRequester({ id: 'order-1', deliveryPinCode: '123456' }, [
      UserRole.RIDER,
      UserRole.CLIENT,
    ]);

    expect(result).toEqual({ id: 'order-1' });
  });
});

describe('Rider proof persistence security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.order.findUnique.mockResolvedValue({ ...currentOrder });
    mocks.tx.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.acquireLock.mockResolvedValue(undefined);
    mocks.deleteStorageObject.mockResolvedValue(undefined);
  });

  it('re-authorizes and compare-and-sets the proof on assignment, status, and prior proof', async () => {
    await photoProof();

    expect(mocks.assertDeliveryPaymentReady).toHaveBeenCalledWith(currentOrder);
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        riderId: 'rider-profile-1',
        status: 'AT_DROPOFF',
        proofOfDeliveryUrl: null,
      },
      data: {
        proofOfDeliveryUrl: '/uploads/proofs/rider-user-1/proof.jpg',
        proofOfDeliveryType: 'PHOTO',
      },
    });
    expect(mocks.deleteStorageObject).not.toHaveBeenCalled();
  });

  it('deletes a newly uploaded object if assignment changed before persistence', async () => {
    mocks.tx.order.findUnique.mockResolvedValue({ ...currentOrder, riderId: 'another-rider' });

    await expect(photoProof()).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith('proofs/rider-user-1/proof.jpg');
  });

  it('deletes a newly uploaded object if status changed before persistence', async () => {
    mocks.tx.order.findUnique.mockResolvedValue({ ...currentOrder, status: 'DELIVERED' });

    await expect(photoProof()).rejects.toMatchObject({ code: 'PROOF_STATUS_CHANGED' });
    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith('proofs/rider-user-1/proof.jpg');
  });

  it('deletes a newly uploaded object if the final compare-and-set loses a race', async () => {
    mocks.tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(photoProof()).rejects.toMatchObject({ code: 'PROOF_WRITE_RACE' });
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith('proofs/rider-user-1/proof.jpg');
  });

  it('stores a non-secret marker for a PIN proof and rechecks the PIN in the transaction', async () => {
    await persistRiderOrderProof({
      orderId: 'order-1',
      riderProfileId: 'rider-profile-1',
      expectedStatus: 'AT_DROPOFF',
      expectedProofUrl: null,
      proofType: 'PIN_CODE',
      proofUrl: 'pin:123456',
      submittedPin: '123456',
    });

    const update = mocks.tx.order.updateMany.mock.calls[0]?.[0];
    expect(update.data.proofOfDeliveryUrl).toBe('pin:verified');
    expect(JSON.stringify(update.data)).not.toContain('123456');
  });

  it('deletes a newly uploaded object when the database transaction fails', async () => {
    mocks.prisma.$transaction.mockRejectedValue(new Error('database unavailable'));

    await expect(photoProof()).rejects.toThrow('database unavailable');
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith('proofs/rider-user-1/proof.jpg');
  });

  it('rejects a stale PIN during final authorization without writing proof', async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      ...currentOrder,
      deliveryPinCode: '654321',
    });

    await expect(
      persistRiderOrderProof({
        orderId: 'order-1',
        riderProfileId: 'rider-profile-1',
        expectedStatus: 'AT_DROPOFF',
        expectedProofUrl: null,
        proofType: 'PIN_CODE',
        proofUrl: 'pin:verified',
        submittedPin: '123456',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PIN' });
    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
  });
});

describe('Rider multi-stop proof persistence security', () => {
  const currentStop = {
    id: 'stop-2',
    orderId: 'order-1',
    type: 'DROPOFF',
    sequence: 2,
    status: 'PENDING',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      riderId: 'rider-profile-1',
      status: 'IN_TRANSIT',
      isMultiStop: true,
      deliveryPinCode: '123456',
    });
    mocks.tx.orderStop.findFirst.mockResolvedValue({ ...currentStop });
    mocks.tx.orderStop.count.mockResolvedValue(0);
    mocks.tx.orderStop.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.orderStop.findUniqueOrThrow.mockResolvedValue({
      ...currentStop,
      status: 'COMPLETED',
      proofType: 'PIN_CODE',
      proofUrl: 'pin:verified',
      pinCode: 'verified',
    });
    mocks.acquireLock.mockResolvedValue(undefined);
    mocks.deleteStorageObject.mockResolvedValue(undefined);
  });

  it('rechecks Rider, Order, sequence, and PIN while persisting only non-secret markers', async () => {
    const result = await completeRiderOrderStop({
      orderId: 'order-1',
      stopId: 'stop-2',
      riderProfileId: 'rider-profile-1',
      expectedOrderStatus: 'IN_TRANSIT',
      expectedStopStatus: 'PENDING',
      expectedSequence: 2,
      proofType: 'PIN_CODE',
      proofUrl: 'pin:123456',
      submittedPin: '123456',
    });

    expect(mocks.acquireLock).toHaveBeenCalledWith(mocks.tx, 'order-status-transition', 'order-1');
    expect(mocks.acquireLock).toHaveBeenCalledWith(
      mocks.tx,
      'rider-vehicle-state',
      'rider-profile-1',
    );
    expect(mocks.tx.orderStop.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'stop-2',
          orderId: 'order-1',
          status: 'PENDING',
          sequence: 2,
        },
        data: expect.objectContaining({
          status: 'COMPLETED',
          proofType: 'PIN_CODE',
          proofUrl: 'pin:verified',
          pinCode: 'verified',
        }),
      }),
    );
    expect(JSON.stringify(mocks.tx.orderStop.updateMany.mock.calls[0]?.[0].data)).not.toContain(
      '123456',
    );
    expect(result.pinCode).toBe('verified');
  });

  it('deletes a stop-proof upload when final Rider authorization fails', async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      riderId: 'another-rider',
      status: 'IN_TRANSIT',
      isMultiStop: true,
      deliveryPinCode: '123456',
    });

    await expect(
      completeRiderOrderStop({
        orderId: 'order-1',
        stopId: 'stop-2',
        riderProfileId: 'rider-profile-1',
        expectedOrderStatus: 'IN_TRANSIT',
        expectedStopStatus: 'PENDING',
        expectedSequence: 2,
        proofType: 'PHOTO',
        proofUrl: '/uploads/proofs/rider-user-1/stop.jpg',
        uploadedStorageKey: 'proofs/rider-user-1/stop.jpg',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.tx.orderStop.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith('proofs/rider-user-1/stop.jpg');
  });

  it('deletes a stop-proof upload when its compare-and-set loses a race', async () => {
    mocks.tx.orderStop.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      completeRiderOrderStop({
        orderId: 'order-1',
        stopId: 'stop-2',
        riderProfileId: 'rider-profile-1',
        expectedOrderStatus: 'IN_TRANSIT',
        expectedStopStatus: 'PENDING',
        expectedSequence: 2,
        proofType: 'PHOTO',
        proofUrl: '/uploads/proofs/rider-user-1/stop.jpg',
        uploadedStorageKey: 'proofs/rider-user-1/stop.jpg',
      }),
    ).rejects.toMatchObject({ code: 'STOP_WRITE_RACE' });
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith('proofs/rider-user-1/stop.jpg');
  });
});
