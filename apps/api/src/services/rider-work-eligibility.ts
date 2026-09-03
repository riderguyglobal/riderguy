import { ApiError } from '../lib/api-error';
import type { Prisma } from '@prisma/client';

export interface RiderWorkEligibilityProfile {
  onboardingStatus: string;
  isVerified: boolean;
  user?: { status: string } | null;
  vehicles: Array<{ reviewStatus: string }>;
}

export const REQUIRED_RIDER_DOCUMENT_TYPES = ['NATIONAL_ID', 'DRIVERS_LICENSE', 'SELFIE'] as const;

export const REQUIRED_IN_HOUSE_TRAINING_MODULES = [
  'SAFETY_BASICS',
  'SERVICE_STANDARDS',
  'DELIVERY_OPERATIONS',
] as const;

export interface RiderComplianceSnapshot {
  riderChannel: string | null;
  user: {
    documents: Array<{
      type: string;
      status: string;
      createdAt?: Date | string;
    }>;
  };
  vehicles: Array<{
    reviewStatus: string;
    photoFrontUrl?: string | null;
    photoBackUrl?: string | null;
    photoLeftUrl?: string | null;
    photoRightUrl?: string | null;
  }>;
  trainingCompletions: Array<{
    moduleKey: string;
    verifiedAt: Date | string | null;
  }>;
}

/**
 * Canonical post-activation compliance rule.
 *
 * `isVerified` is the fast, persisted work gate. This evaluator is used when
 * evidence or training changes to keep that gate synchronized with the latest
 * source records.
 */
export function isRiderComplianceSatisfied(profile: RiderComplianceSnapshot): boolean {
  if (profile.riderChannel !== 'GUEST' && profile.riderChannel !== 'IN_HOUSE') return false;

  const latestDocuments = new Map<string, RiderComplianceSnapshot['user']['documents'][number]>();
  const documents = [...profile.user.documents].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
  for (const document of documents) {
    if (!latestDocuments.has(document.type)) latestDocuments.set(document.type, document);
  }
  if (
    !REQUIRED_RIDER_DOCUMENT_TYPES.every((type) => latestDocuments.get(type)?.status === 'APPROVED')
  )
    return false;

  const hasApprovedVehicle = profile.vehicles.some(
    (vehicle) =>
      vehicle.reviewStatus === 'APPROVED' &&
      Boolean(vehicle.photoFrontUrl) &&
      Boolean(vehicle.photoBackUrl) &&
      Boolean(vehicle.photoLeftUrl) &&
      Boolean(vehicle.photoRightUrl),
  );
  if (!hasApprovedVehicle) return false;

  if (profile.riderChannel === 'IN_HOUSE') {
    const verifiedModules = new Set(
      profile.trainingCompletions
        .filter((completion) => Boolean(completion.verifiedAt))
        .map((completion) => completion.moduleKey),
    );
    if (!REQUIRED_IN_HOUSE_TRAINING_MODULES.every((moduleKey) => verifiedModules.has(moduleKey))) {
      return false;
    }
  }

  return true;
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
    vehicles: {
      some: {
        reviewStatus: 'APPROVED' as const,
        photoFrontUrl: { not: null },
        photoBackUrl: { not: null },
        photoLeftUrl: { not: null },
        photoRightUrl: { not: null },
      },
    },
    AND: [
      ...REQUIRED_RIDER_DOCUMENT_TYPES.map((type) => ({
        user: { documents: { some: { type, status: 'APPROVED' as const } } },
      })),
      {
        OR: [
          { riderChannel: 'GUEST' as const },
          {
            riderChannel: 'IN_HOUSE' as const,
            AND: REQUIRED_IN_HOUSE_TRAINING_MODULES.map((moduleKey) => ({
              trainingCompletions: { some: { moduleKey, verifiedAt: { not: null } } },
            })),
          },
        ],
      },
    ],
  };
}

export function isRiderWorkEligible(
  profile: RiderWorkEligibilityProfile | null | undefined,
): boolean {
  if (isRiderWorkEligibilityBypassed()) return !!profile;

  return (
    !!profile &&
    profile.onboardingStatus === 'ACTIVATED' &&
    profile.isVerified &&
    profile.user?.status === 'ACTIVE' &&
    profile.vehicles.some((vehicle) => vehicle.reviewStatus === 'APPROVED')
  );
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
