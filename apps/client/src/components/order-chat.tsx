'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@riderguy/auth';
import { getSocket, connectSocket, sendMessage, sendTyping } from '@/hooks/use-socket';
import { MessageCircle, X, Send, ChevronDown } from 'lucide-react';

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
          className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-2xl brand-gradient text-white shadow-brand flex items-center justify-center hover:shadow-lg transition-all btn-press group"
        >
          <MessageCircle className="h-6 w-6 group-hover:scale-110 transition-transform" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-6 min-w-6 px-1 rounded-full bg-danger-500 text-white text-xs flex items-center justify-center font-bold animate-bounce-in border-2 border-white shadow-md">
              {unread}
            </span>
          )}
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-2xl bg-brand-400/20 animate-pulse pointer-events-none" style={{ inset: '-4px', borderRadius: '20px' }} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-slide-up">
          {/* Header */}
          <div className="safe-area-top bg-white border-b border-surface-100">
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl brand-gradient flex items-center justify-center shadow-brand">
                  <MessageCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-surface-900">Chat with Rider</h3>
                  {typing && (
                    <p className="text-[11px] text-brand-500 font-medium animate-pulse">typing...</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center hover:bg-surface-200 transition-colors btn-press"
              >
                <X className="h-4 w-4 text-surface-600" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-surface-50/50">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="h-16 w-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8 text-brand-300" />
                </div>
                <p className="text-sm font-semibold text-surface-700 mb-1">No messages yet</p>
                <p className="text-xs text-surface-400">Send a message to your rider</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                  <div className={`max-w-[78%] px-4 py-3 ${
                    isMe
                      ? 'brand-gradient text-white rounded-2xl rounded-br-lg shadow-brand/20 shadow-md'
                      : 'bg-white text-surface-900 rounded-2xl rounded-bl-lg shadow-card border border-surface-100'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <p className={`text-[10px] mt-1.5 ${isMe ? 'text-white/60' : 'text-surface-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {typing && (
              <div className="flex justify-start animate-slide-up">
                <div className="flex items-center gap-1.5 px-4 py-3 bg-white rounded-2xl rounded-bl-lg shadow-card border border-surface-100">
                  <div className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="bg-white border-t border-surface-100 px-4 py-3 safe-area-bottom">
            <div className="flex items-center gap-3">
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  sendTyping(orderId);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 h-12 px-5 bg-surface-50 rounded-2xl border border-surface-200 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-12 w-12 rounded-2xl brand-gradient text-white flex items-center justify-center disabled:opacity-30 disabled:shadow-none shadow-brand hover:shadow-lg transition-all btn-press"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
