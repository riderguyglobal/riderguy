import { vi } from 'vitest';

// Mock Prisma client for tests
export const prisma = {
  order: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  riderProfile: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  orderStatusHistory: {
    create: vi.fn(),
  },
  withdrawal: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  wallet: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transaction: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  zone: {
    findMany: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
};
