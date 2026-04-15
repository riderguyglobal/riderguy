require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const result = await p.riderProfile.updateMany({
    data: { onboardingStatus: 'ACTIVATED' },
  });
  console.log('Updated', result.count, 'rider profiles to ACTIVATED');
}

main().catch(console.error).finally(() => p.$disconnect());
