import { describe, expect, it } from 'vitest';
import {
  registerVehicleSchema,
  reviewVehicleSchema,
  updateVehicleSchema,
} from '@riderguy/validators';

describe('updateVehicleSchema', () => {
  it.each([
    'riderId',
    'isApproved',
    'isPrimary',
    'photoFrontUrl',
    'photoBackUrl',
    'photoLeftUrl',
    'photoRightUrl',
    'createdAt',
    'updatedAt',
    'id',
  ])('rejects the protected field %s', (protectedField) => {
    const result = updateVehicleSchema.safeParse({
      make: 'Honda',
      [protectedField]: 'attacker-controlled',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'unrecognized_keys' }),
        ]),
      );
    }
  });

  it('accepts and normalizes legitimate partial updates', () => {
    expect(updateVehicleSchema.parse({
      make: '  Honda  ',
      model: '  CB 125  ',
      year: 2025,
      color: 'Green',
      plateNumber: '  GR-1234-25  ',
    })).toEqual({
      make: 'Honda',
      model: 'CB 125',
      year: 2025,
      color: 'Green',
      plateNumber: 'GR-1234-25',
    });
  });

  it('rejects an empty update', () => {
    expect(updateVehicleSchema.safeParse({}).success).toBe(false);
  });
});

describe('vehicle registration and review validation', () => {
  it('canonicalizes plate casing and separators', () => {
    const result = registerVehicleSchema.parse({
      type: 'MOTORCYCLE',
      make: 'Honda',
      model: 'CB 125',
      plateNumber: '  gr  1234 - 25  ',
    });

    expect(result.plateNumber).toBe('GR-1234-25');
  });

  it('accepts an approval without a rejection reason', () => {
    expect(reviewVehicleSchema.parse({ status: 'APPROVED' })).toEqual({ status: 'APPROVED' });
  });

  it('requires a meaningful reason when rejecting or unapproving a vehicle', () => {
    expect(reviewVehicleSchema.safeParse({ status: 'REJECTED' }).success).toBe(false);
    expect(reviewVehicleSchema.safeParse({ status: 'REJECTED', rejectionReason: 'no' }).success).toBe(false);
    expect(reviewVehicleSchema.parse({ status: 'REJECTED', rejectionReason: '  Blurry right photo  ' }))
      .toEqual({ status: 'REJECTED', rejectionReason: 'Blurry right photo' });
  });

  it('rejects contradictory or unknown review fields', () => {
    expect(reviewVehicleSchema.safeParse({
      status: 'APPROVED',
      rejectionReason: 'Stale reason',
    }).success).toBe(false);
    expect(reviewVehicleSchema.safeParse({ status: 'APPROVED', isApproved: true }).success).toBe(false);
  });
});
