// ============================================================
// Chat Service — Sprint 11
// Zone chat rooms, direct messages, message history
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';

// ────── Room Management ──────

/** Get or create the zone chat room for a given zone */
export async function getOrCreateZoneRoom(zoneId: string) {
  const existing = await prisma.chatRoom.findFirst({
    where: { type: 'ZONE', zoneId, isActive: true },
    include: { _count: { select: { members: true } } },
  });

  if (existing) return existing;

  // Fetch zone name for the room name
  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { name: true },
  });

  return prisma.chatRoom.create({
    data: {
      name: zone ? `${zone.name} Riders` : 'Zone Chat',
      type: 'ZONE',
      zoneId,
      description: `Chat room for riders in ${zone?.name ?? 'this zone'}`,
    },
    include: { _count: { select: { members: true } } },
  });
}

/** Get or create a DM room between two users */
export async function getOrCreateDirectRoom(userId1: string, userId2: string) {
  // Check if a DM room already exists between these two users
  const existing = await prisma.chatRoom.findFirst({
    where: {
      type: 'DIRECT',
      isActive: true,
      AND: [
        { members: { some: { userId: userId1 } } },
        { members: { some: { userId: userId2 } } },
      ],
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      },
      _count: { select: { messages: true } },
    },
  });

  if (existing) return existing;

  // Get both users' names for room name
  const [user1, user2] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId1 }, select: { firstName: true, lastName: true } }),
    prisma.user.findUnique({ where: { id: userId2 }, select: { firstName: true, lastName: true } }),
  ]);

  if (!user1 || !user2) throw ApiError.notFound('User not found');

  const room = await prisma.chatRoom.create({
    data: {
      name: `${user1.firstName} & ${user2.firstName}`,
      type: 'DIRECT',
      members: {
        create: [{ userId: userId1 }, { userId: userId2 }],
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      },
      _count: { select: { messages: true } },
    },
  });

  return room;
}

/** Join a zone chat room */
export async function joinRoom(roomId: string, userId: string) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room || !room.isActive) throw ApiError.notFound('Chat room not found');
  if (room.type === 'DIRECT') throw ApiError.badRequest('Cannot manually join DM rooms');

  const existing = await prisma.chatMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (existing) return existing;

  return prisma.chatMember.create({
    data: { roomId, userId },
  });
}

/** Leave a chat room */
export async function leaveRoom(roomId: string, userId: string) {
  await prisma.chatMember.deleteMany({
    where: { roomId, userId },
  });
}

// ────── Rooms List ──────

/** Get all rooms the user is a member of */
export async function getUserRooms(userId: string) {
  const memberships = await prisma.chatMember.findMany({
    where: { userId },
    include: {
      room: {
        include: {
          _count: { select: { members: true, messages: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              type: true,
              createdAt: true,
              sender: { select: { id: true, firstName: true } },
            },
          },
          members: {
            where: { userId: { not: userId } },
            take: 1,
            include: {
              user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      },
    },
    orderBy: { room: { updatedAt: 'desc' } },
  });

  return memberships.map(m => {
    const lastMessage = m.room.messages[0] ?? null;
    const unread = lastMessage && new Date(lastMessage.createdAt) > new Date(m.lastReadAt);
    return {
      id: m.room.id,
      name: m.room.type === 'DIRECT'
        ? m.room.members[0]?.user
          ? `${m.room.members[0].user.firstName} ${m.room.members[0].user.lastName}`
          : m.room.name
        : m.room.name,
      type: m.room.type,
      avatarUrl: m.room.type === 'DIRECT'
        ? m.room.members[0]?.user?.avatarUrl ?? null
        : m.room.avatarUrl,
      memberCount: m.room._count.members,
      lastMessage: lastMessage
        ? {
          id: lastMessage.id,
          content: lastMessage.content,
          senderName: lastMessage.sender.firstName,
          senderId: lastMessage.sender.id,
          createdAt: lastMessage.createdAt.toISOString(),
        }
        : null,
      hasUnread: !!unread,
      joinedAt: m.joinedAt.toISOString(),
    };
  });
}

/** Get available zone rooms (to browse & join) */
export async function getAvailableZoneRooms(userId: string) {
  const rooms = await prisma.chatRoom.findMany({
    where: { type: 'ZONE', isActive: true },
    include: {
      _count: { select: { members: true } },
      members: {
        where: { userId },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  return rooms.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    memberCount: r._count.members,
    isMember: r.members.length > 0,
    zoneId: r.zoneId,
  }));
}

// ────── Messages ──────

/** Send a message to a room */
export async function sendMessage(data: {
  roomId: string;
  senderId: string;
  content: string;
  type?: 'TEXT' | 'IMAGE' | 'VOICE';
  mediaUrl?: string;
  replyToId?: string;
}) {
  // Verify membership
  const member = await prisma.chatMember.findUnique({
    where: { roomId_userId: { roomId: data.roomId, userId: data.senderId } },
  });
  if (!member) throw ApiError.forbidden('You are not a member of this room');
  if (member.isMuted && member.mutedUntil && member.mutedUntil > new Date()) {
    throw ApiError.forbidden('You are muted in this room');
  }

  const message = await prisma.chatMessage.create({
    data: {
      roomId: data.roomId,
      senderId: data.senderId,
      content: data.content,
      type: (data.type ?? 'TEXT') as any,
      mediaUrl: data.mediaUrl ?? null,
      replyToId: data.replyToId ?? null,
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  // Update room's updatedAt for sorting
  await prisma.chatRoom.update({
    where: { id: data.roomId },
    data: { updatedAt: new Date() },
  }).catch(() => {});

  // Update sender's lastReadAt
  await prisma.chatMember.update({
    where: { roomId_userId: { roomId: data.roomId, userId: data.senderId } },
    data: { lastReadAt: new Date() },
  }).catch(() => {});

  return {
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    senderName: `${message.sender.firstName} ${message.sender.lastName}`,
    senderAvatar: message.sender.avatarUrl,
    type: message.type,
    content: message.content,
    mediaUrl: message.mediaUrl,
    replyToId: message.replyToId,
    reactions: message.reactions,
    createdAt: message.createdAt.toISOString(),
  };
}

/** Get message history for a room (paginated, newest first) */
export async function getMessages(roomId: string, userId: string, cursor?: string, limit = 50) {
  // Verify membership
  const member = await prisma.chatMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!member) throw ApiError.forbidden('You are not a member of this room');

  const messages = await prisma.chatMessage.findMany({
    where: { roomId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  const hasMore = messages.length > limit;
  const items = (hasMore ? messages.slice(0, limit) : messages).map(m => ({
    id: m.id,
    roomId: m.roomId,
    senderId: m.senderId,
    senderName: `${m.sender.firstName} ${m.sender.lastName}`,
    senderAvatar: m.sender.avatarUrl,
    type: m.type,
    content: m.content,
    mediaUrl: m.mediaUrl,
    replyToId: m.replyToId,
    reactions: m.reactions,
    isEdited: m.isEdited,
    createdAt: m.createdAt.toISOString(),
  }));

  return {
    messages: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  };
}

/** Mark messages as read */
export async function markAsRead(roomId: string, userId: string) {
  await prisma.chatMember.update({
    where: { roomId_userId: { roomId, userId } },
    data: { lastReadAt: new Date() },
  });
}

/** Add a reaction to a message */
export async function addReaction(messageId: string, userId: string, emoji: string) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound('Message not found');

  const reactions = (message.reactions as Record<string, string[]>) ?? {};
  if (!reactions[emoji]) reactions[emoji] = [];

  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId);
  }

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { reactions },
  });

  return reactions;
}

/** Remove a reaction from a message */
export async function removeReaction(messageId: string, userId: string, emoji: string) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound('Message not found');

  const reactions = (message.reactions as Record<string, string[]>) ?? {};
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  }

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { reactions },
  });

  return reactions;
}

/** Delete a message (soft-delete) */
export async function deleteMessage(messageId: string, userId: string) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound('Message not found');
  if (message.senderId !== userId) throw ApiError.forbidden('You can only delete your own messages');

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { isDeleted: true, content: '[deleted]' },
  });
}

/** Get room members */
export async function getRoomMembers(roomId: string) {
  const members = await prisma.chatMember.findMany({
    where: { roomId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          riderProfile: {
            select: { currentLevel: true, availability: true },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return members.map(m => ({
    userId: m.user.id,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    avatarUrl: m.user.avatarUrl,
    role: m.user.role,
    level: m.user.riderProfile?.currentLevel ?? null,
    availability: m.user.riderProfile?.availability ?? null,
    isMuted: m.isMuted,
    joinedAt: m.joinedAt.toISOString(),
  }));
}
