/**
 * Ensure the dedicated Google Play reviewer accounts exist.
 *
 * This script is intentionally non-destructive and idempotent. It only creates
 * or repairs the two reserved reviewer accounts and their required profiles.
 * No unrelated users or application data are deleted.
 *
 * Usage: node scripts/seed-test-accounts.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

let prisma = null;

const REVIEWER_EVIDENCE_URL = 'https://myriderguy.com/images/new/Display%20of%20Fleet.png';
const REVIEWER_REQUIRED_DOCUMENTS = [
  {
    id: 'play-reviewer-rider-document-national-id-v1',
    type: 'NATIONAL_ID',
    fileName: 'play-reviewer-synthetic-national-id.png',
  },
  {
    id: 'play-reviewer-rider-document-drivers-license-v1',
    type: 'DRIVERS_LICENSE',
    fileName: 'play-reviewer-synthetic-drivers-license.png',
  },
  {
    id: 'play-reviewer-rider-document-selfie-v1',
    type: 'SELFIE',
    fileName: 'play-reviewer-synthetic-selfie.png',
  },
];

function resolveReviewerPassword(environment = process.env) {
  const configuredPassword = environment.PLAY_REVIEW_PASSWORD;
  if (typeof configuredPassword === 'string' && configuredPassword.trim()) {
    return configuredPassword;
  }
  if (environment.NODE_ENV === 'production') {
    throw new Error('PLAY_REVIEW_PASSWORD is required when NODE_ENV=production');
  }
  return 'Test1234';
}

/**
 * Keep only the dedicated Play reviewer fixture work-eligible. We never delete
 * or rewrite other evidence: a deterministic synthetic record is moved after
 * the newest record for each required type and approved. This matters because
 * Rider compliance deliberately evaluates the latest evidence, not merely any
 * historical approval.
 */
async function ensureApprovedReviewerDocuments(tx, userId, now = new Date()) {
  for (const evidence of REVIEWER_REQUIRED_DOCUMENTS) {
    const [fixture, latest] = await Promise.all([
      tx.document.findUnique({
        where: { id: evidence.id },
        select: { id: true, userId: true, type: true, status: true, createdAt: true },
      }),
      tx.document.findFirst({
        where: { userId, type: evidence.type },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, createdAt: true },
      }),
    ]);

    if (fixture && (fixture.userId !== userId || fixture.type !== evidence.type)) {
      throw new Error(`Reserved Play reviewer document ID collision: ${evidence.id}`);
    }

    const latestTime = latest?.createdAt ? new Date(latest.createdAt).getTime() : 0;
    const fixtureIsLatest = fixture?.id === latest?.id;
    const createdAt = fixtureIsLatest
      ? new Date(fixture.createdAt)
      : new Date(Math.max(now.getTime(), latestTime + 1));
    const approvedData = {
      fileUrl: REVIEWER_EVIDENCE_URL,
      fileName: evidence.fileName,
      fileSizeBytes: 2510676,
      mimeType: 'image/png',
      status: 'APPROVED',
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: now,
      expiresAt: null,
      createdAt,
    };

    if (fixture) {
      await tx.document.update({ where: { id: evidence.id }, data: approvedData });
    } else {
      await tx.document.create({
        data: {
          id: evidence.id,
          userId,
          type: evidence.type,
          ...approvedData,
        },
      });
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const reviewPassword = resolveReviewerPassword(process.env);
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  const passwordHash = await bcrypt.hash(reviewPassword, 12);

  const accounts = await prisma.$transaction(async (tx) => {
    const rider = await tx.user.upsert({
      where: { email: 'rider@test.com' },
      create: {
        phone: '+233200000001',
        email: 'rider@test.com',
        firstName: 'Play',
        lastName: 'Reviewer Rider',
        passwordHash,
        role: 'RIDER',
        roles: ['RIDER'],
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
      },
      update: {
        firstName: 'Play',
        lastName: 'Reviewer Rider',
        passwordHash,
        role: 'RIDER',
        roles: ['RIDER'],
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
        deletedAt: null,
      },
    });

    const riderProfile = await tx.riderProfile.upsert({
      where: { userId: rider.id },
      create: {
        userId: rider.id,
        referralCode: 'RGR-PLAY-TEST',
        riderChannel: 'GUEST',
        requestedRiderChannel: 'GUEST',
        channelVerifiedAt: new Date(),
        onboardingStatus: 'ACTIVATED',
        isVerified: true,
        activatedAt: new Date(),
      },
      update: {
        riderChannel: 'GUEST',
        requestedRiderChannel: 'GUEST',
        channelVerifiedAt: new Date(),
        onboardingStatus: 'ACTIVATED',
        isVerified: true,
        activatedAt: new Date(),
        availability: 'OFFLINE',
      },
    });

    // Work eligibility requires an approved delivery vehicle. Keep the Play
    // reviewer account fully usable without weakening that production gate.
    await tx.vehicle.updateMany({
      where: { riderId: riderProfile.id, id: { not: 'play-reviewer-rider-vehicle-v1' } },
      data: { isPrimary: false },
    });
    await tx.vehicle.upsert({
      where: { id: 'play-reviewer-rider-vehicle-v1' },
      create: {
        id: 'play-reviewer-rider-vehicle-v1',
        riderId: riderProfile.id,
        type: 'MOTORCYCLE',
        make: 'RiderGuy',
        model: 'Reviewer Bike',
        year: 2026,
        color: 'Green',
        plateNumber: 'RG-PLAY-TEST',
        isPrimary: true,
        isApproved: true,
        reviewStatus: 'APPROVED',
        reviewedAt: new Date(),
        photoFrontUrl: 'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
        photoBackUrl: 'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
        photoLeftUrl: 'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
        photoRightUrl: 'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
      },
      update: {
        riderId: riderProfile.id,
        type: 'MOTORCYCLE',
        make: 'RiderGuy',
        model: 'Reviewer Bike',
        year: 2026,
        color: 'Green',
        plateNumber: 'RG-PLAY-TEST',
        isPrimary: true,
        isApproved: true,
        reviewStatus: 'APPROVED',
        rejectionReason: null,
        reviewedAt: new Date(),
        photoFrontUrl: 'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
        photoBackUrl: 'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
        photoLeftUrl: 'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
        photoRightUrl: 'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
      },
    });

    // The canonical compliance recalculation checks the latest National ID,
    // driver's licence, and selfie. These synthetic records are restricted to
    // the reserved reviewer identity and contain no real person's documents.
    await ensureApprovedReviewerDocuments(tx, rider.id);

    await tx.wallet.upsert({
      where: { userId: rider.id },
      create: { userId: rider.id },
      update: { isActive: true, deletedAt: null },
    });

    const client = await tx.user.upsert({
      where: { email: 'client@test.com' },
      create: {
        phone: '+233200000002',
        email: 'client@test.com',
        firstName: 'Play',
        lastName: 'Reviewer Client',
        passwordHash,
        role: 'CLIENT',
        roles: ['CLIENT'],
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
      },
      update: {
        firstName: 'Play',
        lastName: 'Reviewer Client',
        passwordHash,
        role: 'CLIENT',
        roles: ['CLIENT'],
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
        deletedAt: null,
      },
    });

    await tx.clientProfile.upsert({
      where: { userId: client.id },
      create: { userId: client.id },
      update: {},
    });

    await tx.wallet.upsert({
      where: { userId: client.id },
      create: { userId: client.id, balance: 1000 },
      update: { balance: 1000, isActive: true, deletedAt: null },
    });

    return [
      { app: 'rider', email: rider.email, role: rider.role },
      { app: 'client', email: client.email, role: client.role },
    ];
  });

  for (const account of accounts) {
    console.log(`${account.app}: ${account.email} (${account.role}) ready`);
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Failed to ensure Play reviewer accounts:', error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma?.$disconnect());
}

module.exports = {
  REVIEWER_REQUIRED_DOCUMENTS,
  ensureApprovedReviewerDocuments,
  resolveReviewerPassword,
};
