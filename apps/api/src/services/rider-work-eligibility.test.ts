import { afterEach, describe, expect, it } from 'vitest';
import {
  assertRiderWorkEligible,
  isRiderWorkEligibilityBypassed,
  riderWorkEligibilityWhere,
} from './rider-work-eligibility';

const originalNodeEnv = process.env.NODE_ENV;
const originalBypass = process.env.BYPASS_ONBOARDING_CHECK;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.BYPASS_ONBOARDING_CHECK = originalBypass;
});

describe('Rider work eligibility', () => {
  it('requires activation, Rider verification, and an active User account', () => {
    process.env.NODE_ENV = 'production';
    process.env.BYPASS_ONBOARDING_CHECK = 'false';

    expect(riderWorkEligibilityWhere()).toEqual({
      onboardingStatus: 'ACTIVATED',
      isVerified: true,
      user: { status: 'ACTIVE' },
    });
    expect(() => assertRiderWorkEligible({
      onboardingStatus: 'ACTIVATED',
      isVerified: true,
      user: { status: 'ACTIVE' },
    })).not.toThrow();
  });

  it('rejects an unverified Rider even if onboarding says ACTIVATED', () => {
    process.env.NODE_ENV = 'production';

    expect(() => assertRiderWorkEligible({
      onboardingStatus: 'ACTIVATED',
      isVerified: false,
      user: { status: 'ACTIVE' },
    })).toThrow('not been verified');
  });

  it('rejects a suspended or otherwise inactive User account', () => {
    process.env.NODE_ENV = 'production';

    expect(() => assertRiderWorkEligible({
      onboardingStatus: 'ACTIVATED',
      isVerified: true,
      user: { status: 'SUSPENDED' },
    })).toThrow('not active');
  });

  it('honors the bypass only under NODE_ENV=test', () => {
    process.env.BYPASS_ONBOARDING_CHECK = 'true';
    process.env.NODE_ENV = 'production';
    expect(isRiderWorkEligibilityBypassed()).toBe(false);

    process.env.NODE_ENV = 'test';
    expect(isRiderWorkEligibilityBypassed()).toBe(true);
  });
});
