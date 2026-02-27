'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useCommunityChat } from '@/hooks/use-community';
import type { ChatMsg } from '@/hooks/use-community';
import {
  ArrowLeft,
  Send,
  Users,
  MoreVertical,
  Image as ImageIcon,
} from 'lucide-react';

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { user } = useAuth();
  const {
    messages,
    typingUsers,
    enterRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    fetchMessages,
  } = useCommunityChat();

  const [input, setInput] = useState('');
  const [roomName, setRoomName] = useState('Chat');
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Enter room on mount
  useEffect(() => {
    enterRoom(roomId);
    return () => leaveRoom(roomId);
  }, [roomId, enterRoom, leaveRoom]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Handle send
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    sendMessage(roomId, text);
    setInput('');
  }, [input, roomId, sendMessage]);

  // Handle typing
  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    sendTyping(roomId);
    typingTimeout.current = setTimeout(() => {}, 3000);
  }, [roomId, sendTyping]);

  // Load more (scroll up)
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !messages.length) return;
    setLoadingMore(true);
    const firstMsgId = messages[0]?.id;
    const result = await fetchMessages(roomId, firstMsgId);
    setNextCursor(result.nextCursor);
    setLoadingMore(false);
  }, [loadingMore, messages, roomId, fetchMessages]);

  const typingNames = Array.from(typingUsers.values());

  return (
    <div className="flex flex-col h-[100dvh] bg-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-nav backdrop-blur-xl border-b border-themed">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={() => router.push('/dashboard/community')}
              className="p-2 -ml-2 text-muted hover:text-secondary"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-sm font-semibold text-primary truncate">{roomName}</h1>
              {typingNames.length > 0 && (
                <p className="text-[10px] text-brand-400 animate-pulse">
                  {typingNames.join(', ')} typing...
                </p>
              )}
            </div>
            <button className="p-2 -mr-2 text-muted hover:text-secondary">
              <Users className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {/* Load more button */}
        {messages.length >= 50 && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full text-center text-xs text-brand-400 py-2 disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load older messages'}
          </button>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.senderId === user?.id;
          const showAvatar = !isOwn && (i === 0 || messages[i - 1]?.senderId !== msg.senderId);
          const showName = showAvatar;

          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-3' : 'mt-0.5'}`}>
              {/* Avatar */}
              {!isOwn && (
                <div className="w-8 flex-shrink-0">
                  {showAvatar && (
                    <div className="h-7 w-7 rounded-full bg-surface-700 flex items-center justify-center text-[10px] font-bold text-secondary overflow-hidden">
                      {msg.senderAvatar ? (
                        <img src={msg.senderAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        msg.senderName.charAt(0)
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                {showName && (
                  <p className="text-[10px] text-subtle mb-0.5 ml-1">{msg.senderName}</p>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    isOwn
                      ? 'bg-brand-500 text-white rounded-br-md'
                      : 'bg-skeleton text-secondary rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
                <p className={`text-[9px] mt-0.5 ${isOwn ? 'text-right' : 'text-left'} text-subtle`}>
                  {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="px-4 pb-1">
          <p className="text-[11px] text-muted animate-pulse">
            {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
          </p>
        </div>
      )}

      {/* Message input */}
      <div className="sticky bottom-0 bg-page border-t border-themed pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="w-full bg-skeleton border border-themed-strong rounded-full px-4 py-2.5 text-sm text-primary placeholder:text-subtle focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="h-10 w-10 rounded-full bg-brand-500 flex items-center justify-center text-primary shadow-lg shadow-brand-500/30 disabled:opacity-40 disabled:shadow-none transition-all btn-press"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
