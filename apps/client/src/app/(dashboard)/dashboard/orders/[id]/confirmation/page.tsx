'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Spinner,
  Input,
  Separator,
} from '@riderguy/ui';
import { useSocket } from '@/hooks/use-socket';
import type {
  ChatMessage,
  RiderLocationUpdate,
  OrderStatusUpdate,
} from '@riderguy/types';

// ============================================================
// Order Tracking Page — Sprint 5: Live tracking, chat, status
// ============================================================

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Finding Rider', color: 'bg-yellow-100 text-yellow-700', icon: '🔍' },
  SEARCHING_RIDER: { label: 'Searching Rider', color: 'bg-yellow-100 text-yellow-700', icon: '🔍' },
  ASSIGNED: { label: 'Rider Assigned', color: 'bg-blue-100 text-blue-700', icon: '📋' },
  PICKUP_EN_ROUTE: { label: 'Rider En Route to Pickup', color: 'bg-blue-100 text-blue-700', icon: '🗺️' },
  AT_PICKUP: { label: 'Rider at Pickup', color: 'bg-indigo-100 text-indigo-700', icon: '📍' },
  PICKED_UP: { label: 'Package Picked Up', color: 'bg-purple-100 text-purple-700', icon: '📦' },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-purple-100 text-purple-700', icon: '🛵' },
  AT_DROPOFF: { label: 'Rider at Dropoff', color: 'bg-teal-100 text-teal-700', icon: '📍' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: '✅' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: '❌' },
  CANCELLED_BY_CLIENT: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700', icon: '🚫' },
  CANCELLED_BY_RIDER: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700', icon: '🚫' },
  CANCELLED_BY_ADMIN: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700', icon: '🚫' },
};

// Ordered delivery steps for the progress tracker
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

  // ── Socket.IO ──
  const {
    socket,
    connected,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
  } = useSocket();

  // ── Core state ──
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  // ── Rider location ──
  const [riderLocation, setRiderLocation] = useState<{
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    timestamp: string;
  } | null>(null);

  // ── Chat ──
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);

  // ── Fetch order ──
  const fetchOrder = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get(`/orders/${orderId}`);
      setOrder(data.data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ── WebSocket: subscribe to order room ──
  useEffect(() => {
    if (!connected || !orderId) return;
    subscribeToOrder(orderId);
    return () => {
      unsubscribeFromOrder(orderId);
    };
  }, [connected, orderId, subscribeToOrder, unsubscribeFromOrder]);

  // ── WebSocket: order status updates ──
  useEffect(() => {
    if (!socket) return;
    const handler = (data: OrderStatusUpdate) => {
      if (data.orderId === orderId) {
        fetchOrder(); // Refresh full order data
      }
    };
    socket.on('order:status', handler);
    return () => {
      socket.off('order:status', handler);
    };
  }, [socket, orderId, fetchOrder]);

  // ── WebSocket: rider location ──
  useEffect(() => {
    if (!socket) return;
    const handler = (data: RiderLocationUpdate) => {
      if (data.orderId === orderId) {
        setRiderLocation({
          lat: data.latitude,
          lng: data.longitude,
          heading: data.heading,
          speed: data.speed,
          timestamp: data.timestamp,
        });
      }
    };
    socket.on('rider:location', handler);
    return () => {
      socket.off('rider:location', handler);
    };
  }, [socket, orderId]);

  // ── WebSocket: incoming messages ──
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      if (msg.orderId === orderId) {
        setMessages((prev) => [...prev, msg]);
        if (!chatOpen) {
          setUnreadCount((c) => c + 1);
        }
      }
    };
    socket.on('message:new', handler);
    return () => {
      socket.off('message:new', handler);
    };
  }, [socket, orderId, chatOpen]);

  // ── WebSocket: typing ──
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      setPeerTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setPeerTyping(false), 3000);
    };
    socket.on('message:typing', handler);
    return () => {
      socket.off('message:typing', handler);
    };
  }, [socket]);

  // ── Load chat history ──
  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const api = getApiClient();
        const { data } = await api.get(`/orders/${orderId}/messages`);
        if (data.data) setMessages(data.data);
      } catch {
        // Chat unavailable
      }
    })();
  }, [orderId]);

  // ── Chat scroll ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  // ── Fallback poll for pending orders (no rider socket yet) ──
  useEffect(() => {
    if (!order) return;
    const needsPoll = ['PENDING', 'SEARCHING_RIDER'].includes(order.status);
    if (!needsPoll) return;
    const interval = setInterval(fetchOrder, 8000);
    return () => clearInterval(interval);
  }, [order?.status, fetchOrder]);

  // ── Handlers ──
  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/cancel`, { reason: 'Changed my mind' });
      await fetchOrder();
    } catch {
      alert('Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  }

  function handleSendMessage() {
    if (!chatInput.trim()) return;
    sendMessage(orderId, chatInput.trim());
    setChatInput('');
  }

  function handleChatTyping() {
    sendTyping(orderId);
  }

  // ── Loading / not found ──
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Order not found</p>
        <Button className="mt-4" onClick={() => router.push('/dashboard')}>
          Go Home
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[order.status] || {
    label: order.status,
    color: 'bg-gray-100 text-gray-700',
    icon: '📄',
  };

  const isPending = order.status === 'PENDING' || order.status === 'SEARCHING_RIDER';
  const isActive = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(order.status);
  const isCancellable = ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE'].includes(order.status);
  const isComplete = order.status === 'DELIVERED';
  const isFailed = order.status === 'FAILED';
  const isCancelled = order.status.startsWith('CANCELLED');

  // Progress step index
  const currentStepIndex = DELIVERY_STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="p-4 pb-24">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="mb-2 text-sm text-gray-500 hover:text-gray-700"
          >
            ← My Orders
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            Order {order.orderNumber}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(order.createdAt).toLocaleDateString('en-GH', {
              dateStyle: 'medium',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
            title={connected ? 'Live' : 'Offline'}
          />
          <Badge className={`${statusInfo.color} border-0`}>
            {statusInfo.icon} {statusInfo.label}
          </Badge>
        </div>
      </div>

      {/* ── Finding rider animation ── */}
      {isPending && (
        <Card className="mb-4 border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center gap-3 pt-6">
            <Spinner className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Looking for a rider...</p>
              <p className="text-xs text-yellow-600">
                We're matching your delivery with available riders nearby.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Delivery Progress Tracker ── */}
      {(isActive || isComplete) && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Delivery Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {DELIVERY_STEPS.map((step, i) => {
                const isPast = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step.status} className="flex items-start gap-3 pb-3 last:pb-0">
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`h-3 w-3 rounded-full border-2 transition-colors ${
                          isCurrent
                            ? 'border-brand-500 bg-brand-500'
                            : isPast
                            ? 'border-brand-400 bg-brand-400'
                            : 'border-gray-300 bg-white'
                        }`}
                      />
                      {i < DELIVERY_STEPS.length - 1 && (
                        <div
                          className={`w-0.5 flex-1 min-h-[16px] ${
                            isPast ? 'bg-brand-400' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>
                    <p
                      className={`text-sm ${
                        isCurrent
                          ? 'font-semibold text-brand-600'
                          : isPast
                          ? 'text-gray-700'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                      {isCurrent && (
                        <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Rider info + live location ── */}
      {order.rider && isActive && (
        <Card className="mb-4 border-brand-200 bg-brand-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
                {order.rider.user.firstName[0]}
                {order.rider.user.lastName[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {order.rider.user.firstName} {order.rider.user.lastName}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>⭐ {order.rider.averageRating.toFixed(1)}</span>
                  <span>{order.rider.totalDeliveries} deliveries</span>
                </div>
              </div>
              <a
                href={`tel:${order.rider.user.phone}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white"
              >
                📞
              </a>
            </div>

            {/* Live location info */}
            {riderLocation && (
              <div className="mt-3 rounded-lg bg-white/70 p-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <p className="text-xs text-gray-600">
                    Rider location updated{' '}
                    {new Date(riderLocation.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
                {riderLocation.speed !== undefined && riderLocation.speed > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Speed: {(riderLocation.speed * 3.6).toFixed(0)} km/h
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Route ── */}
      <Card className="mb-4">
        <CardContent className="space-y-3 pt-6">
          <div className="flex gap-3">
            <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-400">Pickup</p>
              <p className="text-sm text-gray-900">{order.pickupAddress}</p>
            </div>
          </div>
          <div className="ml-2.5 border-l-2 border-dashed border-gray-200 py-1 pl-5">
            <p className="text-xs text-gray-400">
              {order.distanceKm.toFixed(1)} km • ~{order.estimatedDurationMinutes} min
            </p>
          </div>
          <div className="flex gap-3">
            <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-400">Dropoff</p>
              <p className="text-sm text-gray-900">{order.dropoffAddress}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Delivery PIN ── */}
      {isActive && order.deliveryPinCode && (
        <Card className="mb-4">
          <CardContent className="pt-6 text-center">
            <p className="text-xs font-medium uppercase text-gray-400">Delivery PIN</p>
            <p className="mt-1 text-3xl font-bold tracking-widest text-gray-900">
              {order.deliveryPinCode}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Share this PIN with the rider to confirm delivery
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Payment ── */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="text-brand-600">GH₵{order.totalPrice.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {order.paymentMethod.replace(/_/g, ' ')}
            </p>
            {order.paymentStatus && (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                order.paymentStatus === 'COMPLETED'
                  ? 'bg-green-100 text-green-700'
                  : order.paymentStatus === 'FAILED'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {order.paymentStatus === 'COMPLETED' ? '✓ Paid' : order.paymentStatus === 'FAILED' ? '✗ Failed' : '⏳ Pending'}
              </span>
            )}
          </div>
          {/* Retry payment for CARD / MOBILE_MONEY orders that are not yet paid */}
          {order.paymentStatus !== 'COMPLETED' &&
            order.paymentMethod !== 'CASH' &&
            !['DELIVERED','FAILED','CANCELLED_BY_CLIENT','CANCELLED_BY_RIDER','CANCELLED_BY_ADMIN'].includes(order.status) && (
            <button
              className="mt-3 w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              onClick={async () => {
                try {
                  const api = getApiClient();
                  const callbackUrl = `${window.location.origin}/dashboard/orders/${order.id}/payment`;
                  const { data } = await api.post('/payments/initialize', {
                    orderId: order.id,
                    callbackUrl,
                  });
                  window.location.href = data.data.authorizationUrl;
                } catch {
                  // Silently fail — user can try again
                }
              }}
            >
              💳 Pay Now
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Chat Panel ── */}
      {isActive && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <button
              className="flex w-full items-center justify-between"
              onClick={() => setChatOpen(!chatOpen)}
            >
              <CardTitle className="text-sm font-medium text-gray-500">
                💬 Chat with Rider
              </CardTitle>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
                <span className="text-xs text-gray-400">{chatOpen ? '▲' : '▼'}</span>
              </div>
            </button>
          </CardHeader>
          {chatOpen && (
            <CardContent>
              <div className="mb-3 max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-3">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-4">
                    No messages yet. Send a message to your rider.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => {
                      const isMe = msg.senderId === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 ${
                              isMe
                                ? 'bg-brand-500 text-white'
                                : 'bg-white border border-gray-200 text-gray-800'
                            }`}
                          >
                            {!isMe && (
                              <p className="text-[10px] font-medium text-gray-500 mb-0.5">
                                {msg.senderName}
                              </p>
                            )}
                            <p className="text-sm">{msg.content}</p>
                            <p
                              className={`text-[10px] mt-0.5 ${
                                isMe ? 'text-white/70' : 'text-gray-400'
                              }`}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {peerTyping && (
                      <div className="flex justify-start">
                        <div className="rounded-lg bg-gray-200 px-3 py-2">
                          <p className="text-xs text-gray-500 animate-pulse">typing…</p>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Type a message…"
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    handleChatTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="bg-brand-500 hover:bg-brand-600 px-4"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                >
                  Send
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Status Timeline ── */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">Status Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.statusHistory.map((entry, i) => (
              <div key={i} className="flex gap-3">
                <div className="relative flex flex-col items-center">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      i === order.statusHistory.length - 1
                        ? 'bg-brand-500'
                        : 'bg-gray-300'
                    }`}
                  />
                  {i < order.statusHistory.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-200" />
                  )}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-medium text-gray-900">
                    {STATUS_LABELS[entry.status]?.label ?? entry.status}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.createdAt).toLocaleTimeString('en-GH', {
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      {isCancellable && (
        <Button
          variant="outline"
          className="w-full border-red-200 text-red-600 hover:bg-red-50 mb-4"
          disabled={cancelling}
          onClick={handleCancel}
        >
          {cancelling ? <Spinner className="h-4 w-4" /> : 'Cancel Order'}
        </Button>
      )}

      {isComplete && (
        <div className="space-y-3">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl">🎉</p>
              <p className="mt-1 text-sm font-semibold text-green-800">
                Delivery Complete!
              </p>
              {order.deliveredAt && (
                <p className="text-xs text-green-600 mt-1">
                  Delivered at{' '}
                  {new Date(order.deliveredAt).toLocaleTimeString('en-GH', {
                    timeStyle: 'short',
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          {!order.rating && (
            <Button
              className="w-full bg-brand-500 hover:bg-brand-600"
              onClick={() => router.push(`/dashboard/orders/${orderId}/rate`)}
            >
              ⭐ Rate Your Delivery
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/dashboard/send')}
          >
            Send Another Package
          </Button>
        </div>
      )}

      {isFailed && (
        <Card className="border-red-200 bg-red-50 mb-4">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl">❌</p>
            <p className="mt-1 text-sm font-semibold text-red-800">
              Delivery Failed
            </p>
            <p className="text-xs text-red-600 mt-1">
              Contact support for assistance.
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => router.push('/dashboard/orders')}
            >
              Back to Orders
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
