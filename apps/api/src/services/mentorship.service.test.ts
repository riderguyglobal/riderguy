import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mentorship = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  };
  const riderProfile = {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  };
  const tx = { mentorship, riderProfile };
  return {
    acquireLock: vi.fn(),
    mentorship,
    notificationCreate: vi.fn(),
    riderProfile,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    tx,
  };
});

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: mocks.transaction,
    mentorship: mocks.mentorship,
    riderProfile: mocks.riderProfile,
  },
}));

vi.mock('../lib/postgres-advisory-lock', () => ({
  acquireTransactionAdvisoryLock: mocks.acquireLock,
}));

vi.mock('./notification.service', () => ({
  NotificationService: { create: mocks.notificationCreate },
}));

vi.mock('../lib/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { searchMentors, updateMentorshipStatus } from './mentorship.service';

describe('mentorship integrity and Rider eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BYPASS_ONBOARDING_CHECK = 'false';
    mocks.notificationCreate.mockResolvedValue({ id: 'notification-1' });
  });

  it('uses the canonical live Rider work gate when listing mentors', async () => {
    mocks.riderProfile.findMany.mockResolvedValue([]);
    mocks.riderProfile.count.mockResolvedValue(0);

    await searchMentors({ page: 1, limit: 20, excludeRiderId: 'self-profile' });

    expect(mocks.riderProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'self-profile' },
          onboardingStatus: 'ACTIVATED',
          isVerified: true,
          user: { status: 'ACTIVE' },
          currentLevel: { gte: 3 },
        }),
      }),
    );
  });

  it('serializes participant decisions with the admin lock and notifies the counterpart', async () => {
    const existing = {
      id: 'mentorship-1',
      status: 'PENDING',
      mentor: { userId: 'mentor-user' },
      mentee: { userId: 'mentee-user' },
    };
    const updated = {
      id: 'mentorship-1',
      status: 'ACTIVE',
      mentor: { user: { firstName: 'Ama', lastName: 'Mentor' }, currentLevel: 4 },
      mentee: { user: { firstName: 'Kojo', lastName: 'Rider' }, currentLevel: 1 },
    };
    mocks.mentorship.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
    mocks.mentorship.updateMany.mockResolvedValue({ count: 1 });

    await expect(updateMentorshipStatus('mentorship-1', 'mentor-user', 'ACTIVE')).resolves.toEqual(
      updated,
    );

    expect(mocks.acquireLock).toHaveBeenCalledWith(
      mocks.tx,
      'mentorship-admin-decision',
      'mentorship-1',
    );
    expect(mocks.mentorship.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mentorship-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'ACTIVE', startedAt: expect.any(Date) }),
      }),
    );
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'mentee-user',
        type: 'COMMUNITY',
        data: { mentorshipId: 'mentorship-1', status: 'ACTIVE' },
      }),
    );
  });

  it('rejects a stale participant decision instead of overwriting an admin decision', async () => {
    mocks.mentorship.findUnique.mockResolvedValue({
      id: 'mentorship-1',
      status: 'ACTIVE',
      mentor: { userId: 'mentor-user' },
      mentee: { userId: 'mentee-user' },
    });
    mocks.mentorship.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateMentorshipStatus('mentorship-1', 'mentee-user', 'COMPLETED'),
    ).rejects.toMatchObject({ code: 'MENTORSHIP_DECISION_CONFLICT', statusCode: 409 });
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });
});
