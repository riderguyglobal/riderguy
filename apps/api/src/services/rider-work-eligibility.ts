import { ApiError } from '../lib/api-error';

export interface RiderWorkEligibilityProfile {
  onboardingStatus: string;
  isVerified: boolean;
  user?: { status: string } | null;
}

/**
 * The onboarding bypass exists only for isolated automated tests. Setting the
 * flag in a deployed environment must never weaken Rider work authorization.
 */
export function isRiderWorkEligibilityBypassed(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.BYPASS_ONBOARDING_CHECK === 'true';
}

export function riderWorkEligibilityWhere() {
  if (isRiderWorkEligibilityBypassed()) return {};

  return {
    onboardingStatus: 'ACTIVATED' as const,
    isVerified: true,
    user: { status: 'ACTIVE' as const },
  };
}

export function isRiderWorkEligible(profile: RiderWorkEligibilityProfile | null | undefined): boolean {
  if (isRiderWorkEligibilityBypassed()) return !!profile;

  return !!profile
    && profile.onboardingStatus === 'ACTIVATED'
    && profile.isVerified
    && profile.user?.status === 'ACTIVE';
}

export function assertRiderWorkEligible(profile: RiderWorkEligibilityProfile): void {
  if (isRiderWorkEligibilityBypassed()) return;

  if (profile.onboardingStatus !== 'ACTIVATED') {
    throw ApiError.forbidden(
      'Your account is not yet activated. Please complete onboarding and wait for admin approval before working.',
      'RIDER_NOT_ACTIVATED',
    );
  }
  if (!profile.isVerified) {
    throw ApiError.forbidden('Your Rider account has not been verified.', 'RIDER_NOT_VERIFIED');
  }
  if (profile.user?.status !== 'ACTIVE') {
    throw ApiError.forbidden('Your account is not active.', 'RIDER_ACCOUNT_INACTIVE');
  }
}
