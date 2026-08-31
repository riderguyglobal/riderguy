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
import { z } from 'zod';
import { paystackService, PaystackService } from '../../services/paystack.service';
import {
  creditWalletTopup,
  validateWalletTopupVerification,
} from '../../services/wallet-topup.service';

const router = Router();

router.use(authenticate);

const topupSchema = z.object({
  amount: z.coerce.number().min(1).max(50000),
  callbackUrl: z.string().url().optional(),
});

/** GET /wallets — get own wallet */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!wallet) {
      res.status(StatusCodes.OK).json({ success: true, data: wallet });
      return;
    }

    // Today's earnings (Ghana is UTC year-round, so UTC midnight is local midnight)
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayAgg = await prisma.transaction.aggregate({
      where: {
        walletId: wallet.id,
        type: { in: ['DELIVERY_EARNING', 'TIP', 'BONUS'] },
        amount: { gt: 0 },
        createdAt: { gte: startOfToday },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: { ...wallet, todayEarnings: Number(todayAgg._sum.amount ?? 0) },
    });
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

/** POST /wallets/topup - initialise a wallet top-up through Paystack */
router.post(
  '/topup',
  sensitiveRateLimit,
  validate(topupSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const amount = Number(req.body.amount);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    const reference = PaystackService.generateReference('WALLET');
    const result = await paystackService.initializeTransaction({
      email: user?.email ?? `user-${userId}@myriderguy.com`,
      amount: Math.round(amount * 100),
      currency: 'GHS',
      reference,
      callbackUrl: req.body.callbackUrl,
      channels: ['card', 'mobile_money', 'bank_transfer'],
      metadata: {
        type: 'wallet_topup',
        userId,
        amount,
        name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        authorizationUrl: result.authorizationUrl,
        checkoutUrl: result.authorizationUrl,
        accessCode: result.accessCode,
        reference: result.reference,
        amount,
        currency: 'GHS',
      },
    });
  })
);

/** GET /wallets/topup/verify/:reference - verify and credit a wallet top-up */
router.get(
  '/topup/verify/:reference',
  asyncHandler(async (req, res) => {
    const reference = req.params.reference as string;
    const verification = await paystackService.verifyTransaction(reference);

    if (verification.status !== 'success') {
      res.status(StatusCodes.OK).json({
        success: true,
        data: { status: verification.status, reference },
      });
      return;
    }

    const { amount } = validateWalletTopupVerification(
      {
        amount: verification.amount,
        currency: verification.currency,
        metadata: verification.metadata ?? {},
      },
      req.user!.userId,
    );
    const credited = await creditWalletTopup({
      userId: req.user!.userId,
      amount,
      reference,
      channel: verification.channel,
      provider: 'paystack',
      paidAt: verification.paidAt,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        status: 'success',
        amount,
        currency: verification.currency,
        reference,
        alreadyCredited: credited.alreadyCredited,
        wallet: credited.wallet,
      },
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

    const payoutType = method === 'MOBILE_MONEY' ? 'mobile_money' : 'ghipss';
    const supportedProviders = await paystackService.listBanks({
      currency: 'GHS',
      type: payoutType,
    });
    const payoutProvider = supportedProviders.find(
      (provider) =>
        provider.currency.toUpperCase() === 'GHS' &&
        provider.type.toLowerCase() === payoutType &&
        provider.name.trim().toLowerCase() !== 'bank of ghana' &&
        provider.code.toLowerCase() === bankCode.toLowerCase(),
    );

    if (!payoutProvider) {
      throw ApiError.badRequest(
        method === 'MOBILE_MONEY'
          ? 'Select a supported Ghana Mobile Money network'
          : 'Select a supported Ghana bank',
        'INVALID_PAYOUT_PROVIDER',
      );
    }

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
            bankCode: payoutProvider.code,
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
