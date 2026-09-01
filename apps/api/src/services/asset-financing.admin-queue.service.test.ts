import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    assetFinancingInterest: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

import { AssetFinancingService } from './asset-financing.service';

describe('AssetFinancingService.listForAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([{ id: 'interest-1', updatedAt: new Date() }]);
    mocks.count.mockResolvedValue(41);
  });

  it('returns a stable, bounded page with Rider processing identity', async () => {
    const result = await AssetFinancingService.listForAdmin({
      status: 'UNDER_REVIEW',
      assetType: 'ELECTRIC_VEHICLE',
      search: '  ama  ',
      page: 2,
      limit: 20,
    });

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20,
      take: 20,
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      where: expect.objectContaining({
        status: 'UNDER_REVIEW',
        assetType: 'ELECTRIC_VEHICLE',
        OR: expect.arrayContaining([
          { contactEmail: { contains: 'ama', mode: 'insensitive' } },
          { rider: { user: { phone: { contains: 'ama' } } } },
        ]),
      }),
      select: expect.objectContaining({
        updatedAt: true,
        reviewNotes: true,
        rider: expect.objectContaining({ select: expect.objectContaining({ user: expect.any(Object) }) }),
        reviewedBy: expect.any(Object),
      }),
    }));
    expect(mocks.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'UNDER_REVIEW', assetType: 'ELECTRIC_VEHICLE' }),
    });
    expect(result).toEqual({
      items: [{ id: 'interest-1', updatedAt: expect.any(Date) }],
      pagination: { page: 2, limit: 20, total: 41, totalPages: 3 },
    });
  });

  it('does not add a search clause when no search filter is supplied', async () => {
    await AssetFinancingService.listForAdmin({ page: 1, limit: 20 });

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(mocks.count).toHaveBeenCalledWith({ where: {} });
  });
});
