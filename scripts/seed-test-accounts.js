/**
 * Seed Test Accounts
 * 
 * Deletes ALL data and creates 2 test accounts:
 *   - Rider: rider@test.com / password: Test1234
 *   - Client: client@test.com / password: Test1234
 *
 * Usage: node scripts/seed-test-accounts.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Use the direct URL for migrations/scripts (not pooled)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🗑️  Deleting all existing data...\n');

  // Delete in dependency order (children first)
  const tables = [
    'featureRequestUpvotes', 'featureRequest', 'eventRsvp', 'event',
    'pollVote', 'poll', 'contentReport', 'announcement',
    'forumVote', 'forumComment', 'forumPost', 'forumCategory',
    'chatMessage', 'chatMember', 'chatRoom',
    'notification', 'pushToken',
    'walletAuditEntry', 'withdrawalRequest', 'wallet',
    'orderTimeline', 'orderRating', 'order',
    'scheduledDelivery',
    'vehiclePhoto', 'vehicle',
    'document',
    'riderProfile', 'clientProfile', 'businessAccount', 'partnerProfile',
    'session', 'otp',
    'user',
  ];

  for (const table of tables) {
    try {
      const result = await prisma[table]?.deleteMany({});
      if (result?.count > 0) {
        console.log(`  Deleted ${result.count} ${table} records`);
      }
    } catch (e) {
      // Table may not exist or wrong name — skip silently
    }
  }

  console.log('\n✅ All data deleted.\n');

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
