import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';
import type { TransactionType } from '@prisma/client';

// ============================================================
// Wallet Service — atomic wallet operations with Prisma
// transactions to prevent race conditions.
// ============================================================

/**
 * Credit a user's wallet atomically.
 * Creates the wallet if it doesn't exist (first earning).
 */
export async function creditWallet(
  userId: string,
  amount: number,
  txType: TransactionType,
  description: string,
  referenceId?: string,
  referenceType?: string,
) {
  if (amount <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: {
        userId,
        balance: amount,
        totalEarned: amount,
      },
      update: {
        balance: { increment: amount },
        totalEarned: { increment: amount },
      },
    });

    const updated = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });

    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: txType,
        amount,
        balanceAfter: updated.balance,
        description,
        referenceId,
        referenceType,
      },
    });

    return { wallet: updated, transaction };
  });
}

/**
 * Debit a user's wallet atomically with optimistic concurrency.
 * Fails if balance is insufficient.
 */
export async function debitWallet(
  userId: string,
  amount: number,
  txType: TransactionType,
  description: string,
  referenceId?: string,
  referenceType?: string,
) {
  if (amount <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw ApiError.notFound('Wallet not found');
    if (Number(wallet.balance) < amount) {
      throw ApiError.badRequest('Insufficient wallet balance');
    }

    // Optimistic debit — only succeeds if balance hasn't dropped
    const result = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });

    if (result.count === 0) {
      throw ApiError.badRequest('Insufficient wallet balance (concurrent update)');
    }

    const updated = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });

    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: txType,
        amount: -amount,
        balanceAfter: updated.balance,
        description,
        referenceId,
        referenceType,
      },
    });

    return { wallet: updated, transaction };
  });
}

/**
 * Get wallet balance for a user.
 */
export async function getBalance(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  return wallet ? Number(wallet.balance) : 0;
}

/**
 * Get or create a wallet for a user.
 */
export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId, balance: 0, totalEarned: 0 },
    update: {},
  });
}

/**
 * Credit a tip to user's wallet atomically.
 * Increments totalTips rather than totalEarned.
 */
export async function creditTip(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
  referenceType?: string,
) {
  if (amount <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: {
        userId,
        balance: amount,
        totalTips: amount,
      },
      update: {
        balance: { increment: amount },
        totalTips: { increment: amount },
      },
    });

    const updated = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });

    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'TIP',
        amount,
        balanceAfter: updated.balance,
        description,
        referenceId,
        referenceType,
      },
    });

    return { wallet: updated, transaction };
  });
}
