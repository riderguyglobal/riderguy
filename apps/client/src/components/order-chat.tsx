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
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-30 h-12 w-12 rounded-full bg-brand-500 text-white shadow-lg flex items-center justify-center hover:bg-brand-600 transition-all active:scale-95"
        >
          <MessageCircle className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-danger-500 text-white text-xs flex items-center justify-center font-bold animate-bounce-in">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-slide-up">
          {/* Header */}
          <div className="safe-area-top border-b border-surface-100">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-base font-bold text-surface-900">Chat with Rider</h3>
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center">
                <X className="h-4 w-4 text-surface-600" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle className="h-10 w-10 text-surface-300 mx-auto mb-2" />
                <p className="text-sm text-surface-400">Send a message to your rider</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                    isMe
                      ? 'bg-brand-500 text-white rounded-br-md'
                      : 'bg-surface-100 text-surface-900 rounded-bl-md'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-surface-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}

            {typing && (
              <div className="flex items-center gap-1 px-3 py-2 bg-surface-100 rounded-2xl rounded-bl-md w-fit">
                <div className="h-1.5 w-1.5 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-surface-100 px-4 py-3 safe-area-bottom">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  sendTyping(orderId);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 bg-surface-50 rounded-full border border-surface-200 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-10 w-10 rounded-full bg-brand-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-brand-600 transition-colors"
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
