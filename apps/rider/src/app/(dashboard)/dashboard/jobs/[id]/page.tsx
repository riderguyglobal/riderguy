'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth, getApiClient } from '@riderguy/auth';
import {
  Button,
  Spinner,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@riderguy/ui';
import { useSocket } from '@/hooks/use-socket';
import type { ChatMessage, OrderStatusUpdate } from '@riderguy/types';

// Dynamically import the navigation map (uses Mapbox GL — no SSR)
const NavigationMap = dynamic(() => import('@/components/navigation-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full bg-surface-900 flex items-center justify-center" style={{ height: '50vh', minHeight: '300px' }}>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="h-6 w-6 text-brand-500" />
        <p className="text-xs text-surface-500">Loading map...</p>
      </div>
    </div>
  ),
});

// ============================================================
// Active Job Detail — Sprint 5: Full delivery execution with
// real-time tracking, proof of delivery, chat, and GPS.
// ============================================================

// ── Status display config ──
const STATUS_STEPS = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF', 'DELIVERED'];

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  ASSIGNED: { label: 'Assigned', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  PICKUP_EN_ROUTE: { label: 'Heading to Pickup', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  AT_PICKUP: { label: 'At Pickup', color: 'text-indigo-700', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  PICKED_UP: { label: 'Picked Up', color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  IN_TRANSIT: { label: 'In Transit', color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  AT_DROPOFF: { label: 'At Dropoff', color: 'text-teal-700', bg: 'bg-teal-50', dot: 'bg-teal-500' },
  DELIVERED: { label: 'Delivered', color: 'text-accent-700', bg: 'bg-accent-50', dot: 'bg-accent-500' },
  FAILED: { label: 'Failed', color: 'text-danger-700', bg: 'bg-danger-50', dot: 'bg-danger-500' },
  CANCELLED_BY_RIDER: { label: 'Cancelled', color: 'text-danger-700', bg: 'bg-danger-50', dot: 'bg-danger-500' },
};

// Rider-driven status transitions
const NEXT_STATUS: Record<string, { status: string; label: string }> = {
  ASSIGNED: { status: 'PICKUP_EN_ROUTE', label: 'Head to Pickup' },
  PICKUP_EN_ROUTE: { status: 'AT_PICKUP', label: 'Arrived at Pickup' },
  AT_PICKUP: { status: 'PICKED_UP', label: 'Package Collected' },
  PICKED_UP: { status: 'IN_TRANSIT', label: 'Start Delivery' },
  IN_TRANSIT: { status: 'AT_DROPOFF', label: 'Arrived at Dropoff' },
  AT_DROPOFF: { status: 'DELIVERED', label: 'Confirm Delivery' },
};

const PACKAGE_LABELS: Record<string, string> = {
  DOCUMENT: 'Document',
  SMALL_PARCEL: 'Small Parcel',
  MEDIUM_PARCEL: 'Medium Parcel',
  LARGE_PARCEL: 'Large Parcel',
  FOOD: 'Food',
  FRAGILE: 'Fragile',
  HIGH_VALUE: 'High Value',
};

const FAILURE_REASONS = [
  'Recipient not available',
  'Wrong address / address not found',
  'Recipient refused delivery',
  'Property inaccessible',
  'Unsafe delivery location',
  'Package damaged in transit',
  'Other',
];

type ProofType = 'PHOTO' | 'SIGNATURE' | 'PIN_CODE' | 'LEFT_AT_DOOR';

interface OrderDetail {
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
  packageDescription?: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  totalPrice: number;
  serviceFee: number;
  deliveryFee: number;
  currency: string;
  deliveryPinCode?: string;
  paymentMethod: string;
  createdAt: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  proofOfDeliveryUrl?: string;
  proofOfDeliveryType?: string;
  client: {
    firstName: string;
    lastName: string;
    phone?: string;
  };
  senderName?: string;
  senderPhone?: string;
  recipientName?: string;
  recipientPhone?: string;
}

// ── Signature Canvas Component ──
function SignatureCanvas({
  onSave,
  onClear,
}: {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const getCoords = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = (e as React.TouchEvent).touches[0]!;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPoint.current = getCoords(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing.current || !lastPoint.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPoint.current = p;
  };

  const endDraw = () => {
    isDrawing.current = false;
    lastPoint.current = null;
  };

  const clear = () => {
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    onClear();
  };

  const save = () => {
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={320}
        height={160}
        className="w-full rounded-2xl border-2 border-dashed border-surface-300 bg-white touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} className="flex-1 rounded-xl">
          Clear
        </Button>
        <Button size="sm" onClick={save} className="flex-1 bg-brand-500 hover:bg-brand-600 rounded-xl">
          Accept Signature
        </Button>
      </div>
    </div>
  );
}

// ── Main Page Component ──

export default function ActiveJobPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orderId = params.id as string;

  // ── Socket.IO for real-time ──
  const {
    socket,
    connected,
    emitLocation,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
  } = useSocket();

  // ── Core state ──
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  // ── GPS tracking ──
  const geoWatchRef = useRef<number | null>(null);
  const [riderLocation, setRiderLocation] = useState<{
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
  } | null>(null);

  // ── Proof of Delivery ──
  const [proofType, setProofType] = useState<ProofType>('PHOTO');
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [deliveryPinInput, setDeliveryPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [proofUploading, setProofUploading] = useState(false);

  // ── Pickup photo ──
  const [pickupPhoto, setPickupPhoto] = useState<string | null>(null);
  const pickupPhotoRef = useRef<HTMLInputElement>(null);
  const proofPhotoRef = useRef<HTMLInputElement>(null);

  // ── Chat ──
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);

  // ── Failed delivery ──
  const [failDialogOpen, setFailDialogOpen] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [failCustomReason, setFailCustomReason] = useState('');
  const [failPhoto, setFailPhoto] = useState<string | null>(null);
  const failPhotoRef = useRef<HTMLInputElement>(null);
  const [failSubmitting, setFailSubmitting] = useState(false);

  // ── Fetch order ──
  const fetchOrder = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get(`/orders/${orderId}`);
      setOrder(data.data);
    } catch {
      // Order not found or unauthorized
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // ── Initial load + WebSocket subscription ──
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (!connected || !orderId) return;
    subscribeToOrder(orderId);
    return () => {
      unsubscribeFromOrder(orderId);
    };
  }, [connected, orderId, subscribeToOrder, unsubscribeFromOrder]);

  // ── Listen for real-time order status updates ──
  useEffect(() => {
    if (!socket) return;
    const handler = (data: OrderStatusUpdate) => {
      if (data.orderId === orderId) {
        // Refresh the order to get full updated data
        fetchOrder();
      }
    };
    socket.on('order:status', handler);
    return () => {
      socket.off('order:status', handler);
    };
  }, [socket, orderId, fetchOrder]);

  // ── Listen for incoming chat messages ──
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

  // ── Listen for typing indicators ──
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
        if (data.data) {
          setMessages(data.data);
        }
      } catch {
        // Chat history unavailable
      }
    })();
  }, [orderId]);

  // ── GPS geolocation tracking ──
  useEffect(() => {
    if (!order) return;

    const activeStatuses = [
      'ASSIGNED',
      'PICKUP_EN_ROUTE',
      'AT_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT',
      'AT_DROPOFF',
    ];

    if (!activeStatuses.includes(order.status)) {
      // Stop tracking for completed/failed/cancelled orders
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) return;

    // Use watchPosition for continuous tracking
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
        };
        setRiderLocation(loc);
        // Emit to server via WebSocket
        if (connected) {
          emitLocation(loc.lat, loc.lng, loc.heading, loc.speed);
        }
      },
      (err) => {
        console.warn('[GPS] Error:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
    };
  }, [order?.status, connected, emitLocation]);

  // ── Chat auto-scroll ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset unread when chat opens
  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  // ── File → base64 helper ──
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Photo capture handlers ──
  async function handlePickupPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setPickupPhoto(b64);
  }

  async function handleProofPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setProofPhoto(b64);
  }

  async function handleFailPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setFailPhoto(b64);
  }

  // ── Upload proof of delivery ──
  async function uploadProof(): Promise<boolean> {
    let data: string | null = null;

    if (proofType === 'PHOTO') {
      data = proofPhoto;
    } else if (proofType === 'SIGNATURE') {
      data = signatureData;
    } else if (proofType === 'LEFT_AT_DOOR') {
      data = proofPhoto; // optional photo for left-at-door
    }

    if (proofType === 'PIN_CODE') {
      // PIN validation happens in handleTransition
      return true;
    }

    if (!data && proofType !== 'LEFT_AT_DOOR') {
      alert('Please provide proof of delivery before confirming.');
      return false;
    }

    setProofUploading(true);
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/proof`, {
        proofType,
        proofData: data,
      });
      return true;
    } catch (err) {
      console.error('Proof upload failed:', err);
      alert('Failed to upload proof of delivery. Please try again.');
      return false;
    } finally {
      setProofUploading(false);
    }
  }

  // ── Status transition ──
  async function handleTransition(nextStatus: string) {
    if (!order) return;

    // AT_DROPOFF → DELIVERED: requires proof of delivery
    if (nextStatus === 'DELIVERED') {
      if (proofType === 'PIN_CODE') {
        if (!deliveryPinInput || (order.deliveryPinCode && deliveryPinInput !== order.deliveryPinCode)) {
          setPinError('Incorrect delivery PIN. Ask the recipient for the correct PIN.');
          return;
        }
      }

      // Upload proof before transitioning
      const uploaded = await uploadProof();
      if (!uploaded) return;
    }

    setTransitioning(true);
    setPinError('');
    try {
      const api = getApiClient();
      await api.patch(`/orders/${orderId}/status`, { status: nextStatus });
      await fetchOrder();

      if (nextStatus === 'DELIVERED') {
        // Stay on page to show delivery summary
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error?: string } } }).response?.data?.error
          : 'Failed to update status';
      alert(msg || 'Failed to update status');
    } finally {
      setTransitioning(false);
    }
  }

  // ── Cancel delivery ──
  async function handleCancelJob() {
    if (!confirm('Are you sure you want to cancel this delivery?')) return;
    setTransitioning(true);
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/cancel`, { reason: 'Cancelled by rider' });
      router.push('/dashboard/jobs');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error?: string } } }).response?.data?.error
          : 'Failed to cancel';
      alert(msg || 'Failed to cancel');
    } finally {
      setTransitioning(false);
    }
  }

  // ── Failed delivery submission ──
  async function handleFailDelivery() {
    const reason = failReason === 'Other' ? failCustomReason : failReason;
    if (!reason.trim()) {
      alert('Please provide a reason for the failed delivery.');
      return;
    }

    setFailSubmitting(true);
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/fail`, {
        reason,
        photoData: failPhoto,
      });
      setFailDialogOpen(false);
      await fetchOrder();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error?: string } } }).response?.data?.error
          : 'Failed to report delivery failure';
      alert(msg || 'Failed to report delivery failure');
    } finally {
      setFailSubmitting(false);
    }
  }

  // ── Send chat message ──
  function handleSendMessage() {
    if (!chatInput.trim()) return;
    sendMessage(orderId, chatInput.trim());
    setChatInput('');
  }

  function handleChatTyping() {
    sendTyping(orderId);
  }

  // ── Open navigation ──
  function openNavigation(lat: number, lng: number, label: string) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <p className="mt-3 text-sm font-medium text-surface-900">Order not found</p>
        <Button
          className="mt-4 rounded-xl"
          variant="outline"
          onClick={() => router.push('/dashboard/jobs')}
        >
          Back to Jobs
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: 'text-surface-600', bg: 'bg-surface-50', dot: 'bg-surface-400' };
  const nextAction = NEXT_STATUS[order.status];
  const isCompleted = ['DELIVERED', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN', 'CANCELLED_BY_CLIENT', 'FAILED'].includes(order.status);
  const canCancel = ['ASSIGNED', 'PICKUP_EN_ROUTE'].includes(order.status);
  const canFail = ['AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(order.status);
  const riderEarnings = order.totalPrice - (order.serviceFee ?? 0);
  const isNavigating = ['PICKUP_EN_ROUTE', 'IN_TRANSIT'].includes(order.status);
  const navTarget =
    order.status === 'PICKUP_EN_ROUTE' || order.status === 'ASSIGNED'
      ? { lat: order.pickupLat, lng: order.pickupLng, label: 'Pickup' }
      : { lat: order.dropoffLat, lng: order.dropoffLng, label: 'Dropoff' };

  // Current step index for progress bar
  const currentStepIdx = STATUS_STEPS.indexOf(order.status);

  // Navigation map phase: show route to pickup until picked up, then to dropoff
  const isActiveDelivery = ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(order.status);
  const mapPhase: 'TO_PICKUP' | 'TO_DROPOFF' =
    ['PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(order.status)
      ? 'TO_DROPOFF'
      : 'TO_PICKUP';

  return (
    <div className="dash-page-enter pb-44">
      {/* ── Real-time Navigation Map ── */}
      {isActiveDelivery && (
        <NavigationMap
          pickupLat={order.pickupLat}
          pickupLng={order.pickupLng}
          dropoffLat={order.dropoffLat}
          dropoffLng={order.dropoffLng}
          riderLat={riderLocation?.lat ?? null}
          riderLng={riderLocation?.lng ?? null}
          riderHeading={riderLocation?.heading}
          phase={mapPhase}
          statusLabel={statusInfo.label}
        />
      )}

      {/* ── Sticky Header ── */}
      <div className={`sticky ${isActiveDelivery ? 'top-0' : 'top-14'} z-30 bg-white/80 backdrop-blur-lg border-b border-surface-100`}>
        <div className="flex items-center justify-between px-4 h-12">
          <button
            onClick={() => router.push('/dashboard/jobs')}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 active:scale-95 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-accent-500' : 'bg-surface-300'}`} />
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Progress Steps */}
        {!isCompleted && currentStepIdx >= 0 && (
          <div className="px-4 pb-2">
            <div className="flex gap-1">
              {STATUS_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    idx <= currentStepIdx ? 'bg-brand-500' : 'bg-surface-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Delivery Complete Summary ── */}
      {order.status === 'DELIVERED' && (
        <div className="px-4 pt-6">
          <div className="rounded-2xl bg-gradient-to-br from-accent-50 to-accent-100/50 border border-accent-200 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500 mx-auto auth-scale-in">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 className="mt-4 text-lg font-bold text-surface-900">Delivery Completed!</h2>
            <p className="mt-2 text-3xl font-bold text-accent-600">
              +GH₵{riderEarnings.toLocaleString()}
            </p>
            <p className="text-xs text-surface-500 mt-1">Earnings credited to your wallet</p>

            <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-white p-3">
              <div>
                <p className="text-[10px] text-surface-400">Distance</p>
                <p className="text-sm font-semibold text-surface-900">{order.distanceKm.toFixed(1)} km</p>
              </div>
              <div>
                <p className="text-[10px] text-surface-400">Duration</p>
                <p className="text-sm font-semibold text-surface-900">~{order.estimatedDurationMinutes} min</p>
              </div>
              <div>
                <p className="text-[10px] text-surface-400">Package</p>
                <p className="text-sm font-semibold text-surface-900">{PACKAGE_LABELS[order.packageType] ?? order.packageType}</p>
              </div>
            </div>

            <Button
              className="mt-5 w-full bg-brand-500 hover:bg-brand-600 rounded-xl h-12"
              onClick={() => router.push('/dashboard/jobs')}
            >
              Find Next Job
            </Button>
          </div>
        </div>
      )}

      {/* ── Failed delivery banner ── */}
      {order.status === 'FAILED' && (
        <div className="px-4 pt-6">
          <div className="rounded-2xl bg-danger-50 border border-danger-200 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-100 mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h2 className="mt-3 text-base font-semibold text-danger-800">Delivery Failed</h2>
            <p className="mt-1 text-sm text-danger-600">This delivery has been marked as failed.</p>
            <Button className="mt-4 w-full rounded-xl" variant="outline" onClick={() => router.push('/dashboard/jobs')}>
              Back to Jobs
            </Button>
          </div>
        </div>
      )}

      {/* ── Navigation Card — compact widget below map ── */}
      {isNavigating && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-brand-500 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-brand-100 uppercase tracking-wider">
                  Navigating to {navTarget.label}
                </p>
                <p className="text-sm font-medium text-white mt-1 truncate">
                  {order.status === 'PICKUP_EN_ROUTE' || order.status === 'ASSIGNED'
                    ? order.pickupAddress
                    : order.dropoffAddress}
                </p>
                {riderLocation && (
                  <p className="text-[10px] text-brand-200 mt-1">
                    GPS active · {riderLocation.lat.toFixed(4)}, {riderLocation.lng.toFixed(4)}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                className="ml-3 bg-white text-brand-600 hover:bg-brand-50 rounded-xl flex-shrink-0"
                onClick={() => openNavigation(navTarget.lat, navTarget.lng, navTarget.label)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                Google Maps
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pickup Confirmation ── */}
      {order.status === 'AT_PICKUP' && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <p className="text-sm font-semibold text-surface-900">Pickup Confirmation</p>
            </div>
            <p className="text-xs text-surface-500 mb-3">Take a photo of the package (optional but recommended)</p>
            <input ref={pickupPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePickupPhoto} />
            {pickupPhoto ? (
              <div className="relative">
                <img src={pickupPhoto} alt="Pickup" className="w-full rounded-xl" />
                <button className="absolute top-2 right-2 rounded-full bg-white/90 shadow-sm p-1.5" onClick={() => setPickupPhoto(null)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <button
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-white py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                onClick={() => pickupPhotoRef.current?.click()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Take Photo
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Proof of Delivery ── */}
      {order.status === 'AT_DROPOFF' && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-teal-50 border border-teal-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <p className="text-sm font-semibold text-surface-900">Proof of Delivery</p>
            </div>

            {/* Proof type selector */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              {([
                { type: 'PHOTO' as ProofType, label: 'Photo', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg> },
                { type: 'SIGNATURE' as ProofType, label: 'Signature', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> },
                { type: 'PIN_CODE' as ProofType, label: 'PIN Code', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> },
                { type: 'LEFT_AT_DOOR' as ProofType, label: 'Left at Door', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
              ] as const).map((opt) => (
                <button
                  key={opt.type}
                  className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-all ${
                    proofType === opt.type
                      ? 'border-brand-500 bg-brand-50 shadow-sm'
                      : 'border-surface-200 bg-white hover:border-surface-300'
                  }`}
                  onClick={() => setProofType(opt.type)}
                >
                  <span className={proofType === opt.type ? 'text-brand-600' : 'text-surface-400'}>{opt.icon}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Photo proof */}
            {proofType === 'PHOTO' && (
              <div>
                <input ref={proofPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleProofPhoto} />
                {proofPhoto ? (
                  <div className="relative">
                    <img src={proofPhoto} alt="Proof" className="w-full rounded-xl" />
                    <button className="absolute top-2 right-2 rounded-full bg-white/90 shadow-sm p-1.5" onClick={() => setProofPhoto(null)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <button className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-200 bg-white py-3 text-sm font-medium text-teal-600 hover:bg-teal-50 transition" onClick={() => proofPhotoRef.current?.click()}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Take Delivery Photo
                  </button>
                )}
              </div>
            )}

            {proofType === 'SIGNATURE' && (
              <div>
                <p className="text-xs text-surface-500 mb-2">Ask the recipient to sign below:</p>
                {signatureData ? (
                  <div className="relative">
                    <img src={signatureData} alt="Signature" className="w-full rounded-xl border" />
                    <button className="absolute top-2 right-2 rounded-full bg-white/90 shadow-sm p-1.5" onClick={() => setSignatureData(null)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <SignatureCanvas onSave={setSignatureData} onClear={() => setSignatureData(null)} />
                )}
              </div>
            )}

            {proofType === 'PIN_CODE' && (
              <div>
                <p className="text-xs text-surface-500 mb-2">Ask the recipient for their delivery PIN:</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter PIN"
                  value={deliveryPinInput}
                  onChange={(e) => { setDeliveryPinInput(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
                  className="w-full rounded-xl border-2 border-surface-200 px-4 py-3 text-center text-xl font-mono tracking-[0.3em] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                {pinError && <p className="mt-2 text-xs text-danger-600">{pinError}</p>}
              </div>
            )}

            {proofType === 'LEFT_AT_DOOR' && (
              <div>
                <p className="text-xs text-surface-500 mb-2">Optionally photo where the package was left:</p>
                <input ref={proofPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleProofPhoto} />
                {proofPhoto ? (
                  <div className="relative">
                    <img src={proofPhoto} alt="Left at door" className="w-full rounded-xl" />
                    <button className="absolute top-2 right-2 rounded-full bg-white/90 shadow-sm p-1.5" onClick={() => setProofPhoto(null)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <button className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-200 bg-white py-3 text-sm font-medium text-teal-600 hover:bg-teal-50 transition" onClick={() => proofPhotoRef.current?.click()}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Photo (Optional)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Route Card ── */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-white shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-surface-400 font-medium">Order #{order.orderNumber}</p>
            <p className="text-base font-bold text-accent-600">GH₵{riderEarnings.toLocaleString()}</p>
          </div>

          {/* Route visualization */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1.5">
              <div className="h-3 w-3 rounded-full bg-accent-500 ring-2 ring-accent-100" />
              <div className="w-0.5 flex-1 bg-surface-200 my-1.5 min-h-[2rem]" />
              <div className="h-3 w-3 rounded-full bg-danger-500 ring-2 ring-danger-100" />
            </div>
            <div className="flex-1 min-w-0">
              {/* Pickup */}
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Pickup</p>
                <p className="text-sm text-surface-800 mt-0.5">{order.pickupAddress}</p>
                {order.senderName && (
                  <p className="text-xs text-surface-500 mt-0.5">
                    {order.senderName}
                    {order.senderPhone && (
                      <a href={`tel:${order.senderPhone}`} className="ml-1.5 text-brand-500 font-medium">{order.senderPhone}</a>
                    )}
                  </p>
                )}
                {(order.status === 'ASSIGNED' || order.status === 'PICKUP_EN_ROUTE') && (
                  <button className="mt-1 flex items-center gap-1 text-xs text-brand-500 font-medium" onClick={() => openNavigation(order.pickupLat, order.pickupLng, 'Pickup')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                    Directions
                  </button>
                )}
              </div>

              <div className="h-5" />

              {/* Dropoff */}
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Dropoff</p>
                <p className="text-sm text-surface-800 mt-0.5">{order.dropoffAddress}</p>
                {order.recipientName && (
                  <p className="text-xs text-surface-500 mt-0.5">
                    {order.recipientName}
                    {order.recipientPhone && (
                      <a href={`tel:${order.recipientPhone}`} className="ml-1.5 text-brand-500 font-medium">{order.recipientPhone}</a>
                    )}
                  </p>
                )}
                {['PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(order.status) && (
                  <button className="mt-1 flex items-center gap-1 text-xs text-brand-500 font-medium" onClick={() => openNavigation(order.dropoffLat, order.dropoffLng, 'Dropoff')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                    Directions
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Details Grid ── */}
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-white shadow-card p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Package</p>
              <p className="text-sm font-medium text-surface-900 mt-0.5">{PACKAGE_LABELS[order.packageType] ?? order.packageType}</p>
              {order.packageDescription && <p className="text-xs text-surface-500 mt-0.5">{order.packageDescription}</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Distance</p>
              <p className="text-sm font-medium text-surface-900 mt-0.5">{order.distanceKm.toFixed(1)} km · ~{order.estimatedDurationMinutes} min</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Client</p>
              <p className="text-sm font-medium text-surface-900 mt-0.5">{order.client.firstName} {order.client.lastName}</p>
              {order.client.phone && (
                <a href={`tel:${order.client.phone}`} className="flex items-center gap-1 mt-0.5 text-xs text-brand-500 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                  Call
                </a>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Payment</p>
              <p className="text-sm font-medium text-surface-900 mt-0.5">{order.paymentMethod === 'CASH' ? 'Cash' : order.paymentMethod}</p>
            </div>
          </div>

          {/* Earnings breakdown */}
          <div className="mt-4 pt-3 border-t border-surface-100 flex items-center justify-between">
            <span className="text-xs text-surface-400">
              Fare: GH₵{order.totalPrice.toLocaleString()} · Fee: GH₵{(order.serviceFee ?? 0).toLocaleString()}
            </span>
            <span className="text-sm font-bold text-accent-600">GH₵{riderEarnings.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── Chat Panel ── */}
      {!isCompleted && (
        <div className="px-4 pt-3">
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <button
              className="flex w-full items-center justify-between p-4"
              onClick={() => setChatOpen(!chatOpen)}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                </div>
                <span className="text-sm font-semibold text-surface-900">Chat with Client</span>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-500 px-1.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className={`transition-transform ${chatOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </button>

            {chatOpen && (
              <div className="border-t border-surface-100 p-4">
                <div className="mb-3 max-h-64 overflow-y-auto rounded-xl bg-surface-50 p-3">
                  {messages.length === 0 ? (
                    <p className="text-center text-xs text-surface-400 py-6">No messages yet</p>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((msg) => {
                        const isMe = msg.senderId === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                              isMe ? 'bg-brand-500 text-white rounded-br-md' : 'bg-white border border-surface-200 text-surface-800 rounded-bl-md'
                            }`}>
                              {!isMe && <p className="text-[10px] font-medium text-surface-500 mb-0.5">{msg.senderName}</p>}
                              <p className="text-sm">{msg.content}</p>
                              <p className={`text-[10px] mt-0.5 ${isMe ? 'text-white/60' : 'text-surface-400'}`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {peerTyping && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl rounded-bl-md bg-surface-200 px-3.5 py-2">
                            <p className="text-xs text-surface-500 animate-pulse">typing...</p>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    className="flex-1 rounded-xl"
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => { setChatInput(e.target.value); handleChatTyping(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  />
                  <Button
                    size="sm"
                    className="bg-brand-500 hover:bg-brand-600 rounded-xl px-4"
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Failed Delivery Dialog ── */}
      <Dialog open={failDialogOpen} onOpenChange={setFailDialogOpen}>
        <DialogContent className="mx-4 max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Report Failed Delivery</DialogTitle>
            <DialogDescription>Select a reason and optionally provide a photo as evidence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              {FAILURE_REASONS.map((reason) => (
                <button
                  key={reason}
                  className={`w-full rounded-xl border-2 px-3 py-2.5 text-left text-sm transition-all ${
                    failReason === reason
                      ? 'border-danger-500 bg-danger-50 text-danger-700 font-medium'
                      : 'border-surface-200 hover:border-surface-300'
                  }`}
                  onClick={() => setFailReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            {failReason === 'Other' && (
              <Textarea placeholder="Describe the reason..." value={failCustomReason} onChange={(e) => setFailCustomReason(e.target.value)} rows={3} className="rounded-xl" />
            )}
            <div>
              <p className="text-xs text-surface-500 mb-2">Photo evidence (optional):</p>
              <input ref={failPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFailPhoto} />
              {failPhoto ? (
                <div className="relative">
                  <img src={failPhoto} alt="Evidence" className="w-full rounded-xl" />
                  <button className="absolute top-2 right-2 rounded-full bg-white/90 shadow-sm p-1.5" onClick={() => setFailPhoto(null)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={() => failPhotoRef.current?.click()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Take Photo
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFailDialogOpen(false)} disabled={failSubmitting} className="rounded-xl">Cancel</Button>
            <Button className="bg-danger-500 hover:bg-danger-600 rounded-xl" onClick={handleFailDelivery} disabled={failSubmitting || !failReason}>
              {failSubmitting ? <Spinner className="h-4 w-4" /> : 'Confirm Failed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bottom Action Bar — Uber slide-up style ── */}
      {!isCompleted && nextAction && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-100 z-50 safe-area-bottom">
          <div className="p-4">
            <Button
              className="w-full bg-surface-900 hover:bg-surface-800 text-white rounded-xl h-13 text-sm font-bold shadow-elevated"
              disabled={transitioning || proofUploading}
              onClick={() => handleTransition(nextAction.status)}
            >
              {transitioning || proofUploading ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  {proofUploading ? 'Uploading...' : 'Updating...'}
                </span>
              ) : (
                nextAction.label
              )}
            </Button>

            {(canFail || canCancel) && (
              <div className="mt-2 flex gap-2">
                {canFail && (
                  <button
                    className="flex-1 text-center text-xs font-medium text-danger-500 hover:text-danger-600 py-2 rounded-xl hover:bg-danger-50 transition"
                    onClick={() => setFailDialogOpen(true)}
                    disabled={transitioning}
                  >
                    Report Failed
                  </button>
                )}
                {canCancel && (
                  <button
                    className="flex-1 text-center text-xs font-medium text-danger-500 hover:text-danger-600 py-2 rounded-xl hover:bg-danger-50 transition"
                    onClick={handleCancelJob}
                    disabled={transitioning}
                  >
                    Cancel Delivery
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
