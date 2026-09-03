import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveContentReportSchema } from '@riderguy/validators';

const mocks = vi.hoisted(() => {
  const tx = {
    contentReport: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    chatMessage: { findUnique: vi.fn(), update: vi.fn() },
    chatMember: { updateMany: vi.fn() },
    forumPost: { findUnique: vi.fn(), update: vi.fn() },
    forumComment: { findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    prisma: {
      contentReport: { findMany: vi.fn(), count: vi.fn() },
      forumPost: { findMany: vi.fn() },
      forumComment: { findMany: vi.fn() },
      chatMessage: { findMany: vi.fn() },
    },
    transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
    acquireLock: vi.fn(),
    audit: vi.fn(),
    notify: vi.fn(),
  };
});

vi.mock('@riderguy/database', () => ({
  prisma: { ...mocks.prisma, $transaction: mocks.transaction },
}));

vi.mock('../lib/postgres-advisory-lock', () => ({
  acquireTransactionAdvisoryLock: mocks.acquireLock,
}));

vi.mock('./admin-audit.service', () => ({
  AdminAuditService: { record: mocks.audit },
}));

vi.mock('./notification.service', () => ({
  NotificationService: { create: mocks.notify },
}));

import { listReports, resolveReport } from './moderation.service';

const auditContext = {
  actorUserId: 'admin-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-1',
    reporterId: 'reporter-1',
    reason: 'HARASSMENT',
    description: 'Unsafe language',
    entityType: 'forum_post',
    entityId: 'post-1',
    status: 'PENDING',
    moderatorId: null,
    moderatorNote: null,
    actionTaken: null,
    resolvedAt: null,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    reporter: { id: 'reporter-1', firstName: 'Ama', lastName: 'Mensah' },
    ...overrides,
  };
}

describe('content moderation decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.contentReport.findUnique.mockResolvedValue(report());
    mocks.tx.contentReport.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.contentReport.findUniqueOrThrow.mockResolvedValue(
      report({
        status: 'ACTION_TAKEN',
        moderatorId: 'admin-1',
        actionTaken: 'WARNING',
        resolvedAt: new Date('2026-09-01T11:00:00.000Z'),
      }),
    );
    mocks.tx.forumPost.findUnique.mockResolvedValue({ authorId: 'offender-1' });
    mocks.tx.forumPost.update.mockResolvedValue({});
    mocks.tx.chatMessage.findUnique.mockResolvedValue({
      senderId: 'offender-1',
      roomId: 'room-1',
    });
    mocks.tx.chatMessage.update.mockResolvedValue({});
    mocks.tx.chatMember.updateMany.mockResolvedValue({ count: 1 });
    mocks.audit.mockResolvedValue({});
    mocks.notify.mockResolvedValue({});
  });

  it('removes forum content, records the decision atomically, and warns after commit', async () => {
    await resolveReport(
      'report-1',
      'admin-1',
      { status: 'ACTION_TAKEN', actionTaken: 'WARNING', moderatorNote: 'Confirmed.' },
      auditContext,
    );

    expect(mocks.acquireLock).toHaveBeenCalledWith(mocks.tx, 'content-report-review', 'report-1');
    expect(mocks.tx.forumPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { isDeleted: true },
    });
    expect(mocks.tx.contentReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'report-1', status: 'PENDING' } }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'COMMUNITY_REPORT_RESOLVED',
      }),
      mocks.tx,
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'offender-1', title: 'Community moderation decision' }),
    );
  });

  it('applies room mutes only to a reported chat author', async () => {
    mocks.tx.contentReport.findUnique.mockResolvedValue(
      report({ entityType: 'chat_message', entityId: 'message-1' }),
    );
    mocks.tx.contentReport.findUniqueOrThrow.mockResolvedValue(
      report({
        entityType: 'chat_message',
        entityId: 'message-1',
        status: 'ACTION_TAKEN',
        actionTaken: 'MUTE_24H',
        resolvedAt: new Date(),
      }),
    );

    await resolveReport(
      'report-1',
      'admin-1',
      { status: 'ACTION_TAKEN', actionTaken: 'MUTE_24H' },
      auditContext,
    );

    expect(mocks.tx.chatMember.updateMany).toHaveBeenCalledWith({
      where: { userId: 'offender-1', roomId: 'room-1' },
      data: { isMuted: true, mutedUntil: expect.any(Date) },
    });
  });

  it('does not claim success when an action cannot be applied', async () => {
    await expect(
      resolveReport(
        'report-1',
        'admin-1',
        { status: 'ACTION_TAKEN', actionTaken: 'MUTE_7D' },
        auditContext,
      ),
    ).rejects.toThrow('only for reported chat messages');

    expect(mocks.tx.contentReport.updateMany).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('rejects a second decision without replaying moderation effects', async () => {
    mocks.tx.contentReport.findUnique.mockResolvedValue(report({ status: 'DISMISSED' }));

    await expect(
      resolveReport('report-1', 'admin-1', { status: 'DISMISSED' }, auditContext),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.tx.forumPost.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe('administrator moderation queue evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.contentReport.count.mockResolvedValue(3);
    mocks.prisma.contentReport.findMany.mockResolvedValue([
      report(),
      report({ id: 'report-2', entityType: 'forum_comment', entityId: 'comment-1' }),
      report({ id: 'report-3', entityType: 'chat_message', entityId: 'message-1' }),
    ]);
    mocks.prisma.forumPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        title: 'Road safety discussion',
        body: 'This is the exact forum post text under review.',
        isDeleted: false,
        createdAt: new Date('2026-09-01T09:00:00.000Z'),
        author: { id: 'author-1', firstName: 'Kofi', lastName: 'Asare' },
      },
    ]);
    mocks.prisma.forumComment.findMany.mockResolvedValue([
      {
        id: 'comment-1',
        body: 'This is the exact comment under review.',
        isDeleted: false,
        createdAt: new Date('2026-09-01T09:15:00.000Z'),
        author: { id: 'author-2', firstName: 'Efua', lastName: 'Boateng' },
        post: { id: 'post-2', title: 'Accra Rider meetup' },
      },
    ]);
    mocks.prisma.chatMessage.findMany.mockResolvedValue([
      {
        id: 'message-1',
        content: 'This is the exact room message under review.',
        mediaUrl: 'https://cdn.example.com/evidence.jpg',
        isDeleted: false,
        createdAt: new Date('2026-09-01T09:30:00.000Z'),
        sender: { id: 'author-3', firstName: 'Yaw', lastName: 'Osei' },
        room: { id: 'room-1', name: 'Accra Central Riders', type: 'ZONE' },
      },
    ]);
  });

  it('returns the reported content, its author, and minimum review context for every content type', async () => {
    const result = await listReports({ status: 'PENDING', page: 1, limit: 20 });

    expect(result.reports).toEqual([
      expect.objectContaining({
        id: 'report-1',
        reportedContent: {
          author: { id: 'author-1', firstName: 'Kofi', lastName: 'Asare' },
          title: 'Road safety discussion',
          text: 'This is the exact forum post text under review.',
          isDeleted: false,
          createdAt: '2026-09-01T09:00:00.000Z',
        },
      }),
      expect.objectContaining({
        id: 'report-2',
        reportedContent: expect.objectContaining({
          author: { id: 'author-2', firstName: 'Efua', lastName: 'Boateng' },
          text: 'This is the exact comment under review.',
          context: { id: 'post-2', label: 'Accra Rider meetup', type: 'forum_post' },
        }),
      }),
      expect.objectContaining({
        id: 'report-3',
        reportedContent: expect.objectContaining({
          author: { id: 'author-3', firstName: 'Yaw', lastName: 'Osei' },
          text: 'This is the exact room message under review.',
          mediaUrl: 'https://cdn.example.com/evidence.jpg',
          context: { id: 'room-1', label: 'Accra Central Riders', type: 'ZONE' },
        }),
      }),
    ]);
    expect(mocks.prisma.forumPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          author: { select: { id: true, firstName: true, lastName: true } },
        }),
      }),
    );
  });

  it('marks missing source content as unavailable instead of substituting reporter prose', async () => {
    mocks.prisma.forumPost.findMany.mockResolvedValue([]);

    const result = await listReports({ status: 'PENDING', page: 1, limit: 20 });

    expect(result.reports[0]).toMatchObject({
      description: 'Unsafe language',
      reportedContent: null,
    });
  });
});

describe('content moderation validation', () => {
  it('requires a real implemented action and rejects legacy pretend bans', () => {
    expect(() => resolveContentReportSchema.parse({ status: 'ACTION_TAKEN' })).toThrow();
    expect(() =>
      resolveContentReportSchema.parse({
        status: 'ACTION_TAKEN',
        actionTaken: 'BAN_FROM_COMMUNITY',
      }),
    ).toThrow();
    expect(
      resolveContentReportSchema.parse({ status: 'ACTION_TAKEN', actionTaken: 'WARNING' }),
    ).toEqual({ status: 'ACTION_TAKEN', actionTaken: 'WARNING' });
  });
});
