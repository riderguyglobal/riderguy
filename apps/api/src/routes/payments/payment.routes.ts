import { Router, Request, Response } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { paystackService, PaystackService } from '../../services/paystack.service';
import { logger } from '../../lib/logger';
import { enqueuePayoutJob } from '../../jobs/queues';

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
      email: user?.email ?? `user-${userId}@riderguy.com`,
      amount: Math.round(Number(order.totalPrice) * 100), // Convert to pesewas
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
  asyncHandler(async (req: Request, res: Response) => {
    const { reference } = req.params;

    const order = await prisma.order.findFirst({
      where: { paymentReference: reference as string },
    });

    if (!order) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No order found for this payment reference' },
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
        // Verify amount matches (in pesewas)
        const expectedPesewas = Math.round(Number(order.totalPrice) * 100);
        if (verification.amount !== expectedPesewas) {
          logger.warn(
            { reference, expected: expectedPesewas, received: verification.amount },
            'Payment amount mismatch',
          );
          res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            error: { code: 'AMOUNT_MISMATCH', message: 'Payment amount does not match order' },
          });
          return;
        }

        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'COMPLETED' },
        });

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

    switch (event.event) {
      // ── Charge events (order payments) ──
      case 'charge.success': {
        const reference = event.data?.reference as string | undefined;
        if (!reference) break;

        const order = await prisma.order.findFirst({
          where: { paymentReference: reference },
        });

        if (order && order.paymentStatus !== 'COMPLETED') {
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'COMPLETED' },
          });
          logger.info({ orderId: order.id, reference }, 'Order payment completed via webhook');
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
          // Refund the money back to the wallet
          await prisma.$transaction(async (tx) => {
            await tx.withdrawal.update({
              where: { id: failedWithdrawal.id },
              data: {
                status: 'FAILED',
                failureReason: event.data?.reason ?? `Transfer ${event.event.split('.')[1]}`,
              },
            });

            const wallet = await tx.wallet.findUnique({
              where: { id: failedWithdrawal.walletId },
            });
            if (wallet) {
              await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: failedWithdrawal.amount } },
              });

              await tx.transaction.create({
                data: {
                  walletId: wallet.id,
                  type: 'REFUND',
                  amount: failedWithdrawal.amount,
                  balanceAfter: Number(wallet.balance) + Number(failedWithdrawal.amount),
                  description: `Refund for failed withdrawal`,
                  referenceId: failedWithdrawal.id,
                  referenceType: 'withdrawal',
                },
              });
            }
          });

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
  asyncHandler(async (_req: Request, res: Response) => {
    const banks = await paystackService.listBanks();
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

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id },
        data: { status: 'CANCELLED', failureReason: reason },
      });

      // Refund the amount
      const wallet = await tx.wallet.findUnique({ where: { id: withdrawal.walletId } });
      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: withdrawal.amount } },
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'REFUND',
            amount: withdrawal.amount,
            balanceAfter: Number(wallet.balance) + Number(withdrawal.amount),
            description: `Refund for rejected withdrawal: ${reason}`,
            referenceId: withdrawal.id,
            referenceType: 'withdrawal',
          },
        });
      }
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
