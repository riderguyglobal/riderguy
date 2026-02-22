import { Queue } from 'bullmq';
import { config } from '../config';
import { logger } from '../lib/logger';

// ============================================================
// BullMQ Job Queue Infrastructure — Sprint 6
//
// Processors: payout processing, receipt generation,
// commission crediting, and scheduled withdrawals.
// ============================================================

// ── Parse Redis URL into ioredis-compatible connection options ──

function parseRedisUrl(url: string): Record<string, unknown> {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1)) || 0 : 0,
      maxRetriesPerRequest: null, // Required by BullMQ
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    // Fallback for simple host:port or localhost
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

const redisConnection = parseRedisUrl(config.redis.url);

// ── Queue definitions ──

export const payoutQueue = new Queue('payouts', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

export const receiptQueue = new Queue('receipts', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
  },
});

export const commissionQueue = new Queue('commissions', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

// ── Job data interfaces ──

export interface PayoutJobData {
  withdrawalId: string;
  userId: string;
  amount: number;
  method: string;
  destination: string;
  destinationName: string;
  bankCode?: string;
}

export interface ReceiptJobData {
  orderId: string;
  clientId: string;
  orderNumber: string;
  totalPrice: number;
  currency: string;
}

export interface CommissionJobData {
  orderId: string;
  riderId: string;
  riderUserId: string;
  orderAmount: number;
  commissionRate: number;
  platformCommission: number;
}

// ── Queue helper functions ──

export async function enqueuePayoutJob(data: PayoutJobData): Promise<void> {
  await payoutQueue.add('process-payout', data, {
    jobId: `payout-${data.withdrawalId}`,
  });
  logger.info({ withdrawalId: data.withdrawalId }, 'Payout job enqueued');
}

export async function enqueueReceiptJob(data: ReceiptJobData): Promise<void> {
  await receiptQueue.add('generate-receipt', data, {
    jobId: `receipt-${data.orderId}`,
  });
  logger.info({ orderId: data.orderId }, 'Receipt generation job enqueued');
}

export async function enqueueCommissionJob(data: CommissionJobData): Promise<void> {
  await commissionQueue.add('credit-commission', data, {
    jobId: `commission-${data.orderId}`,
  });
  logger.info({ orderId: data.orderId }, 'Commission tracking job enqueued');
}

// ── Get queue stats for admin dashboard ──

export async function getQueueStats() {
  const [payoutCounts, receiptCounts, commissionCounts] = await Promise.all([
    payoutQueue.getJobCounts(),
    receiptQueue.getJobCounts(),
    commissionQueue.getJobCounts(),
  ]);

  return {
    payouts: payoutCounts,
    receipts: receiptCounts,
    commissions: commissionCounts,
  };
}
