'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import { Button, Input, Spinner } from '@riderguy/ui';
import { useSocket } from '@/hooks/use-socket';
import type {
  ChatMessage,
  RiderLocationUpdate,
  OrderStatusUpdate,
} from '@riderguy/types';

// ============================================================
// Order Tracking — Bolt/Uber-inspired live tracking experience
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PENDING:           { label: 'Finding Rider',       color: 'text-amber-700',  bg: 'bg-amber-50',    dot: 'bg-amber-500' },
  SEARCHING_RIDER:   { label: 'Searching Rider',     color: 'text-amber-700',  bg: 'bg-amber-50',    dot: 'bg-amber-500' },
  ASSIGNED:          { label: 'Rider Assigned',       color: 'text-blue-700',   bg: 'bg-blue-50',     dot: 'bg-blue-500' },
  PICKUP_EN_ROUTE:   { label: 'En Route to Pickup',  color: 'text-blue-700',   bg: 'bg-blue-50',     dot: 'bg-blue-500' },
  AT_PICKUP:         { label: 'At Pickup Point',      color: 'text-indigo-700', bg: 'bg-indigo-50',   dot: 'bg-indigo-500' },
  PICKED_UP:         { label: 'Package Picked Up',   color: 'text-purple-700', bg: 'bg-purple-50',   dot: 'bg-purple-500' },
  IN_TRANSIT:        { label: 'In Transit',           color: 'text-purple-700', bg: 'bg-purple-50',   dot: 'bg-purple-500' },
  AT_DROPOFF:        { label: 'At Dropoff Point',     color: 'text-teal-700',   bg: 'bg-teal-50',     dot: 'bg-teal-500' },
  DELIVERED:         { label: 'Delivered',            color: 'text-green-700',  bg: 'bg-green-50',    dot: 'bg-green-500' },
  FAILED:            { label: 'Failed',               color: 'text-red-700',    bg: 'bg-red-50',      dot: 'bg-red-500' },
  CANCELLED_BY_CLIENT: { label: 'Cancelled', color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' },
  CANCELLED_BY_RIDER:  { label: 'Cancelled', color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' },
  CANCELLED_BY_ADMIN:  { label: 'Cancelled', color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' },
};

const DELIVERY_STEPS = [
  { status: 'PENDING', label: 'Order Placed' },
  { status: 'ASSIGNED', label: 'Rider Assigned' },
  { status: 'PICKUP_EN_ROUTE', label: 'En Route to Pickup' },
  { status: 'AT_PICKUP', label: 'At Pickup' },
  { status: 'PICKED_UP', label: 'Picked Up' },
  { status: 'IN_TRANSIT', label: 'In Transit' },
  { status: 'AT_DROPOFF', label: 'At Dropoff' },
  { status: 'DELIVERED', label: 'Delivered' },
];

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  packageType: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  baseFare: number;
  distanceCharge: number;
  surgeMultiplier: number;
  serviceFee: number;
  totalPrice: number;
  currency: string;
  paymentMethod: string;
  paymentStatus?: string;
  deliveryPinCode: string;
  rider?: {
    id: string;
    user: { firstName: string; lastName: string; phone: string };
    averageRating: number;
    totalDeliveries: number;
  };
  statusHistory: { status: string; note: string; createdAt: string }[];
  createdAt: string;
  deliveredAt?: string;
  rating?: number;
}

export default function OrderConfirmationPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const orderId = params.id as string;

  const {
    socket,
    connected,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
  } = useSocket();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const [riderLocation, setRiderLocation] = useState<{
    lat: number; lng: number; heading?: number; speed?: number; timestamp: string;
  } | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get(`/orders/${orderId}`);
      setOrder(data.data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  useEffect(() => {
    if (!connected || !orderId) return;
    subscribeToOrder(orderId);
    return () => { unsubscribeFromOrder(orderId); };
  }, [connected, orderId, subscribeToOrder, unsubscribeFromOrder]);

  useEffect(() => {
    if (!socket) return;
    const h = (data: OrderStatusUpdate) => { if (data.orderId === orderId) fetchOrder(); };
    socket.on('order:status', h);
    return () => { socket.off('order:status', h); };
  }, [socket, orderId, fetchOrder]);

  useEffect(() => {
    if (!socket) return;
    const h = (data: RiderLocationUpdate) => {
      if (data.orderId === orderId) {
        setRiderLocation({ lat: data.latitude, lng: data.longitude, heading: data.heading, speed: data.speed, timestamp: data.timestamp });
      }
    };
    socket.on('rider:location', h);
    return () => { socket.off('rider:location', h); };
  }, [socket, orderId]);

  useEffect(() => {
    if (!socket) return;
    const h = (msg: ChatMessage) => {
      if (msg.orderId === orderId) {
        setMessages((prev) => [...prev, msg]);
        if (!chatOpen) setUnreadCount((c) => c + 1);
      }
    };
    socket.on('message:new', h);
    return () => { socket.off('message:new', h); };
  }, [socket, orderId, chatOpen]);

  useEffect(() => {
    if (!socket) return;
    const h = () => {
      setPeerTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setPeerTyping(false), 3000);
    };
    socket.on('message:typing', h);
    return () => { socket.off('message:typing', h); };
  }, [socket]);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const api = getApiClient();
        const { data } = await api.get(`/orders/${orderId}/messages`);
        if (data.data) setMessages(data.data);
      } catch { /* chat unavailable */ }
    })();
  }, [orderId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (chatOpen) setUnreadCount(0); }, [chatOpen]);

  useEffect(() => {
    if (!order) return;
    if (!['PENDING', 'SEARCHING_RIDER'].includes(order.status)) return;
    const interval = setInterval(fetchOrder, 8000);
    return () => clearInterval(interval);
  }, [order?.status, fetchOrder]);

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/cancel`, { reason: 'Changed my mind' });
      await fetchOrder();
    } catch { alert('Failed to cancel order'); }
    finally { setCancelling(false); }
  }

  function handleSendMessage() {
    if (!chatInput.trim()) return;
    sendMessage(orderId, chatInput.trim());
    setChatInput('');
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-50 mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        </div>
        <p className="text-sm font-medium text-surface-700">Order not found</p>
        <Button className="mt-4 bg-brand-500 hover:bg-brand-600 rounded-xl" size="sm" onClick={() => router.push('/dashboard')}>Go Home</Button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[order.status] || { label: order.status, color: 'text-surface-500', bg: 'bg-surface-50', dot: 'bg-surface-400' };
  const isPending = ['PENDING', 'SEARCHING_RIDER'].includes(order.status);
  const isActive = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(order.status);
  const isCancellable = ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE'].includes(order.status);
  const isComplete = order.status === 'DELIVERED';
  const isFailed = order.status === 'FAILED';
  const currentStepIndex = DELIVERY_STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="dash-page-enter pb-24">
      {/* ── Map / Status Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-surface-100 to-surface-50" style={{ height: isPending ? '180px' : isActive ? '220px' : '140px' }}>
        {/* Grid pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Simulated route line */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 220" fill="none">
          <path d="M80,180 C80,100 320,120 320,40" stroke="rgba(14,165,233,0.3)" strokeWidth="3" strokeDasharray="8 4" />
          {/* Pickup dot */}
          <circle cx="80" cy="180" r="8" fill="white" stroke="#0ea5e9" strokeWidth="3" />
          <circle cx="80" cy="180" r="3" fill="#0ea5e9" />
          {/* Dropoff dot */}
          <circle cx="320" cy="40" r="8" fill="white" stroke="#22c55e" strokeWidth="3" />
          <circle cx="320" cy="40" r="3" fill="#22c55e" />
          {/* Rider position (if active) */}
          {isActive && (
            <g>
              <circle cx="200" cy="110" r="14" fill="#1e293b" stroke="white" strokeWidth="2" className="rider-pin-bounce" />
              <text x="200" y="115" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">R</text>
            </g>
          )}
        </svg>

        {/* Live indicator */}
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 shadow-card border border-surface-100">
            <div className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-accent-500 dash-pulse-dot' : 'bg-surface-300'}`} />
            <span className="text-[10px] font-medium text-surface-600">{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => router.push('/dashboard/orders')}
          className="absolute top-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-md shadow-card border border-surface-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      </div>

      {/* ── Status Banner ── */}
      <div className="px-4 -mt-6 relative z-10">
        <div className={`rounded-2xl ${isPending ? 'bg-amber-50 border-amber-100' : cfg.bg + ' border border-surface-100'} p-4 shadow-card`}>
          <div className="flex items-center gap-3">
            {isPending ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Spinner className="h-5 w-5 text-amber-600" />
              </div>
            ) : (
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.bg}`}>
                <div className={`h-3 w-3 rounded-full ${cfg.dot} ${isActive ? 'dash-pulse-dot' : ''}`} />
              </div>
            )}
            <div className="flex-1">
              <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
              <p className="text-xs text-surface-500 mt-0.5">
                {order.orderNumber} · {new Date(order.createdAt).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
              </p>
            </div>
          </div>
          {isPending && (
            <p className="text-xs text-amber-600 mt-2">We&apos;re matching your delivery with available riders nearby.</p>
          )}
        </div>
      </div>

      {/* ── Delivery Progress ── */}
      {(isActive || isComplete) && (
        <div className="px-4 mt-5">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Delivery Progress</p>
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
            {DELIVERY_STEPS.map((step, i) => {
              const isPast = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.status} className="flex items-start gap-3 last:pb-0" style={{ paddingBottom: i < DELIVERY_STEPS.length - 1 ? '12px' : 0 }}>
                  <div className="relative flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full border-2 transition-all ${
                      isCurrent ? 'border-brand-500 bg-brand-500 tracking-pulse-ring' : isPast ? 'border-brand-400 bg-brand-400' : 'border-surface-200 bg-white'
                    }`} />
                    {i < DELIVERY_STEPS.length - 1 && (
                      <div className={`w-0.5 flex-1 min-h-[12px] ${isPast ? 'bg-brand-400' : 'bg-surface-100'}`} />
                    )}
                  </div>
                  <p className={`text-xs ${isCurrent ? 'font-bold text-brand-600' : isPast ? 'font-medium text-surface-700' : 'text-surface-300'}`}>
                    {step.label}
                    {isCurrent && <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Rider Card ── */}
      {order.rider && isActive && (
        <div className="px-4 mt-5">
          <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 ring-2 ring-brand-100">
                {order.rider.user.firstName[0]}{order.rider.user.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-surface-900">{order.rider.user.firstName} {order.rider.user.lastName}</p>
                <div className="flex items-center gap-3 text-xs text-surface-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                    {order.rider.averageRating.toFixed(1)}
                  </span>
                  <span>{order.rider.totalDeliveries} trips</span>
                </div>
              </div>
              {/* Call + Chat buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-surface-50 border border-surface-100 transition-all active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{unreadCount}</span>
                  )}
                </button>
                <a
                  href={`tel:${order.rider.user.phone}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 transition-all active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Live location */}
            {riderLocation && (
              <div className="mt-3 rounded-xl bg-surface-50 px-3 py-2 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-accent-500 dash-pulse-dot" />
                <p className="text-[11px] text-surface-500">
                  Location updated {new Date(riderLocation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  {riderLocation.speed !== undefined && riderLocation.speed > 0 && ` · ${(riderLocation.speed * 3.6).toFixed(0)} km/h`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chat Panel ── */}
      {chatOpen && isActive && (
        <div className="px-4 mt-4 slide-up-sheet">
          <div className="rounded-2xl bg-white border border-surface-100 shadow-elevated overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
              <p className="text-sm font-bold text-surface-900">Chat with Rider</p>
              <button onClick={() => setChatOpen(false)} className="text-surface-400 hover:text-surface-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto p-3 bg-surface-50/50">
              {messages.length === 0 ? (
                <p className="text-center text-xs text-surface-400 py-8">No messages yet. Say hello to your rider!</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} chat-msg-in`}>
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                          isMe ? 'bg-brand-500 text-white rounded-br-md' : 'bg-white border border-surface-100 text-surface-800 rounded-bl-md shadow-sm'
                        }`}>
                          {!isMe && <p className="text-[10px] font-medium text-surface-400 mb-0.5">{msg.senderName}</p>}
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <p className={`text-[10px] mt-0.5 ${isMe ? 'text-white/60' : 'text-surface-300'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {peerTyping && (
                    <div className="flex justify-start">
                      <div className="flex gap-1 rounded-2xl bg-white border border-surface-100 px-4 py-3 rounded-bl-md shadow-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-surface-300 typing-dot" />
                        <div className="h-1.5 w-1.5 rounded-full bg-surface-300 typing-dot" />
                        <div className="h-1.5 w-1.5 rounded-full bg-surface-300 typing-dot" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 p-3 border-t border-surface-100">
              <Input
                className="flex-1 rounded-xl border-surface-200 text-sm"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => { setChatInput(e.target.value); sendTyping(orderId); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white transition-all active:scale-95 disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Route ── */}
      <div className="px-4 mt-5">
        <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-3 w-3 rounded-full border-2 border-brand-500 bg-white" />
              <div className="w-0.5 flex-1 border-l-2 border-dashed border-surface-200 my-1" />
              <div className="h-3 w-3 rounded-full bg-accent-500" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase">Pickup</p>
                <p className="text-sm font-medium text-surface-900 mt-0.5">{order.pickupAddress}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-surface-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                <span>{order.distanceKm.toFixed(1)} km · ~{order.estimatedDurationMinutes} min</span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase">Dropoff</p>
                <p className="text-sm font-medium text-surface-900 mt-0.5">{order.dropoffAddress}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Delivery PIN ── */}
      {isActive && order.deliveryPinCode && (
        <div className="px-4 mt-4">
          <div className="rounded-2xl bg-surface-900 p-4 text-center">
            <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-widest">Delivery PIN</p>
            <p className="mt-1 text-3xl font-black tracking-[0.3em] text-white">{order.deliveryPinCode}</p>
            <p className="mt-1.5 text-xs text-surface-400">Share this PIN with the rider to confirm delivery</p>
          </div>
        </div>
      )}

      {/* ── Payment ── */}
      <div className="px-4 mt-4">
        <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Payment</p>
            {order.paymentStatus && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                order.paymentStatus === 'COMPLETED' ? 'bg-green-50 text-green-700' : order.paymentStatus === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  order.paymentStatus === 'COMPLETED' ? 'bg-green-500' : order.paymentStatus === 'FAILED' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                {order.paymentStatus === 'COMPLETED' ? 'Paid' : order.paymentStatus === 'FAILED' ? 'Failed' : 'Pending'}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {order.paymentMethod === 'CASH' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2" /><circle cx="12" cy="12" r="3" /></svg>
              ) : order.paymentMethod === 'CARD' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
              )}
              <span className="text-xs text-surface-500">{order.paymentMethod.replace(/_/g, ' ')}</span>
            </div>
            <span className="text-lg font-bold text-surface-900">GH₵{order.totalPrice.toLocaleString()}</span>
          </div>
          {order.paymentStatus !== 'COMPLETED' && order.paymentMethod !== 'CASH' &&
            !['DELIVERED','FAILED','CANCELLED_BY_CLIENT','CANCELLED_BY_RIDER','CANCELLED_BY_ADMIN'].includes(order.status) && (
            <button
              className="mt-3 w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-all active:scale-[0.98]"
              onClick={async () => {
                try {
                  const api = getApiClient();
                  const callbackUrl = `${window.location.origin}/dashboard/orders/${order.id}/payment`;
                  const { data } = await api.post('/payments/initialize', { orderId: order.id, callbackUrl });
                  window.location.href = data.data.authorizationUrl;
                } catch { /* silent */ }
              }}
            >
              Pay Now
            </button>
          )}
        </div>
      </div>

      {/* ── Status Timeline ── */}
      <div className="px-4 mt-4">
        <details className="rounded-2xl bg-white border border-surface-100 shadow-card overflow-hidden">
          <summary className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider cursor-pointer flex items-center justify-between">
            Status Timeline
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-2">
            {order.statusHistory.map((entry, i) => {
              const entryCfg = STATUS_CONFIG[entry.status];
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full ${i === order.statusHistory.length - 1 ? 'bg-brand-500' : 'bg-surface-200'}`} />
                    {i < order.statusHistory.length - 1 && <div className="w-0.5 flex-1 min-h-[10px] bg-surface-100" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-xs font-medium text-surface-700">{entryCfg?.label ?? entry.status}</p>
                    <p className="text-[10px] text-surface-400">{new Date(entry.createdAt).toLocaleTimeString('en-GH', { timeStyle: 'short' })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      </div>

      {/* ── Actions ── */}
      <div className="px-4 mt-5 space-y-3">
        {isCancellable && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
          >
            {cancelling ? <Spinner className="h-4 w-4 mx-auto" /> : 'Cancel Order'}
          </button>
        )}

        {isComplete && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-accent-50 border border-accent-100 p-5 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 auth-scale-in">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-bold text-accent-800">Delivery Complete!</p>
              {order.deliveredAt && (
                <p className="text-xs text-accent-600 mt-1">Delivered at {new Date(order.deliveredAt).toLocaleTimeString('en-GH', { timeStyle: 'short' })}</p>
              )}
            </div>
            {!order.rating && (
              <Button
                className="w-full bg-surface-900 hover:bg-surface-800 rounded-xl py-3 font-semibold"
                onClick={() => router.push(`/dashboard/orders/${orderId}/rate`)}
              >
                Rate Your Delivery
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full rounded-xl py-3"
              onClick={() => router.push('/dashboard/send')}
            >
              Send Another Package
            </Button>
          </div>
        )}

        {isFailed && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-5 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <p className="text-sm font-bold text-red-800">Delivery Failed</p>
            <p className="text-xs text-red-600 mt-1">Contact support for assistance.</p>
            <Button variant="outline" className="mt-3 rounded-xl" onClick={() => router.push('/dashboard/orders')}>Back to Orders</Button>
          </div>
        )}
      </div>
    </div>
  );
}
