import { describe, expect, it } from 'vitest';
import { listAssetFinancingInterestsQuerySchema } from '@riderguy/validators';

describe('asset-financing admin queue query validation', () => {
  it('coerces bounded pagination and accepts supported filters', () => {
    expect(listAssetFinancingInterestsQuerySchema.parse({
      status: 'SUBMITTED',
      assetType: 'MOTORBIKE',
      search: '  Ama Mensah  ',
      page: '2',
      limit: '50',
    })).toEqual({
      status: 'SUBMITTED',
      assetType: 'MOTORBIKE',
      search: 'Ama Mensah',
      page: 2,
      limit: 50,
    });
  });

  it('applies safe defaults and rejects unbounded or unknown input', () => {
    expect(listAssetFinancingInterestsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(listAssetFinancingInterestsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(listAssetFinancingInterestsQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(listAssetFinancingInterestsQuerySchema.safeParse({ status: 'ALL' }).success).toBe(false);
    expect(listAssetFinancingInterestsQuerySchema.safeParse({ search: '   ' }).success).toBe(false);
    expect(listAssetFinancingInterestsQuerySchema.safeParse({ userId: 'rider-selected' }).success).toBe(false);
  });
});
