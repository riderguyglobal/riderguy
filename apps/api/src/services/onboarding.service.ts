// ============================================================
// OnboardingService — Rider onboarding progress tracking
//
// Returns a checklist of all onboarding steps with completion
// status so the rider knows what's done and what's next.
// ============================================================

import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';

// --------------- types ------------------------------------------------

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  optional: boolean;
}

export interface OnboardingProgress {
  riderId: string;
  onboardingStatus: string;
  overallProgress: number; // 0-100
  steps: OnboardingStep[];
}

// --------------- service class ----------------------------------------

export class OnboardingService {
  static async getProgress(userId: string): Promise<OnboardingProgress> {
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      include: {
        user: {
          include: {
            documents: { select: { type: true, status: true } },
          },
        },
        vehicles: { select: { id: true, isApproved: true, photoFrontUrl: true, photoBackUrl: true, photoLeftUrl: true, photoRightUrl: true } },
      },
    });

    if (!rider) {
      throw ApiError.notFound('Rider profile not found');
    }

    const docs = rider.user.documents;
    const docMap = new Map(docs.map((d) => [d.type, d.status]));
    const vehicles = rider.vehicles;

    // Build steps
    const steps: OnboardingStep[] = [
      {
        key: 'account_created',
        label: 'Create Account',
        description: 'Register with your phone number and personal details.',
        status: 'completed', // Always done if we have a rider profile
        optional: false,
      },
      {
        key: 'national_id',
        label: 'Upload National ID',
        description: 'Upload a clear photo of your valid government-issued ID.',
        status: OnboardingService.docStepStatus(docMap.get('NATIONAL_ID')),
        optional: false,
      },
      {
        key: 'drivers_license',
        label: 'Upload Driver\'s License',
        description: 'Upload your valid driver\'s licence.',
        status: OnboardingService.docStepStatus(docMap.get('DRIVERS_LICENSE')),
        optional: false,
      },
      {
        key: 'selfie',
        label: 'Take a Selfie',
        description: 'Take a clear selfie for identity verification.',
        status: OnboardingService.docStepStatus(docMap.get('SELFIE')),
        optional: false,
      },
      {
        key: 'vehicle_registration',
        label: 'Register Your Vehicle',
        description: 'Add your vehicle details (type, make, model, plate number).',
        status: vehicles.length > 0 ? 'completed' : 'pending',
        optional: false,
      },
      {
        key: 'insurance',
        label: 'Upload Insurance Certificate',
        description: 'Upload your vehicle insurance certificate.',
        status: OnboardingService.docStepStatus(docMap.get('INSURANCE_CERTIFICATE')),
        optional: true,
      },
      {
        key: 'vehicle_photos',
        label: 'Upload Vehicle Photos',
        description: 'Upload front, back, left, and right photos of your vehicle.',
        status: OnboardingService.vehiclePhotoStatus(vehicles),
        optional: true,
      },
      {
        key: 'review_pending',
        label: 'Await Verification',
        description: 'Our team will review your documents and activate your account.',
        status: rider.onboardingStatus === 'ACTIVATED'
          ? 'completed'
          : rider.onboardingStatus === 'DOCUMENTS_SUBMITTED' ||
            rider.onboardingStatus === 'DOCUMENTS_UNDER_REVIEW'
          ? 'current'
          : 'pending',
        optional: false,
      },
    ];

    // Mark the first pending step as "current" if no step is currently "current"
    const hasCurrent = steps.some((s) => s.status === 'current');
    if (!hasCurrent) {
      const firstPending = steps.find((s) => s.status === 'pending' && !s.optional);
      if (firstPending) {
        firstPending.status = 'current';
      }
    }

    // Calculate overall progress
    const requiredSteps = steps.filter((s) => !s.optional);
    const completedRequired = requiredSteps.filter((s) => s.status === 'completed').length;
    const overallProgress = Math.round((completedRequired / requiredSteps.length) * 100);

    return {
      riderId: rider.id,
      onboardingStatus: rider.onboardingStatus,
      overallProgress,
      steps,
    };
  }

  // ---- Helpers ----

  private static docStepStatus(
    docStatus: string | undefined,
  ): 'completed' | 'current' | 'pending' {
    if (!docStatus) return 'pending';
    if (docStatus === 'APPROVED') return 'completed';
    if (docStatus === 'PENDING' || docStatus === 'UNDER_REVIEW') return 'current';
    return 'pending'; // REJECTED or EXPIRED → needs re-upload
  }

  private static vehiclePhotoStatus(
    vehicles: Array<{ id: string; isApproved: boolean; photoFrontUrl?: string | null; photoBackUrl?: string | null; photoLeftUrl?: string | null; photoRightUrl?: string | null }>,
  ): 'completed' | 'current' | 'pending' {
    if (vehicles.length === 0) return 'pending';

    // Check the first (primary) vehicle for photo completion
    const vehicle = vehicles[0]!;
    const photos = [vehicle.photoFrontUrl, vehicle.photoBackUrl, vehicle.photoLeftUrl, vehicle.photoRightUrl];
    const uploaded = photos.filter(Boolean).length;

    if (uploaded === 0) return 'pending';
    if (uploaded === 4) return 'completed';
    return 'current';
  }
}
