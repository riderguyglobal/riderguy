import { describe, expect, it } from 'vitest';
import {
  createAssetFinancingInterestSchema,
  updateAssetFinancingInterestStatusSchema,
} from '@riderguy/validators';

describe('asset-financing validators', () => {
  it('accepts only the Rider-selected asset and bounded notes', () => {
    expect(createAssetFinancingInterestSchema.parse({
      assetType: 'MOTORBIKE',
      notes: '  Central Accra routes  ',
    })).toEqual({
      assetType: 'MOTORBIKE',
      notes: 'Central Accra routes',
    });
  });

  it.each(['contactEmail', 'userId', 'riderId', 'status'])(
    'rejects client control of %s',
    (protectedField) => {
      const result = createAssetFinancingInterestSchema.safeParse({
        assetType: 'ELECTRIC_VEHICLE',
        [protectedField]: 'attacker-controlled',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({ code: 'unrecognized_keys' }),
        ]));
      }
    },
  );

  it('rejects unsupported asset types and oversized notes', () => {
    expect(createAssetFinancingInterestSchema.safeParse({
      assetType: 'CAR',
    }).success).toBe(false);
    expect(createAssetFinancingInterestSchema.safeParse({
      assetType: 'MOTORBIKE',
      notes: 'x'.repeat(1001),
    }).success).toBe(false);
  });

  it('strictly validates the admin status update', () => {
    expect(updateAssetFinancingInterestStatusSchema.parse({
      status: 'UNDER_REVIEW',
      reviewNotes: ' Initial eligibility review ',
      expectedUpdatedAt: '2026-09-01T08:00:00.000Z',
    })).toEqual({
      status: 'UNDER_REVIEW',
      reviewNotes: 'Initial eligibility review',
      expectedUpdatedAt: '2026-09-01T08:00:00.000Z',
    });
    expect(updateAssetFinancingInterestStatusSchema.safeParse({
      status: 'APPROVED',
      riderId: 'rider-1',
      expectedUpdatedAt: '2026-09-01T08:00:00.000Z',
    }).success).toBe(false);
    expect(updateAssetFinancingInterestStatusSchema.safeParse({
      status: 'APPROVED',
    }).success).toBe(false);
    expect(updateAssetFinancingInterestStatusSchema.safeParse({
      status: 'DECLINED',
      expectedUpdatedAt: '2026-09-01T08:00:00.000Z',
    }).success).toBe(false);
    expect(updateAssetFinancingInterestStatusSchema.safeParse({
      status: 'DECLINED',
      reviewNotes: '  Not eligible yet  ',
      expectedUpdatedAt: '2026-09-01T08:00:00.000Z',
    }).success).toBe(true);
  });
});
