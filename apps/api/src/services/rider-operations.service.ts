import type { Prisma } from '@prisma/client';
import { prisma } from '@riderguy/database';
import type { ListRiderOperationsCasesQuery } from '@riderguy/validators';
import { ApiError } from '../lib/api-error';
import { REQUIRED_IN_HOUSE_TRAINING_MODULES } from './onboarding.service';

const REQUIRED_DOCUMENT_TYPES = ['NATIONAL_ID', 'DRIVERS_LICENSE', 'SELFIE'] as const;

const approvedVehicleWhere: Prisma.VehicleWhereInput = {
  reviewStatus: 'APPROVED',
  photoFrontUrl: { not: null },
  photoBackUrl: { not: null },
  photoLeftUrl: { not: null },
  photoRightUrl: { not: null },
};

const readyForActivationWhere: Prisma.RiderProfileWhereInput = {
  onboardingStatus: { not: 'ACTIVATED' },
  riderChannel: { not: null },
  user: {
    documents: {
      every: {},
    },
  },
  AND: [
    ...REQUIRED_DOCUMENT_TYPES.map((type) => ({
      user: { documents: { some: { type, status: 'APPROVED' as const } } },
    })),
    { vehicles: { some: approvedVehicleWhere } },
    {
      OR: [
        { riderChannel: 'GUEST' },
        {
          riderChannel: 'IN_HOUSE',
          AND: REQUIRED_IN_HOUSE_TRAINING_MODULES.map((moduleKey) => ({
            trainingCompletions: { some: { moduleKey, verifiedAt: { not: null } } },
          })),
        },
      ],
    },
  ],
};

const reviewableVehicleWhere: Prisma.VehicleWhereInput = {
  reviewStatus: 'PENDING',
  photoFrontUrl: { not: null },
  photoBackUrl: { not: null },
  photoLeftUrl: { not: null },
  photoRightUrl: { not: null },
};

const actionRequiredWhere: Prisma.RiderProfileWhereInput = {
  onboardingStatus: { not: 'ACTIVATED' },
  OR: [
    { riderChannel: null },
    { user: { documents: { some: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } } } },
    { vehicles: { some: reviewableVehicleWhere } },
    { trainingCompletions: { some: { verifiedAt: null } } },
  ],
};

const caseInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      avatarUrl: true,
      status: true,
      phoneVerified: true,
      emailVerified: true,
      ghanaCardNumber: true,
      lastLoginAt: true,
      createdAt: true,
      documents: { orderBy: { createdAt: 'desc' as const } },
    },
  },
  vehicles: {
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'desc' as const }],
    include: {
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  trainingCompletions: { orderBy: { moduleKey: 'asc' as const } },
  assetFinancingInterest: {
    include: {
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  channelInvitation: {
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  applicationReviewedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  _count: { select: { ordersAsRider: true, cancellationRecords: true } },
} satisfies Prisma.RiderProfileInclude;

type RiderCase = Prisma.RiderProfileGetPayload<{ include: typeof caseInclude }>;

function hasRequiredVehiclePhotos(vehicle: RiderCase['vehicles'][number]) {
  return Boolean(
    vehicle.photoFrontUrl
    && vehicle.photoBackUrl
    && vehicle.photoLeftUrl
    && vehicle.photoRightUrl,
  );
}

function latestDocuments(rider: RiderCase) {
  const latest = new Map<string, RiderCase['user']['documents'][number]>();
  for (const document of rider.user.documents) {
    if (!latest.has(document.type)) latest.set(document.type, document);
  }
  return latest;
}

export function describeRiderReadiness(rider: RiderCase) {
  const latest = latestDocuments(rider);
  const missing: string[] = [];
  if (!rider.riderChannel) missing.push('Rider channel is not authorized');
  for (const type of REQUIRED_DOCUMENT_TYPES) {
    if (latest.get(type)?.status !== 'APPROVED') {
      missing.push(`${type.replace(/_/g, ' ')} is not approved`);
    }
  }
  const approvedVehicles = rider.vehicles.filter((vehicle) => vehicle.reviewStatus === 'APPROVED');
  if (rider.vehicles.length === 0) missing.push('No delivery vehicle is registered');
  else if (approvedVehicles.length === 0) missing.push('No delivery vehicle has been approved');
  if (approvedVehicles.length > 0 && !approvedVehicles.some(hasRequiredVehiclePhotos)) {
    missing.push('An approved vehicle is missing required photos');
  }
  if (rider.riderChannel === 'IN_HOUSE') {
    const verified = new Set(
      rider.trainingCompletions.filter((item) => item.verifiedAt).map((item) => item.moduleKey),
    );
    for (const moduleKey of REQUIRED_IN_HOUSE_TRAINING_MODULES) {
      if (!verified.has(moduleKey)) {
        missing.push(`${moduleKey.replace(/_/g, ' ')} is not admin-verified`);
      }
    }
  }
  return { ready: missing.length === 0, missing };
}

function queueWhere(queue: ListRiderOperationsCasesQuery['queue']): Prisma.RiderProfileWhereInput {
  switch (queue) {
    case 'PENDING':
      return { onboardingStatus: { not: 'ACTIVATED' } };
    case 'ACTION_REQUIRED':
      return actionRequiredWhere;
    case 'READY':
      return readyForActivationWhere;
    case 'BLOCKED':
      return {
        onboardingStatus: { notIn: ['ACTIVATED', 'APPLICATION_REJECTED'] },
        AND: [{ NOT: readyForActivationWhere }, { NOT: actionRequiredWhere }],
      };
    case 'REJECTED':
      return { onboardingStatus: 'APPLICATION_REJECTED' };
    case 'ACTIVATED':
      return { onboardingStatus: 'ACTIVATED' };
    default:
      return {};
  }
}

function summarizeCase(rider: RiderCase) {
  const latest = latestDocuments(rider);
  const requiredDocuments = REQUIRED_DOCUMENT_TYPES.map((type) => latest.get(type)).filter(Boolean);
  const pendingDocuments = requiredDocuments.filter((document) => (
    document?.status === 'PENDING' || document?.status === 'UNDER_REVIEW'
  )).length;
  const approvedDocuments = requiredDocuments.filter((document) => document?.status === 'APPROVED').length;
  const reviewableVehicles = rider.vehicles.filter((vehicle) => (
    vehicle.reviewStatus === 'PENDING' && hasRequiredVehiclePhotos(vehicle)
  )).length;
  const approvedVehicles = rider.vehicles.filter((vehicle) => vehicle.reviewStatus === 'APPROVED').length;
  const trainingAwaitingVerification = rider.trainingCompletions.filter((item) => !item.verifiedAt).length;
  const readiness = describeRiderReadiness(rider);
  const nextAction = readiness.ready
    ? 'Approve and activate Rider'
    : pendingDocuments > 0
      ? `Review ${pendingDocuments} required document${pendingDocuments === 1 ? '' : 's'}`
      : reviewableVehicles > 0
        ? `Review ${reviewableVehicles} vehicle${reviewableVehicles === 1 ? '' : 's'}`
        : trainingAwaitingVerification > 0
          ? `Verify ${trainingAwaitingVerification} training module${trainingAwaitingVerification === 1 ? '' : 's'}`
          : !rider.riderChannel
            ? 'Resolve Rider channel authorization'
            : readiness.missing[0] ?? 'Review application';

  return {
    id: rider.id,
    userId: rider.userId,
    onboardingStatus: rider.onboardingStatus,
    riderChannel: rider.riderChannel,
    requestedRiderChannel: rider.requestedRiderChannel,
    channelVerifiedAt: rider.channelVerifiedAt,
    referralCode: rider.referralCode,
    applicationRejectionReason: rider.applicationRejectionReason,
    applicationReviewedAt: rider.applicationReviewedAt,
    user: {
      id: rider.user.id,
      firstName: rider.user.firstName,
      lastName: rider.user.lastName,
      phone: rider.user.phone,
      email: rider.user.email,
      avatarUrl: rider.user.avatarUrl,
      status: rider.user.status,
      phoneVerified: rider.user.phoneVerified,
      emailVerified: rider.user.emailVerified,
      createdAt: rider.user.createdAt,
      lastLoginAt: rider.user.lastLoginAt,
    },
    evidence: {
      requiredDocuments: REQUIRED_DOCUMENT_TYPES.length,
      approvedDocuments,
      pendingDocuments,
      registeredVehicles: rider.vehicles.length,
      approvedVehicles,
      reviewableVehicles,
      trainingCompleted: rider.trainingCompletions.length,
      trainingVerified: rider.trainingCompletions.filter((item) => item.verifiedAt).length,
      trainingAwaitingVerification,
    },
    readiness,
    approvalReadiness: readiness,
    nextAction,
    lastActivityAt: rider.updatedAt,
  };
}

export class RiderOperationsService {
  static async getSummary() {
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
    const [
      totalRiders,
      pendingCases,
      readyForActivation,
      rejectedCases,
      activatedRiders,
      unclassifiedChannels,
      pendingDocuments,
      pendingVehicles,
      incompleteVehicleEvidence,
      trainingAwaitingVerification,
      financingAwaitingReview,
      activeInvitations,
      staleCases,
    ] = await Promise.all([
      prisma.riderProfile.count(),
      prisma.riderProfile.count({ where: { onboardingStatus: { not: 'ACTIVATED' } } }),
      prisma.riderProfile.count({ where: readyForActivationWhere }),
      prisma.riderProfile.count({ where: { onboardingStatus: 'APPLICATION_REJECTED' } }),
      prisma.riderProfile.count({ where: { onboardingStatus: 'ACTIVATED' } }),
      prisma.riderProfile.count({ where: { riderChannel: null } }),
      prisma.document.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
      prisma.vehicle.count({ where: reviewableVehicleWhere }),
      prisma.vehicle.count({
        where: {
          reviewStatus: 'PENDING',
          OR: [
            { photoFrontUrl: null }, { photoBackUrl: null },
            { photoLeftUrl: null }, { photoRightUrl: null },
          ],
        },
      }),
      prisma.riderTrainingCompletion.count({ where: { verifiedAt: null } }),
      prisma.assetFinancingInterest.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      prisma.riderInvitation.count({ where: { usedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
      prisma.riderProfile.count({
        where: {
          onboardingStatus: { notIn: ['ACTIVATED', 'APPLICATION_REJECTED'] },
          updatedAt: { lt: fortyEightHoursAgo },
        },
      }),
    ]);

    return {
      totalRiders,
      pendingCases,
      readyForActivation,
      rejectedCases,
      activatedRiders,
      unclassifiedChannels,
      evidenceQueues: {
        documents: pendingDocuments,
        vehicles: pendingVehicles,
        incompleteVehicleEvidence,
        training: trainingAwaitingVerification,
        assetFinancing: financingAwaitingReview,
      },
      activeInvitations,
      staleCases,
      generatedAt: now,
    };
  }

  static async listCases(query: ListRiderOperationsCasesQuery) {
    const filters: Prisma.RiderProfileWhereInput[] = [queueWhere(query.queue)];
    if (query.status) filters.push({ onboardingStatus: query.status });
    if (query.channel === 'UNCLASSIFIED') filters.push({ riderChannel: null });
    else if (query.channel) filters.push({ riderChannel: query.channel });
    if (query.search) {
      filters.push({
        OR: [
          { referralCode: { contains: query.search, mode: 'insensitive' } },
          { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
          { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
          { user: { phone: { contains: query.search } } },
          { user: { email: { contains: query.search, mode: 'insensitive' } } },
          { vehicles: { some: { plateNumber: { contains: query.search, mode: 'insensitive' } } } },
        ],
      });
    }
    const where: Prisma.RiderProfileWhereInput = { AND: filters };
    const skip = (query.page - 1) * query.limit;
    const [cases, total] = await Promise.all([
      prisma.riderProfile.findMany({
        where,
        include: caseInclude,
        orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: query.limit,
      }),
      prisma.riderProfile.count({ where }),
    ]);
    return {
      items: cases.map(summarizeCase),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  static async getCase(userId: string) {
    const rider = await prisma.riderProfile.findUnique({ where: { userId }, include: caseInclude });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const reviewerIds = [...new Set([
      ...rider.user.documents.flatMap((document) => document.reviewedBy ? [document.reviewedBy] : []),
      ...rider.trainingCompletions.flatMap((completion) => completion.verifiedById ? [completion.verifiedById] : []),
    ])];
    const reviewers = reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const reviewerMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));

    return {
      ...summarizeCase(rider),
      profile: {
        id: rider.id,
        referralCode: rider.referralCode,
        availability: rider.availability,
        isVerified: rider.isVerified,
        activatedAt: rider.activatedAt,
        applicationReviewedAt: rider.applicationReviewedAt,
        applicationReviewedBy: rider.applicationReviewedBy,
        totalDeliveries: rider.totalDeliveries,
        averageRating: rider.averageRating,
        cancellationCount: rider.cancellationCount,
        suspendedUntil: rider.suspendedUntil,
      },
      identity: {
        phoneVerified: rider.user.phoneVerified,
        emailVerified: rider.user.emailVerified,
        ghanaCardOnFile: Boolean(rider.user.ghanaCardNumber),
      },
      documents: rider.user.documents.map((document) => ({
        ...document,
        reviewer: document.reviewedBy ? reviewerMap.get(document.reviewedBy) ?? null : null,
      })),
      vehicles: rider.vehicles,
      trainingCompletions: rider.trainingCompletions.map((completion) => ({
        ...completion,
        reviewer: completion.verifiedById ? reviewerMap.get(completion.verifiedById) ?? null : null,
      })),
      assetFinancingInterest: rider.assetFinancingInterest,
      channelInvitation: rider.channelInvitation,
      activity: {
        completedOrders: rider._count.ordersAsRider,
        cancellationRecords: rider._count.cancellationRecords,
      },
    };
  }
}
