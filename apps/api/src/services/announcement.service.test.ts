import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  announcement: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  riderProfileFindMany: vi.fn(),
  transaction: vi.fn(),
  recordAudit: vi.fn(),
  notificationCreate: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    announcement: mocks.announcement,
    riderProfile: { findMany: mocks.riderProfileFindMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock('./admin-audit.service', () => ({
  AdminAuditService: { record: mocks.recordAudit },
}));
vi.mock('./notification.service', () => ({
  NotificationService: { create: mocks.notificationCreate },
}));
vi.mock('../lib/logger', () => ({
  logger: { error: mocks.loggerError, warn: mocks.loggerWarn },
}));

import {
  createAnnouncement,
  deleteAnnouncement,
  getPublishedAnnouncements,
  updateAnnouncement,
} from './announcement.service';

const timestamp = new Date('2026-09-02T10:00:00.000Z');

function announcement(id: string, targetZones: string[]) {
  return {
    id,
    title: `${id} title`,
    body: `${id} message`,
    priority: 0,
    targetZones,
    targetRoles: ['RIDER'],
    isPublished: true,
    publishedAt: timestamp,
    expiresAt: null,
    author: { id: 'admin-1', firstName: 'RiderGuy', lastName: 'Admin' },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function publishedWhere() {
  const call = mocks.announcement.findMany.mock.calls[0]?.[0] as {
    where: { AND: Array<Record<string, unknown>> };
  };
  return call.where;
}

describe('published announcement zone visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) =>
      callback({ announcement: mocks.announcement }),
    );
    mocks.recordAudit.mockResolvedValue({ id: 'audit-1' });
    mocks.riderProfileFindMany.mockResolvedValue([]);
    mocks.notificationCreate.mockResolvedValue({ id: 'notification-1' });
  });

  it('keeps global Rider messages visible without exposing zone-targeted messages when the zone is unknown', async () => {
    mocks.announcement.findMany.mockResolvedValue([announcement('global', [])]);
    mocks.announcement.count.mockResolvedValue(1);

    const result = await getPublishedAnnouncements({ role: 'RIDER' });

    expect(result.announcements.map((item) => item.id)).toEqual(['global']);
    const where = publishedWhere();
    expect(where.AND.at(-1)).toEqual({
      OR: [{ targetZones: { isEmpty: true } }],
    });
    expect(mocks.announcement.count).toHaveBeenCalledWith({ where });
  });

  it('returns global messages plus messages targeted to the Rider current zone only', async () => {
    mocks.announcement.findMany.mockResolvedValue([
      announcement('global', []),
      announcement('accra-only', ['zone-accra']),
    ]);
    mocks.announcement.count.mockResolvedValue(2);

    const result = await getPublishedAnnouncements({
      roles: ['RIDER'],
      zoneId: 'zone-accra',
      page: 1,
      limit: 10,
    });

    expect(result.announcements.map((item) => item.id)).toEqual(['global', 'accra-only']);
    const where = publishedWhere();
    expect(where.AND.at(-1)).toEqual({
      OR: [{ targetZones: { isEmpty: true } }, { targetZones: { has: 'zone-accra' } }],
    });
    expect(where.AND.at(-1)).not.toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([{ targetZones: { has: 'zone-kumasi' } }]),
      }),
    );
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
  });
});

describe('announcement administrator decisions', () => {
  const auditContext = {
    actorUserId: 'admin-1',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) =>
      callback({ announcement: mocks.announcement }),
    );
    mocks.recordAudit.mockResolvedValue({ id: 'audit-1' });
    mocks.riderProfileFindMany.mockResolvedValue([]);
    mocks.notificationCreate.mockResolvedValue({ id: 'notification-1' });
  });

  it('creates the broadcast and its attributed audit in one transaction', async () => {
    const created = announcement('announcement-1', []);
    mocks.announcement.create.mockResolvedValue(created);

    await expect(
      createAnnouncement(
        {
          authorId: 'admin-1',
          title: created.title,
          body: created.body,
          isPublished: true,
        },
        auditContext,
      ),
    ).resolves.toMatchObject({ id: created.id, isPublished: true });

    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'RIDER_BROADCAST_PUBLISHED',
        entityId: created.id,
      }),
      { announcement: mocks.announcement },
    );
  });

  it('notifies every active Rider in the targeted zones only after commit', async () => {
    const created = {
      ...announcement('announcement-1', ['zone-accra']),
      priority: 2,
    };
    mocks.announcement.create.mockResolvedValue(created);
    mocks.riderProfileFindMany.mockResolvedValueOnce([
      { id: 'profile-1', userId: 'rider-1' },
      { id: 'profile-2', userId: 'rider-2' },
    ]);

    await createAnnouncement(
      {
        authorId: 'admin-1',
        title: created.title,
        body: created.body,
        priority: 2,
        targetZones: ['zone-accra'],
        isPublished: true,
      },
      auditContext,
    );

    expect(mocks.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.riderProfileFindMany.mock.invocationCallOrder[0],
    );
    expect(mocks.riderProfileFindMany).toHaveBeenCalledWith({
      where: {
        user: { status: 'ACTIVE', deletedAt: null },
        currentZoneId: { in: ['zone-accra'] },
      },
      select: { id: true, userId: true },
      orderBy: { id: 'asc' },
      take: 200,
    });
    expect(mocks.notificationCreate).toHaveBeenCalledTimes(2);
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      userId: 'rider-1',
      title: created.title,
      body: created.body,
      type: 'SYSTEM',
      data: {
        context: 'ANNOUNCEMENT',
        announcementId: created.id,
        priority: 2,
      },
    });
  });

  it('does not notify Riders for a draft or a broadcast targeting other roles', async () => {
    mocks.announcement.create
      .mockResolvedValueOnce({ ...announcement('draft', []), isPublished: false })
      .mockResolvedValueOnce({
        ...announcement('client-only', []),
        targetRoles: ['CLIENT'],
      });

    await createAnnouncement(
      {
        authorId: 'admin-1',
        title: 'Draft',
        body: 'Not published.',
        isPublished: false,
      },
      auditContext,
    );
    await createAnnouncement(
      {
        authorId: 'admin-1',
        title: 'Clients',
        body: 'Client-only update.',
        targetRoles: ['CLIENT'],
        isPublished: true,
      },
      auditContext,
    );

    expect(mocks.riderProfileFindMany).not.toHaveBeenCalled();
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it('does not report success when durable update attribution fails', async () => {
    let stored = announcement('announcement-1', []);
    mocks.transaction.mockImplementation(async (callback) => {
      const snapshot = { ...stored };
      try {
        return await callback({ announcement: mocks.announcement });
      } catch (error) {
        stored = snapshot;
        throw error;
      }
    });
    mocks.announcement.findUnique.mockImplementation(async () => stored);
    mocks.announcement.updateMany.mockImplementation(async ({ data }) => {
      stored = { ...stored, ...data, updatedAt: new Date('2026-09-02T10:01:00.000Z') };
      return { count: 1 };
    });
    mocks.recordAudit.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      updateAnnouncement(stored.id, { title: 'Updated announcement' }, auditContext),
    ).rejects.toThrow('audit unavailable');

    expect(stored.title).toBe('announcement-1 title');
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'RIDER_BROADCAST_UPDATED',
        entityId: stored.id,
      }),
      { announcement: mocks.announcement },
    );
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it('notifies the current Rider audience after a published update commits', async () => {
    const existing = announcement('announcement-1', []);
    const updated = { ...existing, title: 'Updated safety briefing' };
    mocks.announcement.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
    mocks.announcement.updateMany.mockResolvedValue({ count: 1 });
    mocks.riderProfileFindMany.mockResolvedValue([{ id: 'profile-1', userId: 'rider-1' }]);

    await updateAnnouncement(existing.id, { title: updated.title }, auditContext);

    expect(mocks.recordAudit).toHaveBeenCalled();
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'rider-1',
        title: updated.title,
        data: expect.objectContaining({
          context: 'ANNOUNCEMENT',
          announcementId: existing.id,
        }),
      }),
    );
  });

  it('rejects a stale announcement update before writing an audit', async () => {
    const existing = announcement('announcement-1', []);
    mocks.announcement.findUnique.mockResolvedValue(existing);
    mocks.announcement.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateAnnouncement(existing.id, { title: 'Stale edit' }, auditContext),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ANNOUNCEMENT_CHANGED' });

    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('deletes a broadcast only in the same transaction as its audit', async () => {
    const existing = announcement('announcement-1', []);
    mocks.announcement.findUnique.mockResolvedValue(existing);
    mocks.announcement.deleteMany.mockResolvedValue({ count: 1 });

    await deleteAnnouncement(existing.id, auditContext);

    expect(mocks.announcement.deleteMany).toHaveBeenCalledWith({
      where: { id: existing.id, updatedAt: existing.updatedAt },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'RIDER_BROADCAST_DELETED',
        entityId: existing.id,
      }),
      { announcement: mocks.announcement },
    );
  });
});
