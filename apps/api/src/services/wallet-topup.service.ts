import { prisma } from '@riderguy/database';

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
