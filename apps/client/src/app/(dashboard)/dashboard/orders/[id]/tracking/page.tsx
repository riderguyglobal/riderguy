'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import { useSocket } from '@/hooks/use-socket';
import { Avatar, AvatarImage, AvatarFallback, Skeleton } from '@riderguy/ui';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Package,
  Clock,
  CheckCircle,
  Truck,
  Navigation,
  Copy,
  AlertTriangle,
  Star,
  CreditCard,
  Send,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const TrackingMap = dynamic(() => import('@/components/tracking-map'), { ssr: false });

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Finding a rider for you...', icon: Clock },
  { key: 'SEARCHING_RIDER', label: 'Finding a rider for you...', icon: Clock },
  { key: 'ASSIGNED', label: 'Rider is assigned', icon: CheckCircle },
  { key: 'PICKUP_EN_ROUTE', label: 'Rider is on the way to pickup', icon: Truck },
  { key: 'AT_PICKUP', label: 'Rider arrived at pickup', icon: Navigation },
  { key: 'PICKED_UP', label: 'Package picked up', icon: Package },
  { key: 'IN_TRANSIT', label: 'Your package is on the way', icon: Truck },
  { key: 'AT_DROPOFF', label: 'Rider has arrived', icon: Navigation },
  { key: 'DELIVERED', label: 'Package delivered!', icon: CheckCircle },
];

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { api, user } = useAuth();
  const { socket, subscribeToOrder, unsubscribeFromOrder, sendMessage, sendTyping } = useSocket();
  const [riderCoords, setRiderCoords] = useState<[number, number] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; content: string; senderId: string; createdAt: string }>>([]);
  const [typing, setTyping] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const historyLoadedRef = useRef(false);

  // Load existing chat messages
  useEffect(() => {
    if (!api || !id || historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    api.get(`/orders/${id}/messages`)
      .then((res) => {
        const existing = res.data.data ?? [];
        if (existing.length > 0) setMessages(existing);
      })
      .catch(() => {});
  }, [api, id]);

  // Auto-verify payment if redirected from Paystack with a reference
  const paymentRef = searchParams.get('reference') || searchParams.get('trxref');
  useEffect(() => {
    if (!api || !paymentRef) return;
    api.get(`/payments/verify/${paymentRef}`).catch(() => {});
  }, [api, paymentRef]);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api!.get(`/orders/${id}`);
      return res.data.data;
    },
    enabled: !!api && !!id,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!id || !socket) return;
    subscribeToOrder(id);

    const onUpdate = (data: Record<string, unknown>) => {
      if (data.orderId === id) refetch();
    };
    const onLocation = (data: { lat: number; lng: number }) => {
      setRiderCoords([data.lng, data.lat]);
    };
    const onMessage = (msg: { id: string; content: string; senderId: string; createdAt: string }) => {
      setMessages((prev) => [...prev, msg]);
    };
    const onTyping = (data: { userId: string }) => {
      if (data.userId !== user?.id) {
        setTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
      }
    };

    socket.on('order:updated', onUpdate);
    socket.on('rider:location', onLocation);
    socket.on('message:new', onMessage);
    socket.on('message:typing', onTyping);

    return () => {
      unsubscribeFromOrder(id);
      socket.off('order:updated', onUpdate);
      socket.off('rider:location', onLocation);
      socket.off('message:new', onMessage);
      socket.off('message:typing', onTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [id, socket, refetch, user?.id, subscribeToOrder, unsubscribeFromOrder]);

  const handleSendMessage = () => {
    if (!msgInput.trim()) return;
    sendMessage(id, msgInput.trim());
    setMsgInput('');
  };

  const pickupCoords = useMemo<[number, number] | null>(
    () => order?.pickupLongitude && order?.pickupLatitude
      ? [order.pickupLongitude, order.pickupLatitude] : null,
    [order?.pickupLongitude, order?.pickupLatitude]
  );
  const dropoffCoords = useMemo<[number, number] | null>(
    () => order?.dropoffLongitude && order?.dropoffLatitude
      ? [order.dropoffLongitude, order.dropoffLatitude] : null,
    [order?.dropoffLongitude, order?.dropoffLatitude]
  );

  if (isLoading || !order) {
    return (
      <div className="min-h-[100dvh] bg-surface-50 p-5 space-y-4">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-surface-600', bg: 'bg-surface-100' };
  const currentStep = STATUS_STEPS.find((s) => s.key === order.status) || STATUS_STEPS[0];
  const isComplete = order.status === 'DELIVERED';
  const isCancelled = order.status.startsWith('CANCELLED') || order.status === 'FAILED';
  const hasRider = !!(order as Record<string, unknown>).rider;

  const rider = (order as Record<string, unknown>).rider as Record<string, unknown> | undefined;
  const deliveryPin = order.deliveryPinCode;

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-50">
      {/* ─── Full-bleed Map ─── */}
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0">
          <TrackingMap
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            riderCoords={riderCoords}
            status={order.status}
          />
        </div>

        {/* Floating back button */}
        <div className="absolute top-0 left-0 right-0 safe-area-top z-10">
          <div className="flex items-center justify-between px-4 pt-3">
            <button
              onClick={() => router.push('/dashboard/orders')}
              className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-elevated btn-press"
            >
              <ArrowLeft className="h-5 w-5 text-surface-900" />
            </button>

            {/* Floating status badge */}
            <div className={`px-3 py-1.5 rounded-full ${statusConfig.bg} shadow-elevated`}>
              <span className={`text-xs font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Sheet ─── */}
      <div className={`bottom-sheet transition-all duration-500 ease-out ${expanded ? 'max-h-[75dvh]' : 'max-h-[45dvh]'} overflow-y-auto`}>
        {/* Drag handle + expand toggle */}
        <div className="sticky top-0 bg-white pt-3 pb-2 z-10 rounded-t-[1.75rem]">
          <button onClick={() => setExpanded(!expanded)} className="w-full flex flex-col items-center">
            <div className="drag-handle" />
            <div className="flex items-center gap-1 mt-2">
              {expanded ? <ChevronDown className="h-3.5 w-3.5 text-surface-400" /> : <ChevronUp className="h-3.5 w-3.5 text-surface-400" />}
            </div>
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Status text */}
          {currentStep && (
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              isComplete ? 'bg-accent-50' : isCancelled ? 'bg-danger-50' : 'bg-brand-50'
            }`}>
              <currentStep.icon className={`h-5 w-5 ${
                isComplete ? 'text-accent-500' : isCancelled ? 'text-danger-500' : 'text-brand-500'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-surface-900">{currentStep.label}</p>
              <p className="text-xs text-surface-400">Order #{id?.slice(-6).toUpperCase()}</p>
            </div>
          </div>
          )}

          {/* Delivery PIN */}
          {deliveryPin && !isComplete && !isCancelled && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50">
              <Shield className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-700">Delivery PIN</p>
                <p className="text-[11px] text-amber-500">Share with rider at delivery</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-[0.25em] text-amber-700">{deliveryPin}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(deliveryPin)}
                  className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center btn-press"
                >
                  <Copy className="h-3.5 w-3.5 text-amber-600" />
                </button>
              </div>
            </div>
          )}

          {/* Rider card — Uber-style */}
          {rider && (
            <div className="flex items-center gap-3 py-3 border-t border-b border-surface-100">
              <Avatar className="h-12 w-12 ring-2 ring-surface-100">
                {rider.avatarUrl ? <AvatarImage src={rider.avatarUrl as string} alt={String(rider.firstName ?? '')} /> : null}
                <AvatarFallback className="bg-surface-100 text-surface-600 text-sm font-bold">
                  {String(rider.firstName ?? '')[0] || ''}{String(rider.lastName ?? '')[0] || ''}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-surface-900">
                  {String(rider.firstName ?? '')} {String(rider.lastName ?? '')}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {Boolean(rider.vehiclePlate) && (
                    <span className="text-xs font-semibold text-surface-500 px-1.5 py-0.5 bg-surface-100 rounded">
                      {String(rider.vehiclePlate)}
                    </span>
                  )}
                  {Boolean(rider.rating) && (
                    <span className="text-xs text-surface-400 flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      {String(rider.rating)}
                    </span>
                  )}
                </div>
              </div>
              {Boolean(rider.phone) && (
                <a
                  href={`tel:${String(rider.phone)}`}
                  className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center btn-press hover:bg-surface-200 transition-colors"
                >
                  <Phone className="h-4 w-4 text-surface-900" />
                </a>
              )}
            </div>
          )}

          {/* Inline "Send a message" bar — Uber-style */}
          {rider && !isComplete && !isCancelled && !showChat && (
            <button
              onClick={() => setShowChat(true)}
              className="w-full flex items-center gap-3 h-12 px-4 bg-surface-100 rounded-xl text-left btn-press hover:bg-surface-200/70 transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-surface-400" />
              <span className="text-sm text-surface-400">Send a message</span>
              {typing && (
                <span className="text-xs text-brand-500 font-medium ml-auto animate-pulse">typing...</span>
              )}
            </button>
          )}

          {/* Expanded chat */}
          {showChat && rider && !isComplete && !isCancelled && (
            <div className="animate-slide-up">
              {/* Messages */}
              <div className="max-h-48 overflow-y-auto space-y-2 mb-3 px-1">
                {messages.length === 0 && (
                  <p className="text-xs text-surface-400 text-center py-4">Start a conversation with your rider</p>
                )}
                {messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3.5 py-2.5 text-sm ${
                        isMe
                          ? 'bg-surface-900 text-white rounded-2xl rounded-br-md'
                          : 'bg-surface-100 text-surface-900 rounded-2xl rounded-bl-md'
                      }`}>
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-white/50' : 'text-surface-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {typing && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-100 rounded-2xl rounded-bl-md">
                      <div className="h-1.5 w-1.5 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0s' }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex items-center gap-2">
                <input
                  value={msgInput}
                  onChange={(e) => { setMsgInput(e.target.value); sendTyping(id); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 h-11 px-4 bg-surface-100 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-surface-900/10 transition-all"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!msgInput.trim()}
                  className="h-11 w-11 rounded-xl bg-surface-900 text-white flex items-center justify-center disabled:opacity-30 btn-press hover:bg-surface-800 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              <button onClick={() => setShowChat(false)} className="text-xs text-surface-400 mt-2 hover:text-surface-600 transition-colors">
                Close chat
              </button>
            </div>
          )}

          {/* Route details (expandable) */}
          {expanded && (
            <div className="space-y-4 animate-slide-up">
              {/* Route */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-0.5 pt-1.5">
                    <div className="h-3 w-3 rounded-full bg-surface-900" />
                    <div className="w-0.5 h-6 bg-surface-200 rounded-full" />
                    <div className="h-3 w-3 rounded-full bg-surface-900 ring-2 ring-surface-200" />
                  </div>
                  <div className="flex-1 space-y-2.5">
                    <div>
                      <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Pickup</p>
                      <p className="text-sm text-surface-900 font-medium">{order.pickupAddress || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Dropoff</p>
                      <p className="text-sm text-surface-900 font-medium">{order.dropoffAddress || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price */}
              {order.totalPrice && (
                <div className="flex items-center justify-between py-3 border-t border-surface-100">
                  <span className="text-sm text-surface-500">Total</span>
                  <span className="text-lg font-bold text-surface-900">{formatCurrency(order.totalPrice)}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {isComplete && (
            <button
              onClick={() => router.push(`/dashboard/orders/${id}/rate`)}
              className="w-full h-13 rounded-2xl bg-surface-900 text-white font-semibold text-sm hover:bg-surface-800 transition-all btn-press flex items-center justify-center gap-2"
            >
              <Star className="h-4 w-4" /> Rate Delivery
            </button>
          )}

          {/* Pay Now button for unpaid non-cash orders */}
          {!isComplete && !isCancelled && order.paymentMethod !== 'CASH' && order.paymentStatus !== 'COMPLETED' && (
            <button
              onClick={() => router.push(`/dashboard/orders/${id}/payment`)}
              className="w-full h-13 rounded-2xl bg-surface-900 text-white font-semibold text-sm hover:bg-surface-800 transition-all btn-press flex items-center justify-center gap-2"
            >
              <CreditCard className="h-4 w-4" /> Pay Now — {formatCurrency(order.totalPrice)}
            </button>
          )}

          {!isComplete && !isCancelled && ['PENDING', 'SEARCHING_RIDER'].includes(order.status) && (
            <button
              onClick={async () => {
                try {
                  await api!.post(`/orders/${id}/cancel`);
                  refetch();
                } catch { /* ignored */ }
              }}
              className="w-full h-12 rounded-2xl border border-surface-200 text-surface-500 font-medium text-sm hover:bg-surface-50 transition-all btn-press flex items-center justify-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" /> Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
