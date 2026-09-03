import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
  tx: {
    mentorship: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  acquireLock: vi.fn(),
  audit: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({ prisma: mocks.prisma }));
vi.mock('../lib/postgres-advisory-lock', () => ({
  acquireTransactionAdvisoryLock: mocks.acquireLock,
}));
vi.mock('./admin-audit.service', () => ({
  AdminAuditService: { record: mocks.audit },
}));
vi.mock('./notification.service', () => ({
  NotificationService: { create: mocks.notify },
}));

import { RiderExperienceAdminService } from './rider-experience-admin.service';

const existingMentorship = {
  id: 'mentorship-1',
  status: 'PENDING',
  mentor: { userId: 'mentor-user-1' },
  mentee: { userId: 'mentee-user-1' },
};

const updatedMentorship = {
  ...existingMentorship,
  status: 'ACTIVE',
  completionNote: 'Approved after participant review',
  mentor: {
    id: 'mentor-1',
    userId: 'mentor-user-1',
    currentLevel: 4,
    totalDeliveries: 320,
    averageRating: 4.9,
    user: {
      firstName: 'Ama',
      lastName: 'Mensah',
      email: 'ama@example.com',
      avatarUrl: null,
    },
  },
  mentee: {
    id: 'mentee-1',
    userId: 'mentee-user-1',
    currentLevel: 1,
    totalDeliveries: 12,
    averageRating: 4.7,
    user: {
      firstName: 'Kojo',
      lastName: 'Owusu',
      email: 'kojo@example.com',
      avatarUrl: null,
    },
  },
  zone: { id: 'zone-accra', name: 'Accra' },
  _count: { checkIns: 0 },
};

const auditContext = {
  actorUserId: 'admin-user-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

describe('RiderExperienceAdminService.updateMentorship', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.acquireLock.mockResolvedValue(undefined);
    mocks.audit.mockResolvedValue({ id: 'audit-1' });
    mocks.notify.mockResolvedValue({ id: 'notification-1' });
  });

  it('serializes the decision, applies a status CAS, and records the audit in the same transaction', async () => {
    mocks.tx.mentorship.findUnique
      .mockResolvedValueOnce(existingMentorship)
      .mockResolvedValueOnce(updatedMentorship);
    mocks.tx.mentorship.updateMany.mockResolvedValue({ count: 1 });

    const result = await RiderExperienceAdminService.updateMentorship(
      'mentorship-1',
      { status: 'ACTIVE', note: 'Approved after participant review' },
      auditContext,
    );

    expect(result).toEqual(updatedMentorship);
    expect(mocks.acquireLock).toHaveBeenCalledOnce();
    expect(mocks.acquireLock).toHaveBeenCalledWith(
      mocks.tx,
      'mentorship-admin-decision',
      'mentorship-1',
    );
    expect(mocks.tx.mentorship.updateMany).toHaveBeenCalledWith({
      where: { id: 'mentorship-1', status: 'PENDING' },
      data: {
        status: 'ACTIVE',
        completionNote: 'Approved after participant review',
        startedAt: expect.any(Date),
      },
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      {
        ...auditContext,
        action: 'MENTORSHIP_STATUS_CHANGED',
        entityType: 'Mentorship',
        entityId: 'mentorship-1',
        oldData: { status: 'PENDING' },
        newData: {
          status: 'ACTIVE',
          note: 'Approved after participant review',
        },
      },
      mocks.tx,
    );
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'mentor-user-1',
        data: { mentorshipId: 'mentorship-1', status: 'ACTIVE' },
      }),
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'mentee-user-1',
        data: { mentorshipId: 'mentorship-1', status: 'ACTIVE' },
      }),
    );
    expect(mocks.audit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.notify.mock.invocationCallOrder[0],
    );
  });

  it('rejects a lost status race before auditing or notifying either Rider', async () => {
    mocks.tx.mentorship.findUnique.mockResolvedValueOnce(existingMentorship);
    mocks.tx.mentorship.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      RiderExperienceAdminService.updateMentorship(
        'mentorship-1',
        { status: 'ACTIVE', note: 'Approved after participant review' },
        auditContext,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'MENTORSHIP_DECISION_CONFLICT',
    });

    expect(mocks.acquireLock).toHaveBeenCalledWith(
      mocks.tx,
      'mentorship-admin-decision',
      'mentorship-1',
    );
    expect(mocks.tx.mentorship.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mentorship-1', status: 'PENDING' },
      }),
    );
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
