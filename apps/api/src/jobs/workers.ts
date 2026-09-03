import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../lib/logger';
import { prisma } from '@riderguy/database';
import { processWithdrawalPayout } from '../services/withdrawal-payout.service';
import { EmailService } from '../services/email.service';
import { redisEnabled } from './queues';
import { notifyAdminJobFailure } from './admin-alerts';
import type { PayoutJobData, ReceiptJobData, CommissionJobData, PushJobData } from './queues';

// ============================================================
// BullMQ Workers — Sprint 6
//
// Redis is OPTIONAL — workers are only created when REDIS_URL
// is configured. Without Redis the API still starts normally.
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
      maxRetriesPerRequest: null,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

let payoutWorker: Worker | null = null;
let receiptWorker: Worker | null = null;
let commissionWorker: Worker | null = null;
let pushWorker: Worker | null = null;
let cleanupWorker: Worker | null = null;

// ── Start all workers (only when Redis is configured) ──

export async function startWorkers(): Promise<void> {
  if (!redisEnabled) {
    logger.warn('BullMQ workers NOT started — Redis not configured. Set REDIS_URL to enable.');
    return;
  }

  const redisConnection = parseRedisUrl(config.redis.url);

  // ── Payout Worker ──
  payoutWorker = new Worker(
    'payouts',
    async (job: Job<PayoutJobData>) => {
      const { withdrawalId, amount } = job.data;

      logger.info({ withdrawalId, amount }, 'Processing payout');
      return processWithdrawalPayout({ withdrawalId });
    },
    {
      connection: redisConnection,
      concurrency: 3,
      limiter: { max: 10, duration: 60000 },
    },
  );

  payoutWorker.on('completed', (job: Job) => {
    logger.info({ jobId: job.id }, 'Payout job completed');
  });

  payoutWorker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Payout job failed');
    void notifyAdminJobFailure({
      queueName: 'payouts',
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
      error: err,
    });
  });

  // ── Receipt Worker ──
  receiptWorker = new Worker(
    'receipts',
    async (job: Job<ReceiptJobData>) => {
      const { orderId, orderNumber, totalPrice, currency } = job.data;

      logger.info(
        { orderId, orderNumber, correlationId: (job.data as any).correlationId },
        'Generating delivery receipt',
      );

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          client: { select: { firstName: true, lastName: true, email: true, phone: true } },
          rider: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      });

      if (!order) {
        logger.warn({ orderId }, 'Receipt: order not found');
        return { skipped: true };
      }

      // PAY-07: Idempotency — skip if already sent. Worker retries should not
      //         duplicate emails to the client.
      if (order.receiptEmailSentAt) {
        logger.info(
          { orderId, sentAt: order.receiptEmailSentAt },
          'Receipt already sent — skipping',
        );
        return { skipped: true, reason: 'already_sent' };
      }

      const receiptData = {
        receiptNumber: `RG-${orderNumber}`,
        date: order.deliveredAt ?? order.updatedAt,
        client: {
          name: `${order.client.firstName} ${order.client.lastName}`,
          email: order.client.email,
          phone: order.client.phone,
        },
        rider: order.rider
          ? { name: `${order.rider.user.firstName} ${order.rider.user.lastName}` }
          : null,
        pickup: order.pickupAddress,
        dropoff: order.dropoffAddress,
        packageType: order.packageType,
        distance: `${order.distanceKm.toFixed(1)} km`,
        lineItems: [
          { label: 'Base fare', amount: Number(order.baseFare) },
          { label: 'Distance charge', amount: Number(order.distanceCharge) },
          ...(Number(order.surgeMultiplier) > 1
            ? [{ label: `Surge (${order.surgeMultiplier}x)`, amount: 0 }]
            : []),
          { label: 'Service fee', amount: Number(order.serviceFee) },
          ...(Number(order.tipAmount) > 0
            ? [{ label: 'Tip', amount: Number(order.tipAmount) }]
            : []),
        ],
        total: { amount: totalPrice, currency },
        paymentMethod: order.paymentMethod,
      };

      logger.info(
        { orderId, receiptNumber: receiptData.receiptNumber, total: receiptData.total },
        'Receipt generated',
      );

      // Send receipt email to client
      if (receiptData.client.email) {
        await EmailService.sendDeliveryReceipt(receiptData.client.email, {
          firstName: order.client.firstName,
          orderNumber,
          deliveredAt: receiptData.date
            ? new Date(receiptData.date).toLocaleString('en-GH', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : 'N/A',
          riderName: receiptData.rider?.name ?? 'RiderGuy Driver',
          totalPrice: Number(order.totalPrice),
          tipAmount: Number(order.tipAmount),
          currency,
        });
        // PAY-07: Mark sent only after successful email dispatch.
        await prisma.order.update({
          where: { id: orderId },
          data: { receiptEmailSentAt: new Date() },
        });
      }

      return { receiptNumber: receiptData.receiptNumber };
    },
    {
      connection: redisConnection,
      concurrency: 5,
      // JOB-02: Throttle email throughput to avoid SMTP provider rate-limits.
      limiter: { max: 30, duration: 60_000 },
    },
  );

  receiptWorker.on('completed', (job: Job) => {
    logger.info({ jobId: job.id }, 'Receipt job completed');
  });

  receiptWorker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Receipt job failed');
    void notifyAdminJobFailure({
      queueName: 'receipts',
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
      error: err,
    });
  });

  // ── Commission Tracking Worker ──
  commissionWorker = new Worker(
    'commissions',
    async (job: Job<CommissionJobData>) => {
      const { orderId, riderUserId, orderAmount, commissionRate, platformCommission } = job.data;

      logger.info({ orderId, platformCommission }, 'Recording commission');

      const wallet = await prisma.wallet.findUnique({
        where: { userId: riderUserId },
      });

      if (!wallet) {
        logger.warn({ riderUserId }, 'Commission: wallet not found');
        return { skipped: true };
      }

      const existing = await prisma.transaction.findFirst({
        where: {
          walletId: wallet.id,
          type: 'COMMISSION_DEDUCTION',
          referenceId: orderId,
        },
      });

      if (existing) {
        logger.info({ orderId }, 'Commission already recorded');
        return { skipped: true, reason: 'already_recorded' };
      }

      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'COMMISSION_DEDUCTION',
          amount: -platformCommission,
          balanceAfter: wallet.balance,
          description: `Platform commission (${commissionRate}%) on order total GHS ${orderAmount.toLocaleString()}`,
          referenceId: orderId,
          referenceType: 'order',
          metadata: {
            commissionRate,
            orderAmount,
            platformCommission,
          },
        },
      });

      logger.info({ orderId, commission: platformCommission }, 'Commission tracked');
      return { recorded: true };
    },
    {
      connection: redisConnection,
      concurrency: 5,
      // JOB-02: Cap DB write throughput on commission inserts.
      limiter: { max: 60, duration: 60_000 },
    },
  );

  commissionWorker.on('completed', (job: Job) => {
    logger.info({ jobId: job.id }, 'Commission job completed');
  });

  commissionWorker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Commission job failed');
    void notifyAdminJobFailure({
      queueName: 'commissions',
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
      error: err,
    });
  });

  // ── Push Notification Worker ──
  const { PushService } = await import('../services/push.service');

  pushWorker = new Worker(
    'push-notifications',
    async (job: Job<PushJobData>) => {
      const { userId, title, body, data } = job.data;

      logger.info({ userId, title, attempt: job.attemptsMade + 1 }, 'Sending push notification');

      const result = await PushService.sendToUser(userId, title, body, data);

      if (result.successCount === 0 && result.failureCount > 0) {
        throw new Error(`All ${result.failureCount} FCM token(s) failed`);
      }

      return { successCount: result.successCount, failureCount: result.failureCount };
    },
    {
      connection: redisConnection,
      concurrency: 10,
      // JOB-02: FCM has its own rate-limits; throttle here to stay well under.
      limiter: { max: 200, duration: 60_000 },
    },
  );

  pushWorker.on('completed', (job: Job) => {
    logger.info({ jobId: job.id }, 'Push notification job completed');
  });

  pushWorker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Push notification job failed');
    void notifyAdminJobFailure({
      queueName: 'push-notifications',
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
      error: err,
    });
  });

  // ── Data Cleanup Worker — purges old LocationHistory records ──
  cleanupWorker = new Worker(
    'data-cleanup',
    async (job: Job<{ retentionDays: number }>) => {
      const retentionDays = job.data.retentionDays ?? 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.locationHistory.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      logger.info(
        { deletedCount: result.count, retentionDays, cutoffDate: cutoffDate.toISOString() },
        'Location history cleanup completed',
      );

      return { deletedCount: result.count };
    },
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  cleanupWorker.on('completed', (job: Job) => {
    logger.info({ jobId: job.id }, 'Data cleanup job completed');
  });

  cleanupWorker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Data cleanup job failed');
    void notifyAdminJobFailure({
      queueName: 'data-cleanup',
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
      error: err,
    });
  });

  logger.info(
    'BullMQ workers started: payouts, receipts, commissions, push-notifications, data-cleanup',
  );
}

// ── Graceful shutdown ──

export async function stopWorkers(): Promise<void> {
  const closing = [];
  if (payoutWorker) closing.push(payoutWorker.close());
  if (receiptWorker) closing.push(receiptWorker.close());
  if (commissionWorker) closing.push(commissionWorker.close());
  if (pushWorker) closing.push(pushWorker.close());
  if (cleanupWorker) closing.push(cleanupWorker.close());
  if (closing.length > 0) {
    await Promise.all(closing);
    logger.info('BullMQ workers stopped');
  }
}
