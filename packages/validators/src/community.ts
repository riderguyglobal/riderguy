// ============================================================
// Community Validators — Sprint 11
// Chat, Forums, Polls, Announcements, Moderation
// ============================================================

import { z } from 'zod';

// ────── Chat ──────

export const sendChatMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
  type: z.enum(['TEXT', 'IMAGE', 'VOICE']).default('TEXT'),
  mediaUrl: z.string().url().optional(),
  replyToId: z.string().optional(),
});

export const createDirectChatSchema = z.object({
  targetUserId: z.string().min(1, 'Target user ID is required'),
});

export const updateLastReadSchema = z.object({
  roomId: z.string().min(1),
});

// ────── Forum ──────

export const createForumPostSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  body: z.string().min(10, 'Post body must be at least 10 characters').max(10000, 'Post too long'),
  category: z.enum([
    'GENERAL', 'TIPS_TRICKS', 'ROUTES', 'VEHICLE_MAINTENANCE',
    'EARNINGS', 'SAFETY', 'EVENTS', 'FEATURE_REQUESTS', 'OFF_TOPIC',
  ]).default('GENERAL'),
  // Optional poll
  poll: z.object({
    question: z.string().min(5, 'Poll question must be at least 5 characters').max(300),
    options: z.array(z.string().min(1).max(100)).min(2, 'Polls need at least 2 options').max(10),
    expiresAt: z.string().datetime().optional(),
  }).optional(),
});

export const updateForumPostSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  body: z.string().min(10).max(10000).optional(),
  category: z.enum([
    'GENERAL', 'TIPS_TRICKS', 'ROUTES', 'VEHICLE_MAINTENANCE',
    'EARNINGS', 'SAFETY', 'EVENTS', 'FEATURE_REQUESTS', 'OFF_TOPIC',
  ]).optional(),
});

export const createForumCommentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment too long'),
  parentId: z.string().optional(), // For nested replies
});

export const voteSchema = z.object({
  value: z.number().refine(v => v === 1 || v === -1, 'Vote must be +1 or -1'),
});

export const pollVoteSchema = z.object({
  optionId: z.string().min(1, 'Option ID is required'),
});

// ────── Announcements (Admin) ──────

export const createAnnouncementSchema = z.object({
  title: z.string().min(3, 'Title too short').max(200),
  body: z.string().min(10, 'Body too short').max(10000),
  priority: z.number().int().min(0).max(2).default(0),
  targetZones: z.array(z.string()).default([]),
  targetRoles: z.array(z.enum(['RIDER', 'CLIENT', 'BUSINESS_CLIENT', 'PARTNER', 'DISPATCHER', 'ADMIN', 'SUPER_ADMIN'])).default(['RIDER']),
  isPublished: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  body: z.string().min(10).max(10000).optional(),
  priority: z.number().int().min(0).max(2).optional(),
  targetZones: z.array(z.string()).optional(),
  targetRoles: z.array(z.enum(['RIDER', 'CLIENT', 'BUSINESS_CLIENT', 'PARTNER', 'DISPATCHER', 'ADMIN', 'SUPER_ADMIN'])).optional(),
  isPublished: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// ────── Content Moderation ──────

export const createContentReportSchema = z.object({
  entityType: z.enum(['chat_message', 'forum_post', 'forum_comment']),
  entityId: z.string().min(1),
  reason: z.enum(['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'MISINFORMATION', 'INAPPROPRIATE', 'SCAM', 'OTHER']),
  description: z.string().max(1000).optional(),
});

export const resolveContentReportSchema = z.object({
  moderatorNote: z.string().max(1000).optional(),
  actionTaken: z.enum(['WARNING', 'MUTE_1H', 'MUTE_24H', 'MUTE_7D', 'BAN_FROM_ROOM', 'BAN_FROM_COMMUNITY']).optional(),
  status: z.enum(['REVIEWED', 'ACTION_TAKEN', 'DISMISSED']),
});

// ────── Admin Forum Moderation ──────

export const adminPinPostSchema = z.object({
  isPinned: z.boolean(),
});

export const adminLockPostSchema = z.object({
  isLocked: z.boolean(),
});
