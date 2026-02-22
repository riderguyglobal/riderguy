import { PrismaClient } from '@prisma/client';

// ============================================================
// Prisma Client Singleton
// Re-uses a single PrismaClient across hot-reloads in dev and
// guarantees one connection pool in production.
// ============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export everything from @prisma/client so consumers
// only need to import from @riderguy/database.
export * from '@prisma/client';
