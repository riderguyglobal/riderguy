'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { Button, Input } from '@riderguy/ui';
import { timeAgo } from '@riderguy/utils';
import { useSocket } from '@/hooks/use-socket';
import { useAuth } from '@riderguy/auth';

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
}

interface DeliveryChatProps {
  orderId: string;
  userId: string;
}

export function DeliveryChat({ orderId, userId }: DeliveryChatProps) {
  const { socket, sendMessage, sendTyping } = useSocket();
  const { api } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const loadedRef = useRef(false);

  // Load existing messages on first open
  useEffect(() => {
    if (!open || loadedRef.current || !api) return;
    loadedRef.current = true;
    api.get(`/orders/${orderId}/messages`)
      .then((res) => {
        const existing = res.data.data ?? [];
        if (existing.length > 0) setMessages(existing);
      })
      .catch(() => {});
  }, [open, api, orderId]);

  // Socket message listeners
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      if (!open && msg.senderId !== userId) {
        setUnread((c) => c + 1);
      }
    };

    const handleTyping = () => {
      setPeerTyping(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setPeerTyping(false), 3000);
    };

    socket.on('message:new', handleMessage);
    socket.on('message:typing', handleTyping);

    return () => {
      socket.off('message:new', handleMessage);
      socket.off('message:typing', handleTyping);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [socket, open, userId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, peerTyping]);

  // Reset unread when opened
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Lock body scroll when chat panel is open (prevents iOS scroll-through)
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Android back button trap — close chat instead of navigating away
  useEffect(() => {
    if (!open) return;
    let pushed = true;
    history.pushState({ __backTrap: true }, '');
    const handlePop = () => { pushed = false; setOpen(false); };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (pushed) history.back();
    };
  }, [open]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage(orderId, text);
    setInput('');
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    sendTyping(orderId);
  };

  return (
    <>
      {/* Floating chat button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-2xl gradient-brand text-white shadow-xl glow-brand flex items-center justify-center btn-press"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-danger-500 text-[10px] text-white flex items-center justify-center font-bold shadow-lg">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-page animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-themed safe-area-top bg-nav backdrop-blur-xl">
            <h3 className="text-lg font-bold text-primary tracking-tight">Chat</h3>
            <button onClick={() => setOpen(false)} className="h-9 w-9 rounded-xl bg-skeleton border border-themed-strong flex items-center justify-center btn-press">
              <X className="h-5 w-5 text-secondary" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-card flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-subtle" />
                </div>
                <p className="text-subtle text-sm">No messages yet. Say hello!</p>
              </div>
            )}
            {messages.map((msg) => {
              const isMine = msg.senderId === userId;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 ${
                    isMine
                      ? 'gradient-brand text-white rounded-2xl rounded-br-md shadow-lg'
                      : 'bg-skeleton text-secondary rounded-2xl rounded-bl-md border border-themed'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-white/50' : 'text-subtle'}`}>
                      {timeAgo(new Date(msg.createdAt))}
                    </p>
                  </div>
                </div>
              );
            })}
            {peerTyping && (
              <div className="flex justify-start">
                <div className="bg-skeleton border border-themed px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-2 w-2 bg-surface-500 rounded-full" style={{
                        animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-themed bg-nav backdrop-blur-xl safe-area-bottom">
            <Input
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-card border-themed-strong text-primary placeholder:text-subtle rounded-xl h-11 focus:border-brand-500/50 focus:ring-brand-500/20"
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim()}
              className="gradient-brand shrink-0 rounded-xl h-11 w-11 glow-brand"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
