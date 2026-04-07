import { PrismaClient, Prisma } from '@prisma/client';

// ── Ensure Prisma Decimal serializes to JSON numbers ────────
// Without this, Decimal fields (totalPrice, baseFare, etc.)
// serialize as strings in res.json(), causing NaN on the frontend.
(Prisma.Decimal.prototype.toJSON as unknown) = function (this: Prisma.Decimal) {
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

// ── Soft Delete Extension ───────────────────────────────────
// Models with a `deletedAt` field get automatic soft delete:
// - findMany/findFirst/findUnique filter out soft-deleted rows
// - delete/deleteMany become updates that set deletedAt
// Uses Prisma Client extensions ($extends) since $use middleware
// was removed in Prisma 5+.

function addSoftDeleteWhere(args: any) {
  if (!args) args = {};
  if (!args.where) args.where = {};
  if (args.where.deletedAt === undefined) {
    args.where.deletedAt = null;
  }
  return args;
}

const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  query: {
    user: {
      findFirst({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findMany({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findUnique({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findFirstOrThrow({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findUniqueOrThrow({ args, query }) { return query(addSoftDeleteWhere(args)); },
      count({ args, query }) { return query(addSoftDeleteWhere(args)); },
      async delete({ args }) {
        return prisma.user.update({ where: args.where, data: { deletedAt: new Date() } }) as any;
      },
      async deleteMany({ args }) {
        return prisma.user.updateMany({ where: args?.where ?? {}, data: { deletedAt: new Date() } }) as any;
      },
    },
    order: {
      findFirst({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findMany({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findUnique({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findFirstOrThrow({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findUniqueOrThrow({ args, query }) { return query(addSoftDeleteWhere(args)); },
      count({ args, query }) { return query(addSoftDeleteWhere(args)); },
      async delete({ args }) {
        return prisma.order.update({ where: args.where, data: { deletedAt: new Date() } }) as any;
      },
      async deleteMany({ args }) {
        return prisma.order.updateMany({ where: args?.where ?? {}, data: { deletedAt: new Date() } }) as any;
      },
    },
    wallet: {
      findFirst({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findMany({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findUnique({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findFirstOrThrow({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findUniqueOrThrow({ args, query }) { return query(addSoftDeleteWhere(args)); },
      count({ args, query }) { return query(addSoftDeleteWhere(args)); },
      async delete({ args }) {
        return prisma.wallet.update({ where: args.where, data: { deletedAt: new Date() } }) as any;
      },
      async deleteMany({ args }) {
        return prisma.wallet.updateMany({ where: args?.where ?? {}, data: { deletedAt: new Date() } }) as any;
      },
    },
    transaction: {
      findFirst({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findMany({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findUnique({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findFirstOrThrow({ args, query }) { return query(addSoftDeleteWhere(args)); },
      findUniqueOrThrow({ args, query }) { return query(addSoftDeleteWhere(args)); },
      count({ args, query }) { return query(addSoftDeleteWhere(args)); },
      async delete({ args }) {
        return prisma.transaction.update({ where: args.where, data: { deletedAt: new Date() } }) as any;
      },
      async deleteMany({ args }) {
        return prisma.transaction.updateMany({ where: args?.where ?? {}, data: { deletedAt: new Date() } }) as any;
      },
    },
  },
});

const basePrisma = globalForPrisma.prisma ?? createPrismaClient();
export const prisma = basePrisma.$extends(softDeleteExtension) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
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
