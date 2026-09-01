import { ApiError } from '../lib/api-error';
import type { Prisma } from '@prisma/client';

export interface RiderWorkEligibilityProfile {
  onboardingStatus: string;
  isVerified: boolean;
  user?: { status: string } | null;
  vehicles: Array<{ reviewStatus: string }>;
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
    vehicles: { some: { reviewStatus: 'APPROVED' as const } },
  };
}

export function isRiderWorkEligible(profile: RiderWorkEligibilityProfile | null | undefined): boolean {
  if (isRiderWorkEligibilityBypassed()) return !!profile;

  return !!profile
    && profile.onboardingStatus === 'ACTIVATED'
    && profile.isVerified
    && profile.user?.status === 'ACTIVE'
    && profile.vehicles.some((vehicle) => vehicle.reviewStatus === 'APPROVED');
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
  if (!profile.vehicles.some((vehicle) => vehicle.reviewStatus === 'APPROVED')) {
    throw ApiError.forbidden(
      'You need an approved delivery vehicle before you can receive work.',
      'RIDER_VEHICLE_NOT_APPROVED',
    );
  }
}

/**
 * Release a Rider after work without reviving an account whose approval state
 * changed during the delivery. Callers must hold the Rider's
 * `rider-vehicle-state` transaction advisory lock before invoking this helper.
 */
export async function setPostWorkRiderAvailability(
  tx: Prisma.TransactionClient,
  riderProfileId: string,
): Promise<'ONLINE' | 'OFFLINE'> {
  const eligible = await tx.riderProfile.updateMany({
    where: {
      id: riderProfileId,
      ...riderWorkEligibilityWhere(),
    },
    data: { availability: 'ONLINE' },
  });

  if (eligible.count > 0) return 'ONLINE';

  await tx.riderProfile.update({
    where: { id: riderProfileId },
    data: { availability: 'OFFLINE' },
  });
  return 'OFFLINE';
}
