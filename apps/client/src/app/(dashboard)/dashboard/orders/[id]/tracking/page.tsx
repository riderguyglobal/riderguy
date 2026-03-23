'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  PartyPopper,
  X,
  UserX,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { CancelOrderModal } from '@/components/cancel-order-modal';

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
  { key: 'CANCELLED_BY_CLIENT', label: 'You cancelled this delivery', icon: AlertTriangle },
  { key: 'CANCELLED_BY_RIDER', label: 'Rider cancelled the delivery', icon: AlertTriangle },
  { key: 'CANCELLED_BY_ADMIN', label: 'Delivery was cancelled', icon: AlertTriangle },
  { key: 'FAILED', label: 'Delivery failed', icon: AlertTriangle },
];

/** Play a short celebration chime using Web Audio API */
function playRiderFoundChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const playNote = (freq: number, start: number, dur: number, vol = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(vol, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    // Ascending celebration tones
    playNote(523, 0, 0.15);      // C5
    playNote(659, 0.12, 0.15);   // E5
    playNote(784, 0.24, 0.15);   // G5
    playNote(1047, 0.36, 0.25);  // C6 (hold longer)
  } catch {
    // Web Audio API not available
  }
}

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>() ?? {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const { api, user } = useAuth();
  const queryClient = useQueryClient();
  const { socket, subscribeToOrder, unsubscribeFromOrder, sendMessage, sendTyping } = useSocket();
  const [riderCoords, setRiderCoords] = useState<[number, number] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; content: string; senderId: string; createdAt: string }>>([]);
  const [typing, setTyping] = useState(false);
  const [riderFoundCelebration, setRiderFoundCelebration] = useState(false);
  const [noRidersMessage, setNoRidersMessage] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelRequest, setCancelRequest] = useState<{
    requestId: string;
    riderName: string;
    reason: string;
    status: string;
    expiresAt: string;
  } | null>(null);
  const [cancelAuthLoading, setCancelAuthLoading] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const historyLoadedRef = useRef(false);
  const previousStatusRef = useRef<string | null>(null);
  const searchStartRef = useRef<number | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Load existing cancel request if any
    api.get(`/orders/${id}/cancel-request`)
      .then((res) => {
        const req = res.data.data;
        if (req && req.status !== 'RETURN_CONFIRMED' && req.status !== 'AUTHORIZED_COMPLETE') {
          setCancelRequest({
            requestId: req.id,
            riderName: req.rider?.user ? `${req.rider.user.firstName ?? ''} ${req.rider.user.lastName ?? ''}`.trim() : 'Your rider',
            reason: req.reason,
            status: req.status,
            expiresAt: req.expiresAt,
          });
        }
      })
      .catch(() => {});
  }, [api, id]);

  // Auto-verify payment if redirected from Paystack with a reference
  const paymentRef = searchParams?.get('reference') || searchParams?.get('trxref');
  useEffect(() => {
    if (!api || !paymentRef) return;
    api.get(`/payments/verify/${paymentRef}`).catch(() => {});
  }, [api, paymentRef]);

  // Adaptive polling: faster while searching for rider, normal otherwise
  const isSearching = previousStatusRef.current === 'SEARCHING_RIDER' || previousStatusRef.current === 'PENDING' || previousStatusRef.current === null;

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api!.get(`/orders/${id}`);
      return res.data.data;
    },
    enabled: !!api && !!id,
    refetchInterval: isSearching ? 5000 : 15000,
  });

  // Track status transitions for "Rider Found" celebration
  useEffect(() => {
    if (!order?.status) return;
    const prev = previousStatusRef.current;
    const curr = order.status;

    // Detect the SEARCHING_RIDER → ASSIGNED transition
    if (prev && (prev === 'PENDING' || prev === 'SEARCHING_RIDER') && curr === 'ASSIGNED') {
      // Rider found! Celebrate!
      setRiderFoundCelebration(true);
      playRiderFoundChime();
      navigator.vibrate?.([200, 100, 200, 100, 300]);

      // Auto-dismiss celebration after 5 seconds
      setTimeout(() => setRiderFoundCelebration(false), 5000);
    }

    previousStatusRef.current = curr;
  }, [order?.status]);

  useEffect(() => {
    if (!id || !socket) return;
    subscribeToOrder(id);

    const onStatusUpdate = (data: { orderId: string; status: string; previousStatus: string }) => {
      if (data.orderId === id) {
        // Optimistically update the cached order status for instant UI response
        queryClient.setQueryData(['order', id], (old: Record<string, unknown> | undefined) =>
          old ? { ...old, status: data.status } : old,
        );
        // Then refetch full data in the background for complete accuracy
        refetch();
      }
    };
    const onLocation = (data: { latitude: number; longitude: number; lat?: number; lng?: number }) => {
      const lng = data.longitude ?? data.lng;
      const lat = data.latitude ?? data.lat;
      if (typeof lng === 'number' && typeof lat === 'number' && !Number.isNaN(lng) && !Number.isNaN(lat)) {
        setRiderCoords([lng, lat]);
      }
    };
    const onMessage = (msg: { id: string; content: string; senderId: string; createdAt: string }) => {
      setMessages((prev) => [...prev, msg]);
    };
    const onTyping = (data: { userId: string; senderId?: string }) => {
      const senderId = data.userId ?? data.senderId;
      if (senderId !== user?.id) {
        setTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
      }
    };

    socket.on('order:status', onStatusUpdate);
    socket.on('rider:location', onLocation);
    socket.on('message:new', onMessage);
    socket.on('message:typing', onTyping);

    // Listen for "no riders found" from auto-dispatch
    const onNoRiders = (data: { orderId: string; reason: string }) => {
      if (data.orderId === id) {
        setNoRidersMessage(data.reason || 'No riders are available right now. Your order is still in the queue.');
        // Auto-dismiss after 15 seconds
        setTimeout(() => setNoRidersMessage(null), 15000);
        // Refetch to get latest status
        queryClient.invalidateQueries({ queryKey: ['order', id] });
        refetch();
      }
    };
    socket.on('order:no-riders', onNoRiders);

    // Listen for rider cancellation request
    const onCancelRequest = (data: { orderId: string; requestId: string; riderName: string; reason: string; orderStatusAtRequest: string; expiresAt: string }) => {
      if (data.orderId === id) {
        setCancelRequest({
          requestId: data.requestId,
          riderName: data.riderName,
          reason: data.reason,
          status: 'PENDING',
          expiresAt: data.expiresAt,
        });
        // Vibrate to get attention
        navigator.vibrate?.([300, 100, 300]);
      }
    };
    socket.on('order:cancel-request', onCancelRequest);

    return () => {
      unsubscribeFromOrder(id);
      socket.off('order:status', onStatusUpdate);
      socket.off('rider:location', onLocation);
      socket.off('message:new', onMessage);
      socket.off('message:typing', onTyping);
      socket.off('order:no-riders', onNoRiders);
      socket.off('order:cancel-request', onCancelRequest);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [id, socket, refetch, user?.id, subscribeToOrder, unsubscribeFromOrder, queryClient]);

  // Foreground recovery: refetch when app returns from background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && id) {
        queryClient.invalidateQueries({ queryKey: ['order', id] });
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [id, refetch, queryClient]);

  // Search timeout: if searching for more than 3 minutes, show a gentle message
  useEffect(() => {
    if (!order?.status) return;
    const isStillSearching = order.status === 'PENDING' || order.status === 'SEARCHING_RIDER';

    if (isStillSearching && !searchStartRef.current) {
      searchStartRef.current = Date.now();
    }

    if (isStillSearching && !searchTimerRef.current) {
      searchTimerRef.current = setTimeout(() => {
        setNoRidersMessage(
          'It\'s taking longer than usual to find a rider. Your order is still in the queue — you can wait or cancel and try again later.',
        );
      }, 3 * 60 * 1000); // 3 minutes
    }

    // Clear the timeout if a rider is found or order is cancelled
    if (!isStillSearching) {
      searchStartRef.current = null;
      setNoRidersMessage(null);
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    }

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [order?.status]);

  const handleSendMessage = () => {
    if (!msgInput.trim() || !id) return;
    sendMessage(id, msgInput.trim());
    setMsgInput('');
  };

  const handleCancelAuthorize = async (decision: 'return' | 'complete' | 'deny') => {
    if (!api || !id) return;
    setCancelAuthLoading(true);
    try {
      await api.post(`/orders/${id}/cancel-authorize`, { decision });
      if (decision === 'deny') {
        setCancelRequest(null);
      } else {
        setCancelRequest((prev) => prev ? { ...prev, status: decision === 'return' ? 'AUTHORIZED_RETURN' : 'AUTHORIZED_COMPLETE' } : null);
      }
      if (decision === 'complete') {
        queryClient.invalidateQueries({ queryKey: ['order', id] });
        refetch();
      }
    } catch { /* ignore */ }
    setCancelAuthLoading(false);
  };

  const handleConfirmReturn = async () => {
    if (!api || !id) return;
    setCancelAuthLoading(true);
    try {
      await api.post(`/orders/${id}/cancel-return-confirm`);
      setCancelRequest(null);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      refetch();
    } catch { /* ignore */ }
    setCancelAuthLoading(false);
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

      {/* ─── Rider Found Celebration Banner ─── */}
      {riderFoundCelebration && (
        <div className="fixed top-0 left-0 right-0 z-50 safe-area-top animate-slide-down">
          <div className="mx-4 mt-3 p-4 rounded-2xl bg-accent-500 shadow-elevated flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
              <PartyPopper className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Rider Found!</p>
              <p className="text-xs text-white/80">Your rider is on the way to pick up your package</p>
            </div>
            <button onClick={() => setRiderFoundCelebration(false)} className="text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── No Riders Available Banner ─── */}
      {noRidersMessage && !riderFoundCelebration && (
        <div className="fixed top-0 left-0 right-0 z-50 safe-area-top animate-slide-down">
          <div className="mx-4 mt-3 p-4 rounded-2xl bg-amber-500 shadow-elevated flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <UserX className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">No Riders Available</p>
              <p className="text-xs text-white/80">{noRidersMessage}</p>
            </div>
            <button onClick={() => setNoRidersMessage(null)} className="text-white/60 hover:text-white shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
              isComplete ? 'bg-accent-50' : isCancelled ? 'bg-danger-50' : riderFoundCelebration ? 'bg-accent-50 animate-pulse' : 'bg-brand-50'
            }`}>
              <currentStep.icon className={`h-5 w-5 ${
                isComplete ? 'text-accent-500' : isCancelled ? 'text-danger-500' : riderFoundCelebration ? 'text-accent-500' : 'text-brand-500'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-surface-900">
                {riderFoundCelebration ? 'Rider Found!' : currentStep.label}
              </p>
              <p className="text-xs text-surface-400">Order #{id?.slice(-6).toUpperCase()}</p>
            </div>
          </div>
          )}

          {/* Delivery PIN */}
          {deliveryPin && !isComplete && !isCancelled && (
            <div className={`rounded-2xl p-4 ${
              order.status === 'AT_DROPOFF'
                ? 'bg-gradient-to-r from-amber-100 to-amber-50 border-2 border-amber-300 shadow-lg shadow-amber-200/40 animate-pulse-subtle'
                : 'bg-amber-50'
            }`}>
              <div className="flex items-center gap-3">
                <Shield className={`h-5 w-5 shrink-0 ${order.status === 'AT_DROPOFF' ? 'text-amber-700' : 'text-amber-600'}`} />
                <div className="flex-1">
                  <p className={`font-semibold ${order.status === 'AT_DROPOFF' ? 'text-sm text-amber-800' : 'text-xs text-amber-700'}`}>Delivery PIN</p>
                  <p className="text-[11px] text-amber-500">
                    {order.status === 'AT_DROPOFF'
                      ? 'Your rider is here! Give them this PIN to confirm delivery'
                      : 'Share with rider at delivery'}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 mt-3">
                <span className={`font-extrabold tracking-[0.3em] text-amber-700 ${
                  order.status === 'AT_DROPOFF' ? 'text-3xl' : 'text-lg'
                }`}>{deliveryPin}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(deliveryPin)}
                  className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center btn-press"
                >
                  <Copy className="h-3.5 w-3.5 text-amber-600" />
                </button>
              </div>
            </div>
          )}

          {/* Cancellation Authorization Request from Rider */}
          {cancelRequest && cancelRequest.status === 'PENDING' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3 animate-slide-up">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-800">Rider Wants to Cancel</p>
                  <p className="text-xs text-red-600 mt-1">
                    {cancelRequest.riderName} is requesting to cancel this delivery because your package has already been picked up.
                  </p>
                </div>
              </div>

              <div className="bg-white/60 rounded-xl px-3 py-2 border border-red-100">
                <p className="text-[10px] font-medium text-red-400 uppercase tracking-wider mb-0.5">Reason</p>
                <p className="text-sm text-red-700">{cancelRequest.reason}</p>
              </div>

              <p className="text-xs text-red-500">
                Your package is with the rider. Please choose how to proceed:
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => handleCancelAuthorize('return')}
                  disabled={cancelAuthLoading}
                  className="w-full h-11 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 disabled:opacity-50 transition-all btn-press flex items-center justify-center gap-2"
                >
                  <Package className="h-4 w-4" /> Cancel &amp; Return Package
                </button>
                <button
                  onClick={() => handleCancelAuthorize('complete')}
                  disabled={cancelAuthLoading}
                  className="w-full h-11 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition-all btn-press flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="h-4 w-4" /> Cancel — No Return Needed
                </button>
                <button
                  onClick={() => handleCancelAuthorize('deny')}
                  disabled={cancelAuthLoading}
                  className="w-full h-11 rounded-xl border border-surface-200 text-surface-600 font-medium text-sm hover:bg-surface-50 disabled:opacity-50 transition-all btn-press flex items-center justify-center gap-2"
                >
                  <Shield className="h-4 w-4" /> Deny — Continue Delivery
                </button>
              </div>

              <p className="text-[10px] text-red-400 text-center">
                This request expires in 30 minutes. If not responded to, it will be escalated to our support team.
              </p>
            </div>
          )}

          {/* Waiting for package return */}
          {cancelRequest && cancelRequest.status === 'AUTHORIZED_RETURN' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-slide-up">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 animate-pulse">
                  <Package className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">Waiting for Package Return</p>
                  <p className="text-xs text-amber-600 mt-1">
                    You authorized the cancellation. The rider should be returning your package.
                    Once you have your package, confirm below.
                  </p>
                </div>
              </div>

              <button
                onClick={handleConfirmReturn}
                disabled={cancelAuthLoading}
                className="w-full h-12 rounded-xl bg-surface-900 text-white font-semibold text-sm hover:bg-surface-800 disabled:opacity-50 transition-all btn-press flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-4 w-4" /> Confirm Package Returned
              </button>
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
                  onChange={(e) => { setMsgInput(e.target.value); if (id) sendTyping(id); }}
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

          {/* Pay Now button — shown AFTER delivery for unpaid non-cash orders */}
          {isComplete && order.paymentMethod !== 'CASH' && order.paymentStatus !== 'COMPLETED' && (
            <button
              onClick={() => router.push(`/dashboard/orders/${id}/payment`)}
              className="w-full h-13 rounded-2xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-all btn-press flex items-center justify-center gap-2"
            >
              <CreditCard className="h-4 w-4" /> Pay Now — {formatCurrency(order.totalPrice)}
            </button>
          )}

          {!isComplete && !isCancelled && ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE'].includes(order.status) && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full h-12 rounded-2xl border border-surface-200 text-surface-500 font-medium text-sm hover:bg-surface-50 transition-all btn-press flex items-center justify-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" /> Cancel Order
            </button>
          )}

          {/* Cancel confirmation modal */}
          {order && (
            <CancelOrderModal
              open={showCancelModal}
              onClose={() => setShowCancelModal(false)}
              orderNumber={order.orderNumber}
              status={order.status}
              onConfirm={async (reason) => {
                await api!.post(`/orders/${id}/cancel`, { reason });
                setShowCancelModal(false);
                refetch();
              }}
            />
          )}

          {/* Show cancelled state message */}
          {isCancelled && order.status === 'CANCELLED_BY_CLIENT' && (
            <div className="bg-surface-50 rounded-2xl p-4 text-center">
              <p className="text-sm text-surface-500">You cancelled this delivery.</p>
            </div>
          )}

          {isCancelled && order.status === 'CANCELLED_BY_RIDER' && (() => {
            // Extract the rider's cancellation reason from status history
            const cancelEntry = order.statusHistory?.find(
              (h: { status: string; note?: string }) => h.status === 'CANCELLED_BY_RIDER' && h.note,
            );
            const rawNote = cancelEntry?.note ?? '';
            const cancelReason = rawNote.replace(/^Rider cancel:\s*/i, '') || 'No reason provided';

            return (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <UserX className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800">Your rider cancelled this delivery</p>
                    <div className="mt-1.5 bg-white/60 rounded-xl px-3 py-2 border border-red-100">
                      <p className="text-[10px] font-medium text-red-400 uppercase tracking-wider mb-0.5">Reason given</p>
                      <p className="text-sm text-red-700">{cancelReason}</p>
                    </div>
                    <p className="text-xs text-red-500 mt-2">
                      This has been recorded. Riders who cancel frequently face penalties including suspension.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/dashboard/send')}
                  className="w-full h-11 rounded-xl bg-surface-900 text-white font-semibold text-sm hover:bg-surface-800 transition-all btn-press"
                >
                  Place New Order
                </button>
              </div>
            );
          })()}

          {isCancelled && order.status === 'CANCELLED_BY_ADMIN' && (
            <div className="bg-surface-50 rounded-2xl p-4 text-center">
              <p className="text-sm text-surface-500">This delivery was cancelled by support.</p>
            </div>
          )}

          {isCancelled && order.status === 'FAILED' && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center space-y-2">
              <div className="h-11 w-11 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-sm font-semibold text-amber-800">Delivery could not be completed</p>
              <p className="text-xs text-amber-600">
                The rider was unable to complete this delivery. Please contact support if you need help.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
