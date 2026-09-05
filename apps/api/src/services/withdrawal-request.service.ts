import { prisma } from '@riderguy/database';
import type { PaymentMethod, Prisma, Withdrawal } from '@prisma/client';
import { MIN_WITHDRAWAL_AMOUNT } from '@riderguy/utils';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../lib/api-error';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';

export interface WithdrawalRequestInput {
  requestId: string;
  userId: string;
  amount: number;
  method: PaymentMethod;
  destination: string;
  destinationName: string;
  bankCode: string;
}

export interface WithdrawalRequestResult {
  withdrawal: Withdrawal;
  replayed: boolean;
}

/** Preserve modern clients' retry key; assign one for pre-contract APKs. */
export function resolveWithdrawalRequestId(
  clientRequestId: string | undefined,
  generate: () => string = randomUUID,
): string {
  return clientRequestId ?? generate();
}

function idempotencyConflict(): ApiError {
  return ApiError.conflict(
    'This withdrawal request ID has already been used for another request',
    'IDEMPOTENCY_KEY_REUSED',
  );
}

function matchesOriginalRequest(existing: Withdrawal, input: WithdrawalRequestInput): boolean {
  return (
    existing.userId === input.userId &&
    Number(existing.amount) === input.amount &&
    existing.method === input.method &&
    existing.destination === input.destination &&
    existing.destinationName === input.destinationName &&
    existing.bankCode?.toLowerCase() === input.bankCode.toLowerCase()
  );
}

function resolveReplay(
  existing: Withdrawal,
  input: WithdrawalRequestInput,
): WithdrawalRequestResult {
  // Never expose another user's withdrawal, and never let a client reuse one
  // operation key for a materially different debit.
  if (!matchesOriginalRequest(existing, input)) throw idempotencyConflict();
  return { withdrawal: existing, replayed: true };
}

/**
 * Fast path for ordinary retries. The transactional function below repeats
 * this check, so a request racing a first submission is safe as well.
 */
export async function findWithdrawalRequestReplay(
  input: WithdrawalRequestInput,
): Promise<WithdrawalRequestResult | null> {
  const existing = await prisma.withdrawal.findUnique({
    where: { requestId: input.requestId },
  });
  return existing ? resolveReplay(existing, input) : null;
}

/**
 * Atomically records a withdrawal and its wallet debit. The request-scoped
 * advisory lock keeps cooperating callers from doing speculative duplicate
 * work; the unique constraint and P2002 recovery remain the final guard for
 * concurrent or legacy callers that did not acquire the lock.
 */
export async function createWithdrawalRequest(
  input: WithdrawalRequestInput,
): Promise<WithdrawalRequestResult> {
  if (input.amount < MIN_WITHDRAWAL_AMOUNT) {
    throw ApiError.badRequest(
      `Minimum withdrawal amount is GHS ${MIN_WITHDRAWAL_AMOUNT}`,
      'MIN_WITHDRAWAL',
    );
  }

  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await acquireTransactionAdvisoryLock(tx, 'withdrawal-request', input.requestId);

      const existing = await tx.withdrawal.findUnique({
        where: { requestId: input.requestId },
      });
      if (existing) return resolveReplay(existing, input);

      const wallet = await tx.wallet.findUnique({
        where: { userId: input.userId },
      });
      if (!wallet) throw ApiError.notFound('Wallet not found');

      const debitResult = await tx.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: input.amount } },
        data: { balance: { decrement: input.amount } },
      });
      if (debitResult.count === 0) {
        throw ApiError.badRequest('Insufficient wallet balance', 'INSUFFICIENT_BALANCE');
      }

      const updatedWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
      });
      const withdrawal = await tx.withdrawal.create({
        data: {
          requestId: input.requestId,
          walletId: wallet.id,
          userId: input.userId,
          amount: input.amount,
          method: input.method,
          destination: input.destination,
          destinationName: input.destinationName,
          bankCode: input.bankCode,
          status: 'PENDING',
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount: -input.amount,
          balanceAfter: updatedWallet.balance,
          description: `Withdrawal to ${input.destinationName}`,
          referenceId: withdrawal.id,
          referenceType: 'withdrawal',
        },
      });

      return { withdrawal, replayed: false };
    });
  } catch (error: unknown) {
    // A unique race rolls the entire losing transaction back, including its
    // tentative wallet debit. Once the winner commits, return that row only
    // when it belongs to the same user and exact logical request.
    if ((error as { code?: string })?.code !== 'P2002') throw error;

    const existing = await prisma.withdrawal.findUnique({
      where: { requestId: input.requestId },
    });
    if (!existing) throw error;
    return resolveReplay(existing, input);
  }
}
