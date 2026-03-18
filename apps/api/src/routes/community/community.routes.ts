// ============================================================
// Community Routes — Sprint 11
// Chat, Forums, Polls, Announcements, Moderation
// ============================================================

import { Router, Request, Response } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { UserRole } from '@riderguy/types';
import {
  sendChatMessageSchema,
  createDirectChatSchema,
  updateLastReadSchema,
  createForumPostSchema,
  updateForumPostSchema,
  createForumCommentSchema,
  voteSchema,
  pollVoteSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  createContentReportSchema,
  resolveContentReportSchema,
  adminPinPostSchema,
  adminLockPostSchema,
} from '@riderguy/validators';
import * as ChatService from '../../services/chat.service';
import * as ForumService from '../../services/forum.service';
import * as AnnouncementService from '../../services/announcement.service';
import * as ModerationService from '../../services/moderation.service';
import { StatusCodes } from 'http-status-codes';

const router = Router();

// All community routes require authentication
router.use(authenticate);

// ============================================================
// CHAT — Rooms, Messages, Members
// ============================================================

/** GET /community/chat/rooms — List user's joined rooms */
router.get(
  '/chat/rooms',
  asyncHandler(async (req: Request, res: Response) => {
    const rooms = await ChatService.getUserRooms(req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: rooms });
  }),
);

/** GET /community/chat/zones — Browse zone rooms */
router.get(
  '/chat/zones',
  asyncHandler(async (req: Request, res: Response) => {
    const rooms = await ChatService.getAvailableZoneRooms(req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: rooms });
  }),
);

/** POST /community/chat/zones/:zoneId/join — Get or create zone room and join */
router.post(
  '/chat/zones/:zoneId/join',
  asyncHandler(async (req: Request, res: Response) => {
    const room = await ChatService.getOrCreateZoneRoom(req.params.zoneId as string);
    await ChatService.joinRoom(room.id, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: { roomId: room.id } });
  }),
);

/** POST /community/chat/direct — Create or get DM room */
router.post(
  '/chat/direct',
  validate(createDirectChatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const room = await ChatService.getOrCreateDirectRoom(req.user!.userId, req.body.userId);
    res.status(StatusCodes.OK).json({ success: true, data: room });
  }),
);

/** GET /community/chat/rooms/:roomId/messages — Get message history */
router.get(
  '/chat/rooms/:roomId/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const data = await ChatService.getMessages(req.params.roomId as string, req.user!.userId, cursor, limit);
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** POST /community/chat/rooms/:roomId/messages — Send a message */
router.post(
  '/chat/rooms/:roomId/messages',
  validate(sendChatMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await ChatService.sendMessage({
      roomId: req.params.roomId as string,
      senderId: req.user!.userId,
      content: req.body.content,
      type: req.body.type,
      mediaUrl: req.body.mediaUrl,
      replyToId: req.body.replyToId,
    });
    res.status(StatusCodes.CREATED).json({ success: true, data: message });
  }),
);

/** PUT /community/chat/rooms/:roomId/read — Mark room as read */
router.put(
  '/chat/rooms/:roomId/read',
  asyncHandler(async (req: Request, res: Response) => {
    await ChatService.markAsRead(req.params.roomId as string, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true });
  }),
);

/** GET /community/chat/rooms/:roomId/members — Get room members */
router.get(
  '/chat/rooms/:roomId/members',
  asyncHandler(async (req: Request, res: Response) => {
    const members = await ChatService.getRoomMembers(req.params.roomId as string);
    res.status(StatusCodes.OK).json({ success: true, data: members });
  }),
);

/** POST /community/chat/rooms/:roomId/leave — Leave a room */
router.post(
  '/chat/rooms/:roomId/leave',
  asyncHandler(async (req: Request, res: Response) => {
    await ChatService.leaveRoom(req.params.roomId as string, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true });
  }),
);

/** POST /community/chat/messages/:messageId/react — Add reaction */
router.post(
  '/chat/messages/:messageId/react',
  asyncHandler(async (req: Request, res: Response) => {
    const reactions = await ChatService.addReaction(
      req.params.messageId as string,
      req.user!.userId,
      req.body.emoji,
    );
    res.status(StatusCodes.OK).json({ success: true, data: reactions });
  }),
);

/** DELETE /community/chat/messages/:messageId/react — Remove reaction */
router.delete(
  '/chat/messages/:messageId/react',
  asyncHandler(async (req: Request, res: Response) => {
    const reactions = await ChatService.removeReaction(
      req.params.messageId as string,
      req.user!.userId,
      req.body.emoji,
    );
    res.status(StatusCodes.OK).json({ success: true, data: reactions });
  }),
);

/** DELETE /community/chat/messages/:messageId — Delete message */
router.delete(
  '/chat/messages/:messageId',
  asyncHandler(async (req: Request, res: Response) => {
    await ChatService.deleteMessage(req.params.messageId as string, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true });
  }),
);

// ============================================================
// FORUM — Posts, Comments, Voting
// ============================================================

/** GET /community/forum/posts — List all posts */
router.get(
  '/forum/posts',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ForumService.listPosts({
      category: req.query.category as string | undefined,
      sort: (req.query.sort as 'newest' | 'trending' | 'top') || 'newest',
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
      userId: req.user!.userId,
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** POST /community/forum/posts — Create a new post */
router.post(
  '/forum/posts',
  validate(createForumPostSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const post = await ForumService.createPost({
      authorId: req.user!.userId,
      title: req.body.title,
      body: req.body.body,
      category: req.body.category,
      poll: req.body.poll,
    });
    res.status(StatusCodes.CREATED).json({ success: true, data: post });
  }),
);

/** GET /community/forum/posts/:postId — Get single post */
router.get(
  '/forum/posts/:postId',
  asyncHandler(async (req: Request, res: Response) => {
    const post = await ForumService.getPost(req.params.postId as string, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: post });
  }),
);

/** PUT /community/forum/posts/:postId — Update a post */
router.put(
  '/forum/posts/:postId',
  validate(updateForumPostSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const post = await ForumService.updatePost(req.params.postId as string, req.user!.userId, req.body);
    res.status(StatusCodes.OK).json({ success: true, data: post });
  }),
);

/** DELETE /community/forum/posts/:postId — Delete a post */
router.delete(
  '/forum/posts/:postId',
  asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
    await ForumService.deletePost(req.params.postId as string, req.user!.userId, isAdmin);
    res.status(StatusCodes.OK).json({ success: true });
  }),
);

/** GET /community/forum/posts/:postId/comments — Get comments for post */
router.get(
  '/forum/posts/:postId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const comments = await ForumService.getComments(req.params.postId as string, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: comments });
  }),
);

/** POST /community/forum/posts/:postId/comments — Create comment */
router.post(
  '/forum/posts/:postId/comments',
  validate(createForumCommentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const comment = await ForumService.createComment({
      postId: req.params.postId as string,
      authorId: req.user!.userId,
      body: req.body.body,
      parentId: req.body.parentId,
    });
    res.status(StatusCodes.CREATED).json({ success: true, data: comment });
  }),
);

/** DELETE /community/forum/comments/:commentId — Delete comment */
router.delete(
  '/forum/comments/:commentId',
  asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
    await ForumService.deleteComment(req.params.commentId as string, req.user!.userId, isAdmin);
    res.status(StatusCodes.OK).json({ success: true });
  }),
);

/** POST /community/forum/posts/:postId/vote — Vote on a post */
router.post(
  '/forum/posts/:postId/vote',
  validate(voteSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await ForumService.voteOnPost(req.params.postId as string, req.user!.userId, req.body.value);
    res.status(StatusCodes.OK).json({ success: true, data: result });
  }),
);

/** POST /community/forum/comments/:commentId/vote — Vote on a comment */
router.post(
  '/forum/comments/:commentId/vote',
  validate(voteSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await ForumService.voteOnComment(
      req.params.commentId as string,
      req.user!.userId,
      req.body.value,
    );
    res.status(StatusCodes.OK).json({ success: true, data: result });
  }),
);

// ────── Polls ──────

/** POST /community/forum/polls/:optionId/vote — Vote on a poll */
router.post(
  '/forum/polls/:optionId/vote',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await ForumService.votePoll(req.params.optionId as string, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: result });
  }),
);

/** GET /community/forum/polls/:pollId/results — Get poll results */
router.get(
  '/forum/polls/:pollId/results',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await ForumService.getPollResults(req.params.pollId as string, req.user!.userId);
    res.status(StatusCodes.OK).json({ success: true, data: result });
  }),
);

// ============================================================
// ANNOUNCEMENTS
// ============================================================

/** GET /community/announcements — Get published announcements (for riders/clients) */
router.get(
  '/announcements',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await AnnouncementService.getPublishedAnnouncements({
      role: req.user!.role,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

// ────── Admin Announcement CRUD ──────

/** GET /community/announcements/admin — List all announcements (admin) */
router.get(
  '/announcements/admin',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await AnnouncementService.listAnnouncementsAdmin({
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** POST /community/announcements/admin — Create an announcement */
router.post(
  '/announcements/admin',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createAnnouncementSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const announcement = await AnnouncementService.createAnnouncement({
      authorId: req.user!.userId,
      ...req.body,
    });
    res.status(StatusCodes.CREATED).json({ success: true, data: announcement });
  }),
);

/** PUT /community/announcements/admin/:id — Update an announcement */
router.put(
  '/announcements/admin/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(updateAnnouncementSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const announcement = await AnnouncementService.updateAnnouncement(req.params.id as string, req.body);
    res.status(StatusCodes.OK).json({ success: true, data: announcement });
  }),
);

/** DELETE /community/announcements/admin/:id — Delete an announcement */
router.delete(
  '/announcements/admin/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    await AnnouncementService.deleteAnnouncement(req.params.id as string);
    res.status(StatusCodes.OK).json({ success: true });
  }),
);

// ============================================================
// MODERATION — Reports & Admin Review
// ============================================================

/** POST /community/reports — Report content */
router.post(
  '/reports',
  validate(createContentReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const report = await ModerationService.createReport({
      reporterId: req.user!.userId,
      ...req.body,
    });
    res.status(StatusCodes.CREATED).json({ success: true, data: report });
  }),
);

/** GET /community/reports/admin — Admin report queue */
router.get(
  '/reports/admin',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ModerationService.listReports({
      status: req.query.status as string | undefined,
      entityType: req.query.entityType as string | undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  }),
);

/** PUT /community/reports/admin/:id — Resolve a report */
router.put(
  '/reports/admin/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(resolveContentReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const report = await ModerationService.resolveReport(req.params.id as string, req.user!.userId, req.body);
    res.status(StatusCodes.OK).json({ success: true, data: report });
  }),
);

/** GET /community/reports/admin/stats — Moderation stats */
router.get(
  '/reports/admin/stats',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await ModerationService.getModerationStats();
    res.status(StatusCodes.OK).json({ success: true, data: stats });
  }),
);

// ────── Admin Forum Moderation ──────

/** PUT /community/forum/admin/posts/:postId/pin — Pin/unpin a post */
router.put(
  '/forum/admin/posts/:postId/pin',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(adminPinPostSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const post = await ForumService.pinPost(req.params.postId as string, req.body.isPinned);
    res.status(StatusCodes.OK).json({ success: true, data: post });
  }),
);

/** PUT /community/forum/admin/posts/:postId/lock — Lock/unlock a post */
router.put(
  '/forum/admin/posts/:postId/lock',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(adminLockPostSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const post = await ForumService.lockPost(req.params.postId as string, req.body.isLocked);
    res.status(StatusCodes.OK).json({ success: true, data: post });
  }),
);

export { router as communityRouter };
