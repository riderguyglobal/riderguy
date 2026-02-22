import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import { requestWithdrawalSchema } from '@riderguy/validators';
import { MIN_WITHDRAWAL_AMOUNT } from '@riderguy/utils';
import { StatusCodes } from 'http-status-codes';
import type { PaymentMethod as PrismaPaymentMethod } from '@prisma/client';

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

    if (wallet.balance < amount) {
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
          message: `Minimum withdrawal amount is NGN ${MIN_WITHDRAWAL_AMOUNT}`,
        },
      });
      return;
    }

    // Create withdrawal + debit wallet in a serializable transaction to prevent race conditions
    const [withdrawal] = await prisma.$transaction(async (tx) => {
      // Re-read wallet inside transaction with latest balance
      const freshWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
      });

      if (freshWallet.balance < amount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const w = await tx.withdrawal.create({
        data: {
          walletId: freshWallet.id,
          userId: req.user!.userId,
          amount,
          method: method as PrismaPaymentMethod,
          destination,
          destinationName,
          bankCode,
          status: 'PENDING',
        },
      });

      await tx.wallet.update({
        where: { id: freshWallet.id },
        data: { balance: { decrement: amount } },
      });

      await tx.transaction.create({
        data: {
          walletId: freshWallet.id,
          type: 'WITHDRAWAL',
          amount: -amount,
          balanceAfter: freshWallet.balance - amount,
          description: `Withdrawal to ${destinationName}`,
          referenceId: w.id,
          referenceType: 'withdrawal',
        },
      });

      return [w];
    }, { isolationLevel: 'Serializable' });

    res.status(StatusCodes.CREATED).json({ success: true, data: withdrawal });
  })
);

export { router as walletRouter };
