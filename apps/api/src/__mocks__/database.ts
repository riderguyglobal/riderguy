// Mock for @riderguy/database — prevents Prisma client initialization during tests
export const prisma = {
  order: {
    findUnique: async () => null,
    findMany: async () => [],
    update: async () => ({}),
    create: async () => ({}),
  },
  riderProfile: {
    findMany: async () => [],
    findUnique: async () => null,
    update: async () => ({}),
  },
  orderStatusHistory: {
    create: async () => ({}),
  },
  $transaction: async (fn: (tx: any) => Promise<any>) => fn({
    order: { update: async () => ({}) },
    riderProfile: { update: async () => ({}) },
    orderStatusHistory: { create: async () => ({}) },
  }),
};
