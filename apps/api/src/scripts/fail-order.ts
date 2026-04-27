// ============================================================
// One-off admin script: mark a specific order as FAILED.
//
// Usage (from apps/api):
//   node dist/scripts/fail-order.js <orderId> "<reason>"
//
// Goes through `failOrderAsStuck()` so it produces a proper
// orderStatusHistory entry, fires socket updates, releases the
// rider's availability, and notifies client + rider.
//
// Only allowed for orders currently in AT_PICKUP / PICKED_UP /
// IN_TRANSIT / AT_DROPOFF — the helper rejects anything else.
// ============================================================

import { prisma } from '@riderguy/database';
import { failOrderAsStuck } from '../services/order-reassign.service';
import { logger } from '../lib/logger';

async function main() {
  const orderId = process.argv[2];
  const reason = process.argv[3];

  if (!orderId || !reason) {
    console.error('Usage: node dist/scripts/fail-order.js <orderId> "<reason>"');
    process.exit(2);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderNumber: true, status: true,
      clientId: true, riderId: true, createdAt: true,
    },
  });

  if (!order) {
    console.error(`Order ${orderId} not found`);
    process.exit(1);
  }

  console.log('--- order before ---');
  console.log(JSON.stringify(order, null, 2));

  const ok = await failOrderAsStuck(orderId, reason, 'admin');

  if (!ok) {
    console.error('failOrderAsStuck returned false — order not in failable status or update failed');
    process.exit(1);
  }

  const after = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true, failureReason: true, cancelledAt: true },
  });
  console.log('--- order after ---');
  console.log(JSON.stringify(after, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, 'fail-order script crashed');
  console.error(err);
  process.exit(1);
});
