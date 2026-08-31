import { Router, Request, Response } from 'express';
import { authenticate, requireRole, validate, sensitiveRateLimit } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { paystackService, PaystackService } from '../../services/paystack.service';
import { logger } from '../../lib/logger';
import { enqueuePayoutJob } from '../../jobs/queues';
import { handlePaymentFailureAfterAssignment } from '../../services/order-reassign.service';
import {
  processWalletTopupWebhook,
} from '../../services/wallet-topup.service';
import { getOrderPaymentReceiptMismatch } from '../../services/order-payment-verification';

const router = Router();

// ============================================================
// Payment Routes — Sprint 6
//
// Paystack integration for:
//  - Payment initialisation (client pays for an order)
//  - Payment verification
//  - Webhook handling
//  - Bank listing (for withdrawals)
//  - Account resolution / verification
// ============================================================

// ── Validation Schemas ──

const initPaymentSchema = z.object({
  orderId: z.string().uuid(),
  callbackUrl: z.string().url().optional(),
});

const verifyPaymentSchema = z.object({
  reference: z.string().min(1),
});

const resolveAccountSchema = z.object({
  accountNumber: z.string().min(10).max(10),
  bankCode: z.string().min(2),
});

// ── Routes ──

/**
 * POST /payments/initialize
 * Client initiates a payment for an order via Paystack.
 */
router.post(
  '/initialize',
  authenticate,
  sensitiveRateLimit,
  requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT),
  validate(initPaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { orderId, callbackUrl } = req.body;
    const userId = req.user!.userId;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
      return;
    }

    if (order.clientId !== userId) {
      res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your order' },
      });
      return;
    }

    if (order.paymentStatus === 'COMPLETED') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'ALREADY_PAID', message: 'This order has already been paid for' },
      });
      return;
    }

    // Only allow card / bank payments via Paystack (cash is handled offline)
    if (order.paymentMethod === 'CASH') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'CASH_ORDER', message: 'Cash orders do not require online payment' },
      });
      return;
    }

    // Get user email for Paystack
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    const reference = PaystackService.generateReference('ORD');

    const result = await paystackService.initializeTransaction({
      email: user?.email ?? `user-${userId}@myriderguy.com`,
      amount: Math.round(Number(order.totalPrice) * 100), // Convert to pesewas
      currency: order.currency,
      reference,
      callbackUrl: callbackUrl ?? undefined,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientId: userId,
        clientName: `${user!.firstName} ${user!.lastName}`,
      },
    });

    // Save reference on the order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentReference: reference,
        paymentStatus: 'PROCESSING',
      },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        authorizationUrl: result.authorizationUrl,
        accessCode: result.accessCode,
        reference: result.reference,
      },
    });
  }),
);

/**
 * GET /payments/verify/:reference
 * Verify a payment after Paystack callback.
 */
router.get(
  '/verify/:reference',
  authenticate,
  validate(verifyPaymentSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { reference } = req.params;

    const order = await prisma.order.findFirst({
      where: { paymentReference: reference as string },
      include: { rider: { select: { userId: true } } },
    });

    if (!order) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No order found for this payment reference' },
      });
      return;
    }

    // Ownership check — only the order's client or assigned rider can verify
    const userId = req.user!.userId;
    if (order.clientId !== userId && order.rider?.userId !== userId) {
      res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to verify this payment' },
      });
      return;
    }

    // Already verified
    if (order.paymentStatus === 'COMPLETED') {
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          status: 'success',
          orderId: order.id,
          amount: order.totalPrice,
          currency: order.currency,
        },
      });
      return;
    }

    try {
      const verification = await paystackService.verifyTransaction(reference as string);

      if (verification.status === 'success') {
        const receiptMismatch = getOrderPaymentReceiptMismatch(order, verification);
        if (receiptMismatch) {
          logger.warn(
            {
              reference,
              code: receiptMismatch.code,
              expected: receiptMismatch.expected,
              received: receiptMismatch.received,
            },
            'Rejected mismatched order payment verification',
          );
          res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            error: { code: receiptMismatch.code, message: receiptMismatch.message },
          });
          return;
        }

        // Optimistic update: only mark COMPLETED if still PROCESSING (prevents double-dispatch)
        const paymentUpdate = await prisma.order.updateMany({
          where: { id: order.id, paymentStatus: { not: 'COMPLETED' } },
          data: { paymentStatus: 'COMPLETED' },
        });

        // If count is 0, webhook already completed this payment — skip
        if (paymentUpdate.count === 0) {
          res.status(StatusCodes.OK).json({
            success: true,
            data: {
              status: 'success',
              orderId: order.id,
              amount: order.totalPrice,
              currency: order.currency,
            },
          });
          return;
        }

        // Dispatch is handled at order creation — no need to trigger here.
        // This verification just confirms the post-delivery payment was successful.

        res.status(StatusCodes.OK).json({
          success: true,
          data: {
            status: 'success',
            orderId: order.id,
            amount: order.totalPrice,
            currency: order.currency,
            channel: verification.channel,
          },
        });
      } else {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'FAILED' },
        });

        // If a rider was already assigned, release them and cancel the order
        handlePaymentFailureAfterAssignment(order.id).catch((err) =>
          logger.error({ err, orderId: order.id }, 'Failed to handle payment failure after assignment'),
        );

        res.status(StatusCodes.OK).json({
          success: true,
          data: { status: verification.status, orderId: order.id },
        });
      }
    } catch (err) {
      logger.error({ err, reference }, 'Payment verification failed');
      res.status(StatusCodes.BAD_GATEWAY).json({
        success: false,
        error: { code: 'VERIFICATION_FAILED', message: 'Unable to verify payment' },
      });
    }
  }),
);

/**
 * POST /payments/webhook
 * Paystack webhook handler — NOT authenticated with JWT,
 * verified via HMAC signature instead.
 */
router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-paystack-signature'] as string;
    // Use raw body buffer captured by express.json verify callback for accurate HMAC
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      logger.warn('Webhook: raw body not available');
      res.status(StatusCodes.BAD_REQUEST).json({ success: false });
      return;
    }

    if (!paystackService.verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid Paystack webhook signature');
      res.status(StatusCodes.UNAUTHORIZED).json({ success: false });
      return;
    }

    const event = req.body;
    logger.info({ event: event.event }, 'Paystack webhook received');

    // ── Idempotency: dedupe via webhook_events table ──
    // Paystack guarantees `data.id` is unique per event; fall back to
    // `${event}:${reference}` when missing so we never silently process twice.
    const providerEventId =
      (event?.data?.id != null ? String(event.data.id) : undefined) ??
      (event?.data?.reference ? `${event.event}:${event.data.reference}` : undefined);

    if (!providerEventId) {
      logger.warn({ eventType: event?.event }, 'Webhook missing event id — accepting without idempotency');
      res.status(StatusCodes.OK).json({ success: true });
      return;
    }

    let webhookEventRow;
    try {
      webhookEventRow = await prisma.webhookEvent.create({
        data: {
          provider: 'paystack',
          eventId: providerEventId,
          eventType: String(event.event ?? 'unknown'),
          status: 'PROCESSED',
          payload: {
            reference: event?.data?.reference ?? null,
            amount: event?.data?.amount ?? null,
            status: event?.data?.status ?? null,
          },
        },
        select: { id: true },
      });
    } catch (err: unknown) {
      // Unique violation = duplicate delivery — Paystack retries can hit us multiple times.
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') {
        logger.info({ eventId: providerEventId, eventType: event.event }, 'Duplicate webhook ignored');
        res.status(StatusCodes.OK).json({ success: true, deduped: true });
        return;
      }
      throw err;
    }

    try {
    switch (event.event) {
      // ── Charge events (order payments) ──
      case 'charge.success': {
        const reference = event.data?.reference as string | undefined;
        if (!reference) break;

        const metadata = event.data?.metadata ?? {};
        if (metadata.type === 'wallet_topup') {
          const topup = await processWalletTopupWebhook({
            amount: Number(event.data?.amount),
            currency: String(event.data?.currency ?? ''),
            metadata,
            reference,
            channel: event.data?.channel,
            paidAt: event.data?.paid_at ?? null,
          });
          if (!topup.accepted) {
            logger.warn({ err: topup.error, reference }, 'Rejected invalid wallet top-up webhook');
            break;
          }
          logger.info(
            { userId: topup.userId, reference, amount: topup.amount },
            'Wallet top-up completed via webhook',
          );
          break;
        }

        const order = await prisma.order.findFirst({
          where: { paymentReference: reference },
        });

        const receiptMismatch = order
          ? getOrderPaymentReceiptMismatch(order, {
              amount: event.data?.amount,
              currency: event.data?.currency,
            })
          : null;

        if (order && receiptMismatch) {
          logger.warn(
            {
              orderId: order.id,
              reference,
              code: receiptMismatch.code,
              expected: receiptMismatch.expected,
              received: receiptMismatch.received,
            },
            'Rejected mismatched order payment webhook',
          );
          break;
        }

        if (order && order.paymentStatus !== 'COMPLETED') {
          // Optimistic update: only mark COMPLETED if not already done (prevents double-dispatch with /verify)
          const webhookUpdate = await prisma.order.updateMany({
            where: { id: order.id, paymentStatus: { not: 'COMPLETED' } },
            data: { paymentStatus: 'COMPLETED' },
          });

          if (webhookUpdate.count > 0) {
            logger.info({ orderId: order.id, reference }, 'Order payment completed via webhook');
            // Dispatch is handled at order creation — webhook only confirms payment.
          }
        }
        break;
      }

      // ── Transfer events (rider withdrawals/payouts) ──
      case 'transfer.success': {
        const transferRef = event.data?.reference as string | undefined;
        if (!transferRef) break;

        const withdrawal = await prisma.withdrawal.findFirst({
          where: { paymentReference: transferRef },
        });

        if (withdrawal && withdrawal.status !== 'COMPLETED') {
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: { status: 'COMPLETED', processedAt: new Date() },
          });

          // Update wallet totalWithdrawn
          await prisma.wallet.update({
            where: { id: withdrawal.walletId },
            data: { totalWithdrawn: { increment: withdrawal.amount } },
          });

          logger.info(
            { withdrawalId: withdrawal.id, reference: transferRef },
            'Withdrawal completed via webhook',
          );
        }
        break;
      }

      case 'transfer.failed':
      case 'transfer.reversed': {
        const failRef = event.data?.reference as string | undefined;
        if (!failRef) break;

        const failedWithdrawal = await prisma.withdrawal.findFirst({
          where: { paymentReference: failRef },
        });

        if (failedWithdrawal && !['COMPLETED', 'CANCELLED'].includes(failedWithdrawal.status)) {
          // Refund the money back to the wallet — sequential writes with optimistic guard
          const failUpdate = await prisma.withdrawal.updateMany({
            where: { id: failedWithdrawal.id, status: { notIn: ['COMPLETED', 'CANCELLED', 'FAILED'] } },
            data: {
              status: 'FAILED',
              failureReason: event.data?.reason ?? `Transfer ${event.event.split('.')[1]}`,
            },
          });

          if (failUpdate.count > 0) {
            const updatedWallet = await prisma.wallet.update({
              where: { id: failedWithdrawal.walletId },
              data: { balance: { increment: failedWithdrawal.amount } },
            });

            await prisma.transaction.create({
              data: {
                walletId: updatedWallet.id,
                type: 'REFUND',
                amount: failedWithdrawal.amount,
                balanceAfter: Number(updatedWallet.balance),
                description: `Refund for failed withdrawal`,
                referenceId: failedWithdrawal.id,
                referenceType: 'withdrawal',
              },
            });
          }

          logger.info(
            { withdrawalId: failedWithdrawal.id },
            `Withdrawal ${event.event.split('.')[1]} — refunded`,
          );
        }
        break;
      }

      default:
        logger.info({ event: event.event }, 'Unhandled Paystack webhook event');
    }
    } catch (processingErr: unknown) {
      // Mark the webhook event row as FAILED so ops can audit / replay manually.
      const message = processingErr instanceof Error ? processingErr.message : String(processingErr);
      logger.error({ err: processingErr, eventId: providerEventId, eventType: event.event }, 'Webhook processing failed');
      await prisma.webhookEvent
        .update({
          where: { id: webhookEventRow.id },
          data: { status: 'FAILED', error: message.slice(0, 1000) },
        })
        .catch((updateErr) =>
          logger.error({ err: updateErr }, 'Failed to mark webhook event as FAILED'),
        );
      // Respond 500 so Paystack retries; the unique constraint on (provider, eventId)
      // means a duplicate row creation will fail next time, so we delete-on-fail to allow retry.
      await prisma.webhookEvent
        .delete({ where: { id: webhookEventRow.id } })
        .catch(() => undefined);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false });
      return;
    }

    // Always respond 200 to Paystack
    res.status(StatusCodes.OK).json({ success: true });
  }),
);

/**
 * GET /payments/banks
 * List available Ghanaian banks (from Paystack).
 */
router.get(
  '/banks',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const banks = await paystackService.listBanks({ type });
    res.status(StatusCodes.OK).json({ success: true, data: banks });
  }),
);

/**
 * POST /payments/resolve-account
 * Resolve a bank account name from account number + bank code.
 */
router.post(
  '/resolve-account',
  authenticate,
  requireRole(UserRole.RIDER, UserRole.PARTNER),
  validate(resolveAccountSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { accountNumber, bankCode } = req.body;

    try {
      const result = await paystackService.resolveAccountNumber(accountNumber, bankCode);
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          accountNumber: result.accountNumber,
          accountName: result.accountName,
          bankId: result.bankId,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Account resolution failed');
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'RESOLUTION_FAILED',
          message: 'Unable to resolve account. Please check the details and try again.',
        },
      });
    }
  }),
);

/**
 * GET /payments/withdrawals
 * List own withdrawal history (for riders).
 */
router.get(
  '/withdrawals',
  authenticate,
  requireRole(UserRole.RIDER, UserRole.PARTNER),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(String(req.query.page ?? '1')) || 1;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20')) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status ? String(req.query.status) : undefined;

    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawal.count({ where }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

// ── Admin payment routes ──

/**
 * GET /payments/admin/withdrawals
 * List all withdrawal requests (admin payout dashboard).
 */
router.get(
  '/admin/withdrawals',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true, phone: true } },
            },
          },
        },
      }),
      prisma.withdrawal.count({ where }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

/**
 * POST /payments/admin/withdrawals/:id/approve
 * Approve and process a pending withdrawal (enqueue payout job).
 */
router.post(
  '/admin/withdrawals/:id/approve',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Withdrawal not found' },
      });
      return;
    }

    if (withdrawal.status !== 'PENDING') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Cannot approve a ${withdrawal.status} withdrawal` },
      });
      return;
    }

    // Enqueue payout job
    await enqueuePayoutJob({
      withdrawalId: withdrawal.id,
      userId: withdrawal.userId,
      amount: Number(withdrawal.amount),
      method: withdrawal.method,
      destination: withdrawal.destination,
      destinationName: withdrawal.destinationName,
      bankCode: withdrawal.bankCode ?? undefined,
    });

    res.status(StatusCodes.OK).json({ success: true, message: 'Payout queued for processing' });
  }),
);

/**
 * POST /payments/admin/withdrawals/:id/reject
 * Reject a pending withdrawal and refund the rider's wallet.
 */
router.post(
  '/admin/withdrawals/:id/reject',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const reason = (req.body.reason as string) || 'Rejected by admin';

    const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Withdrawal not found' },
      });
      return;
    }

    if (withdrawal.status !== 'PENDING') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Cannot reject a ${withdrawal.status} withdrawal` },
      });
      return;
    }

    // Optimistic guard: only reject if still PENDING
    const rejectUpdate = await prisma.withdrawal.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CANCELLED', failureReason: reason },
    });

    if (rejectUpdate.count === 0) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Withdrawal is no longer in PENDING status' },
      });
      return;
    }

    // Refund the amount — use update return value for accurate balanceAfter
    const updatedWallet = await prisma.wallet.update({
      where: { id: withdrawal.walletId },
      data: { balance: { increment: withdrawal.amount } },
    });

    await prisma.transaction.create({
      data: {
        walletId: updatedWallet.id,
        type: 'REFUND',
        amount: withdrawal.amount,
        balanceAfter: Number(updatedWallet.balance),
        description: `Refund for rejected withdrawal: ${reason}`,
        referenceId: withdrawal.id,
        referenceType: 'withdrawal',
      },
    });

    res.status(StatusCodes.OK).json({ success: true, message: 'Withdrawal rejected and refunded' });
  }),
);

/**
 * GET /payments/admin/stats
 * Financial overview stats for admin dashboard.
 */
router.get(
  '/admin/stats',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (_req: Request, res: Response) => {
    const [
      totalRevenue,
      totalCommissions,
      pendingWithdrawals,
      completedWithdrawals,
      totalWithdrawalAmount,
      totalOrders,
      paidOrders,
    ] = await Promise.all([
      prisma.order.aggregate({ _sum: { totalPrice: true }, where: { status: 'DELIVERED' } }),
      prisma.order.aggregate({ _sum: { platformCommission: true }, where: { status: 'DELIVERED' } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.withdrawal.count({ where: { status: 'COMPLETED' } }),
      prisma.withdrawal.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { paymentStatus: 'COMPLETED' } }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        totalRevenue: totalRevenue._sum.totalPrice ?? 0,
        totalCommissions: totalCommissions._sum.platformCommission ?? 0,
        pendingWithdrawals,
        completedWithdrawals,
        totalWithdrawalAmount: totalWithdrawalAmount._sum.amount ?? 0,
        totalDeliveredOrders: totalOrders,
        totalPaidOrders: paidOrders,
      },
    });
  }),
);

/**
 * GET /payments/admin/transactions
 * List all wallet transactions across all users (admin).
 */
router.get(
  '/admin/transactions',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const type = req.query.type as string | undefined;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

export { router as paymentRouter };
