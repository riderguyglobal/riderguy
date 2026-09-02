import { beforeEach, describe, expect, it, vi } from 'vitest';

const { orderFindMany, orderCount } = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderCount: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    order: { findMany: orderFindMany, count: orderCount },
  },
}));
vi.mock('./notification.service', () => ({ createOrderNotification: vi.fn() }));
vi.mock('../socket', () => ({ emitOrderStatusUpdate: vi.fn() }));
vi.mock('../lib/postgres-advisory-lock', () => ({ acquireTransactionAdvisoryLock: vi.fn() }));

// Use a non-aliased relative path: vitest.config maps the exact
// `./dispatch.service` specifier to the lightweight auto-dispatch mock.
import { getDispatchQueue } from '../services/dispatch.service';

describe('getDispatchQueue status filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderFindMany.mockResolvedValue([]);
    orderCount.mockResolvedValue(0);
  });

  it('converts the admin multi-status filter into a Prisma in-clause', async () => {
    await getDispatchQueue({ status: 'PENDING,SEARCHING_RIDER', page: 1, limit: 20 });

    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['PENDING', 'SEARCHING_RIDER'] } },
    }));
    expect(orderCount).toHaveBeenCalledWith({
      where: { status: { in: ['PENDING', 'SEARCHING_RIDER'] } },
    });
  });

  it('keeps a single valid status as a scalar filter', async () => {
    await getDispatchQueue({ status: 'DELIVERED' });
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'DELIVERED' },
    }));
  });

  it('rejects unknown statuses before querying Prisma', async () => {
    await expect(getDispatchQueue({ status: 'PENDING,NOT_A_STATUS' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ORDER_STATUS_FILTER' });
    expect(orderFindMany).not.toHaveBeenCalled();
    expect(orderCount).not.toHaveBeenCalled();
  });
});
