import { PrismaClient, Prisma } from '@prisma/client';

// ── Ensure Prisma Decimal serializes to JSON numbers ────────
// Without this, Decimal fields (totalPrice, baseFare, etc.)
// serialize as strings in res.json(), causing NaN on the frontend.
Prisma.Decimal.prototype.toJSON = function () {
  return Number(this);
};

// ============================================================
// Prisma Client Singleton
// Re-uses a single PrismaClient across hot-reloads in dev and
// guarantees one connection pool in production.
//
// Uses standard TCP connections everywhere. The Neon serverless
// WebSocket adapter is only needed in edge/serverless runtimes
// (Cloudflare Workers, Vercel Edge). Render and local dev both
// support standard TCP which works with Neon's pooled URL.
// ============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const logConfig =
    process.env.NODE_ENV === 'development'
      ? ['query' as const, 'warn' as const, 'error' as const]
      : ['error' as const];

  return new PrismaClient({ log: logConfig });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown — disconnect from DB on process exit
const shutdown = async () => {
  await prisma.$disconnect();
};
process.on('beforeExit', shutdown);
process.on('SIGINT', async () => { await shutdown(); process.exit(0); });
process.on('SIGTERM', async () => { await shutdown(); process.exit(0); });

// Re-export everything from @prisma/client so consumers
// only need to import from @riderguy/database.
export * from '@prisma/client';
