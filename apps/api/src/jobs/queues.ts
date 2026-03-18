import { Queue } from 'bullmq';
import { config } from '../config';
import { logger } from '../lib/logger';

// ============================================================
// BullMQ Job Queue Infrastructure — Sprint 6
//
// Redis is OPTIONAL — if REDIS_URL is not set, queues are
// disabled and enqueue calls become safe no-ops.
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
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

// ── Only enable when REDIS_URL is explicitly set ──

function isRedisConfigured(): boolean {
  const url = config.redis.url;
  if (config.nodeEnv === 'production' && (!url || url === 'redis://localhost:6379')) {
    return false;
  }
  return true;
}

export const redisEnabled = isRedisConfigured();

let payoutQueue: Queue | null = null;
let receiptQueue: Queue | null = null;
let commissionQueue: Queue | null = null;
let pushQueue: Queue | null = null;

if (redisEnabled) {
  const redisConnection = parseRedisUrl(config.redis.url);

  payoutQueue = new Queue('payouts', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  });

  receiptQueue = new Queue('receipts', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    },
  });

  commissionQueue = new Queue('commissions', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  });

  pushQueue = new Queue('push-notifications', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    },
  });

  logger.info('BullMQ queues initialized (Redis connected)');
} else {
  logger.warn('Redis not configured — BullMQ queues disabled. Set REDIS_URL to enable.');
}

export { payoutQueue, receiptQueue, commissionQueue, pushQueue };

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

export interface PushJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

// ── Queue helpers — safe no-ops when Redis is not configured ──

export async function enqueuePayoutJob(data: PayoutJobData): Promise<void> {
  if (!payoutQueue) {
    logger.warn({ withdrawalId: data.withdrawalId }, 'Payout job skipped — Redis not configured');
    return;
  }
  await payoutQueue.add('process-payout', data, {
    jobId: `payout-${data.withdrawalId}`,
  });
  logger.info({ withdrawalId: data.withdrawalId }, 'Payout job enqueued');
}

export async function enqueueReceiptJob(data: ReceiptJobData): Promise<void> {
  if (!receiptQueue) {
    logger.warn({ orderId: data.orderId }, 'Receipt job skipped — Redis not configured');
    return;
  }
  await receiptQueue.add('generate-receipt', data, {
    jobId: `receipt-${data.orderId}`,
  });
  logger.info({ orderId: data.orderId }, 'Receipt generation job enqueued');
}

export async function enqueueCommissionJob(data: CommissionJobData): Promise<void> {
  if (!commissionQueue) {
    logger.warn({ orderId: data.orderId }, 'Commission job skipped — Redis not configured');
    return;
  }
  await commissionQueue.add('credit-commission', data, {
    jobId: `commission-${data.orderId}`,
  });
  logger.info({ orderId: data.orderId }, 'Commission tracking job enqueued');
}

export async function enqueuePushJob(data: PushJobData): Promise<void> {
  if (!pushQueue) {
    // Fallback: fire-and-forget direct send when Redis is unavailable
    try {
      const { PushService } = await import('../services/push.service');
      await PushService.sendToUser(data.userId, data.title, data.body, data.data);
    } catch {}
    return;
  }
  await pushQueue.add('send-push', data);
  logger.info({ userId: data.userId, title: data.title }, 'Push notification job enqueued');
}

// ── Get queue stats for admin dashboard ──

export async function getQueueStats() {
  if (!payoutQueue || !receiptQueue || !commissionQueue) {
    return { payouts: null, receipts: null, commissions: null, pushNotifications: null, redisEnabled: false };
  }

  const [payoutCounts, receiptCounts, commissionCounts, pushCounts] = await Promise.all([
    payoutQueue.getJobCounts(),
    receiptQueue.getJobCounts(),
    commissionQueue.getJobCounts(),
    pushQueue?.getJobCounts() ?? Promise.resolve(null),
  ]);

  return {
    payouts: payoutCounts,
    receipts: receiptCounts,
    commissions: commissionCounts,
    pushNotifications: pushCounts,
    redisEnabled: true,
  };
}
