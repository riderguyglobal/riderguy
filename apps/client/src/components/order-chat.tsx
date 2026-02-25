'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { getSocket, connectSocket, disconnectSocket, sendMessage, sendTyping } from '@/hooks/use-socket';
import { MessageCircle, X, Send, ArrowLeft } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
}

export default function OrderChat({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const socket = connectSocket();

    const onMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      if (!open && msg.senderId !== user?.id) {
        setUnread((n) => n + 1);
      }
    };

    const onTyping = (data: { userId: string }) => {
      if (data.userId !== user?.id) {
        setTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTyping(false), 2000);
      }
    };

    socket.on('message:new', onMessage);
    socket.on('message:typing', onTyping);

    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:typing', onTyping);
      disconnectSocket();
    };
  }, [open, user?.id]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [open, messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(orderId, input.trim());
    setInput('');
  };

  return (
    <>
      {/* Floating chat button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-30 h-12 w-12 rounded-full bg-surface-900 text-white shadow-elevated flex items-center justify-center hover:bg-surface-800 transition-all btn-press"
        >
          <MessageCircle className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-danger-500 text-white text-[10px] flex items-center justify-center font-bold border-2 border-white">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-slide-up">
          {/* Header */}
          <div className="safe-area-top bg-white border-b border-surface-100">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => setOpen(false)}
                className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center hover:bg-surface-200 transition-colors btn-press"
              >
                <ArrowLeft className="h-5 w-5 text-surface-900" />
              </button>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-surface-900">Chat with Rider</h3>
                {typing && (
                  <p className="text-xs text-brand-500 font-medium animate-pulse">typing...</p>
                )}
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 bg-surface-50">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="h-14 w-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="h-6 w-6 text-surface-300" />
                </div>
                <p className="text-sm font-semibold text-surface-700 mb-1">No messages yet</p>
                <p className="text-xs text-surface-400">Send a message to your rider</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                  <div className={`max-w-[78%] px-4 py-3 text-sm ${
                    isMe
                      ? 'bg-surface-900 text-white rounded-2xl rounded-br-md'
                      : 'bg-white text-surface-900 rounded-2xl rounded-bl-md shadow-elevated'
                  }`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={`text-[10px] mt-1.5 ${isMe ? 'text-white/50' : 'text-surface-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {typing && (
              <div className="flex justify-start animate-slide-up">
                <div className="flex items-center gap-1.5 px-4 py-3 bg-white rounded-2xl rounded-bl-md shadow-elevated">
                  <div className="h-1.5 w-1.5 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="bg-white border-t border-surface-100 px-4 py-3 safe-area-bottom">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  sendTyping(orderId);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 h-11 px-4 bg-surface-100 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-surface-900/10 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-11 w-11 rounded-xl bg-surface-900 text-white flex items-center justify-center disabled:opacity-30 disabled:shadow-none hover:bg-surface-800 transition-all btn-press"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
