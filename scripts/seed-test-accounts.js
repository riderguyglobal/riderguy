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

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const REVIEW_PASSWORD = process.env.PLAY_REVIEW_PASSWORD || 'Test1234';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const passwordHash = await bcrypt.hash(REVIEW_PASSWORD, 12);

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

main()
  .catch((error) => {
    console.error('Failed to ensure Play reviewer accounts:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
