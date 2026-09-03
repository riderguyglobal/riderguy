import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn() },
  tx: {
    forumPost: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  recordAudit: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({ prisma: mocks.prisma }));
vi.mock('./admin-audit.service', () => ({
  AdminAuditService: { record: mocks.recordAudit },
}));

import { lockPost, pinPost } from './forum.service';

const auditContext = {
  actorUserId: 'admin-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

let post: {
  id: string;
  isPinned: boolean;
  isLocked: boolean;
  updatedAt: Date;
};
let auditRows: number;
let failAudit: boolean;

function installStatefulTransaction() {
  mocks.tx.forumPost.findUnique.mockImplementation(async () => ({ ...post }));
  mocks.tx.forumPost.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.id !== post.id || where.updatedAt?.getTime() !== post.updatedAt.getTime()) {
      return { count: 0 };
    }
    post = {
      ...post,
      ...data,
      updatedAt: new Date(post.updatedAt.getTime() + 1000),
    };
    return { count: 1 };
  });
  mocks.recordAudit.mockImplementation(async () => {
    if (failAudit) throw new Error('audit unavailable');
    auditRows += 1;
    return { id: `audit-${auditRows}` };
  });
  mocks.prisma.$transaction.mockImplementation(async (callback) => {
    const postSnapshot = { ...post };
    const auditSnapshot = auditRows;
    try {
      return await callback(mocks.tx);
    } catch (error) {
      post = postSnapshot;
      auditRows = auditSnapshot;
      throw error;
    }
  });
}

describe('forum administrator moderation decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post = {
      id: 'post-1',
      isPinned: false,
      isLocked: false,
      updatedAt: new Date('2026-09-03T00:00:00.000Z'),
    };
    auditRows = 0;
    failAudit = false;
    installStatefulTransaction();
  });

  it('pins a post and attributes the decision in the same transaction', async () => {
    await expect(pinPost(post.id, true, auditContext)).resolves.toMatchObject({
      isPinned: true,
    });

    expect(post.isPinned).toBe(true);
    expect(auditRows).toBe(1);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'COMMUNITY_POST_PINNED',
        entityType: 'ForumPost',
        entityId: post.id,
        oldData: { isPinned: false },
        newData: { isPinned: true },
      }),
      mocks.tx,
    );
  });

  it('rolls a lock mutation back when durable audit attribution fails', async () => {
    failAudit = true;

    await expect(lockPost(post.id, true, auditContext)).rejects.toThrow('audit unavailable');

    expect(post.isLocked).toBe(false);
    expect(auditRows).toBe(0);
  });

  it('rejects a stale moderation write before creating an audit row', async () => {
    mocks.tx.forumPost.updateMany.mockResolvedValue({ count: 0 });

    await expect(pinPost(post.id, true, auditContext)).rejects.toMatchObject({
      statusCode: 409,
      code: 'FORUM_POST_CHANGED',
    });

    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(post.isPinned).toBe(false);
  });

  it('treats a retry of the same moderation decision as a no-op', async () => {
    post.isPinned = true;

    await expect(pinPost(post.id, true, auditContext)).resolves.toMatchObject({
      isPinned: true,
    });

    expect(mocks.tx.forumPost.updateMany).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
