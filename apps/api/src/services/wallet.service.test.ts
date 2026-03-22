import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Type helper ──
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// ── Mocks ──

const mockTx = {
  transaction: { findFirst: vi.fn(), create: vi.fn() },
  wallet: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    wallet: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../lib/api-error', async () => {
  const actual = await vi.importActual('../lib/api-error') as any;
  return actual;
});

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import AFTER mocks ──
import { creditWallet, debitWallet, creditTip, getBalance, getOrCreateWallet } from './wallet.service';
import { prisma } from '@riderguy/database';

// ============================================================
// WALLET SERVICE — COMPREHENSIVE SIMULATION TESTS
// ============================================================

describe('WalletService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────
  // 1. CREDIT WALLET — rider earns money from delivery
  // ────────────────────────────────────────────────────────────
  describe('creditWallet', () => {
    it('should credit wallet and create transaction', async () => {
      const wallet = { id: 'w-1', userId: 'user-1', balance: 100, totalEarned: 80 };
      const tx = { id: 'tx-1', walletId: 'w-1', amount: 11.25, balanceAfter: 111.25 };

      mockTx.transaction.findFirst.mockResolvedValue(null); // no duplicate
      mockTx.wallet.upsert.mockResolvedValue({ ...wallet, balance: 111.25, totalEarned: 91.25 });
      mockTx.transaction.create.mockResolvedValue(tx);

      const result = await creditWallet(
        'user-1',
        11.25,
        'DELIVERY_EARNING' as any,
        'Earnings from order RG-001',
        'order-1',
        'order',
      );

      expect(result).toBeDefined();
      expect(result!.wallet.balance).toBe(111.25);
      expect(result!.transaction.amount).toBe(11.25);
    });

    it('should be idempotent — return existing transaction on duplicate', async () => {
      const existingTx = {
        id: 'tx-existing',
        walletId: 'w-1',
        amount: 11.25,
        wallet: { id: 'w-1', balance: 111.25 },
      };
      mockTx.transaction.findFirst.mockResolvedValue(existingTx);

      const result = await creditWallet(
        'user-1',
        11.25,
        'DELIVERY_EARNING' as any,
        'Earnings from order RG-001',
        'order-1',
        'order',
      );

      expect(result!.transaction.id).toBe('tx-existing');
      // Should NOT create a new transaction
      expect(mockTx.wallet.upsert).not.toHaveBeenCalled();
    });

    it('should skip zero/negative amounts', async () => {
      const result = await creditWallet('user-1', 0, 'BONUS' as any, 'test');
      expect(result).toBeNull();

      const result2 = await creditWallet('user-1', -5, 'BONUS' as any, 'test');
      expect(result2).toBeNull();
    });

    it('should create wallet on first credit (upsert)', async () => {
      const newWallet = { id: 'w-new', userId: 'new-user', balance: 15, totalEarned: 15 };
      mockTx.transaction.findFirst.mockResolvedValue(null);
      mockTx.wallet.upsert.mockResolvedValue(newWallet);
      mockTx.transaction.create.mockResolvedValue({ id: 'tx-1', amount: 15 });

      const result = await creditWallet('new-user', 15, 'DELIVERY_EARNING' as any, 'First delivery');

      expect(result).toBeDefined();
      expect(mockTx.wallet.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'new-user' },
        create: expect.objectContaining({ userId: 'new-user', balance: 15 }),
      }));
    });

    it('should NOT increment totalEarned for non-earning types (e.g., WITHDRAWAL_REVERSAL)', async () => {
      mockTx.transaction.findFirst.mockResolvedValue(null);
      mockTx.wallet.upsert.mockResolvedValue({ id: 'w-1', balance: 50 });
      mockTx.transaction.create.mockResolvedValue({ id: 'tx-1', amount: 10 });

      await creditWallet('user-1', 10, 'WITHDRAWAL_REVERSAL' as any, 'Reversal');

      // The upsert update should NOT include totalEarned increment
      const upsertCall = mockTx.wallet.upsert.mock.calls[0][0];
      expect(upsertCall.update).not.toHaveProperty('totalEarned');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2. DEBIT WALLET — rider withdraws money
  // ────────────────────────────────────────────────────────────
  describe('debitWallet', () => {
    it('should debit wallet with sufficient balance', async () => {
      const wallet = { id: 'w-1', userId: 'user-1', balance: 100 };
      const updatedWallet = { ...wallet, balance: 50 };

      mockTx.wallet.findUnique.mockResolvedValue(wallet);
      mockTx.wallet.updateMany.mockResolvedValue({ count: 1 });
      mockTx.wallet.findUniqueOrThrow.mockResolvedValue(updatedWallet);
      mockTx.transaction.create.mockResolvedValue({ id: 'tx-1', amount: -50, balanceAfter: 50 });

      const result = await debitWallet('user-1', 50, 'WITHDRAWAL' as any, 'Cash withdrawal');

      expect(result).toBeDefined();
      expect(result!.wallet.balance).toBe(50);
      expect(result!.transaction.amount).toBe(-50);
    });

    it('should reject debit with insufficient balance', async () => {
      const wallet = { id: 'w-1', userId: 'user-1', balance: 10 };
      mockTx.wallet.findUnique.mockResolvedValue(wallet);

      await expect(debitWallet('user-1', 50, 'WITHDRAWAL' as any, 'Too much'))
        .rejects.toThrow('Insufficient wallet balance');
    });

    it('should reject debit on non-existent wallet', async () => {
      mockTx.wallet.findUnique.mockResolvedValue(null);

      await expect(debitWallet('ghost-user', 10, 'WITHDRAWAL' as any, 'No wallet'))
        .rejects.toThrow('Wallet not found');
    });

    it('should handle optimistic concurrency (balance dropped between read and write)', async () => {
      const wallet = { id: 'w-1', userId: 'user-1', balance: 50 };
      mockTx.wallet.findUnique.mockResolvedValue(wallet);
      mockTx.wallet.updateMany.mockResolvedValue({ count: 0 }); // concurrent debit won

      await expect(debitWallet('user-1', 50, 'WITHDRAWAL' as any, 'Race'))
        .rejects.toThrow('Insufficient wallet balance (concurrent update)');
    });

    it('should skip zero/negative amounts', async () => {
      const result = await debitWallet('user-1', 0, 'WITHDRAWAL' as any, 'nothing');
      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3. CREDIT TIP — client tips rider after delivery
  // ────────────────────────────────────────────────────────────
  describe('creditTip', () => {
    it('should credit tip and increment totalTips', async () => {
      const wallet = { id: 'w-1', userId: 'rider-1', balance: 105, totalTips: 5 };

      mockTx.transaction.findFirst.mockResolvedValue(null);
      mockTx.wallet.upsert.mockResolvedValue(wallet);
      mockTx.transaction.create.mockResolvedValue({ id: 'tx-tip', amount: 5, type: 'TIP' });

      const result = await creditTip('rider-1', 5, 'Tip from order RG-001', 'order-1', 'order');

      expect(result).toBeDefined();
      expect(mockTx.wallet.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: expect.objectContaining({
          balance: { increment: 5 },
          totalTips: { increment: 5 },
        }),
      }));
    });

    it('should be idempotent for duplicate tips', async () => {
      const existingTip = {
        id: 'tx-existing',
        type: 'TIP',
        amount: 5,
        wallet: { id: 'w-1' },
      };
      mockTx.transaction.findFirst.mockResolvedValue(existingTip);

      const result = await creditTip('rider-1', 5, 'Tip', 'order-1', 'order');

      expect(result!.transaction.id).toBe('tx-existing');
      expect(mockTx.wallet.upsert).not.toHaveBeenCalled();
    });

    it('should skip zero tips', async () => {
      const result = await creditTip('rider-1', 0, 'No tip');
      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 4. GET BALANCE
  // ────────────────────────────────────────────────────────────
  describe('getBalance', () => {
    it('should return wallet balance', async () => {
      asMock(prisma.wallet.findUnique).mockResolvedValue({ id: 'w-1', balance: 85.50 });

      const balance = await getBalance('user-1');

      expect(balance).toBe(85.50);
    });

    it('should return 0 for non-existent wallet', async () => {
      asMock(prisma.wallet.findUnique).mockResolvedValue(null);

      const balance = await getBalance('new-user');

      expect(balance).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 5. GET OR CREATE WALLET
  // ────────────────────────────────────────────────────────────
  describe('getOrCreateWallet', () => {
    it('should return existing wallet or create new one', async () => {
      const wallet = { id: 'w-1', userId: 'user-1', balance: 0, totalEarned: 0 };
      asMock(prisma.wallet.upsert).mockResolvedValue(wallet);

      const result = await getOrCreateWallet('user-1');

      expect(result.userId).toBe('user-1');
      expect(prisma.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: { userId: 'user-1', balance: 0, totalEarned: 0 },
        update: {},
      });
    });
  });
});
