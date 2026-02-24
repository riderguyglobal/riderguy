'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { Button, Input } from '@riderguy/ui';
import { timeAgo } from '@riderguy/utils';
import { useSocket } from '@/hooks/use-socket';

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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

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
          className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/25 flex items-center justify-center hover:bg-brand-600 transition-colors"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-danger-500 text-xs text-white flex items-center justify-center font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface-950 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 safe-area-top bg-surface-900">
            <h3 className="text-lg font-semibold text-white">Chat</h3>
            <button onClick={() => setOpen(false)} className="h-9 w-9 rounded-full bg-surface-800 flex items-center justify-center">
              <X className="h-5 w-5 text-surface-300" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-surface-500 text-sm py-8">No messages yet. Say hello!</p>
            )}
            {messages.map((msg) => {
              const isMine = msg.senderId === userId;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                    isMine
                      ? 'bg-brand-500 text-white rounded-br-md'
                      : 'bg-surface-800 text-surface-200 rounded-bl-md'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-surface-500'}`}>
                      {timeAgo(new Date(msg.createdAt))}
                    </p>
                  </div>
                </div>
              );
            })}
            {peerTyping && (
              <div className="flex justify-start">
                <div className="bg-surface-800 px-4 py-2.5 rounded-2xl rounded-bl-md">
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
          <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 bg-surface-900 safe-area-bottom">
            <Input
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-surface-800 border-surface-700 text-white placeholder:text-surface-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-brand-500 hover:bg-brand-600 shrink-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
