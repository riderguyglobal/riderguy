// ============================================================
// OnboardingService — enforced Rider onboarding state
// ============================================================

import crypto from 'node:crypto';
import { prisma } from '@riderguy/database';
import type { Prisma } from '@prisma/client';
import type { ListInHouseInvitationsQuery } from '@riderguy/validators';
import { ApiError } from '../lib/api-error';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import {
  isRiderComplianceSatisfied,
  isRiderWorkEligible,
  REQUIRED_IN_HOUSE_TRAINING_MODULES,
  REQUIRED_RIDER_DOCUMENT_TYPES,
} from './rider-work-eligibility';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

export { REQUIRED_IN_HOUSE_TRAINING_MODULES } from './rider-work-eligibility';

export type TrainingModuleKey = (typeof REQUIRED_IN_HOUSE_TRAINING_MODULES)[number];
type RiderChannel = 'GUEST' | 'IN_HOUSE';

const TRAINING_COPY: Record<TrainingModuleKey, { title: string; description: string }> = {
  SAFETY_BASICS: {
    title: 'Safety Basics',
    description: 'Road safety, protective equipment, emergencies, and incident reporting.',
  },
  SERVICE_STANDARDS: {
    title: 'Service Standards',
    description: 'Customer care, package handling, communication, and RiderGuy conduct.',
  },
  DELIVERY_OPERATIONS: {
    title: 'Delivery Operations',
    description:
      'Offer handling, pickup and drop-off verification, navigation, and proof of delivery.',
  },
};

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  optional: boolean;
}

export interface OnboardingProgress {
  riderId: string;
  riderChannel: RiderChannel | null;
  requestedRiderChannel: RiderChannel | null;
  channelAuthorizationRequired: boolean;
  onboardingStatus: string;
  referralCode: string;
  applicationRejectionReason: string | null;
  canAccessWork: boolean;
  overallProgress: number;
  steps: OnboardingStep[];
}

function hashInvitationCode(code: string) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function normalizePhone(value?: string | null) {
  if (!value) return null;
  const cleaned = value.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('233')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+233${cleaned.slice(1)}`;
  return cleaned;
}

const INVITATION_METADATA_SELECT = {
  id: true,
  targetEmail: true,
  targetPhone: true,
  expiresAt: true,
  createdAt: true,
} as const;

function invitationMatchesTarget(
  invitation: { targetEmail: string | null; targetPhone: string | null },
  targetEmail: string | null,
  targetPhone: string | null,
) {
  return targetEmail
    ? normalizeEmail(invitation.targetEmail) === targetEmail && !invitation.targetPhone
    : normalizePhone(invitation.targetPhone) === targetPhone && !invitation.targetEmail;
}

export class OnboardingService {
  static async getProgress(userId: string): Promise<OnboardingProgress> {
    await this.recalculateStatus(userId);

    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      include: {
        user: {
          include: {
            documents: {
              orderBy: { createdAt: 'desc' },
              select: { type: true, status: true },
            },
          },
        },
        vehicles: {
          select: {
            id: true,
            reviewStatus: true,
            photoFrontUrl: true,
            photoBackUrl: true,
            photoLeftUrl: true,
            photoRightUrl: true,
          },
        },
        trainingCompletions: { select: { moduleKey: true, completedAt: true, verifiedAt: true } },
      },
    });

    if (!rider) throw ApiError.notFound('Rider profile not found');

    const docMap = new Map<string, string>();
    for (const document of rider.user.documents) {
      // The query is newest-first. Preserve the first record for each type so
      // progress uses the same latest-evidence rule as compliance recalculation.
      if (!docMap.has(document.type)) docMap.set(document.type, document.status);
    }
    const trainingMap = new Map(rider.trainingCompletions.map((item) => [item.moduleKey, item]));

    const channelStep: OnboardingStep = rider.riderChannel
      ? {
          key: 'rider_channel',
          label:
            rider.riderChannel === 'IN_HOUSE'
              ? 'RiderGuy In-House Rider'
              : '3rd Party Rider (Guest)',
          description:
            rider.riderChannel === 'IN_HOUSE'
              ? 'Your targeted RiderGuy invitation has been verified.'
              : 'Your independent Rider channel is confirmed.',
          status: 'completed',
          optional: false,
        }
      : {
          key: 'rider_channel',
          label:
            rider.requestedRiderChannel === 'IN_HOUSE'
              ? 'Authorize In-House Channel'
              : 'Choose Rider Channel',
          description:
            rider.requestedRiderChannel === 'IN_HOUSE'
              ? 'Enter the one-time invitation issued to your email address or phone number.'
              : 'Choose Guest Rider, or use a RiderGuy invitation to join the In-House channel.',
          status: 'current',
          optional: false,
        };

    const steps: OnboardingStep[] = [
      {
        key: 'account_created',
        label: 'Create Account',
        description: 'Your Rider account has been created securely.',
        status: 'completed',
        optional: false,
      },
      channelStep,
      {
        key: 'national_id',
        label: 'Upload National ID',
        description: 'Upload a clear photo of a valid government-issued ID.',
        status: this.docStepStatus(docMap.get('NATIONAL_ID')),
        optional: false,
      },
      {
        key: 'drivers_license',
        label: "Upload Driver's License",
        description: "Upload your valid driver's licence.",
        status: this.docStepStatus(docMap.get('DRIVERS_LICENSE')),
        optional: false,
      },
      {
        key: 'selfie',
        label: 'Take a Selfie',
        description: 'Take a clear selfie for identity verification.',
        status: this.docStepStatus(docMap.get('SELFIE')),
        optional: false,
      },
      {
        key: 'vehicle_registration',
        label: 'Register & Verify Your Vehicle',
        description: 'Add the vehicle you will use for deliveries and wait for RiderGuy approval.',
        status: rider.vehicles.some((vehicle) => vehicle.reviewStatus === 'APPROVED')
          ? 'completed'
          : rider.vehicles.length > 0
            ? 'current'
            : 'pending',
        optional: false,
      },
      {
        key: 'insurance',
        label: 'Upload Insurance Certificate',
        description: 'Upload a current vehicle insurance certificate.',
        status: this.docStepStatus(docMap.get('INSURANCE_CERTIFICATE')),
        optional: true,
      },
      {
        key: 'vehicle_photos',
        label: 'Upload Vehicle Photos',
        description: 'Upload front, back, left, and right photos of the vehicle.',
        status: this.vehiclePhotoStatus(rider.vehicles),
        optional: false,
      },
      ...(rider.riderChannel === 'IN_HOUSE'
        ? REQUIRED_IN_HOUSE_TRAINING_MODULES.map((moduleKey) => {
            const record = trainingMap.get(moduleKey);
            return {
              key: `training_${moduleKey.toLowerCase()}`,
              label: TRAINING_COPY[moduleKey].title,
              description:
                record?.completedAt && !record.verifiedAt
                  ? 'Completed — waiting for RiderGuy verification.'
                  : TRAINING_COPY[moduleKey].description,
              status: record?.verifiedAt
                ? ('completed' as const)
                : record?.completedAt
                  ? ('current' as const)
                  : ('pending' as const),
              optional: false,
            };
          })
        : []),
      {
        key: 'review_pending',
        label: 'Admin Review',
        description: rider.applicationRejectionReason
          ? `Action required: ${rider.applicationRejectionReason}`
          : 'RiderGuy will verify all required items before activating delivery access.',
        status:
          rider.onboardingStatus === 'ACTIVATED'
            ? 'completed'
            : [
                  'DOCUMENTS_SUBMITTED',
                  'DOCUMENTS_UNDER_REVIEW',
                  'DOCUMENTS_APPROVED',
                  'TRAINING_PENDING',
                  'TRAINING_COMPLETE',
                ].includes(rider.onboardingStatus)
              ? 'current'
              : 'pending',
        optional: false,
      },
    ];

    if (!steps.some((step) => step.status === 'current')) {
      const firstPending = steps.find((step) => step.status === 'pending' && !step.optional);
      if (firstPending) firstPending.status = 'current';
    }

    const requiredSteps = steps.filter((step) => !step.optional);
    const completedRequired = requiredSteps.filter((step) => step.status === 'completed').length;

    return {
      riderId: rider.id,
      riderChannel: rider.riderChannel,
      requestedRiderChannel: rider.requestedRiderChannel,
      channelAuthorizationRequired:
        rider.requestedRiderChannel === 'IN_HOUSE' && rider.riderChannel !== 'IN_HOUSE',
      onboardingStatus: rider.onboardingStatus,
      referralCode: rider.referralCode,
      applicationRejectionReason: rider.applicationRejectionReason,
      canAccessWork: isRiderWorkEligible(rider),
      overallProgress: Math.round((completedRequired / requiredSteps.length) * 100),
      steps,
    };
  }

  static async selectChannel(userId: string, channel: RiderChannel, invitationCode?: string) {
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true, phone: true } } },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');
    if (rider.onboardingStatus === 'ACTIVATED')
      throw ApiError.conflict('The channel of an activated Rider cannot be changed.');
    if (rider.riderChannel && rider.riderChannel !== channel) {
      throw ApiError.conflict(
        'Your Rider channel has already been confirmed. Contact support to request a change.',
      );
    }

    if (channel === 'GUEST') {
      return prisma.riderProfile.update({
        where: { id: rider.id },
        data: {
          riderChannel: 'GUEST',
          requestedRiderChannel: 'GUEST',
          channelVerifiedAt: new Date(),
          channelInvitationId: null,
          onboardingStatus: 'DOCUMENTS_PENDING',
          applicationRejectionReason: null,
        },
      });
    }

    if (!invitationCode?.trim()) {
      await prisma.riderProfile.update({
        where: { id: rider.id },
        data: {
          requestedRiderChannel: 'IN_HOUSE',
          riderChannel: null,
          onboardingStatus: 'REGISTERED',
        },
      });
      throw ApiError.badRequest(
        'A valid RiderGuy In-House invitation code is required.',
        'IN_HOUSE_INVITATION_REQUIRED',
      );
    }

    const now = new Date();
    const invitation = await prisma.riderInvitation.findUnique({
      where: { codeHash: hashInvitationCode(invitationCode) },
    });
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt <= now) {
      throw ApiError.badRequest(
        'This In-House invitation is invalid, expired, or already used.',
        'INVALID_IN_HOUSE_INVITATION',
      );
    }

    const accountEmail = normalizeEmail(rider.user.email);
    const accountPhone = normalizePhone(rider.user.phone);
    if (invitation.targetEmail && normalizeEmail(invitation.targetEmail) !== accountEmail) {
      throw ApiError.forbidden('This invitation was issued to a different email address.');
    }
    if (invitation.targetPhone && normalizePhone(invitation.targetPhone) !== accountPhone) {
      throw ApiError.forbidden('This invitation was issued to a different phone number.');
    }

    return prisma.$transaction(async (tx) => {
      const consumed = await tx.riderInvitation.updateMany({
        where: { id: invitation.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1)
        throw ApiError.conflict('This In-House invitation has already been used.');
      return tx.riderProfile.update({
        where: { id: rider.id },
        data: {
          riderChannel: 'IN_HOUSE',
          requestedRiderChannel: 'IN_HOUSE',
          channelVerifiedAt: now,
          channelInvitationId: invitation.id,
          onboardingStatus: 'DOCUMENTS_PENDING',
          applicationRejectionReason: null,
        },
      });
    });
  }

  static async createInHouseInvitation(
    createdById: string,
    input: {
      email?: string;
      phone?: string;
      expiresInDays?: number;
      idempotencyKey: string;
    },
    auditContext?: AdminAuditContext,
  ) {
    const targetEmail = normalizeEmail(input.email);
    const targetPhone = normalizePhone(input.phone);
    if (!targetEmail && !targetPhone)
      throw ApiError.badRequest(
        'An email address or phone number is required for a targeted invitation.',
      );
    const days = Math.min(Math.max(input.expiresInDays ?? 7, 1), 30);
    const code = `RGIH-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const result = await prisma.$transaction(async (tx) => {
      // The opaque request key is persisted only in the privileged audit
      // record. Serializing on it makes an uncertain client retry resolve to
      // the original invitation without storing or re-showing its plaintext.
      await acquireTransactionAdvisoryLock(tx, 'rider-invitation-request', input.idempotencyKey);
      const previousRequest = await tx.auditLog.findFirst({
        where: {
          action: { in: ['rider_invitation.issued', 'rider_invitation.issue_reused'] },
          entityType: 'RiderInvitation',
          newData: { path: ['idempotencyKey'], equals: input.idempotencyKey },
        },
        select: { entityId: true },
      });
      if (previousRequest) {
        const previousInvitation = await tx.riderInvitation.findUnique({
          where: { id: previousRequest.entityId },
          select: INVITATION_METADATA_SELECT,
        });
        if (!previousInvitation) {
          throw ApiError.conflict(
            'This invitation request was already processed, but its record is unavailable.',
          );
        }
        if (!invitationMatchesTarget(previousInvitation, targetEmail, targetPhone)) {
          throw ApiError.conflict(
            'This invitation request ID was already used for another target.',
          );
        }
        return {
          invitation: previousInvitation,
          requestState: 'IDEMPOTENT_REPLAY' as const,
        };
      }

      const targetKey = targetEmail ? `email:${targetEmail}` : `phone:${targetPhone}`;
      await acquireTransactionAdvisoryLock(tx, 'rider-invitation-target', targetKey);

      // A second request key for the same identity must not create a second
      // live authorization. This also protects retries from older clients.
      const activeInvitation = await tx.riderInvitation.findFirst({
        where: {
          ...(targetEmail
            ? { targetEmail, targetPhone: null }
            : { targetPhone, targetEmail: null }),
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        select: INVITATION_METADATA_SELECT,
      });
      if (activeInvitation) {
        await AdminAuditService.record(
          {
            actorUserId: createdById,
            ipAddress: auditContext?.ipAddress,
            userAgent: auditContext?.userAgent,
            action: 'rider_invitation.issue_reused',
            entityType: 'RiderInvitation',
            entityId: activeInvitation.id,
            newData: {
              idempotencyKey: input.idempotencyKey,
              targetEmail,
              targetPhone,
              reason: 'ACTIVE_TARGET_ALREADY_EXISTS',
            },
          },
          tx,
        );
        return {
          invitation: activeInvitation,
          requestState: 'ACTIVE_TARGET_REUSED' as const,
        };
      }

      const created = await tx.riderInvitation.create({
        data: {
          codeHash: hashInvitationCode(code),
          targetEmail,
          targetPhone,
          expiresAt,
          createdById,
        },
        select: {
          id: true,
          targetEmail: true,
          targetPhone: true,
          expiresAt: true,
          createdAt: true,
        },
      });
      await AdminAuditService.record(
        {
          actorUserId: createdById,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          action: 'rider_invitation.issued',
          entityType: 'RiderInvitation',
          entityId: created.id,
          newData: {
            idempotencyKey: input.idempotencyKey,
            targetEmail: created.targetEmail,
            targetPhone: created.targetPhone,
            expiresAt: created.expiresAt,
          },
        },
        tx,
      );
      return { invitation: created, requestState: 'CREATED' as const };
    });

    if (result.requestState !== 'CREATED') {
      return {
        ...result.invitation,
        code: null,
        requestState: result.requestState,
        delivery: {
          email: targetEmail ? 'ALREADY_ISSUED' : 'NOT_REQUESTED',
          sms: targetPhone ? 'ALREADY_ISSUED' : 'NOT_REQUESTED',
        },
      };
    }

    // The plaintext code is deliberately not stored. Deliver it immediately
    // to the targeted identity and return it once to the issuing admin as a
    // manual fallback if the configured provider is unavailable.
    const [emailSent, smsSent] = await Promise.all([
      targetEmail
        ? import('./email.service')
            .then(({ EmailService }) =>
              EmailService.sendInHouseInvitation(targetEmail, code, expiresAt),
            )
            .catch(() => false)
        : Promise.resolve(null),
      targetPhone
        ? import('./sms.service')
            .then(({ SmsService }) =>
              SmsService.sendInHouseInvitation(targetPhone, code, expiresAt),
            )
            .catch(() => false)
        : Promise.resolve(null),
    ]);

    return {
      ...result.invitation,
      code,
      requestState: result.requestState,
      delivery: {
        email: targetEmail ? (emailSent ? 'SENT' : 'FAILED') : 'NOT_REQUESTED',
        sms: targetPhone ? (smsSent ? 'SENT' : 'FAILED') : 'NOT_REQUESTED',
      },
    };
  }

  static async listInHouseInvitations(input: ListInHouseInvitationsQuery) {
    const { page, limit } = input;
    const [items, total] = await Promise.all([
      prisma.riderInvitation.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          targetEmail: true,
          targetPhone: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
          createdAt: true,
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          consumedBy: { select: { userId: true } },
        },
      }),
      prisma.riderInvitation.count(),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async revokeInHouseInvitation(
    adminId: string,
    invitationId: string,
    reason: string,
    auditContext?: AdminAuditContext,
  ) {
    return prisma.$transaction(async (tx) => {
      const invitation = await tx.riderInvitation.findUnique({ where: { id: invitationId } });
      if (!invitation) throw ApiError.notFound('Rider invitation not found');
      if (invitation.usedAt) throw ApiError.conflict('A consumed invitation cannot be revoked.');
      if (invitation.revokedAt)
        throw ApiError.conflict('This invitation has already been revoked.');

      const now = new Date();
      const changed = await tx.riderInvitation.updateMany({
        where: { id: invitationId, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      if (changed.count !== 1) {
        throw ApiError.conflict(
          'This invitation changed while it was being revoked. Refresh and try again.',
        );
      }
      await AdminAuditService.record(
        {
          actorUserId: adminId,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          action: 'rider_invitation.revoked',
          entityType: 'RiderInvitation',
          entityId: invitationId,
          oldData: { revokedAt: invitation.revokedAt, usedAt: invitation.usedAt },
          newData: { revokedAt: now, reason },
        },
        tx,
      );
      return tx.riderInvitation.findUnique({
        where: { id: invitationId },
        select: {
          id: true,
          targetEmail: true,
          targetPhone: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
          createdAt: true,
        },
      });
    });
  }

  static async completeTrainingModule(userId: string, moduleKey: string) {
    this.assertTrainingModule(moduleKey);
    const rider = await prisma.riderProfile.findUnique({ where: { userId } });
    if (!rider) throw ApiError.notFound('Rider profile not found');
    if (rider.riderChannel !== 'IN_HOUSE')
      throw ApiError.forbidden('Training completion is only part of the In-House Rider channel.');
    const record = await prisma.riderTrainingCompletion.upsert({
      where: { riderId_moduleKey: { riderId: rider.id, moduleKey } },
      create: { riderId: rider.id, moduleKey },
      update: { completedAt: new Date() },
    });
    await this.recalculateStatus(userId);
    return record;
  }

  static async getTraining(userId: string) {
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      include: { trainingCompletions: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');
    const records = new Map(rider.trainingCompletions.map((record) => [record.moduleKey, record]));
    return {
      riderChannel: rider.riderChannel,
      modules: REQUIRED_IN_HOUSE_TRAINING_MODULES.map((key) => ({
        key,
        ...TRAINING_COPY[key],
        completedAt: records.get(key)?.completedAt ?? null,
        verifiedAt: records.get(key)?.verifiedAt ?? null,
      })),
    };
  }

  static async verifyTrainingModule(
    adminId: string,
    userId: string,
    moduleKey: string,
    auditContext?: AdminAuditContext,
  ) {
    return this.reviewTrainingModule(
      adminId,
      userId,
      moduleKey,
      'VERIFIED',
      undefined,
      auditContext,
    );
  }

  static async reviewTrainingModule(
    adminId: string,
    userId: string,
    moduleKey: string,
    decision: 'VERIFIED' | 'REVOKED',
    reason?: string,
    auditContext?: AdminAuditContext,
  ) {
    this.assertTrainingModule(moduleKey);
    const rider = await prisma.riderProfile.findUnique({ where: { userId } });
    if (!rider) throw ApiError.notFound('Rider profile not found');
    const completion = await prisma.riderTrainingCompletion.findUnique({
      where: { riderId_moduleKey: { riderId: rider.id, moduleKey } },
    });
    if (!completion) throw ApiError.badRequest('The Rider has not completed this training module.');
    if (decision === 'VERIFIED' && completion.verifiedAt) {
      throw ApiError.conflict('This training module is already verified.');
    }
    if (decision === 'REVOKED' && !completion.verifiedAt) {
      throw ApiError.conflict('This training module is not currently verified.');
    }
    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const changed = await tx.riderTrainingCompletion.updateMany({
        where: {
          id: completion.id,
          verifiedAt: decision === 'VERIFIED' ? null : { not: null },
        },
        data:
          decision === 'VERIFIED'
            ? { verifiedAt: now, verifiedById: adminId }
            : { verifiedAt: null, verifiedById: null },
      });
      if (changed.count !== 1) {
        throw ApiError.conflict('This training record changed during review. Refresh the case.');
      }
      const result = await tx.riderTrainingCompletion.findUnique({ where: { id: completion.id } });
      if (!result) throw ApiError.notFound('Training completion not found');
      await AdminAuditService.record(
        {
          actorUserId: adminId,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          action:
            decision === 'VERIFIED'
              ? 'rider_training.verified'
              : 'rider_training.verification_revoked',
          entityType: 'RiderTrainingCompletion',
          entityId: completion.id,
          oldData: {
            riderUserId: userId,
            moduleKey,
            verifiedAt: completion.verifiedAt,
            verifiedById: completion.verifiedById,
          },
          newData: {
            riderUserId: userId,
            moduleKey,
            verifiedAt: result.verifiedAt,
            verifiedById: result.verifiedById,
            ...(reason ? { reason } : {}),
          },
        },
        tx,
      );
      await this.recalculateStatus(userId, tx);
      return result;
    });
    return updated;
  }

  static async recalculateStatus(
    userId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<unknown> {
    if (!transaction) {
      return prisma.$transaction((tx) => this.recalculateStatus(userId, tx));
    }

    const identity = await transaction.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!identity) return null;

    // Serialize compliance changes against availability and dispatch, which use
    // the same RiderProfile-scoped advisory lock.
    await acquireTransactionAdvisoryLock(transaction, 'rider-vehicle-state', identity.id);

    const rider = await transaction.riderProfile.findUnique({
      where: { userId },
      include: {
        user: { include: { documents: { orderBy: { createdAt: 'desc' } } } },
        vehicles: {
          select: {
            reviewStatus: true,
            photoFrontUrl: true,
            photoBackUrl: true,
            photoLeftUrl: true,
            photoRightUrl: true,
          },
        },
        trainingCompletions: true,
      },
    });
    if (!rider) return null;

    if (rider.onboardingStatus === 'ACTIVATED') {
      const compliant = isRiderComplianceSatisfied(rider);
      const mustStopReceivingWork = !compliant && rider.availability !== 'ON_DELIVERY';
      const verificationChanged = rider.isVerified !== compliant;
      const availabilityChanged = mustStopReceivingWork && rider.availability !== 'OFFLINE';

      if (!verificationChanged && !availabilityChanged) return rider;

      return transaction.riderProfile.update({
        where: { id: rider.id },
        data: {
          ...(verificationChanged ? { isVerified: compliant } : {}),
          ...(availabilityChanged ? { availability: 'OFFLINE', sessionStartedAt: null } : {}),
        },
      });
    }

    if (rider.onboardingStatus === 'APPLICATION_REJECTED' && rider.applicationReviewedAt) {
      const hasNewSubmission = rider.user.documents.some(
        (document) => document.createdAt > rider.applicationReviewedAt!,
      );
      if (!hasNewSubmission) return rider;
      await transaction.riderProfile.update({
        where: { id: rider.id },
        data: { applicationRejectionReason: null },
      });
    }

    let status: typeof rider.onboardingStatus = 'REGISTERED';
    if (rider.riderChannel) {
      const latest = new Map<string, string>();
      for (const document of rider.user.documents)
        if (!latest.has(document.type)) latest.set(document.type, document.status);
      const required = REQUIRED_RIDER_DOCUMENT_TYPES;
      const hasAll = required.every((type) => latest.has(type));
      const anyRejected = Array.from(latest.values()).some(
        (value) => value === 'REJECTED' || value === 'EXPIRED',
      );
      const allApproved = hasAll && required.every((type) => latest.get(type) === 'APPROVED');

      if (anyRejected) status = 'DOCUMENTS_REJECTED';
      else if (!hasAll) status = 'DOCUMENTS_PENDING';
      else if (!allApproved) status = 'DOCUMENTS_SUBMITTED';
      else if (rider.riderChannel === 'IN_HOUSE') {
        const verified = new Set(
          rider.trainingCompletions.filter((item) => item.verifiedAt).map((item) => item.moduleKey),
        );
        status = REQUIRED_IN_HOUSE_TRAINING_MODULES.every((key) => verified.has(key))
          ? 'TRAINING_COMPLETE'
          : 'TRAINING_PENDING';
      } else status = 'DOCUMENTS_APPROVED';
    }

    if (status === rider.onboardingStatus) return rider;
    return transaction.riderProfile.update({
      where: { id: rider.id },
      data: { onboardingStatus: status },
    });
  }

  static async getApprovalReadiness(
    userId: string,
    db: Pick<Prisma.TransactionClient, 'riderProfile'> = prisma,
  ) {
    const rider = await db.riderProfile.findUnique({
      where: { userId },
      include: {
        user: { include: { documents: { orderBy: { createdAt: 'desc' } } } },
        vehicles: {
          select: {
            id: true,
            reviewStatus: true,
            photoFrontUrl: true,
            photoBackUrl: true,
            photoLeftUrl: true,
            photoRightUrl: true,
          },
        },
        trainingCompletions: true,
      },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');
    const latest = new Map<string, string>();
    for (const document of rider.user.documents)
      if (!latest.has(document.type)) latest.set(document.type, document.status);
    const missing: string[] = [];
    if (rider.onboardingStatus === 'APPLICATION_REJECTED') {
      missing.push('Application is rejected and requires a new Rider submission');
    }
    if (['SUSPENDED', 'DEACTIVATED', 'BANNED'].includes(rider.user.status)) {
      missing.push(`Rider account is ${rider.user.status.toLowerCase()}`);
    }
    if (!rider.riderChannel) missing.push('Rider channel is not authorized');
    for (const type of ['NATIONAL_ID', 'DRIVERS_LICENSE', 'SELFIE']) {
      if (latest.get(type) !== 'APPROVED')
        missing.push(`${type.replace(/_/g, ' ')} is not approved`);
    }
    if (rider.vehicles.length === 0) {
      missing.push('No delivery vehicle is registered');
    } else {
      const approvedVehicles = rider.vehicles.filter(
        (vehicle) => vehicle.reviewStatus === 'APPROVED',
      );
      if (approvedVehicles.length === 0) {
        missing.push('No delivery vehicle has been approved');
      }
      if (!approvedVehicles.some((vehicle) => this.hasRequiredVehiclePhotos(vehicle))) {
        missing.push('Front, back, left, and right photos are required for an approved vehicle');
      }
    }
    if (rider.riderChannel === 'IN_HOUSE') {
      const verified = new Set(
        rider.trainingCompletions.filter((item) => item.verifiedAt).map((item) => item.moduleKey),
      );
      for (const key of REQUIRED_IN_HOUSE_TRAINING_MODULES)
        if (!verified.has(key)) missing.push(`${TRAINING_COPY[key].title} is not admin-verified`);
    }
    return { ready: missing.length === 0, missing, rider };
  }

  private static assertTrainingModule(moduleKey: string): asserts moduleKey is TrainingModuleKey {
    if (!REQUIRED_IN_HOUSE_TRAINING_MODULES.includes(moduleKey as TrainingModuleKey))
      throw ApiError.badRequest('Unknown RiderGuy training module.');
  }

  private static docStepStatus(status?: string): 'completed' | 'current' | 'pending' {
    if (status === 'APPROVED') return 'completed';
    if (status === 'PENDING' || status === 'UNDER_REVIEW') return 'current';
    return 'pending';
  }

  private static vehiclePhotoStatus(
    vehicles: Array<{
      photoFrontUrl?: string | null;
      photoBackUrl?: string | null;
      photoLeftUrl?: string | null;
      photoRightUrl?: string | null;
    }>,
  ): 'completed' | 'current' | 'pending' {
    if (vehicles.length === 0) return 'pending';
    if (vehicles.some((vehicle) => this.hasRequiredVehiclePhotos(vehicle))) return 'completed';
    const uploaded = Math.max(
      ...vehicles.map(
        (vehicle) =>
          [
            vehicle.photoFrontUrl,
            vehicle.photoBackUrl,
            vehicle.photoLeftUrl,
            vehicle.photoRightUrl,
          ].filter(Boolean).length,
      ),
    );
    if (uploaded === 0) return 'pending';
    return 'current';
  }

  private static hasRequiredVehiclePhotos(vehicle: {
    photoFrontUrl?: string | null;
    photoBackUrl?: string | null;
    photoLeftUrl?: string | null;
    photoRightUrl?: string | null;
  }): boolean {
    return !!(
      vehicle.photoFrontUrl &&
      vehicle.photoBackUrl &&
      vehicle.photoLeftUrl &&
      vehicle.photoRightUrl
    );
  }
}
