'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@riderguy/auth';
import { useCommunityChat, useForum, useAnnouncements } from '@/hooks/use-community';
import type { ChatRoom, ForumPost, Announcement } from '@/hooks/use-community';
import {
  MessageCircle,
  MessageSquare,
  Megaphone,
  ChevronRight,
  Users,
  TrendingUp,
  Pin,
  ArrowLeft,
  Plus,
} from 'lucide-react';

type Tab = 'chat' | 'forum' | 'announcements';

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: 'Chat', icon: <MessageCircle className="h-4 w-4" /> },
    { id: 'forum', label: 'Forum', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'announcements', label: 'News', icon: <Megaphone className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#0a0e17]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <Link href="/dashboard" className="p-2 -ml-2 text-surface-400 hover:text-surface-200">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold text-white">Community</h1>
            <div className="w-9" />
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 pb-3">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand-500/20 text-brand-400 shadow-[0_0_12px_rgba(14,165,233,0.15)]'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-white/[0.04]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-4">
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'forum' && <ForumTab />}
        {activeTab === 'announcements' && <AnnouncementsTab />}
      </div>
    </div>
  );
}

// ────── Chat Tab ──────

function ChatTab() {
  const { rooms, loading, fetchRooms } = useCommunityChat();

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  if (loading && rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="text-surface-400 text-sm mt-3">Loading chats...</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
          <MessageCircle className="h-8 w-8 text-brand-500" />
        </div>
        <h3 className="text-white font-semibold mb-1">No chats yet</h3>
        <p className="text-surface-400 text-sm max-w-[260px]">
          Join a zone chat room to connect with nearby riders
        </p>
        <Link
          href="/dashboard/community/zones"
          className="mt-4 px-5 py-2.5 rounded-full bg-brand-500 text-white text-sm font-medium shadow-lg shadow-brand-500/30"
        >
          Browse Zone Rooms
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold">Your Chats</h2>
        <Link
          href="/dashboard/community/zones"
          className="text-brand-400 text-sm font-medium flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Join Room
        </Link>
      </div>
      {rooms.map(room => (
        <Link key={room.id} href={`/dashboard/community/chat/${room.id}`}>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold ${
                room.type === 'ZONE' ? 'bg-brand-500/20 text-brand-400' : 'bg-purple-500/20 text-purple-400'
              }`}>
                {room.type === 'ZONE' ? <Users className="h-5 w-5" /> : room.name.charAt(0)}
              </div>
              {room.hasUnread && (
                <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-brand-500 border-2 border-[#0a0e17]" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold truncate ${room.hasUnread ? 'text-white' : 'text-surface-200'}`}>
                  {room.name}
                </span>
                {room.lastMessage && (
                  <span className="text-[10px] text-surface-500 flex-shrink-0 ml-2">
                    {formatTime(room.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              {room.lastMessage ? (
                <p className={`text-xs truncate mt-0.5 ${room.hasUnread ? 'text-surface-300' : 'text-surface-500'}`}>
                  <span className="text-surface-400">{room.lastMessage.senderName}: </span>
                  {room.lastMessage.content}
                </p>
              ) : (
                <p className="text-xs text-surface-500 mt-0.5">No messages yet</p>
              )}
            </div>

            <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ────── Forum Tab ──────

function ForumTab() {
  const { posts, loading, fetchPosts, vote } = useForum();

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  if (loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="text-surface-400 text-sm mt-3">Loading forum...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-white font-semibold">Forum</h2>
        <Link
          href="/dashboard/community/forum/new"
          className="text-brand-400 text-sm font-medium flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> New Post
        </Link>
      </div>

      {/* Sort / Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {['newest', 'trending', 'top'].map(s => (
          <button
            key={s}
            onClick={() => fetchPosts({ sort: s })}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-white/[0.04] text-surface-300 hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
          >
            {s === 'trending' && <TrendingUp className="h-3 w-3 inline mr-1" />}
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-brand-500" />
          </div>
          <h3 className="text-white font-semibold mb-1">No posts yet</h3>
          <p className="text-surface-400 text-sm">Be the first to start a discussion!</p>
        </div>
      ) : (
        posts.map(post => (
          <Link key={post.id} href={`/dashboard/community/forum/${post.id}`}>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
              <div className="flex items-start gap-3">
                {/* Vote column */}
                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                  <button
                    onClick={e => { e.preventDefault(); vote(post.id, 1); }}
                    className={`p-1 rounded ${post.userVote === 1 ? 'text-brand-400' : 'text-surface-500 hover:text-surface-300'}`}
                  >
                    ▲
                  </button>
                  <span className={`text-sm font-bold ${post.score > 0 ? 'text-brand-400' : post.score < 0 ? 'text-red-400' : 'text-surface-400'}`}>
                    {post.score}
                  </span>
                  <button
                    onClick={e => { e.preventDefault(); vote(post.id, -1); }}
                    className={`p-1 rounded ${post.userVote === -1 ? 'text-red-400' : 'text-surface-500 hover:text-surface-300'}`}
                  >
                    ▼
                  </button>
                </div>

                {/* Post content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {post.isPinned && <Pin className="h-3 w-3 text-amber-400" />}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-surface-400 font-medium">
                      {post.category}
                    </span>
                    {post.hasPoll && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                        📊 Poll
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-surface-400 text-xs mt-1 line-clamp-2">{post.body}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-surface-500">
                    <span>{post.author.firstName}</span>
                    <span>💬 {post.commentCount}</span>
                    <span>👁 {post.viewCount}</span>
                    <span>{formatTime(post.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}

// ────── Announcements Tab ──────

function AnnouncementsTab() {
  const { announcements, loading, fetch } = useAnnouncements();

  useEffect(() => { fetch(); }, [fetch]);

  if (loading && announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="text-surface-400 text-sm mt-3">Loading news...</p>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
          <Megaphone className="h-8 w-8 text-amber-500" />
        </div>
        <h3 className="text-white font-semibold mb-1">No announcements</h3>
        <p className="text-surface-400 text-sm">Check back later for news & updates</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-white font-semibold mb-1">Announcements</h2>
      {announcements.map(a => (
        <div
          key={a.id}
          className={`p-4 rounded-2xl border transition-colors ${
            a.priority >= 2
              ? 'bg-amber-500/[0.06] border-amber-500/20'
              : 'bg-white/[0.03] border-white/[0.06]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              a.priority >= 2 ? 'bg-amber-500/20' : 'bg-brand-500/20'
            }`}>
              <Megaphone className={`h-5 w-5 ${a.priority >= 2 ? 'text-amber-400' : 'text-brand-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm">{a.title}</h3>
              <p className="text-surface-300 text-xs mt-1 leading-relaxed">{a.body}</p>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-surface-500">
                {a.author && <span>By {a.author.firstName}</span>}
                <span>•</span>
                <span>{formatTime(a.publishedAt ?? a.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ────── Utility ──────

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
