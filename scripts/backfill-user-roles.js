/**
 * backfill-user-roles.js
 *
 * Idempotent data migration script to populate the `roles` array column
 * from the legacy `role` scalar on all existing users.
 *
 * Usage: node scripts/backfill-user-roles.js
 * Requires DATABASE_URL env var.
 */

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find users with empty roles array
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { roles: { isEmpty: true } },
          { roles: { equals: [] } },
        ],
      },
      select: { id: true, role: true },
    });

    console.log(`Found ${users.length} users needing roles backfill`);

    let updated = 0;
    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roles: [user.role] },
      });
      updated++;
      if (updated % 100 === 0) {
        console.log(`  ... ${updated}/${users.length} updated`);
      }
    }

    console.log(`Done! Updated ${updated} users.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
