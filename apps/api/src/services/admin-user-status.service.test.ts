import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountStatus } from '@prisma/client';
import { UserRole } from '@riderguy/types';

const mocks = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn() },
  acquireLock: vi.fn(),
  tx: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('@riderguy/database', () => ({ prisma: mocks.prisma }));
vi.mock('../lib/postgres-advisory-lock', () => ({
  acquireTransactionAdvisoryLock: mocks.acquireLock,
}));

import { updateAdminManagedUserStatus } from './admin-user-status.service';

const baseUser = {
  id: 'target-admin',
  firstName: 'Target',
  lastName: 'Admin',
  email: 'target@example.com',
  phone: '+233200000000',
  role: UserRole.SUPER_ADMIN,
  roles: [UserRole.SUPER_ADMIN],
};

let currentStatus: AccountStatus;
let activeSuperAdmins: number;
let auditRows: number;
let failAudit: boolean;

function currentUser() {
  return { ...baseUser, status: currentStatus };
}

function installStatefulTransaction() {
  mocks.tx.user.findUnique.mockImplementation(async () => currentUser());
  mocks.tx.user.count.mockImplementation(async () => activeSuperAdmins);
  mocks.tx.user.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.id !== baseUser.id || where.status !== currentStatus) return { count: 0 };
    currentStatus = data.status;
    return { count: 1 };
  });
  mocks.tx.auditLog.create.mockImplementation(async () => {
    if (failAudit) throw new Error('audit unavailable');
    auditRows += 1;
    return { id: `audit-${auditRows}` };
  });
  mocks.prisma.$transaction.mockImplementation(async (callback) => {
    const statusSnapshot = currentStatus;
    const auditSnapshot = auditRows;
    try {
      return await callback(mocks.tx);
    } catch (error) {
      currentStatus = statusSnapshot;
      auditRows = auditSnapshot;
      throw error;
    }
  });
}

function decision(overrides: Record<string, unknown> = {}) {
  return updateAdminManagedUserStatus({
    targetUserId: baseUser.id,
    status: AccountStatus.SUSPENDED,
    reason: 'Confirmed security incident',
    actorIsSuperAdmin: true,
    auditContext: {
      actorUserId: 'acting-super-admin',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    },
    ...overrides,
  });
}

describe('admin managed user status decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStatus = AccountStatus.ACTIVE;
    activeSuperAdmins = 2;
    auditRows = 0;
    failAudit = false;
    installStatefulTransaction();
  });

  it('serialises the last-Super-Admin check and attributes the mutation audit', async () => {
    const result = await decision();

    expect(result.outcome).toBe('UPDATED');
    expect(currentStatus).toBe(AccountStatus.SUSPENDED);
    expect(auditRows).toBe(1);
    expect(mocks.acquireLock).toHaveBeenCalledWith(
      mocks.tx,
      'administrator-account-boundary',
      'active-super-admins',
    );
    expect(mocks.acquireLock.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.user.count.mock.invocationCallOrder[0]!,
    );
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'acting-super-admin',
        action: 'user_account.status_suspended',
        entityType: 'User',
        entityId: baseUser.id,
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    });
  });

  it('prevents restricting the last active Super Admin inside the locked transaction', async () => {
    activeSuperAdmins = 1;

    await expect(decision()).rejects.toMatchObject({
      statusCode: 409,
      code: 'LAST_SUPER_ADMIN',
    });
    expect(currentStatus).toBe(AccountStatus.ACTIVE);
    expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('recognises an administrative role stored in the multi-role array', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({
      ...currentUser(),
      role: UserRole.RIDER,
      roles: [UserRole.RIDER, UserRole.ADMIN],
    });

    await expect(decision({ actorIsSuperAdmin: false })).rejects.toMatchObject({
      statusCode: 403,
      code: 'ADMIN_ACCOUNT_REQUIRES_SUPER_ADMIN',
    });
    expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('rolls the status change back when durable audit attribution fails', async () => {
    failAudit = true;

    await expect(decision()).rejects.toThrow('audit unavailable');
    expect(currentStatus).toBe(AccountStatus.ACTIVE);
    expect(auditRows).toBe(0);
  });

  it('treats a retry of an already-applied restriction as an idempotent no-op', async () => {
    const first = await decision();
    const retry = await decision();

    expect(first.outcome).toBe('UPDATED');
    expect(retry.outcome).toBe('UNCHANGED');
    expect(mocks.tx.user.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('does not block a transition between restricted states for a Super Admin', async () => {
    currentStatus = AccountStatus.SUSPENDED;
    activeSuperAdmins = 1;

    const result = await decision({ status: AccountStatus.BANNED });

    expect(result.outcome).toBe('UPDATED');
    expect(currentStatus).toBe(AccountStatus.BANNED);
    expect(mocks.tx.user.count).not.toHaveBeenCalled();
  });
});
