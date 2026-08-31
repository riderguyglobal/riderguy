import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';

type PaystackTopupVerification = {
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
};

/**
 * Treat Paystack metadata as a binding receipt, not an optional hint. This
 * prevents a successful payment from another purpose, currency, amount, or
 * user from being replayed into a RiderGuy wallet.
 */
export function validateWalletTopupVerification(
  verification: PaystackTopupVerification,
  expectedUserId?: string,
) {
  const metadata = verification.metadata ?? {};
  const userId = typeof metadata.userId === 'string' ? metadata.userId.trim() : '';
  const metadataAmount = Number(metadata.amount);

  if (metadata.type !== 'wallet_topup' || !userId) {
    throw ApiError.badRequest('Payment reference is not a RiderGuy wallet top-up', 'INVALID_TOPUP_REFERENCE');
  }
  if (expectedUserId && userId !== expectedUserId) {
    throw ApiError.forbidden('This wallet top-up belongs to another user');
  }
  if (String(verification.currency).toUpperCase() !== 'GHS') {
    throw ApiError.badRequest('Wallet top-ups must be paid in Ghana cedis', 'INVALID_TOPUP_CURRENCY');
  }
  if (!Number.isInteger(verification.amount) || verification.amount <= 0) {
    throw ApiError.badRequest('Payment provider returned an invalid top-up amount', 'INVALID_TOPUP_AMOUNT');
  }
  if (!Number.isFinite(metadataAmount) || metadataAmount <= 0 || metadataAmount > 50_000) {
    throw ApiError.badRequest('Wallet top-up metadata contains an invalid amount', 'INVALID_TOPUP_AMOUNT');
  }

  const expectedPesewas = Math.round(metadataAmount * 100);
  if (expectedPesewas !== verification.amount) {
    throw ApiError.badRequest('Payment amount does not match wallet top-up', 'TOPUP_AMOUNT_MISMATCH');
  }

  return { userId, amount: verification.amount / 100 };
}

type CreditWalletTopupInput = {
  userId: string;
  amount: number;
  reference: string;
  channel?: string | null;
  provider?: string;
  paidAt?: string | Date | null;
};

export async function creditWalletTopup({
  userId,
  amount,
  reference,
  channel,
  provider = 'paystack',
  paidAt,
}: CreditWalletTopupInput) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid wallet top-up amount');
  }

  return prisma.$transaction(async (tx) => {
    // Webhook and authenticated verification can arrive at the same moment.
    // A transaction-scoped advisory lock serializes this one provider
    // reference before the read-then-credit sequence.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`wallet_topup:${reference}`}, 0))`;

    let wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await tx.wallet.create({ data: { userId } });
    }

    const existing = await tx.transaction.findFirst({
      where: {
        referenceId: reference,
        referenceType: 'wallet_topup',
      },
    });

    if (existing) {
      if (existing.walletId !== wallet.id) {
        throw new Error('Wallet top-up reference is already owned by another wallet');
      }
      return { wallet, transaction: existing, alreadyCredited: true };
    }

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    const transaction = await tx.transaction.create({
      data: {
        walletId: updatedWallet.id,
        type: 'DEPOSIT',
        amount,
        balanceAfter: updatedWallet.balance,
        description: 'Wallet top-up',
        referenceId: reference,
        referenceType: 'wallet_topup',
        metadata: {
          channel: channel ?? null,
          provider,
          paidAt: paidAt instanceof Date ? paidAt.toISOString() : paidAt ?? null,
        },
      },
    });

    return { wallet: updatedWallet, transaction, alreadyCredited: false };
  });
}

type WalletTopupWebhookCharge = {
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
  reference: string;
  channel?: string | null;
  paidAt?: string | Date | null;
};

/**
 * Permanently reject invalid provider receipts, but deliberately keep the
 * credit outside that catch. Database/provider-transient credit failures must
 * reach the webhook's outer retry handler instead of being acknowledged 200.
 */
export async function processWalletTopupWebhook(
  charge: WalletTopupWebhookCharge,
  credit: typeof creditWalletTopup = creditWalletTopup,
) {
  let topup: ReturnType<typeof validateWalletTopupVerification>;
  try {
    topup = validateWalletTopupVerification({
      amount: charge.amount,
      currency: charge.currency,
      metadata: charge.metadata,
    });
  } catch (error) {
    return { accepted: false as const, error };
  }

  const creditResult = await credit({
    userId: topup.userId,
    amount: topup.amount,
    reference: charge.reference,
    channel: charge.channel,
    provider: 'paystack',
    paidAt: charge.paidAt,
  });

  return {
    accepted: true as const,
    userId: topup.userId,
    amount: topup.amount,
    creditResult,
  };
}
