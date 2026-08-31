import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@riderguy/database';
import {
  creditWalletTopup,
  processWalletTopupWebhook,
  validateWalletTopupVerification,
} from './wallet-topup.service';

const asMock = (value: unknown) => value as ReturnType<typeof vi.fn>;

describe('wallet top-up verification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('binds a successful GHS receipt to its exact user and amount', () => {
    expect(validateWalletTopupVerification({
      amount: 12_345,
      currency: 'GHS',
      metadata: { type: 'wallet_topup', userId: 'user-1', amount: 123.45 },
    }, 'user-1')).toEqual({ userId: 'user-1', amount: 123.45 });
  });

  it.each([
    [{ userId: 'user-1', amount: 10 }, 'INVALID_TOPUP_REFERENCE'],
    [{ type: 'wallet_topup', amount: 10 }, 'INVALID_TOPUP_REFERENCE'],
  ])('rejects missing binding metadata', (metadata, code) => {
    expect(() => validateWalletTopupVerification({
      amount: 1_000,
      currency: 'GHS',
      metadata,
    }, 'user-1')).toThrow(expect.objectContaining({ code }));
  });

  it('rejects a receipt owned by another user', () => {
    expect(() => validateWalletTopupVerification({
      amount: 1_000,
      currency: 'GHS',
      metadata: { type: 'wallet_topup', userId: 'user-2', amount: 10 },
    }, 'user-1')).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects non-GHS and amount-mismatched receipts', () => {
    expect(() => validateWalletTopupVerification({
      amount: 1_000,
      currency: 'NGN',
      metadata: { type: 'wallet_topup', userId: 'user-1', amount: 10 },
    }, 'user-1')).toThrow(expect.objectContaining({ code: 'INVALID_TOPUP_CURRENCY' }));

    expect(() => validateWalletTopupVerification({
      amount: 999,
      currency: 'GHS',
      metadata: { type: 'wallet_topup', userId: 'user-1', amount: 10 },
    }, 'user-1')).toThrow(expect.objectContaining({ code: 'TOPUP_AMOUNT_MISMATCH' }));
  });
});

describe('wallet top-up webhook retry behavior', () => {
  const validCharge = {
    amount: 1_000,
    currency: 'GHS',
    metadata: { type: 'wallet_topup', userId: 'user-1', amount: 10 },
    reference: 'WALLET_REF_1',
  };

  it('acknowledges a permanently invalid receipt without attempting credit', async () => {
    const credit = vi.fn();

    const result = await processWalletTopupWebhook(
      { ...validCharge, currency: 'NGN' },
      credit,
    );

    expect(result.accepted).toBe(false);
    expect(credit).not.toHaveBeenCalled();
  });

  it('propagates a transient credit failure so the provider can retry', async () => {
    const transientFailure = new Error('database unavailable');
    const credit = vi.fn().mockRejectedValue(transientFailure);

    await expect(processWalletTopupWebhook(validCharge, credit)).rejects.toBe(transientFailure);
    expect(credit).toHaveBeenCalledTimes(1);
  });
});

describe('creditWalletTopup idempotency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('locks the provider reference before checking and crediting it', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: 'wallet-1', userId: 'user-1', balance: 5 }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'wallet-1', userId: 'user-1', balance: 15 }),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'tx-1', walletId: 'wallet-1' }),
      },
    };
    asMock(prisma.$transaction).mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await creditWalletTopup({
      userId: 'user-1',
      amount: 10,
      reference: 'WALLET_REF_1',
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.transaction.findFirst).toHaveBeenCalledWith({
      where: { referenceId: 'WALLET_REF_1', referenceType: 'wallet_topup' },
    });
    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
    expect(result.alreadyCredited).toBe(false);
  });

  it('does not increment the wallet when the locked reference already exists', async () => {
    const existing = { id: 'tx-existing', walletId: 'wallet-1' };
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: 'wallet-1', userId: 'user-1', balance: 15 }),
        create: vi.fn(),
        update: vi.fn(),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
      },
    };
    asMock(prisma.$transaction).mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await creditWalletTopup({
      userId: 'user-1',
      amount: 10,
      reference: 'WALLET_REF_1',
    });

    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(result.alreadyCredited).toBe(true);
  });
});
