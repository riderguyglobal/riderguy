import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tx: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    emailToken: { updateMany: vi.fn() },
  },
  sendVerificationEmail: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx)),
  },
}));

vi.mock('./auth.service', () => ({
  AuthService: { sendVerificationEmail: mocks.sendVerificationEmail },
}));

vi.mock('../lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

import { UserProfileService } from './user-profile.service';

describe('UserProfileService email verification integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendVerificationEmail.mockResolvedValue(undefined);
  });

  it('invalidates prior links, resets verification and starts verification when email changes', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ email: 'old@example.com', emailVerified: true });
    mocks.tx.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      emailVerified: false,
    });

    const result = await UserProfileService.update('user-1', {
      firstName: 'Ama',
      email: 'new@example.com',
    });

    expect(mocks.tx.emailToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', purpose: 'EMAIL_VERIFICATION', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(mocks.tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { firstName: 'Ama', email: 'new@example.com', emailVerified: false },
        select: expect.objectContaining({ roles: true, createdAt: true }),
      }),
    );
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith('user-1');
    expect(result.emailChanged).toBe(true);
    expect(result.emailVerificationRequested).toBe(true);
    expect(result.emailVerificationRequestFailed).toBe(false);
  });

  it('preserves verification and does not send another email when the address is unchanged', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ email: 'same@example.com', emailVerified: true });
    mocks.tx.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'same@example.com',
      emailVerified: true,
    });

    const result = await UserProfileService.update('user-1', {
      lastName: 'Mensah',
      email: 'same@example.com',
    });

    expect(mocks.tx.emailToken.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lastName: 'Mensah', email: 'same@example.com' },
      }),
    );
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
    expect(result.emailChanged).toBe(false);
    expect(result.emailVerificationRequested).toBe(false);
  });

  it('retries the verification flow when an unverified address is resubmitted', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({
      email: 'pending@example.com',
      emailVerified: false,
    });
    mocks.tx.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'pending@example.com',
      emailVerified: false,
    });

    const result = await UserProfileService.update('user-1', {
      email: 'pending@example.com',
    });

    expect(mocks.tx.emailToken.updateMany).not.toHaveBeenCalled();
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith('user-1');
    expect(result.emailVerificationRequired).toBe(true);
  });

  it('reports a verification follow-up failure without rejecting the committed profile update', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ email: 'old@example.com', emailVerified: true });
    mocks.tx.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      emailVerified: false,
    });
    mocks.sendVerificationEmail.mockRejectedValue(new Error('token database unavailable'));

    const result = await UserProfileService.update('user-1', {
      email: 'new@example.com',
    });

    expect(result.user).toMatchObject({ email: 'new@example.com', emailVerified: false });
    expect(result.emailVerificationRequired).toBe(true);
    expect(result.emailVerificationRequested).toBe(false);
    expect(result.emailVerificationRequestFailed).toBe(true);
    expect(mocks.loggerError).toHaveBeenCalledOnce();
  });
});
