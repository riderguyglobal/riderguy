import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertRiderWorkEligible,
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
      vehicles: { some: { reviewStatus: 'APPROVED' } },
    });
    expect(() => assertRiderWorkEligible({
      onboardingStatus: 'ACTIVATED',
      isVerified: true,
      user: { status: 'ACTIVE' },
      vehicles: [{ reviewStatus: 'APPROVED' }],
    })).not.toThrow();
  });

  it('rejects an unverified Rider even if onboarding says ACTIVATED', () => {
    process.env.NODE_ENV = 'production';

    expect(() => assertRiderWorkEligible({
      onboardingStatus: 'ACTIVATED',
      isVerified: false,
      user: { status: 'ACTIVE' },
      vehicles: [{ reviewStatus: 'APPROVED' }],
    })).toThrow('not been verified');
  });

  it('rejects a suspended or otherwise inactive User account', () => {
    process.env.NODE_ENV = 'production';

    expect(() => assertRiderWorkEligible({
      onboardingStatus: 'ACTIVATED',
      isVerified: true,
      user: { status: 'SUSPENDED' },
      vehicles: [{ reviewStatus: 'APPROVED' }],
    })).toThrow('not active');
  });

  it('immediately rejects an activated Rider after their last vehicle approval is revoked', () => {
    process.env.NODE_ENV = 'production';

    expect(() => assertRiderWorkEligible({
      onboardingStatus: 'ACTIVATED',
      isVerified: true,
      user: { status: 'ACTIVE' },
      vehicles: [{ reviewStatus: 'REJECTED' }, { reviewStatus: 'PENDING' }],
    })).toThrow('approved delivery vehicle');
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

    await expect(setPostWorkRiderAvailability({
      riderProfile: { updateMany, update },
    } as never, 'rider-profile-1')).resolves.toBe('ONLINE');

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'rider-profile-1',
        onboardingStatus: 'ACTIVATED',
        isVerified: true,
        user: { status: 'ACTIVE' },
        vehicles: { some: { reviewStatus: 'APPROVED' } },
      },
      data: { availability: 'ONLINE' },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('lands a now-ineligible Rider offline when their delivery terminates', async () => {
    process.env.NODE_ENV = 'production';
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const update = vi.fn().mockResolvedValue({ id: 'rider-profile-1' });

    await expect(setPostWorkRiderAvailability({
      riderProfile: { updateMany, update },
    } as never, 'rider-profile-1')).resolves.toBe('OFFLINE');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'rider-profile-1' },
      data: { availability: 'OFFLINE' },
    });
  });
});
