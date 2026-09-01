import type { Prisma } from '@prisma/client';

/** Serialize a named critical section for the current PostgreSQL transaction. */
export async function acquireTransactionAdvisoryLock(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  scope: string,
  value: string,
): Promise<void> {
  const key = `riderguy:${scope}:${value}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
