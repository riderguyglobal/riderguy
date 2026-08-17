'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import { useSocket } from '@/hooks/use-socket';
import { Skeleton } from '@riderguy/ui';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Package,
  Clock,
  CheckCircle,
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

/** Custom motorcycle icon (lucide-react has no motorcycle) */
const MotorcycleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="17" r="3" />
    <circle cx="19" cy="17" r="3" />
    <path d="M5 14l2-4h4l2-3h4l2 10" />
    <path d="M13 7l2 7" />
  </svg>
);
import dynamic from 'next/dynamic';
import { CancelOrderModal } from '@/components/cancel-order-modal';
import { SearchingForRider } from '@/components/searching-for-rider';
import { RiderCard, type RiderInfo } from '@/components/rider-card';
import { StatusBadge } from '@/components/status-badge';
import { OrderProgressBar } from '@/components/order-progress-bar';

const TrackingMap = dynamic(() => import('@/components/tracking-map'), { ssr: false });

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Finding a rider for you...', icon: Clock },
  { key: 'SEARCHING_RIDER', label: 'Finding a rider for you...', icon: Clock },
  { key: 'ASSIGNED', label: 'Rider is assigned', icon: CheckCircle },
  { key: 'PICKUP_EN_ROUTE', label: 'Rider is on the way to pickup', icon: MotorcycleIcon },
  { key: 'AT_PICKUP', label: 'Rider arrived at pickup', icon: Navigation },
  { key: 'PICKED_UP', label: 'Package picked up', icon: Package },
  { key: 'IN_TRANSIT', label: 'Your package is on the way', icon: MotorcycleIcon },
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
  const [liveEtaMin, setLiveEtaMin] = useState<number | null>(null);
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
    let retries = 0;
    const verify = () => {
      api.get(`/payments/verify/${encodeURIComponent(paymentRef)}`)
        .then(() => {
          // Payment verified — refetch order to update paymentStatus
          queryClient.invalidateQueries({ queryKey: ['order', id] });
        })
        .catch(() => {
          // Retry up to 2 times with backoff
          if (retries < 2) {
            retries++;
            setTimeout(verify, retries * 2000);
          }
        });
    };
    verify();
  }, [api, paymentRef, queryClient, id]);

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

    // Re-subscribe to order room on socket reconnection
    const onSocketReconnect = () => {
      subscribeToOrder(id);
    };
    socket.on('connect', onSocketReconnect);

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
    const onMessage = (msg: { id: string; content: string; senderId: string; createdAt?: string; timestamp?: string }) => {
      const normalized = { id: msg.id, content: msg.content, senderId: msg.senderId, createdAt: msg.createdAt ?? msg.timestamp ?? new Date().toISOString() };
      setMessages((prev) => {
        // Replace optimistic message from same sender with matching content
        const idx = prev.findIndex(m => m.id.startsWith('optimistic-') && m.senderId === normalized.senderId && m.content === normalized.content);
        if (idx >= 0) { const updated = [...prev]; updated[idx] = normalized; return updated; }
        // Skip duplicate events
        if (prev.some(m => m.id === normalized.id)) return prev;
        return [...prev, normalized];
      });
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
      socket.off('connect', onSocketReconnect);
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

  const handleEtaUpdate = useCallback((durationSec: number) => {
    setLiveEtaMin(Math.ceil(durationSec / 60));
  }, []);

  const handleSendMessage = () => {
    if (!msgInput.trim() || !id) return;
    const content = msgInput.trim();
    // Optimistic: show message immediately before server confirms
    setMessages((prev) => [...prev, {
      id: `optimistic-${crypto.randomUUID()}`,
      content,
      senderId: user?.id ?? '',
      createdAt: new Date().toISOString(),
    }]);
    sendMessage(id, content);
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

  const rider = (order as Record<string, unknown> | undefined)?.rider as Record<string, unknown> | undefined;

  // Set initial rider coords from order data when available
  useEffect(() => {
    if (rider && !riderCoords) {
      const lat = Number(rider.currentLatitude);
      const lng = Number(rider.currentLongitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        setRiderCoords([lng, lat]);
      }
    }
  }, [rider, riderCoords]);

  if (isLoading || !order) {
    return (
      <div className="h-[100dvh] bg-white flex flex-col">
        <Skeleton className="flex-1" />
        <div className="bottom-sheet p-5 space-y-4">
          <div className="drag-handle" />
          <Skeleton className="h-3 w-24 rounded-full mx-auto" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── Searching state: show radar loader before rider is assigned ──
  if (order.status === 'PENDING' || order.status === 'SEARCHING_RIDER') {
    const handleCancelOrder = async (reason: string) => {
      await api?.post(`/orders/${id}/cancel`, { reason });
      router.replace('/dashboard/orders');
    };
    return (
      <>
        <SearchingForRider
          orderId={id ?? ''}
          pickupAddress={order.pickupAddress}
          dropoffAddress={order.dropoffAddress}
          totalPrice={order.totalPrice}
          onCancel={() => setShowCancelModal(true)}
          noRidersMessage={noRidersMessage}
        />
        <CancelOrderModal
          open={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancelOrder}
          status={order.status}
          orderNumber={id ? id.slice(-6).toUpperCase() : ''}
        />
      </>
    );
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-surface-600', bg: 'bg-surface-100' };
  const currentStep = STATUS_STEPS.find((s) => s.key === order.status) || STATUS_STEPS[0];
  const isComplete = order.status === 'DELIVERED';
  const isCancelled = order.status.startsWith('CANCELLED') || order.status === 'FAILED';
  const hasRider = !!(order as Record<string, unknown>).rider;

  const deliveryPin = order.deliveryPinCode;

  // Build RiderInfo object if a rider is assigned
  const riderInfo: RiderInfo | null = rider ? {
    id:              String((rider as Record<string, unknown>).id ?? ''),
    name:            `${String((rider as Record<string, unknown>).firstName ?? '')} ${String((rider as Record<string, unknown>).lastName ?? '')}`.trim() || 'Rider',
    avatarUrl:       (rider as Record<string, unknown>).avatarUrl as string | null,
    rating:          (rider as Record<string, unknown>).rating as number | null,
    totalDeliveries: (rider as Record<string, unknown>).totalDeliveries as number | undefined,
    vehicleMake:     (rider as Record<string, unknown>).vehicleMake as string | null,
    vehicleModel:    (rider as Record<string, unknown>).vehicleModel as string | null,
    vehiclePlate:    (rider as Record<string, unknown>).vehiclePlate as string | null,
    isOnline:        true,
  } : null;

  const riderPhone = rider ? String((rider as Record<string, unknown>).phone ?? '') : '';

  return (
    <div className="h-[100dvh] flex flex-col">
      {/* ─── Full-bleed Map ─────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0">
          <TrackingMap
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            riderCoords={riderCoords}
            status={order.status}
            onEtaUpdate={handleEtaUpdate}
          />
        </div>

        {/* Floating top bar */}
        <div className="map-top-bar">
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="map-btn"
          >
            <ArrowLeft className="h-5 w-5 text-surface-700" />
          </button>

          {/* ETA chip — live from route when available, else order estimate */}
          {!isComplete && !isCancelled && (liveEtaMin !== null || order.estimatedDurationMinutes) && (
            <div className="eta-chip">
              <Clock className="h-3.5 w-3.5 text-brand-500" />
              ~{liveEtaMin ?? order.estimatedDurationMinutes} min
            </div>
          )}

          {/* Status badge */}
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* ─── Rider Found celebration ──────────────────────── */}
      {riderFoundCelebration && (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
             style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
          <div className="mx-4 px-4 py-3 rounded-2xl bg-brand-500 shadow-brand flex items-center gap-3 pointer-events-auto animate-slide-from-top">
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center animate-bounce flex-shrink-0">
              <PartyPopper className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-white">Rider Found!</p>
              <p className="text-[12px] text-white/80">On the way to collect your package</p>
            </div>
            <button onClick={() => setRiderFoundCelebration(false)} className="text-white/60 flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── No-riders warning ───────────────────────────── */}
      {noRidersMessage && !riderFoundCelebration && (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
             style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
          <div className="mx-4 px-4 py-3 rounded-2xl bg-amber-500 flex items-center gap-3 pointer-events-auto animate-slide-from-top">
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <UserX className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-white">No Riders Nearby</p>
              <p className="text-[11px] text-white/80 leading-snug">{noRidersMessage}</p>
            </div>
            <button onClick={() => setNoRidersMessage(null)} className="text-white/60 flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Bottom sheet ────────────────────────────────── */}
      <div
        className={`bottom-sheet transition-all duration-300 ease-out overflow-y-auto ${
          expanded ? 'max-h-[78dvh]' : 'max-h-[48dvh]'
        }`}
      >
        {/* Drag handle — tap to expand/collapse */}
        <div className="sticky top-0 bg-white pt-3 pb-1 z-10 rounded-t-[28px]">
          <button onClick={() => setExpanded(!expanded)} className="w-full flex flex-col items-center gap-1.5">
            <div className="drag-handle" />
          </button>
        </div>

        <div className="px-5 pb-8 space-y-4 mt-1">

          {/* ── Progress bar ────────────────────────────── */}
          {!isCancelled && (
            <OrderProgressBar status={order.status} />
          )}

          {/* ── Status description ──────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-surface-900 leading-tight">
                {riderFoundCelebration ? '🎉 Rider Found!' : (currentStep?.label ?? statusConfig.label)}
              </p>
              <p className="text-[12px] text-surface-400 mt-0.5">Order #{id?.slice(-6).toUpperCase()}</p>
            </div>
            {order.totalPrice && (
              <p className="text-[18px] font-extrabold text-surface-900 leading-none">
                {formatCurrency(order.totalPrice)}
              </p>
            )}
          </div>

          {/* ── Delivery PIN ────────────────────────────── */}
          {deliveryPin && !isComplete && !isCancelled && (
            <div className={`rounded-2xl p-4 ${
              order.status === 'AT_DROPOFF'
                ? 'bg-amber-50 ring-2 ring-amber-400'
                : 'bg-amber-50'
            }`}>
              <div className="flex items-center gap-2.5 mb-3">
                <Shield className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-[13px] font-semibold text-amber-800">
                  {order.status === 'AT_DROPOFF' ? 'Rider is here! Show this PIN' : 'Delivery PIN'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className={`font-extrabold tracking-[0.3em] text-amber-700 ${
                  order.status === 'AT_DROPOFF' ? 'text-3xl' : 'text-2xl'
                }`}>{deliveryPin}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(deliveryPin)}
                  className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center btn-press"
                >
                  <Copy className="h-4 w-4 text-amber-600" />
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

          {/* ── Rider card ──────────────────────────────── */}
          {riderInfo && (
            <div className="py-1">
              <RiderCard
                rider={riderInfo}
                onCall={riderPhone ? () => window.location.href = `tel:${riderPhone}` : undefined}
                onChat={(!isComplete && !isCancelled) ? () => setShowChat(true) : undefined}
                showActions={!isComplete && !isCancelled}
              />
            </div>
          )}

          {/* Typing indicator when chat is open */}
          {showChat && typing && (
            <p className="text-[12px] text-surface-400 animate-pulse">Rider is typing...</p>
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

          {/* ── Route details (expandable) ──────────────── */}
          {expanded && (
            <div className="location-card animate-slide-from-top">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: 3 }}>
                  <span className="dot-pickup" />
                  <div className="route-connector" style={{ height: 24, width: 2, margin: '4px 0' }} />
                  <span className="dot-dropoff" />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="section-label">Pickup</p>
                    <p className="text-[14px] font-semibold text-surface-900 leading-tight mt-0.5">{order.pickupAddress || '—'}</p>
                  </div>
                  <div>
                    <p className="section-label">Delivery</p>
                    <p className="text-[14px] font-semibold text-surface-900 leading-tight mt-0.5">{order.dropoffAddress || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Actions ─────────────────────────────────── */}
          {isComplete && (
            <button
              onClick={() => router.push(`/dashboard/orders/${id}/rate`)}
              className="btn-primary brand"
            >
              <Star className="h-5 w-5" /> Rate Delivery
            </button>
          )}

          {isComplete && order.paymentMethod !== 'CASH' && order.paymentStatus !== 'COMPLETED' && (
            <button
              onClick={() => router.push(`/dashboard/orders/${id}/payment`)}
              className="btn-primary mt-2"
            >
              <CreditCard className="h-5 w-5" /> Pay Now · {formatCurrency(order.totalPrice)}
            </button>
          )}

          {!isComplete && !isCancelled && ['ASSIGNED', 'PICKUP_EN_ROUTE'].includes(order.status) && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full h-12 rounded-2xl bg-surface-100 text-surface-600 font-semibold text-[14px] flex items-center justify-center gap-2 btn-press"
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

          {/* ── Cancellation states ─────────────────────── */}
          {isCancelled && order.status === 'CANCELLED_BY_CLIENT' && (
            <div className="px-4 py-4 rounded-2xl bg-surface-50 text-center space-y-3">
              <p className="text-[14px] font-semibold text-surface-700">You cancelled this delivery</p>
              <button onClick={() => router.push('/dashboard/send')} className="btn-primary inline-flex px-8" style={{ height: 48, fontSize: 14 }}>
                Send Again
              </button>
            </div>
          )}

          {isCancelled && order.status === 'CANCELLED_BY_RIDER' && (() => {
            const cancelEntry = order.statusHistory?.find(
              (h: { status: string; note?: string }) => h.status === 'CANCELLED_BY_RIDER' && h.note,
            );
            const rawNote = cancelEntry?.note ?? '';
            const cancelReason = rawNote.replace(/^Rider cancel:\s*/i, '') || 'No reason provided';
            return (
              <div className="rounded-2xl bg-red-50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <UserX className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-red-800">Rider cancelled this delivery</p>
                    <p className="text-[12px] text-red-600 mt-0.5 leading-snug">Reason: {cancelReason}</p>
                    <p className="text-[11px] text-red-400 mt-1">Riders who cancel frequently are penalised.</p>
                  </div>
                </div>
                <button onClick={() => router.push('/dashboard/send')} className="btn-primary" style={{ height: 48, fontSize: 14 }}>
                  Place New Order
                </button>
              </div>
            );
          })()}

          {isCancelled && (order.status === 'CANCELLED_BY_ADMIN' || order.status === 'FAILED') && (
            <div className="rounded-2xl bg-amber-50 p-4 text-center space-y-3">
              <div className="h-10 w-10 mx-auto rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-[14px] font-semibold text-amber-800">
                {order.status === 'FAILED' ? 'Delivery could not be completed' : 'Delivery was cancelled by support'}
              </p>
              <p className="text-[12px] text-amber-600">Please contact support if you need assistance.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
