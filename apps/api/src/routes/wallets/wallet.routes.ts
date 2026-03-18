import { Router } from 'express';
import { authenticate, requireRole, validate, sensitiveRateLimit } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import { requestWithdrawalSchema } from '@riderguy/validators';
import { MIN_WITHDRAWAL_AMOUNT } from '@riderguy/utils';
import { StatusCodes } from 'http-status-codes';
import type { PaymentMethod as PrismaPaymentMethod } from '@prisma/client';
import { ApiError } from '../../lib/api-error';

const router = Router();

router.use(authenticate);

/** GET /wallets — get own wallet */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
    });

    res.status(StatusCodes.OK).json({ success: true, data: wallet });
  })
);

/** GET /wallets/transactions */
router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!wallet) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Wallet not found' },
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { walletId: wallet.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where: { walletId: wallet.id } }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  })
);

/** POST /wallets/withdraw */
router.post(
  '/withdraw',
  sensitiveRateLimit,
  requireRole(UserRole.RIDER, UserRole.PARTNER),
  validate(requestWithdrawalSchema),
  asyncHandler(async (req, res) => {
    const { amount, method, destination, destinationName, bankCode } = req.body;

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!wallet) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Wallet not found' },
      });
      return;
    }

    if (Number(wallet.balance) < amount) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'INSUFFICIENT_BALANCE', message: 'Insufficient wallet balance' },
      });
      return;
    }

    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'MIN_WITHDRAWAL',
          message: `Minimum withdrawal amount is GHS ${MIN_WITHDRAWAL_AMOUNT}`,
        },
      });
      return;
    }

    // Atomic debit + transaction record in a single Prisma transaction
    // Prevents stale balanceAfter and concurrent withdrawal races
    let withdrawal;
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Optimistic debit: only succeeds if balance hasn't dropped below amount
        const debitResult = await tx.wallet.updateMany({
          where: { id: wallet.id, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });

        if (debitResult.count === 0) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        // Re-read to get the actual post-debit balance
        const updatedWallet = await tx.wallet.findUniqueOrThrow({
          where: { id: wallet.id },
        });

        const wd = await tx.withdrawal.create({
          data: {
            walletId: wallet.id,
            userId: req.user!.userId,
            amount,
            method: method as PrismaPaymentMethod,
            destination,
            destinationName,
            bankCode,
            status: 'PENDING',
          },
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'WITHDRAWAL',
            amount: -amount,
            balanceAfter: Number(updatedWallet.balance),
            description: `Withdrawal to ${destinationName}`,
            referenceId: wd.id,
            referenceType: 'withdrawal',
          },
        });

        return wd;
      });

      withdrawal = result;
    } catch (err: any) {
      if (err.message === 'INSUFFICIENT_BALANCE') {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: { code: 'INSUFFICIENT_BALANCE', message: 'Insufficient wallet balance (concurrent update)' },
        });
        return;
      }
      throw err;
    }

    res.status(StatusCodes.CREATED).json({ success: true, data: withdrawal });
  })
);

export { router as walletRouter };
