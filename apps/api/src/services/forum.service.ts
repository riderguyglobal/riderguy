// ============================================================
// Forum Service — Sprint 11
// Posts, comments, voting, trending
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';

// ────── Posts ──────

export async function createPost(data: {
  authorId: string;
  title: string;
  body: string;
  category?: string;
  poll?: { question: string; options: string[]; expiresAt?: string };
}) {
  const post = await prisma.forumPost.create({
    data: {
      authorId: data.authorId,
      title: data.title,
      body: data.body,
      category: (data.category ?? 'GENERAL') as any,
      ...(data.poll
        ? {
          poll: {
            create: {
              question: data.poll.question,
              expiresAt: data.poll.expiresAt ? new Date(data.poll.expiresAt) : null,
              options: {
                create: data.poll.options.map((text, i) => ({
                  text,
                  position: i,
                })),
              },
            },
          },
        }
        : {}),
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      _count: { select: { comments: true } },
      poll: {
        include: {
          options: {
            include: { _count: { select: { votes: true } } },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });

  return formatPost(post, data.authorId);
}

export async function getPost(postId: string, userId?: string) {
  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      _count: { select: { comments: true } },
      poll: {
        include: {
          options: {
            include: {
              _count: { select: { votes: true } },
              votes: userId ? { where: { userId } } : false,
            },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });

  if (!post || post.isDeleted) throw ApiError.notFound('Post not found');

  // Increment view count (fire-and-forget)
  prisma.forumPost.update({
    where: { id: postId },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  // Get user's vote if logged in
  let userVote: number | null = null;
  if (userId) {
    const vote = await prisma.forumVote.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    userVote = vote?.value ?? null;
  }

  return { ...formatPost(post, userId), userVote };
}

export async function listPosts(options: {
  category?: string;
  sort?: 'newest' | 'trending' | 'top';
  page?: number;
  limit?: number;
  userId?: string;
}) {
  const { category, sort = 'newest', page = 1, limit = 20, userId } = options;
  const skip = (page - 1) * limit;

  const where: any = { isDeleted: false };
  if (category) where.category = category;

  let orderBy: any;
  switch (sort) {
    case 'trending':
      orderBy = [{ viewCount: 'desc' as const }, { upvotes: 'desc' as const }, { createdAt: 'desc' as const }];
      break;
    case 'top':
      orderBy = [{ upvotes: 'desc' as const }, { createdAt: 'desc' as const }];
      break;
    default:
      orderBy = [{ isPinned: 'desc' as const }, { createdAt: 'desc' as const }];
  }

  const [posts, total] = await Promise.all([
    prisma.forumPost.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        _count: { select: { comments: true } },
        poll: { select: { id: true } },
      },
    }),
    prisma.forumPost.count({ where }),
  ]);

  return {
    posts: posts.map(p => formatPost(p, userId)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updatePost(postId: string, userId: string, data: {
  title?: string;
  body?: string;
  category?: string;
}) {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post || post.isDeleted) throw ApiError.notFound('Post not found');
  if (post.authorId !== userId) throw ApiError.forbidden('You can only edit your own posts');

  return prisma.forumPost.update({
    where: { id: postId },
    data: {
      ...(data.title ? { title: data.title } : {}),
      ...(data.body ? { body: data.body } : {}),
      ...(data.category ? { category: data.category as any } : {}),
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      _count: { select: { comments: true } },
    },
  });
}

export async function deletePost(postId: string, userId: string, isAdmin = false) {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound('Post not found');
  if (post.authorId !== userId && !isAdmin) {
    throw ApiError.forbidden('You can only delete your own posts');
  }

  await prisma.forumPost.update({
    where: { id: postId },
    data: { isDeleted: true },
  });
}

// ────── Admin Moderation ──────

export async function pinPost(postId: string, isPinned: boolean) {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound('Post not found');

  return prisma.forumPost.update({
    where: { id: postId },
    data: { isPinned },
  });
}

export async function lockPost(postId: string, isLocked: boolean) {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound('Post not found');

  return prisma.forumPost.update({
    where: { id: postId },
    data: { isLocked },
  });
}

// ────── Comments ──────

export async function createComment(data: {
  postId: string;
  authorId: string;
  body: string;
  parentId?: string;
}) {
  const post = await prisma.forumPost.findUnique({ where: { id: data.postId } });
  if (!post || post.isDeleted) throw ApiError.notFound('Post not found');
  if (post.isLocked) throw ApiError.badRequest('This post is locked — new comments are not allowed');

  const comment = await prisma.forumComment.create({
    data: {
      postId: data.postId,
      authorId: data.authorId,
      body: data.body,
      parentId: data.parentId ?? null,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  return formatComment(comment);
}

export async function getComments(postId: string, userId?: string) {
  const comments = await prisma.forumComment.findMany({
    where: { postId, isDeleted: false, parentId: null },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      replies: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      },
    },
  });

  // Get user's votes for all visible comments
  let userVotes: Record<string, number> = {};
  if (userId) {
    const commentIds = comments.flatMap(c => [c.id, ...c.replies.map(r => r.id)]);
    const votes = await prisma.forumVote.findMany({
      where: { userId, commentId: { in: commentIds } },
    });
    userVotes = votes.reduce((acc, v) => {
      if (v.commentId) acc[v.commentId] = v.value;
      return acc;
    }, {} as Record<string, number>);
  }

  return comments.map(c => ({
    ...formatComment(c),
    userVote: userVotes[c.id] ?? null,
    replies: c.replies.map(r => ({
      ...formatComment(r),
      userVote: userVotes[r.id] ?? null,
    })),
  }));
}

export async function deleteComment(commentId: string, userId: string, isAdmin = false) {
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment) throw ApiError.notFound('Comment not found');
  if (comment.authorId !== userId && !isAdmin) {
    throw ApiError.forbidden('You can only delete your own comments');
  }

  await prisma.forumComment.update({
    where: { id: commentId },
    data: { isDeleted: true, body: '[deleted]' },
  });
}

// ────── Voting (posts & comments) ──────

export async function voteOnPost(postId: string, userId: string, value: number) {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post || post.isDeleted) throw ApiError.notFound('Post not found');

  const existing = await prisma.forumVote.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    if (existing.value === value) {
      // Same vote → remove it (toggle off)
      await prisma.forumVote.delete({ where: { id: existing.id } });
      await prisma.forumPost.update({
        where: { id: postId },
        data: value === 1 ? { upvotes: { decrement: 1 } } : { downvotes: { decrement: 1 } },
      });
      return { value: 0 };
    } else {
      // Flip vote
      await prisma.forumVote.update({ where: { id: existing.id }, data: { value } });
      await prisma.forumPost.update({
        where: { id: postId },
        data:
          value === 1
            ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 } }
            : { upvotes: { decrement: 1 }, downvotes: { increment: 1 } },
      });
      return { value };
    }
  }

  // New vote
  await prisma.forumVote.create({
    data: { userId, postId, value },
  });
  await prisma.forumPost.update({
    where: { id: postId },
    data: value === 1 ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
  });
  return { value };
}

export async function voteOnComment(commentId: string, userId: string, value: number) {
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.isDeleted) throw ApiError.notFound('Comment not found');

  const existing = await prisma.forumVote.findUnique({
    where: { userId_commentId: { userId, commentId } },
  });

  if (existing) {
    if (existing.value === value) {
      await prisma.forumVote.delete({ where: { id: existing.id } });
      await prisma.forumComment.update({
        where: { id: commentId },
        data: value === 1 ? { upvotes: { decrement: 1 } } : { downvotes: { decrement: 1 } },
      });
      return { value: 0 };
    } else {
      await prisma.forumVote.update({ where: { id: existing.id }, data: { value } });
      await prisma.forumComment.update({
        where: { id: commentId },
        data:
          value === 1
            ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 } }
            : { upvotes: { decrement: 1 }, downvotes: { increment: 1 } },
      });
      return { value };
    }
  }

  await prisma.forumVote.create({
    data: { userId, commentId, value },
  });
  await prisma.forumComment.update({
    where: { id: commentId },
    data: value === 1 ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
  });
  return { value };
}

// ────── Polls ──────

export async function votePoll(optionId: string, userId: string) {
  const option = await prisma.pollOption.findUnique({
    where: { id: optionId },
    include: { poll: true },
  });
  if (!option) throw ApiError.notFound('Poll option not found');

  // Check if poll is expired
  if (option.poll.expiresAt && option.poll.expiresAt < new Date()) {
    throw ApiError.badRequest('This poll has expired');
  }

  // Check if user already voted on any option of this poll
  const existingVote = await prisma.pollVote.findFirst({
    where: {
      userId,
      option: { pollId: option.pollId },
    },
  });

  if (existingVote) {
    // Change vote
    await prisma.pollVote.delete({ where: { id: existingVote.id } });
  }

  await prisma.pollVote.create({
    data: { optionId, userId },
  });

  // Return updated poll results
  return getPollResults(option.pollId, userId);
}

export async function getPollResults(pollId: string, userId?: string) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        orderBy: { position: 'asc' },
        include: {
          _count: { select: { votes: true } },
          ...(userId ? { votes: { where: { userId } } } : {}),
        },
      },
    },
  });

  if (!poll) throw ApiError.notFound('Poll not found');

  const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0);

  return {
    id: poll.id,
    question: poll.question,
    expiresAt: poll.expiresAt?.toISOString() ?? null,
    isExpired: poll.expiresAt ? poll.expiresAt < new Date() : false,
    totalVotes,
    options: poll.options.map(o => ({
      id: o.id,
      text: o.text,
      votes: o._count.votes,
      percentage: totalVotes > 0 ? Math.round((o._count.votes / totalVotes) * 100) : 0,
      userVoted: userId ? (o as any).votes?.length > 0 : false,
    })),
  };
}

// ────── Helper formatters ──────

function formatPost(post: any, userId?: string) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    isPinned: post.isPinned,
    isLocked: post.isLocked,
    viewCount: post.viewCount,
    upvotes: post.upvotes,
    downvotes: post.downvotes,
    score: post.upvotes - post.downvotes,
    commentCount: post._count?.comments ?? 0,
    hasPoll: !!post.poll,
    poll: post.poll
      ? {
        id: post.poll.id,
        question: post.poll.question,
        expiresAt: post.poll.expiresAt?.toISOString() ?? null,
        isExpired: post.poll.expiresAt ? post.poll.expiresAt < new Date() : false,
        options: post.poll.options?.map((o: any) => ({
          id: o.id,
          text: o.text,
          votes: o._count?.votes ?? 0,
          userVoted: userId ? o.votes?.some((v: any) => v.userId === userId) : false,
        })) ?? [],
        totalVotes: post.poll.options?.reduce((sum: number, o: any) => sum + (o._count?.votes ?? 0), 0) ?? 0,
      }
      : null,
    author: {
      id: post.author.id,
      firstName: post.author.firstName,
      lastName: post.author.lastName,
      avatarUrl: post.author.avatarUrl,
    },
    isOwner: userId ? post.authorId === userId : false,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function formatComment(comment: any) {
  return {
    id: comment.id,
    postId: comment.postId,
    body: comment.body,
    upvotes: comment.upvotes,
    downvotes: comment.downvotes,
    score: comment.upvotes - comment.downvotes,
    parentId: comment.parentId,
    author: {
      id: comment.author.id,
      firstName: comment.author.firstName,
      lastName: comment.author.lastName,
      avatarUrl: comment.author.avatarUrl,
    },
    createdAt: comment.createdAt.toISOString(),
  };
}
