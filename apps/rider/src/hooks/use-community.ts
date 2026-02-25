'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { useSocket } from './use-socket';
import type { CommunityChatMessage, CommunityTypingIndicator } from '@riderguy/types';

// ============================================================
// Community Hook — Sprint 11
// Chat rooms, forum posts, announcements, moderation
// ============================================================

const BASE = `${API_BASE_URL}/community`;

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

// ────── Helpers ──────

async function apiFetch<T>(path: string, token: string | null, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `Request failed (${res.status})`);
  return json.data as T;
}

// ────── Chat Hook ──────

export function useCommunityChat() {
  const { accessToken, user } = useAuth();
  const { socket, connected } = useSocket();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const activeRoomRef = useRef<string | null>(null);
  const typingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Fetch user rooms
  const fetchRooms = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<ChatRoom[]>('/chat/rooms', accessToken);
      setRooms(data);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Fetch messages for a room
  const fetchMessages = useCallback(async (roomId: string, cursor?: string) => {
    if (!accessToken) return { messages: [], nextCursor: null };
    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      const data = await apiFetch<{ messages: ChatMsg[]; nextCursor: string | null }>(
        `/chat/rooms/${roomId}/messages?${params}`,
        accessToken,
      );
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
  }, [accessToken]);

  // Join a zone room
  const joinZoneRoom = useCallback(async (zoneId: string) => {
    if (!accessToken) return;
    const data = await apiFetch<{ roomId: string }>(`/chat/zones/${zoneId}/join`, accessToken, {
      method: 'POST',
    });
    await fetchRooms();
    return data.roomId;
  }, [accessToken, fetchRooms]);

  // Create or get DM
  const openDM = useCallback(async (userId: string) => {
    if (!accessToken) return null;
    const data = await apiFetch<any>('/chat/direct', accessToken, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    await fetchRooms();
    return data;
  }, [accessToken, fetchRooms]);

  // Send message via REST (fallback) or socket
  const sendMessage = useCallback(async (roomId: string, content: string, type?: string) => {
    if (socket && connected) {
      socket.emit('community:send', { roomId, content, type });
    } else if (accessToken) {
      const msg = await apiFetch<ChatMsg>(`/chat/rooms/${roomId}/messages`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ content, type }),
      });
      setMessages(prev => [...prev, msg]);
    }
  }, [socket, connected, accessToken]);

  // Send typing indicator
  const sendTyping = useCallback((roomId: string) => {
    socket?.emit('community:typing', { roomId });
  }, [socket]);

  // Mark messages as read
  const markAsRead = useCallback(async (roomId: string) => {
    if (!accessToken) return;
    await apiFetch<void>(`/chat/rooms/${roomId}/read`, accessToken, { method: 'PUT' });
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, hasUnread: false } : r));
  }, [accessToken]);

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
      // Update room list to show latest message
      fetchRooms();
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
    };
  }, [socket, user?.id, fetchRooms]);

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
  const { accessToken } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  const fetchPosts = useCallback(async (options?: {
    category?: string;
    sort?: string;
    page?: number;
  }) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (options?.category) params.set('category', options.category);
      if (options?.sort) params.set('sort', options.sort);
      if (options?.page) params.set('page', String(options.page));
      const data = await apiFetch<{ posts: ForumPost[]; pagination: any }>(
        `/forum/posts?${params}`,
        accessToken,
      );
      setPosts(data.posts);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const getPost = useCallback(async (postId: string) => {
    if (!accessToken) return null;
    return apiFetch<ForumPost>(`/forum/posts/${postId}`, accessToken);
  }, [accessToken]);

  const createPost = useCallback(async (data: {
    title: string;
    body: string;
    category?: string;
    poll?: { question: string; options: string[]; expiresAt?: string };
  }) => {
    if (!accessToken) return null;
    return apiFetch<ForumPost>('/forum/posts', accessToken, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }, [accessToken]);

  const vote = useCallback(async (postId: string, value: number) => {
    if (!accessToken) return;
    const result = await apiFetch<{ value: number }>(`/forum/posts/${postId}/vote`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
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
  }, [accessToken]);

  const getComments = useCallback(async (postId: string) => {
    if (!accessToken) return [];
    return apiFetch<ForumComment[]>(`/forum/posts/${postId}/comments`, accessToken);
  }, [accessToken]);

  const addComment = useCallback(async (postId: string, body: string, parentId?: string) => {
    if (!accessToken) return null;
    return apiFetch<ForumComment>(`/forum/posts/${postId}/comments`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ body, parentId }),
    });
  }, [accessToken]);

  const voteComment = useCallback(async (commentId: string, value: number) => {
    if (!accessToken) return;
    return apiFetch<{ value: number }>(`/forum/comments/${commentId}/vote`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  }, [accessToken]);

  const votePoll = useCallback(async (optionId: string) => {
    if (!accessToken) return null;
    return apiFetch<PollData>(`/forum/polls/${optionId}/vote`, accessToken, { method: 'POST' });
  }, [accessToken]);

  const deletePost = useCallback(async (postId: string) => {
    if (!accessToken) return;
    await apiFetch<void>(`/forum/posts/${postId}`, accessToken, { method: 'DELETE' });
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, [accessToken]);

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
  const { accessToken } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (page = 1) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ announcements: Announcement[]; pagination: any }>(
        `/announcements?page=${page}`,
        accessToken,
      );
      setAnnouncements(data.announcements);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const report = useCallback(async (entityType: string, entityId: string, reason: string, description?: string) => {
    if (!accessToken) return;
    return apiFetch<any>('/reports', accessToken, {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId, reason, description }),
    });
  }, [accessToken]);

  return { announcements, loading, fetch, report };
}
