import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  historyCreate: vi.fn(),
  orderUpdate: vi.fn(),
  riderFindUnique: vi.fn(),
  riderUpdate: vi.fn(),
  riderUpdateMany: vi.fn(),
  autoDispatch: vi.fn(),
  notification: vi.fn(),
  emitStatus: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    order: { findMany: mocks.orderFindMany, update: mocks.orderUpdate },
    orderStatusHistory: { create: mocks.historyCreate },
    riderProfile: {
      findUnique: mocks.riderFindUnique,
      update: mocks.riderUpdate,
      updateMany: mocks.riderUpdateMany,
    },
  },
}));
vi.mock('./auto-dispatch.service', () => ({ autoDispatch: mocks.autoDispatch }));
vi.mock('./order.service', () => ({ transitionStatus: vi.fn() }));
vi.mock('./cancellation.service', () => ({ processCancellationConsequences: vi.fn() }));
vi.mock('./notification.service', () => ({ createOrderNotification: mocks.notification }));
vi.mock('../socket', () => ({ emitOrderStatusUpdate: mocks.emitStatus }));
vi.mock('../lib/logger', () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}));

import { handleRiderSuspended } from './order-reassign.service';

const activeOrder = {
  id: 'order-1',
  orderNumber: 'RG-001',
  status: 'ASSIGNED',
  clientId: 'client-1',
};

describe('restricted Rider active-order recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderFindMany.mockResolvedValue([activeOrder]);
    mocks.historyCreate.mockResolvedValue({ id: 'history-1' });
    mocks.orderUpdate.mockResolvedValue({ id: activeOrder.id });
    mocks.riderFindUnique.mockResolvedValueOnce({ userId: 'rider-user-1' }).mockResolvedValueOnce({
      availability: 'ON_DELIVERY',
      suspendedUntil: null,
      user: { status: 'DEACTIVATED' },
    });
    mocks.riderUpdate.mockResolvedValue({ id: 'rider-1' });
    mocks.riderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.autoDispatch.mockResolvedValue(undefined);
    mocks.notification.mockResolvedValue(undefined);
  });

  it('recovers a deactivated Rider order and never returns the Rider to ONLINE', async () => {
    await expect(handleRiderSuspended('rider-1', 'DEACTIVATED')).resolves.toBe(1);

    expect(mocks.riderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'rider-1', availability: { not: 'OFFLINE' } },
      data: { availability: 'OFFLINE', isConnected: false, socketId: null },
    });
    expect(mocks.orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: activeOrder.id },
        data: expect.objectContaining({ status: 'PENDING', riderId: null }),
      }),
    );
    expect(mocks.riderUpdate).toHaveBeenCalledWith({
      where: { id: 'rider-1' },
      data: { availability: 'OFFLINE' },
    });
    expect(mocks.autoDispatch).toHaveBeenCalledWith(activeOrder.id);
  });

  it('raises an observable operational failure instead of reporting recovery success', async () => {
    mocks.historyCreate.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(handleRiderSuspended('rider-1', 'BANNED')).rejects.toMatchObject({
      statusCode: 503,
      code: 'RIDER_ORDER_RECOVERY_INCOMPLETE',
      details: {
        riderId: 'rider-1',
        restriction: 'BANNED',
        failedOrderIds: ['order-1'],
        handledOrders: 0,
      },
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', restriction: 'BANNED' }),
      expect.stringContaining('restricted Rider'),
    );
  });
});
