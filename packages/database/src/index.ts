import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';

// ============================================================
// Prisma Client Singleton
// Re-uses a single PrismaClient across hot-reloads in dev and
// guarantees one connection pool in production.
//
// In production (Neon), uses the serverless driver adapter for
// connection pooling and scale-to-zero compatibility.
// In development, uses a standard PrismaClient with direct TCP.
// ============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const logConfig =
    process.env.NODE_ENV === 'development'
      ? ['query' as const, 'warn' as const, 'error' as const]
      : ['error' as const];

  // In production, use Neon serverless adapter for optimal
  // connection handling (pooled WebSocket connections).
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL?.includes('neon')) {
    neonConfig.useSecureWebSocket = true;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool as any);
    return new PrismaClient({ adapter, log: logConfig });
  }

  // In development, use standard TCP connection.
  return new PrismaClient({ log: logConfig });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export everything from @prisma/client so consumers
// only need to import from @riderguy/database.
export * from '@prisma/client';
