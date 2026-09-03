import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertRiderWorkEligible,
  isRiderComplianceSatisfied,
  isRiderWorkEligibilityBypassed,
  riderWorkEligibilityWhere,
  setPostWorkRiderAvailability,
} from './rider-work-eligibility';

const originalNodeEnv = process.env.NODE_ENV;
const originalBypass = process.env.BYPASS_ONBOARDING_CHECK;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.BYPASS_ONBOARDING_CHECK = originalBypass;
});

describe('Rider work eligibility', () => {
  it('requires activation, Rider verification, an active User account, and an approved vehicle', () => {
    process.env.NODE_ENV = 'production';
    process.env.BYPASS_ONBOARDING_CHECK = 'false';

    expect(riderWorkEligibilityWhere()).toEqual({
      onboardingStatus: 'ACTIVATED',
      isVerified: true,
      user: { status: 'ACTIVE' },
      vehicles: {
        some: {
          reviewStatus: 'APPROVED',
          photoFrontUrl: { not: null },
          photoBackUrl: { not: null },
          photoLeftUrl: { not: null },
          photoRightUrl: { not: null },
        },
      },
      AND: [
        { user: { documents: { some: { type: 'NATIONAL_ID', status: 'APPROVED' } } } },
        { user: { documents: { some: { type: 'DRIVERS_LICENSE', status: 'APPROVED' } } } },
        { user: { documents: { some: { type: 'SELFIE', status: 'APPROVED' } } } },
        {
          OR: [
            { riderChannel: 'GUEST' },
            {
              riderChannel: 'IN_HOUSE',
              AND: [
                {
                  trainingCompletions: {
                    some: { moduleKey: 'SAFETY_BASICS', verifiedAt: { not: null } },
                  },
                },
                {
                  trainingCompletions: {
                    some: { moduleKey: 'SERVICE_STANDARDS', verifiedAt: { not: null } },
                  },
                },
                {
                  trainingCompletions: {
                    some: { moduleKey: 'DELIVERY_OPERATIONS', verifiedAt: { not: null } },
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(() =>
      assertRiderWorkEligible({
        onboardingStatus: 'ACTIVATED',
        isVerified: true,
        user: { status: 'ACTIVE' },
        vehicles: [{ reviewStatus: 'APPROVED' }],
      }),
    ).not.toThrow();
  });

  it('uses the latest required evidence and all four approved vehicle photos', () => {
    expect(
      isRiderComplianceSatisfied({
        riderChannel: 'GUEST',
        user: {
          documents: [
            { type: 'NATIONAL_ID', status: 'APPROVED', createdAt: '2026-01-01' },
            { type: 'NATIONAL_ID', status: 'PENDING', createdAt: '2026-02-01' },
            { type: 'DRIVERS_LICENSE', status: 'APPROVED', createdAt: '2026-01-01' },
            { type: 'SELFIE', status: 'APPROVED', createdAt: '2026-01-01' },
          ],
        },
        vehicles: [
          {
            reviewStatus: 'APPROVED',
            photoFrontUrl: 'front.jpg',
            photoBackUrl: 'back.jpg',
            photoLeftUrl: 'left.jpg',
            photoRightUrl: 'right.jpg',
          },
        ],
        trainingCompletions: [],
      }),
    ).toBe(false);
  });

  it('requires every verified training module for an In-House Rider', () => {
    expect(
      isRiderComplianceSatisfied({
        riderChannel: 'IN_HOUSE',
        user: {
          documents: [
            { type: 'NATIONAL_ID', status: 'APPROVED' },
            { type: 'DRIVERS_LICENSE', status: 'APPROVED' },
            { type: 'SELFIE', status: 'APPROVED' },
          ],
        },
        vehicles: [
          {
            reviewStatus: 'APPROVED',
            photoFrontUrl: 'front.jpg',
            photoBackUrl: 'back.jpg',
            photoLeftUrl: 'left.jpg',
            photoRightUrl: 'right.jpg',
          },
        ],
        trainingCompletions: [
          { moduleKey: 'SAFETY_BASICS', verifiedAt: new Date() },
          { moduleKey: 'SERVICE_STANDARDS', verifiedAt: new Date() },
          { moduleKey: 'DELIVERY_OPERATIONS', verifiedAt: null },
        ],
      }),
    ).toBe(false);
  });

  it('rejects an unverified Rider even if onboarding says ACTIVATED', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      assertRiderWorkEligible({
        onboardingStatus: 'ACTIVATED',
        isVerified: false,
        user: { status: 'ACTIVE' },
        vehicles: [{ reviewStatus: 'APPROVED' }],
      }),
    ).toThrow('not been verified');
  });

  it('rejects a suspended or otherwise inactive User account', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      assertRiderWorkEligible({
        onboardingStatus: 'ACTIVATED',
        isVerified: true,
        user: { status: 'SUSPENDED' },
        vehicles: [{ reviewStatus: 'APPROVED' }],
      }),
    ).toThrow('not active');
  });

  it('immediately rejects an activated Rider after their last vehicle approval is revoked', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      assertRiderWorkEligible({
        onboardingStatus: 'ACTIVATED',
        isVerified: true,
        user: { status: 'ACTIVE' },
        vehicles: [{ reviewStatus: 'REJECTED' }, { reviewStatus: 'PENDING' }],
      }),
    ).toThrow('approved delivery vehicle');
  });

  it('honors the bypass only under NODE_ENV=test', () => {
    process.env.BYPASS_ONBOARDING_CHECK = 'true';
    process.env.NODE_ENV = 'production';
    expect(isRiderWorkEligibilityBypassed()).toBe(false);

    process.env.NODE_ENV = 'test';
    expect(isRiderWorkEligibilityBypassed()).toBe(true);
  });

  it('returns an eligible Rider online after terminal work', async () => {
    process.env.NODE_ENV = 'production';
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn();

    await expect(
      setPostWorkRiderAvailability(
        {
          riderProfile: { updateMany, update },
        } as never,
        'rider-profile-1',
      ),
    ).resolves.toBe('ONLINE');

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'rider-profile-1',
        onboardingStatus: 'ACTIVATED',
        isVerified: true,
        user: { status: 'ACTIVE' },
        vehicles: {
          some: {
            reviewStatus: 'APPROVED',
            photoFrontUrl: { not: null },
            photoBackUrl: { not: null },
            photoLeftUrl: { not: null },
            photoRightUrl: { not: null },
          },
        },
        AND: expect.any(Array),
      },
      data: { availability: 'ONLINE' },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('lands a now-ineligible Rider offline when their delivery terminates', async () => {
    process.env.NODE_ENV = 'production';
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const update = vi.fn().mockResolvedValue({ id: 'rider-profile-1' });

    await expect(
      setPostWorkRiderAvailability(
        {
          riderProfile: { updateMany, update },
        } as never,
        'rider-profile-1',
      ),
    ).resolves.toBe('OFFLINE');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'rider-profile-1' },
      data: { availability: 'OFFLINE' },
    });
  });
});
