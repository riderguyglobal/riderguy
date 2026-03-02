'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { useSocket } from './use-socket';
import type { CommunityChatMessage, CommunityTypingIndicator } from '@riderguy/types';

// ============================================================
// Community Hook — Sprint 11
// Chat rooms, forum posts, announcements, moderation
// ============================================================

const BASE = '/community';

// ────── Types ──────

export interface ChatRoom {
  id: string;
  name: string;
  type: 'ZONE' | 'DIRECT' | 'ANNOUNCEMENT';
  avatarUrl: string | null;
  memberCount: number;
  lastMessage: {
    id: string;
    content: string;
    senderName: string;
    senderId: string;
    createdAt: string;
  } | null;
  hasUnread: boolean;
  joinedAt: string;
}

export interface ZoneRoom {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  isMember: boolean;
  zoneId: string | null;
}

export interface ChatMsg {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  type: string;
  content: string;
  mediaUrl: string | null;
  replyToId: string | null;
  reactions: Record<string, string[]>;
  isEdited?: boolean;
  createdAt: string;
}

export interface RoomMember {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  level: number | null;
  availability: string | null;
  isMuted: boolean;
  joinedAt: string;
}

export interface ForumPost {
  id: string;
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  upvotes: number;
  downvotes: number;
  score: number;
  commentCount: number;
  hasPoll: boolean;
  poll: PollData | null;
  author: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  isOwner: boolean;
  userVote?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PollData {
  id: string;
  question: string;
  expiresAt: string | null;
  isExpired: boolean;
  totalVotes: number;
  options: Array<{
    id: string;
    text: string;
    votes: number;
    percentage?: number;
    userVoted: boolean;
  }>;
}

export interface ForumComment {
  id: string;
  postId: string;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  parentId: string | null;
  author: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  userVote: number | null;
  createdAt: string;
  replies?: ForumComment[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: number;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  author: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ────── Helpers removed — hooks now use api from useAuth ──────

// ────── Chat Hook ──────

export function useCommunityChat() {
  const { api, user } = useAuth();
  const { socket, connected } = useSocket();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const activeRoomRef = useRef<string | null>(null);
  const typingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Fetch user rooms
  const fetchRooms = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/chat/rooms`);
      setRooms(res.data.data);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Fetch messages for a room
  const fetchMessages = useCallback(async (roomId: string, cursor?: string) => {
    if (!api) return { messages: [], nextCursor: null };
    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      const res = await api.get(`${BASE}/chat/rooms/${roomId}/messages?${params}`);
      const data = res.data.data as { messages: ChatMsg[]; nextCursor: string | null };
      if (!cursor) {
        setMessages(data.messages.reverse());
      } else {
        setMessages(prev => [...data.messages.reverse(), ...prev]);
      }
      return data;
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      return { messages: [], nextCursor: null };
    }
  }, [api]);

  // Join a zone room
  const joinZoneRoom = useCallback(async (zoneId: string) => {
    if (!api) return;
    const res = await api.post(`${BASE}/chat/zones/${zoneId}/join`);
    await fetchRooms();
    return (res.data.data as { roomId: string }).roomId;
  }, [api, fetchRooms]);

  // Create or get DM
  const openDM = useCallback(async (userId: string) => {
    if (!api) return null;
    const res = await api.post(`${BASE}/chat/direct`, { userId });
    await fetchRooms();
    return res.data.data;
  }, [api, fetchRooms]);

  // Send message via REST (fallback) or socket
  const sendMessage = useCallback(async (roomId: string, content: string, type?: string) => {
    if (socket && connected) {
      socket.emit('community:send', { roomId, content, type });
    } else if (api) {
      const res = await api.post(`${BASE}/chat/rooms/${roomId}/messages`, { content, type });
      setMessages(prev => [...prev, res.data.data]);
    }
  }, [socket, connected, api]);

  // Send typing indicator
  const sendTyping = useCallback((roomId: string) => {
    socket?.emit('community:typing', { roomId });
  }, [socket]);

  // Mark messages as read
  const markAsRead = useCallback(async (roomId: string) => {
    if (!api) return;
    await api.put(`${BASE}/chat/rooms/${roomId}/read`);
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, hasUnread: false } : r));
  }, [api]);

  // Enter/leave room (socket)
  const enterRoom = useCallback((roomId: string) => {
    activeRoomRef.current = roomId;
    socket?.emit('community:join', { roomId });
    fetchMessages(roomId);
    markAsRead(roomId);
  }, [socket, fetchMessages, markAsRead]);

  const leaveRoom = useCallback((roomId: string) => {
    activeRoomRef.current = null;
    socket?.emit('community:leave', { roomId });
    setMessages([]);
    setTypingUsers(new Map());
  }, [socket]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: CommunityChatMessage) => {
      if (data.roomId === activeRoomRef.current) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, {
            id: data.id,
            roomId: data.roomId,
            senderId: data.senderId,
            senderName: data.senderName,
            senderAvatar: data.senderAvatar,
            type: data.type,
            content: data.content,
            mediaUrl: data.mediaUrl ?? null,
            replyToId: data.replyToId ?? null,
            reactions: data.reactions ?? {},
            createdAt: data.createdAt,
          }];
        });
      }
      // Update room list locally — bump the room with the latest message to the top
      setRooms(prev => {
        const idx = prev.findIndex(r => r.id === data.roomId);
        if (idx === -1) return prev; // Unknown room — periodic refresh will pick it up
        const updated = [...prev];
        const room: ChatRoom = {
          ...updated[idx]!,
          lastMessage: {
            id: data.id,
            content: data.content,
            senderName: data.senderName,
            senderId: data.senderId,
            createdAt: data.createdAt,
          },
          hasUnread: data.roomId !== activeRoomRef.current,
        };
        updated.splice(idx, 1);
        return [room, ...updated];
      });
    };

    const handleTyping = (data: CommunityTypingIndicator) => {
      if (data.roomId !== activeRoomRef.current) return;
      if (data.userId === user?.id) return;

      setTypingUsers(prev => {
        const next = new Map(prev);
        next.set(data.userId, data.firstName);
        return next;
      });

      // Clear typing after 3s
      const existing = typingTimersRef.current.get(data.userId);
      if (existing) clearTimeout(existing);
      typingTimersRef.current.set(
        data.userId,
        setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Map(prev);
            next.delete(data.userId);
            return next;
          });
        }, 3000),
      );
    };

    socket.on('community:message', handleMessage);
    socket.on('community:typing', handleTyping);

    return () => {
      socket.off('community:message', handleMessage);
      socket.off('community:typing', handleTyping);
      // Clear all pending typing timers to prevent leaks
      typingTimersRef.current.forEach((timer) => clearTimeout(timer));
      typingTimersRef.current.clear();
    };
  }, [socket, user?.id]);

  return {
    rooms,
    messages,
    typingUsers,
    loading,
    fetchRooms,
    fetchMessages,
    joinZoneRoom,
    openDM,
    sendMessage,
    sendTyping,
    markAsRead,
    enterRoom,
    leaveRoom,
  };
}

// ────── Forum Hook ──────

export function useForum() {
  const { api } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  const fetchPosts = useCallback(async (options?: {
    category?: string;
    sort?: string;
    page?: number;
  }) => {
    if (!api) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (options?.category) params.set('category', options.category);
      if (options?.sort) params.set('sort', options.sort);
      if (options?.page) params.set('page', String(options.page));
      const res = await api.get(`${BASE}/forum/posts?${params}`);
      const data = res.data.data as { posts: ForumPost[]; pagination: any };
      setPosts(data.posts);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const getPost = useCallback(async (postId: string) => {
    if (!api) return null;
    const res = await api.get(`${BASE}/forum/posts/${postId}`);
    return res.data.data as ForumPost;
  }, [api]);

  const createPost = useCallback(async (payload: {
    title: string;
    body: string;
    category?: string;
    poll?: { question: string; options: string[]; expiresAt?: string };
  }) => {
    if (!api) return null;
    const res = await api.post(`${BASE}/forum/posts`, payload);
    return res.data.data as ForumPost;
  }, [api]);

  const vote = useCallback(async (postId: string, value: number) => {
    if (!api) return;
    const res = await api.post(`${BASE}/forum/posts/${postId}/vote`, { value });
    const result = res.data.data as { value: number };
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const oldVote = p.userVote ?? 0;
      return {
        ...p,
        userVote: result.value,
        upvotes: p.upvotes + (result.value === 1 ? 1 : 0) - (oldVote === 1 ? 1 : 0),
        downvotes: p.downvotes + (result.value === -1 ? 1 : 0) - (oldVote === -1 ? 1 : 0),
        score: p.score + result.value - oldVote,
      };
    }));
    return result;
  }, [api]);

  const getComments = useCallback(async (postId: string) => {
    if (!api) return [];
    const res = await api.get(`${BASE}/forum/posts/${postId}/comments`);
    return res.data.data as ForumComment[];
  }, [api]);

  const addComment = useCallback(async (postId: string, body: string, parentId?: string) => {
    if (!api) return null;
    const res = await api.post(`${BASE}/forum/posts/${postId}/comments`, { body, parentId });
    return res.data.data as ForumComment;
  }, [api]);

  const voteComment = useCallback(async (commentId: string, value: number) => {
    if (!api) return;
    const res = await api.post(`${BASE}/forum/comments/${commentId}/vote`, { value });
    return res.data.data as { value: number };
  }, [api]);

  const votePoll = useCallback(async (optionId: string) => {
    if (!api) return null;
    const res = await api.post(`${BASE}/forum/polls/${optionId}/vote`);
    return res.data.data as PollData;
  }, [api]);

  const deletePost = useCallback(async (postId: string) => {
    if (!api) return;
    await api.delete(`${BASE}/forum/posts/${postId}`);
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, [api]);

  return {
    posts,
    pagination,
    loading,
    fetchPosts,
    getPost,
    createPost,
    vote,
    getComments,
    addComment,
    voteComment,
    votePoll,
    deletePost,
  };
}

// ────── Announcements Hook ──────

export function useAnnouncements() {
  const { api } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (page = 1) => {
    if (!api) return;
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/announcements?page=${page}`);
      const data = res.data.data as { announcements: Announcement[]; pagination: any };
      setAnnouncements(data.announcements);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const report = useCallback(async (entityType: string, entityId: string, reason: string, description?: string) => {
    if (!api) return;
    const res = await api.post(`${BASE}/reports`, { entityType, entityId, reason, description });
    return res.data.data;
  }, [api]);

  return { announcements, loading, fetch, report };
}
