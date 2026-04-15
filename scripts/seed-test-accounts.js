/**
 * Seed Test Accounts
 * 
 * Deletes ALL data from ALL tables and creates exactly 2 test accounts:
 *   - Rider: rider@test.com / password: Test1234
 *   - Client: client@test.com / password: Test1234
 *
 * Usage: node scripts/seed-test-accounts.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Use DATABASE_URL for direct PostgreSQL connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🗑️  Deleting ALL data from every table...\n');

  // Delete in strict dependency order (children → parents)
  // Using Prisma model names (camelCase) matching schema.prisma exactly
  const tables = [
    // Community / gamification children first
    'featureRequestUpvote', 'featureRequest',
    'riderSpotlight',
    'eventRsvp', 'event',
    'pollVote', 'pollOption', 'poll',
    'contentReport', 'announcement',
    'forumVote', 'forumComment', 'forumPost',
    'mentorCheckIn', 'mentorship',
    'chatMessage', 'chatMember', 'chatRoom',
    // Gamification
    'bonusXpEvent',
    'rewardRedemption', 'rewardStoreItem',
    'challengeParticipant', 'challenge',
    'riderBadge', 'badge', 'riderStreak', 'xpEvent',
    // Notifications
    'notification', 'pushToken',
    // Finance
    'transaction', 'withdrawal', 'wallet',
    // Cancellation
    'cancellationAppeal', 'cancellationRequest', 'cancellationRecord',
    // Orders
    'locationHistory', 'orderMessage', 'orderStatusHistory',
    'orderStop', 'scheduledDelivery', 'order',
    // Promo
    'promoCodeUsage', 'promoCode',
    // Geo / analytics
    'etaCorrectionFactor', 'locationPopularity', 'communityPlace',
    // Audit
    'auditLog',
    // Partners
    'partnerRecruitment', 'partnerProfile',
    // Vehicles & docs
    'vehicle', 'document',
    // Profiles
    'apiKey', 'businessAccount',
    'favoriteRider', 'savedAddress',
    'riderProfile', 'clientProfile',
    // Auth
    'webAuthnChallenge', 'webAuthnCredential',
    'emailToken', 'session', 'otp',
    // User last (everything references it)
    'user',
    // Zones are independent — keep them for pricing
    // 'zone',  // Intentionally kept
  ];

  for (const table of tables) {
    try {
      const result = await prisma[table]?.deleteMany({});
      if (result?.count > 0) {
        console.log(`  Deleted ${result.count} ${table} records`);
      }
    } catch (e) {
      // Table may not exist in this schema version — skip
    }
  }

  console.log('\n✅ All data deleted. Zones preserved for pricing.\n');

  // Hash password
  const passwordHash = await bcrypt.hash('Test1234', 12);

  // Create RIDER account
  console.log('👤 Creating RIDER account...');
  const rider = await prisma.user.create({
    data: {
      phone: '+233200000001',
      email: 'rider@test.com',
      firstName: 'Test',
      lastName: 'Rider',
      passwordHash,
      role: 'RIDER',
      phoneVerified: true,
      emailVerified: true,
      status: 'ACTIVE',
    },
  });

  await prisma.riderProfile.create({
    data: { userId: rider.id, onboardingStatus: 'ACTIVATED' },
  });

  await prisma.wallet.create({
    data: { userId: rider.id },
  });

  console.log(`  ✅ Rider created: ${rider.id}`);
  console.log(`     Email: rider@test.com`);
  console.log(`     Phone: +233200000001`);
  console.log(`     Password: Test1234\n`);

  // Create CLIENT account
  console.log('👤 Creating CLIENT account...');
  const client = await prisma.user.create({
    data: {
      phone: '+233200000002',
      email: 'client@test.com',
      firstName: 'Test',
      lastName: 'Client',
      passwordHash,
      role: 'CLIENT',
      phoneVerified: true,
      emailVerified: true,
      status: 'ACTIVE',
    },
  });

  await prisma.clientProfile.create({
    data: { userId: client.id },
  });

  await prisma.wallet.create({
    data: { userId: client.id },
  });

  console.log(`  ✅ Client created: ${client.id}`);
  console.log(`     Email: client@test.com`);
  console.log(`     Phone: +233200000002`);
  console.log(`     Password: Test1234\n`);

  console.log('═══════════════════════════════════════════');
  console.log('  TEST ACCOUNTS READY');
  console.log('═══════════════════════════════════════════');
  console.log('  RIDER APP  → Email: rider@test.com');
  console.log('  CLIENT APP → Email: client@test.com');
  console.log('  Password for both: Test1234');
  console.log('═══════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
