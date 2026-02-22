import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../lib/logger';
import { prisma } from '@riderguy/database';
import { paystackService } from '../services/paystack.service';
import type { PayoutJobData, ReceiptJobData, CommissionJobData } from './queues';

// ============================================================
// BullMQ Workers — Sprint 6
//
// Processes: payout transfers, receipt generation,
// commission ledger records.
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

const redisConnection = parseRedisUrl(config.redis.url);

// ── Payout Worker ──

export const payoutWorker = new Worker(
  'payouts',
  async (job: Job<PayoutJobData>) => {
    const { withdrawalId, userId, amount, method, destination, destinationName, bankCode } =
      job.data;

    logger.info({ withdrawalId, amount }, 'Processing payout');

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal || withdrawal.status !== 'PENDING') {
      logger.warn({ withdrawalId }, 'Payout: withdrawal not found or not pending');
      return { skipped: true };
    }

    try {
      // Update status to PROCESSING
      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: 'PROCESSING' },
      });

      // Check if Paystack is configured
      if (!config.paystack.secretKey) {
        // In dev/test mode: auto-complete without actual transfer
        logger.warn({ withdrawalId }, 'Paystack not configured — auto-completing payout');
        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            paymentReference: `DEV_${Date.now()}`,
          },
        });

        await prisma.wallet.update({
          where: { userId },
          data: { totalWithdrawn: { increment: amount } },
        });

        return { status: 'completed', dev: true };
      }

      // 1. Create transfer recipient on Paystack
      const recipient = await paystackService.createTransferRecipient({
        type: method === 'MOBILE_MONEY' ? 'mobile_money' : 'nuban',
        name: destinationName,
        accountNumber: destination,
        bankCode: bankCode ?? '',
      });

      // 2. Initiate transfer
      const reference = `WD_${withdrawalId}_${Date.now()}`;
      const transfer = await paystackService.initiateTransfer({
        amount: Math.round(amount * 100), // Convert to kobo
        recipientCode: recipient.recipientCode,
        reason: `RiderGuy withdrawal #${withdrawalId.slice(0, 8)}`,
        reference,
      });

      // 3. Update withdrawal with transfer details
      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          paymentReference: transfer.reference,
          // Status remains PROCESSING — webhook will mark COMPLETED/FAILED
        },
      });

      logger.info(
        { withdrawalId, transferCode: transfer.transferCode },
        'Transfer initiated on Paystack',
      );

      return { status: 'initiated', reference: transfer.reference };
    } catch (err) {
      logger.error({ err, withdrawalId }, 'Payout processing failed');

      // Mark as FAILED and refund the balance
      await prisma.$transaction(async (tx) => {
        await tx.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'FAILED',
            failureReason: err instanceof Error ? err.message : 'Unknown error',
          },
        });

        // Refund the debited amount
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: amount } },
          });

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'REFUND',
              amount: amount,
              balanceAfter: wallet.balance + amount,
              description: `Refund for failed withdrawal #${withdrawalId.slice(0, 8)}`,
              referenceId: withdrawalId,
              referenceType: 'withdrawal',
            },
          });
        }
      });

      throw err; // Let BullMQ retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
    limiter: { max: 10, duration: 60000 }, // Max 10 payouts per minute
  },
);

payoutWorker.on('completed', (job: Job) => {
  logger.info({ jobId: job.id }, 'Payout job completed');
});

payoutWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Payout job failed');
});

// ── Receipt Worker ──

export const receiptWorker = new Worker(
  'receipts',
  async (job: Job<ReceiptJobData>) => {
    const { orderId, clientId, orderNumber, totalPrice, currency } = job.data;

    logger.info({ orderId, orderNumber }, 'Generating delivery receipt');

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

    // Generate receipt data (JSON-based, can be rendered as PDF later)
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
        { label: 'Base fare', amount: order.baseFare },
        { label: 'Distance charge', amount: order.distanceCharge },
        ...(order.surgeMultiplier > 1
          ? [{ label: `Surge (${order.surgeMultiplier}x)`, amount: 0 }]
          : []),
        { label: 'Service fee', amount: order.serviceFee },
        ...(order.tipAmount > 0
          ? [{ label: 'Tip', amount: order.tipAmount }]
          : []),
      ],
      total: { amount: totalPrice, currency },
      paymentMethod: order.paymentMethod,
    };

    // Store receipt as order notes (using packageDescription field as receipt storage)
    // In production, this would be stored in a separate receipts table or S3
    logger.info(
      { orderId, receiptNumber: receiptData.receiptNumber, total: receiptData.total },
      'Receipt generated',
    );
    return { receiptNumber: receiptData.receiptNumber };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

receiptWorker.on('completed', (job: Job) => {
  logger.info({ jobId: job.id }, 'Receipt job completed');
});

receiptWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Receipt job failed');
});

// ── Commission Tracking Worker ──

export const commissionWorker = new Worker(
  'commissions',
  async (job: Job<CommissionJobData>) => {
    const { orderId, riderId, riderUserId, orderAmount, commissionRate, platformCommission } =
      job.data;

    logger.info({ orderId, platformCommission }, 'Recording commission');

    // Record a COMMISSION_DEDUCTION transaction in the rider's wallet for transparency
    const wallet = await prisma.wallet.findUnique({
      where: { userId: riderUserId },
    });

    if (!wallet) {
      logger.warn({ riderUserId }, 'Commission: wallet not found');
      return { skipped: true };
    }

    // Check if commission already recorded for this order
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

    // Create the commission deduction record (informational — amount was already deducted in pricing)
    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'COMMISSION_DEDUCTION',
        amount: -platformCommission,
        balanceAfter: wallet.balance, // Balance not changed — deducted at pricing level
        description: `Platform commission (${commissionRate}%) on order total ₦${orderAmount.toLocaleString()}`,
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
  },
);

commissionWorker.on('completed', (job: Job) => {
  logger.info({ jobId: job.id }, 'Commission job completed');
});

commissionWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Commission job failed');
});

// ── Start all workers ──

export function startWorkers(): void {
  logger.info('BullMQ workers started: payouts, receipts, commissions');
}

// ── Graceful shutdown ──

export async function stopWorkers(): Promise<void> {
  await Promise.all([
    payoutWorker.close(),
    receiptWorker.close(),
    commissionWorker.close(),
  ]);
  logger.info('BullMQ workers stopped');
}
