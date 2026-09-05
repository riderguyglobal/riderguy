import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: vi.fn(),
    withdrawal: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@riderguy/database';
import {
  createWithdrawalRequest,
  findWithdrawalRequestReplay,
  resolveWithdrawalRequestId,
  type WithdrawalRequestInput,
} from './withdrawal-request.service';

const asMock = (value: unknown) => value as ReturnType<typeof vi.fn>;

const input: WithdrawalRequestInput = {
  requestId: '28e31ac1-65b0-4d07-b9ec-a867cecf0979',
  userId: 'user-1',
  amount: 50,
  method: 'MOBILE_MONEY',
  destination: '0551234567',
  destinationName: 'Ama Rider',
  bankCode: 'MTN',
};

const existing = {
  id: 'withdrawal-1',
  requestId: input.requestId,
  walletId: 'wallet-1',
  userId: input.userId,
  amount: input.amount,
  currency: 'GHS',
  method: input.method,
  destination: input.destination,
  destinationName: input.destinationName,
  bankCode: input.bankCode,
  status: 'PENDING',
  processedAt: null,
  failureReason: null,
  paymentReference: null,
  paystackRecipientCode: null,
  createdAt: new Date('2026-09-05T12:00:00.000Z'),
  updatedAt: new Date('2026-09-05T12:00:00.000Z'),
};

function transactionClient() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    wallet: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'wallet-1',
        userId: input.userId,
        balance: 200,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'wallet-1',
        userId: input.userId,
        balance: 150,
      }),
    },
    withdrawal: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(existing),
    },
    transaction: {
      create: vi.fn().mockResolvedValue({ id: 'transaction-1' }),
    },
  };
}

describe('withdrawal request idempotency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves a client retry UUID and assigns a UUID to legacy requests', () => {
    const generated = 'b41cd41a-5195-4276-8be2-b8c35916c630';
    const generate = vi.fn(() => generated);

    expect(resolveWithdrawalRequestId(input.requestId, generate)).toBe(input.requestId);
    expect(generate).not.toHaveBeenCalled();
    expect(resolveWithdrawalRequestId(undefined, generate)).toBe(generated);
    expect(generate).toHaveBeenCalledOnce();
  });

  it('locks the request ID and commits exactly one debit, withdrawal, and ledger record', async () => {
    const tx = transactionClient();
    asMock(prisma.$transaction).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const result = await createWithdrawalRequest(input);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: 'wallet-1', balance: { gte: 50 } },
      data: { balance: { decrement: 50 } },
    });
    expect(tx.withdrawal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: input.requestId,
        userId: input.userId,
        amount: input.amount,
      }),
    });
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'WITHDRAWAL',
        amount: -50,
        referenceId: existing.id,
        referenceType: 'withdrawal',
      }),
    });
    expect(result).toEqual({ withdrawal: existing, replayed: false });
  });

  it('returns the existing same-user request without touching the wallet', async () => {
    const tx = transactionClient();
    tx.withdrawal.findUnique.mockResolvedValue(existing);
    asMock(prisma.$transaction).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const result = await createWithdrawalRequest(input);

    expect(result).toEqual({ withdrawal: existing, replayed: true });
    expect(tx.wallet.findUnique).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.withdrawal.create).not.toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('recovers a concurrent unique race by returning the committed winner', async () => {
    asMock(prisma.$transaction).mockRejectedValue({ code: 'P2002' });
    asMock(prisma.withdrawal.findUnique).mockResolvedValue(existing);

    await expect(createWithdrawalRequest(input)).resolves.toEqual({
      withdrawal: existing,
      replayed: true,
    });
    expect(prisma.withdrawal.findUnique).toHaveBeenCalledWith({
      where: { requestId: input.requestId },
    });
  });

  it('rejects reuse by another user without exposing their withdrawal', async () => {
    asMock(prisma.withdrawal.findUnique).mockResolvedValue({
      ...existing,
      userId: 'user-2',
      walletId: 'wallet-2',
    });

    await expect(findWithdrawalRequestReplay(input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
  });

  it('rejects reuse for a different logical withdrawal by the same user', async () => {
    asMock(prisma.withdrawal.findUnique).mockResolvedValue({
      ...existing,
      amount: 75,
    });

    await expect(findWithdrawalRequestReplay(input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
  });

  it('rolls back the request when the guarded debit finds insufficient funds', async () => {
    const tx = transactionClient();
    tx.wallet.updateMany.mockResolvedValue({ count: 0 });
    asMock(prisma.$transaction).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(createWithdrawalRequest(input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'INSUFFICIENT_BALANCE',
    });
    expect(tx.withdrawal.create).not.toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });
});
