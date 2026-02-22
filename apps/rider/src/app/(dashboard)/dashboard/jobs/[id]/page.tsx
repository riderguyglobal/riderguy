'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Spinner,
  Separator,
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

// ============================================================
// Active Job Detail — Sprint 5: Full delivery execution with
// real-time tracking, proof of delivery, chat, and GPS.
// ============================================================

// ── Status display config ──
const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  ASSIGNED: { label: 'Assigned', color: 'bg-blue-100 text-blue-700', icon: '📋' },
  PICKUP_EN_ROUTE: { label: 'Heading to Pickup', color: 'bg-blue-100 text-blue-700', icon: '🗺️' },
  AT_PICKUP: { label: 'At Pickup', color: 'bg-indigo-100 text-indigo-700', icon: '📍' },
  PICKED_UP: { label: 'Picked Up', color: 'bg-purple-100 text-purple-700', icon: '📦' },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-purple-100 text-purple-700', icon: '🛵' },
  AT_DROPOFF: { label: 'At Dropoff', color: 'bg-teal-100 text-teal-700', icon: '📍' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: '✅' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: '❌' },
  CANCELLED_BY_RIDER: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: '🚫' },
};

// Rider-driven status transitions
const NEXT_STATUS: Record<string, { status: string; label: string; icon: string }> = {
  ASSIGNED: { status: 'PICKUP_EN_ROUTE', label: 'Start Heading to Pickup', icon: '🚀' },
  PICKUP_EN_ROUTE: { status: 'AT_PICKUP', label: 'Arrived at Pickup', icon: '📍' },
  AT_PICKUP: { status: 'PICKED_UP', label: 'Package Collected', icon: '📦' },
  PICKED_UP: { status: 'IN_TRANSIT', label: 'Start Delivery', icon: '🛵' },
  IN_TRANSIT: { status: 'AT_DROPOFF', label: 'Arrived at Dropoff', icon: '📍' },
  AT_DROPOFF: { status: 'DELIVERED', label: 'Confirm Delivery', icon: '✅' },
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
        className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} className="flex-1">
          Clear
        </Button>
        <Button size="sm" onClick={save} className="flex-1 bg-brand-500 hover:bg-brand-600">
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
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-500">Order not found</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => router.push('/dashboard/jobs')}
        >
          Back to Jobs
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[order.status] || {
    label: order.status,
    color: 'bg-gray-100 text-gray-700',
    icon: '📄',
  };
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

  return (
    <div className="p-4 pb-40">
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard/jobs')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
            title={connected ? 'Connected' : 'Disconnected'}
          />
          <Badge className={`${statusInfo.color} border-0`}>
            {statusInfo.icon} {statusInfo.label}
          </Badge>
        </div>
      </div>

      {/* ── Delivery Complete Summary ── */}
      {order.status === 'DELIVERED' && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl">🎉</p>
            <p className="mt-1 text-lg font-semibold text-green-800">
              Delivery Completed!
            </p>
            <p className="mt-2 text-2xl font-bold text-green-700">
              +₦{riderEarnings.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-green-600">
              Earnings credited to your wallet
            </p>
            <Separator className="my-3" />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">Distance</p>
                <p className="text-sm font-semibold text-gray-800">
                  {order.distanceKm.toFixed(1)} km
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm font-semibold text-gray-800">
                  ~{order.estimatedDurationMinutes} min
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Package</p>
                <p className="text-sm font-semibold text-gray-800">
                  {PACKAGE_LABELS[order.packageType] ?? order.packageType}
                </p>
              </div>
            </div>
            {order.proofOfDeliveryType && (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-gray-500">
                  Proof: {order.proofOfDeliveryType.replace('_', ' ')}
                </p>
              </>
            )}
            <Button
              className="mt-4 w-full bg-brand-500 hover:bg-brand-600"
              onClick={() => router.push('/dashboard/jobs')}
            >
              Find Next Job
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Failed delivery banner ── */}
      {order.status === 'FAILED' && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl">❌</p>
            <p className="mt-1 text-sm font-semibold text-red-800">
              Delivery Failed
            </p>
            <p className="mt-1 text-xs text-red-600">
              This delivery has been marked as failed.
            </p>
            <Button
              className="mt-4 w-full"
              variant="outline"
              onClick={() => router.push('/dashboard/jobs')}
            >
              Back to Jobs
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Navigation Card (shown during en-route phases) ── */}
      {isNavigating && (
        <Card className="mb-4 border-brand-200 bg-brand-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-brand-600 uppercase">
                  Navigating to {navTarget.label}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  {order.status === 'PICKUP_EN_ROUTE' || order.status === 'ASSIGNED'
                    ? order.pickupAddress
                    : order.dropoffAddress}
                </p>
                {riderLocation && (
                  <p className="text-xs text-gray-400 mt-1">
                    📡 GPS active · {riderLocation.lat.toFixed(4)}, {riderLocation.lng.toFixed(4)}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                className="bg-brand-500 hover:bg-brand-600"
                onClick={() => openNavigation(navTarget.lat, navTarget.lng, navTarget.label)}
              >
                🗺️ Navigate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pickup Confirmation (at pickup stage) ── */}
      {order.status === 'AT_PICKUP' && (
        <Card className="mb-4 border-indigo-200 bg-indigo-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">
              📸 Pickup Confirmation
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Take a photo of the package for confirmation (optional but recommended).
            </p>
            <input
              ref={pickupPhotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePickupPhoto}
            />
            {pickupPhoto ? (
              <div className="relative">
                <img
                  src={pickupPhoto}
                  alt="Pickup confirmation"
                  className="w-full rounded-lg"
                />
                <button
                  className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-xs"
                  onClick={() => setPickupPhoto(null)}
                >
                  ✕
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => pickupPhotoRef.current?.click()}
              >
                📷 Take Photo of Package
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Proof of Delivery (at dropoff stage) ── */}
      {order.status === 'AT_DROPOFF' && (
        <Card className="mb-4 border-teal-200 bg-teal-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">
              🔐 Proof of Delivery
            </p>

            {/* Proof type selector */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              {([
                { type: 'PHOTO' as ProofType, label: '📷 Photo', desc: 'Take a photo' },
                { type: 'SIGNATURE' as ProofType, label: '✍️ Signature', desc: 'Get signature' },
                { type: 'PIN_CODE' as ProofType, label: '🔢 PIN Code', desc: 'Enter PIN' },
                { type: 'LEFT_AT_DOOR' as ProofType, label: '🚪 Left at Door', desc: 'No contact' },
              ] as const).map((opt) => (
                <button
                  key={opt.type}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    proofType === opt.type
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => setProofType(opt.type)}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Photo proof */}
            {proofType === 'PHOTO' && (
              <div>
                <input
                  ref={proofPhotoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleProofPhoto}
                />
                {proofPhoto ? (
                  <div className="relative">
                    <img
                      src={proofPhoto}
                      alt="Proof of delivery"
                      className="w-full rounded-lg"
                    />
                    <button
                      className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-xs"
                      onClick={() => setProofPhoto(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => proofPhotoRef.current?.click()}
                  >
                    📷 Take Delivery Photo
                  </Button>
                )}
              </div>
            )}

            {/* Signature proof */}
            {proofType === 'SIGNATURE' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Ask the recipient to sign below:
                </p>
                {signatureData ? (
                  <div className="relative">
                    <img
                      src={signatureData}
                      alt="Signature"
                      className="w-full rounded-lg border"
                    />
                    <button
                      className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-xs"
                      onClick={() => setSignatureData(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <SignatureCanvas
                    onSave={setSignatureData}
                    onClear={() => setSignatureData(null)}
                  />
                )}
              </div>
            )}

            {/* PIN code proof */}
            {proofType === 'PIN_CODE' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Ask the recipient for their delivery PIN:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter PIN"
                    value={deliveryPinInput}
                    onChange={(e) => {
                      setDeliveryPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setPinError('');
                    }}
                    className="w-32 rounded-md border border-gray-300 px-3 py-2 text-center text-lg font-mono tracking-[0.25em] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                {pinError && (
                  <p className="mt-2 text-xs text-red-600">{pinError}</p>
                )}
              </div>
            )}

            {/* Left at door */}
            {proofType === 'LEFT_AT_DOOR' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Optionally take a photo showing where the package was left:
                </p>
                <input
                  ref={proofPhotoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleProofPhoto}
                />
                {proofPhoto ? (
                  <div className="relative">
                    <img
                      src={proofPhoto}
                      alt="Left at door"
                      className="w-full rounded-lg"
                    />
                    <button
                      className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-xs"
                      onClick={() => setProofPhoto(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => proofPhotoRef.current?.click()}
                  >
                    📷 Photo of Drop Location (Optional)
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Address Card ── */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            Order #{order.orderNumber}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Pickup */}
            <div className="flex items-start gap-2">
              <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-green-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-400">PICKUP</p>
                <p className="text-sm text-gray-800">{order.pickupAddress}</p>
                {order.senderName && (
                  <p className="text-xs text-gray-500">
                    {order.senderName}
                    {order.senderPhone && (
                      <a href={`tel:${order.senderPhone}`} className="ml-2 text-brand-500 underline">
                        {order.senderPhone}
                      </a>
                    )}
                  </p>
                )}
                {(order.status === 'ASSIGNED' || order.status === 'PICKUP_EN_ROUTE') && (
                  <button
                    className="mt-1 text-xs text-brand-500 hover:text-brand-600 font-medium"
                    onClick={() => openNavigation(order.pickupLat, order.pickupLng, 'Pickup')}
                  >
                    🗺️ Get Directions
                  </button>
                )}
              </div>
            </div>

            <div className="ml-[5px] h-6 border-l-2 border-dashed border-gray-200" />

            {/* Dropoff */}
            <div className="flex items-start gap-2">
              <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-400">DROPOFF</p>
                <p className="text-sm text-gray-800">{order.dropoffAddress}</p>
                {order.recipientName && (
                  <p className="text-xs text-gray-500">
                    {order.recipientName}
                    {order.recipientPhone && (
                      <a href={`tel:${order.recipientPhone}`} className="ml-2 text-brand-500 underline">
                        {order.recipientPhone}
                      </a>
                    )}
                  </p>
                )}
                {['PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(order.status) && (
                  <button
                    className="mt-1 text-xs text-brand-500 hover:text-brand-600 font-medium"
                    onClick={() => openNavigation(order.dropoffLat, order.dropoffLng, 'Dropoff')}
                  >
                    🗺️ Get Directions
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Package + Client Info ── */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Package</p>
              <p className="text-sm font-medium text-gray-800">
                {PACKAGE_LABELS[order.packageType] ?? order.packageType}
              </p>
              {order.packageDescription && (
                <p className="text-xs text-gray-500 mt-1">{order.packageDescription}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400">Distance</p>
              <p className="text-sm font-medium text-gray-800">
                {order.distanceKm.toFixed(1)} km · ~{order.estimatedDurationMinutes} min
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Client</p>
              <p className="text-sm font-medium text-gray-800">
                {order.client.firstName} {order.client.lastName}
              </p>
              {order.client.phone && (
                <a href={`tel:${order.client.phone}`} className="text-xs text-brand-500 underline">
                  Call Client
                </a>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400">Payment</p>
              <p className="text-sm font-medium text-gray-800">
                {order.paymentMethod === 'CASH' ? '💵 Cash' : '💳 ' + order.paymentMethod}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Earnings ── */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Your Earnings</p>
            <p className="text-xl font-bold text-green-600">
              ₦{riderEarnings.toLocaleString()}
            </p>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Total fare: ₦{order.totalPrice.toLocaleString()}</span>
            <span>Service fee: ₦{(order.serviceFee ?? 0).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Chat Panel ── */}
      {!isCompleted && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <button
              className="flex w-full items-center justify-between"
              onClick={() => setChatOpen(!chatOpen)}
            >
              <CardTitle className="text-sm font-medium text-gray-500">
                💬 Chat with Client
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
              {/* Messages */}
              <div className="mb-3 max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-3">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-4">
                    No messages yet. Send a message to the client.
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

              {/* Input */}
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

      {/* ── Failed Delivery Dialog ── */}
      <Dialog open={failDialogOpen} onOpenChange={setFailDialogOpen}>
        <DialogContent className="mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle>Report Failed Delivery</DialogTitle>
            <DialogDescription>
              Select a reason and optionally provide a photo as evidence.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Reason selection */}
            <div className="space-y-2">
              {FAILURE_REASONS.map((reason) => (
                <button
                  key={reason}
                  className={`w-full rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors ${
                    failReason === reason
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setFailReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>

            {/* Custom reason */}
            {failReason === 'Other' && (
              <Textarea
                placeholder="Describe the reason..."
                value={failCustomReason}
                onChange={(e) => setFailCustomReason(e.target.value)}
                rows={3}
              />
            )}

            {/* Photo evidence */}
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Photo evidence (optional):
              </p>
              <input
                ref={failPhotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFailPhoto}
              />
              {failPhoto ? (
                <div className="relative">
                  <img
                    src={failPhoto}
                    alt="Failure evidence"
                    className="w-full rounded-lg"
                  />
                  <button
                    className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-xs"
                    onClick={() => setFailPhoto(null)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => failPhotoRef.current?.click()}
                >
                  📷 Take Photo
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFailDialogOpen(false)}
              disabled={failSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600"
              onClick={handleFailDelivery}
              disabled={failSubmitting || !failReason}
            >
              {failSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Submitting…
                </>
              ) : (
                'Confirm Failed Delivery'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bottom Action Bar ── */}
      {!isCompleted && nextAction && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
          <div className="safe-area-bottom">
            <Button
              className="w-full bg-brand-500 hover:bg-brand-600 text-base py-6"
              disabled={transitioning || proofUploading}
              onClick={() => handleTransition(nextAction.status)}
            >
              {transitioning || proofUploading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {proofUploading ? 'Uploading Proof…' : 'Updating…'}
                </>
              ) : (
                <>
                  {nextAction.icon} {nextAction.label}
                </>
              )}
            </Button>

            <div className="mt-2 flex gap-2">
              {canFail && (
                <button
                  className="flex-1 text-center text-sm text-red-500 hover:text-red-600 py-1"
                  onClick={() => setFailDialogOpen(true)}
                  disabled={transitioning}
                >
                  ⚠️ Report Failed Delivery
                </button>
              )}
              {canCancel && (
                <button
                  className="flex-1 text-center text-sm text-red-500 hover:text-red-600 py-1"
                  onClick={handleCancelJob}
                  disabled={transitioning}
                >
                  Cancel Delivery
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
