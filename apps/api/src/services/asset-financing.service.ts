import { prisma } from '@riderguy/database';
import type {
  CreateAssetFinancingInterestInput,
  ListAssetFinancingInterestsQuery,
  UpdateAssetFinancingInterestStatusInput,
} from '@riderguy/validators';
import { ApiError } from '../lib/api-error';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import { REQUIRED_IN_HOUSE_TRAINING_MODULES } from './onboarding.service';
import type { AssetFinancingInterestStatus, Prisma } from '@prisma/client';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

const RIDER_INTEREST_SELECT = {
  id: true,
  assetType: true,
  status: true,
  contactEmail: true,
  notes: true,
  submittedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ADMIN_INTEREST_SELECT = {
  ...RIDER_INTEREST_SELECT,
  riderId: true,
  reviewNotes: true,
  reviewedById: true,
} as const;

const ADMIN_QUEUE_INTEREST_SELECT = {
  ...ADMIN_INTEREST_SELECT,
  rider: {
    select: {
      id: true,
      userId: true,
      onboardingStatus: true,
      riderChannel: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          emailVerified: true,
          status: true,
        },
      },
    },
  },
  reviewedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} as const;

const CLOSED_STATUSES = new Set(['DECLINED', 'WITHDRAWN']);

const ALLOWED_STATUS_TRANSITIONS: Record<
  AssetFinancingInterestStatus,
  readonly AssetFinancingInterestStatus[]
> = {
  SUBMITTED: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN'],
  APPROVED: ['APPROVED', 'UNDER_REVIEW', 'DECLINED', 'WITHDRAWN'],
  DECLINED: ['DECLINED', 'SUBMITTED', 'UNDER_REVIEW'],
  WITHDRAWN: ['WITHDRAWN', 'SUBMITTED'],
};

function normalizedNotes(notes?: string): string | null {
  return notes?.trim() || null;
}

export class AssetFinancingService {
  static async getCurrentState(userId: string) {
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: {
        user: { select: { email: true, emailVerified: true } },
        assetFinancingInterest: { select: RIDER_INTEREST_SELECT },
      },
    });

    if (!rider) throw ApiError.notFound('Rider profile not found');

    return {
      interest: rider.assetFinancingInterest,
      verifiedContactEmail: rider.user.emailVerified ? rider.user.email : null,
    };
  }

  static async listForAdmin(input: ListAssetFinancingInterestsQuery) {
    const search = input.search?.trim();
    const where: Prisma.AssetFinancingInterestWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.assetType ? { assetType: input.assetType } : {}),
      ...(search
        ? {
            OR: [
              { contactEmail: { contains: search, mode: 'insensitive' } },
              { rider: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
              { rider: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
              { rider: { user: { email: { contains: search, mode: 'insensitive' } } } },
              { rider: { user: { phone: { contains: search } } } },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.limit;

    const [items, total] = await Promise.all([
      prisma.assetFinancingInterest.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        select: ADMIN_QUEUE_INTEREST_SELECT,
      }),
      prisma.assetFinancingInterest.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  static async registerInterest(userId: string, input: CreateAssetFinancingInterestInput) {
    return prisma.$transaction(async (tx) => {
      // A database-backed Rider lock makes simultaneous retries converge on
      // the same record even when the API is running on multiple instances.
      await acquireTransactionAdvisoryLock(tx, 'asset-financing-interest', userId);

      const rider = await tx.riderProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          riderChannel: true,
          user: { select: { email: true, emailVerified: true } },
          trainingCompletions: { select: { moduleKey: true, verifiedAt: true } },
          assetFinancingInterest: { select: RIDER_INTEREST_SELECT },
        },
      });

      if (!rider) throw ApiError.notFound('Rider profile not found');
      if (rider.riderChannel !== 'IN_HOUSE') {
        throw ApiError.forbidden('The asset lease pilot is available only to RiderGuy In-House Riders.');
      }

      const verifiedModules = new Set(
        rider.trainingCompletions
          .filter((completion) => completion.verifiedAt)
          .map((completion) => completion.moduleKey),
      );
      const missingModules = REQUIRED_IN_HOUSE_TRAINING_MODULES.filter(
        (moduleKey) => !verifiedModules.has(moduleKey),
      );
      if (missingModules.length > 0) {
        throw ApiError.forbidden(
          'Every RiderGuy training module must be completed and verified before registering interest.',
          'ASSET_FINANCING_TRAINING_REQUIRED',
        );
      }

      const contactEmail = rider.user.email?.trim().toLowerCase();
      if (!contactEmail || !rider.user.emailVerified) {
        throw ApiError.forbidden(
          'Verify your RiderGuy account email before registering asset-financing interest.',
          'ASSET_FINANCING_VERIFIED_EMAIL_REQUIRED',
        );
      }

      const notes = normalizedNotes(input.notes);
      const current = rider.assetFinancingInterest;

      if (!current) {
        const interest = await tx.assetFinancingInterest.create({
          data: {
            riderId: rider.id,
            assetType: input.assetType,
            contactEmail,
            notes,
          },
          select: RIDER_INTEREST_SELECT,
        });
        return { interest, outcome: 'CREATED' as const };
      }

      if (CLOSED_STATUSES.has(current.status)) {
        const interest = await tx.assetFinancingInterest.update({
          where: { id: current.id },
          data: {
            assetType: input.assetType,
            contactEmail,
            notes,
            status: 'SUBMITTED',
            submittedAt: new Date(),
            reviewNotes: null,
            reviewedAt: null,
            reviewedById: null,
          },
          select: RIDER_INTEREST_SELECT,
        });
        return { interest, outcome: 'RESUBMITTED' as const };
      }

      // Once review has started (or an interest is approved), a duplicate POST
      // is a read of the existing state rather than an implicit application edit.
      if (current.status !== 'SUBMITTED') {
        return { interest: current, outcome: 'UNCHANGED' as const };
      }

      if (
        current.assetType === input.assetType
        && current.contactEmail === contactEmail
        && current.notes === notes
      ) {
        return { interest: current, outcome: 'UNCHANGED' as const };
      }

      const interest = await tx.assetFinancingInterest.update({
        where: { id: current.id },
        data: { assetType: input.assetType, contactEmail, notes },
        select: RIDER_INTEREST_SELECT,
      });
      return { interest, outcome: 'UPDATED' as const };
    });
  }

  static async updateStatus(
    interestId: string,
    reviewerUserId: string,
    input: UpdateAssetFinancingInterestStatusInput,
    auditContext?: AdminAuditContext,
  ) {
    const reviewNotes = normalizedNotes(input.reviewNotes);
    if (input.status === 'DECLINED' && (!reviewNotes || reviewNotes.length < 3)) {
      throw ApiError.badRequest(
        'Review notes of at least 3 characters are required when declining an interest.',
        'ASSET_FINANCING_DECLINE_REASON_REQUIRED',
      );
    }

    return prisma.$transaction(async (tx) => {
      // Resolve the same immutable account identity used by Rider submissions,
      // then serialize both Rider and admin writes on one cross-instance lock.
      const identity = await tx.assetFinancingInterest.findUnique({
        where: { id: interestId },
        select: { rider: { select: { userId: true } } },
      });
      if (!identity) throw ApiError.notFound('Asset-financing interest not found');

      await acquireTransactionAdvisoryLock(
        tx,
        'asset-financing-interest',
        identity.rider.userId,
      );

      // Re-read only after acquiring the lock. The row may have been
      // resubmitted or removed while this request waited.
      const current = await tx.assetFinancingInterest.findUnique({
        where: { id: interestId },
        select: { id: true, status: true, updatedAt: true },
      });
      if (!current) throw ApiError.notFound('Asset-financing interest not found');

      if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
        throw ApiError.conflict(
          'This asset-financing request changed after it was loaded. Refresh it before reviewing.',
          'ASSET_FINANCING_STALE_REVIEW',
        );
      }

      if (!ALLOWED_STATUS_TRANSITIONS[current.status].includes(input.status)) {
        throw ApiError.conflict(
          `Cannot change an asset-financing request from ${current.status} to ${input.status}.`,
          'ASSET_FINANCING_INVALID_TRANSITION',
        );
      }

      const resetReview = input.status === 'SUBMITTED';
      const updated = await tx.assetFinancingInterest.updateMany({
        where: {
          id: interestId,
          status: current.status,
          updatedAt: current.updatedAt,
        },
        data: {
          status: input.status,
          reviewNotes: resetReview ? null : reviewNotes,
          reviewedAt: resetReview ? null : new Date(),
          reviewedById: resetReview ? null : reviewerUserId,
        },
      });
      if (updated.count !== 1) {
        throw ApiError.conflict(
          'This asset-financing request changed during review. Refresh it and try again.',
          'ASSET_FINANCING_STALE_REVIEW',
        );
      }

      const reviewed = await tx.assetFinancingInterest.findUnique({
        where: { id: interestId },
        select: ADMIN_INTEREST_SELECT,
      });
      if (!reviewed) {
        throw ApiError.conflict(
          'This asset-financing request was removed during review.',
          'ASSET_FINANCING_STALE_REVIEW',
        );
      }
      await AdminAuditService.record({
        actorUserId: reviewerUserId,
        ipAddress: auditContext?.ipAddress,
        userAgent: auditContext?.userAgent,
        action: `asset_financing.status_${input.status.toLowerCase()}`,
        entityType: 'AssetFinancingInterest',
        entityId: interestId,
        oldData: { status: current.status, updatedAt: current.updatedAt },
        newData: {
          riderUserId: identity.rider.userId,
          status: reviewed.status,
          reviewNotes: reviewed.reviewNotes,
          reviewedAt: reviewed.reviewedAt,
          reviewedById: reviewed.reviewedById,
        },
      }, tx);
      return reviewed;
    });
  }
}
