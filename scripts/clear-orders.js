const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all order-related data...\n');

  // Check which tables exist
  const tables = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const tableNames = tables.map(t => t.tablename);
  console.log('Existing tables:', tableNames.join(', '));

  // Delete child records first (respect foreign keys), skip if table doesn't exist
  const deleteOrder = [
    'order_messages',
    'order_status_history',
    'order_stops',
  ];

  for (const table of deleteOrder) {
    if (tableNames.includes(table)) {
      const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
      console.log(`  Deleted ${result} rows from ${table}`);
    } else {
      console.log(`  Skipped ${table} (table does not exist)`);
    }
  }

  // Clear order references in LocationHistory
  if (tableNames.includes('location_history')) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "location_history" SET "orderId" = NULL WHERE "orderId" IS NOT NULL`
    );
    console.log(`  Cleared orderId from ${result} LocationHistory rows`);
  }

  // Clear order references in PromoCodeUsage
  if (tableNames.includes('promo_code_usages')) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "promo_code_usages" SET "orderId" = NULL WHERE "orderId" IS NOT NULL`
    );
    console.log(`  Cleared orderId from ${result} PromoCodeUsage rows`);
  }

  // Now delete all orders
  if (tableNames.includes('orders')) {
    const result = await prisma.$executeRawUnsafe(`DELETE FROM "orders"`);
    console.log(`\n  Deleted ${result} orders`);
  }

  console.log('\nDone! All jobs cleared.');
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
