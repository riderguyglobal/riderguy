'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@riderguy/auth';
import { useSocket } from '@/hooks/use-socket';
import { useNavigationNotification } from '@/hooks/use-navigation-notification';
import { STATUS_CONFIG, PACKAGE_TYPES } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, Textarea } from '@riderguy/ui';
import { DeliveryChat } from '@/components/delivery-chat';
import { ProofOfDelivery } from '@/components/proof-of-delivery';
import { RiderCancelModal } from '@/components/rider-cancel-modal';
import {
  ArrowLeft, Navigation, Phone, Package, Clock,
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Sparkles, X
} from 'lucide-react';
import type { Order } from '@riderguy/types';

const NavigationMap = dynamic(
  () => import('@/components/navigation-map').then((m) => m.NavigationMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-page animate-shimmer bg-gradient-to-r from-page via-shimmer to-page rounded-2xl" /> }
);

const STATUS_FLOW = [
  'ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP',
  'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF', 'DELIVERED'
];

const NEXT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Start Navigation',
  PICKUP_EN_ROUTE: 'Arrived at Pickup',
  AT_PICKUP: 'Package Picked Up',
  PICKED_UP: 'Heading to Drop-off',
  IN_TRANSIT: 'Arrived at Drop-off',
  AT_DROPOFF: 'Complete Delivery',
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>() ?? {};
  const router = useRouter();
  const { api, user } = useAuth();
  const { socket, subscribeToOrder, unsubscribeFromOrder } = useSocket();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [showProof, setShowProof] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [actionError, setActionError] = useState('');
  const searchParams = useSearchParams();
  const autoNavTriggered = useRef(false);
  const { showNotification: showNavNotification, dismissNotification: dismissNavNotification } = useNavigationNotification(id);

  const fetchOrder = useCallback(async () => {
    if (!api || !id) return;
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data.data);
    } catch {} finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Subscribe to order updates
  useEffect(() => {
    if (!id || !socket) return;
    subscribeToOrder(id);

    const handleStatus = (data: { orderId: string; status: string; note?: string }) => {
      if (data.orderId === id) {
        setOrder((prev) => {
          if (!prev) return prev;
          // Terminal statuses (cancelled/failed) always take effect immediately
          if (data.status.startsWith('CANCELLED') || data.status === 'FAILED') {
            return { ...prev, status: data.status as Order['status'], cancelNote: data.note };
          }
          // Only accept forward status progressions to prevent out-of-order socket events
          const prevIdx = STATUS_FLOW.indexOf(prev.status);
          const newIdx = STATUS_FLOW.indexOf(data.status);
          if (newIdx > prevIdx) {
            return { ...prev, status: data.status as Order['status'] };
          }
          return prev;
        });
      }
    };

    socket.on('order:status', handleStatus);

    return () => {
      unsubscribeFromOrder(id);
      socket.off('order:status', handleStatus);
    };
  }, [id, socket, subscribeToOrder, unsubscribeFromOrder]);

  // Track GPS — only update local map marker here.
  // The availability hook already sends location via socket + REST heartbeat,
  // so we do NOT call emitLocation here to avoid duplicate DB writes.
  useEffect(() => {
    if (!order || order.status === 'DELIVERED' || order.status.startsWith('CANCELLED')) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setRiderPos({ lat, lng });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [order?.status]);

  const advanceStatus = async () => {
    if (!api || !order || updating) return;
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;

    // If at ARRIVED_DROPOFF, show proof of delivery instead
    if (order.status === 'AT_DROPOFF') {
      setShowProof(true);
      return;
    }

    const nextStatus = STATUS_FLOW[idx + 1];
    setUpdating(true);
    try {
      await api.patch(`/orders/${id}/status`, { status: nextStatus });
      navigator.vibrate?.(50);
      setOrder((prev) => prev ? { ...prev, status: nextStatus as Order['status'] } : prev);

      // Auto-launch Google Maps navigation on key transitions
      if (nextStatus === 'PICKUP_EN_ROUTE') {
        // Heading to pickup — navigate to pickup location
        launchNavigation(order.pickupLatitude, order.pickupLongitude, 'pickup');
      } else if (nextStatus === 'IN_TRANSIT') {
        // Heading to drop-off — navigate to dropoff location
        launchNavigation(order.dropoffLatitude, order.dropoffLongitude, 'delivery');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to update status';
      setActionError(msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmPayment = async (actualPaymentMethod: string) => {
    if (!api || !id) return;
    await api.post(`/orders/${id}/confirm-payment`, { actualPaymentMethod });
    setPaymentConfirmed(true);
  };

  const handleProofSubmit = async (proof: { type: string; data: string; file?: File }) => {
    if (!api || !id) return;

    setUpdating(true);
    try {
      if (proof.type === 'PHOTO' && proof.file) {
        // Multipart upload for photo proofs
        const formData = new FormData();
        formData.append('file', proof.file);
        formData.append('proofType', proof.type);
        formData.append('completeDelivery', 'true');
        await api.post(`/orders/${id}/proof`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        // JSON for signature (base64) and PIN code
        await api.post(`/orders/${id}/proof`, {
          proofType: proof.type,
          proofData: proof.data,
          completeDelivery: true,
        });
      }

      setOrder((prev) => prev ? { ...prev, status: 'DELIVERED' as Order['status'] } : prev);
      setShowProof(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to submit proof of delivery';
      setActionError(msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleFail = async () => {
    if (!api || !id || !failReason.trim()) return;
    setUpdating(true);
    try {
      await api.post(`/orders/${id}/fail`, { reason: failReason.trim() });
      setOrder((prev) => prev ? { ...prev, status: 'FAILED' as Order['status'] } : prev);
      setShowFailDialog(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to report delivery issue';
      setActionError(msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleRiderCancel = async (reason: string) => {
    if (!api || !id) return;
    await api.post(`/orders/${id}/rider-cancel`, { reason });
    setOrder((prev) => prev ? { ...prev, status: 'CANCELLED_BY_RIDER' as Order['status'] } : prev);
    setShowCancelModal(false);
  };

  const handleRequestCancel = async (reason: string) => {
    if (!api || !id) return;
    await api.post(`/orders/${id}/cancel-request`, { reason });
  };

  /** Launch Google Maps turn-by-turn navigation to the given coordinates */
  const launchNavigation = useCallback((lat: number, lng: number, phase: 'pickup' | 'delivery' = 'pickup') => {
    // Show a persistent notification so the rider can tap to return
    showNavNotification(phase);

    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    if (window.matchMedia('(display-mode: standalone)').matches) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [showNavNotification]);

  const openExternalNav = () => {
    if (!order) return;
    const isPickup = ['ASSIGNED', 'PICKUP_EN_ROUTE'].includes(order.status);
    const lat = isPickup ? order.pickupLatitude : order.dropoffLatitude;
    const lng = isPickup ? order.pickupLongitude : order.dropoffLongitude;
    launchNavigation(lat, lng, isPickup ? 'pickup' : 'delivery');
  };

  // Auto-launch Google Maps navigation when arriving from accept (autoNav=pickup)
  useEffect(() => {
    if (autoNavTriggered.current) return;
    if (!order || !searchParams?.get('autoNav')) return;

    autoNavTriggered.current = true;
    // Clean the URL param so it doesn't re-trigger on refresh
    router.replace(`/dashboard/jobs/${id}`, { scroll: false });

    // Small delay so the detail page renders before launching Maps
    const timer = setTimeout(() => {
      launchNavigation(order.pickupLatitude, order.pickupLongitude, 'pickup');
    }, 800);
    return () => clearTimeout(timer);
  }, [order, searchParams, id, router, launchNavigation]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-page">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-xl scale-150 animate-pulse" />
          <div className="animate-spin-slow"><Package className="h-8 w-8 text-brand-400" /></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-page px-6 text-center">
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-full bg-surface-500/10 blur-xl scale-150" />
          <div className="relative h-16 w-16 rounded-2xl glass flex items-center justify-center">
            <Package className="h-7 w-7 text-subtle" />
          </div>
        </div>
        <p className="text-muted mb-4">Order not found</p>
        <Button variant="outline" className="border-themed text-secondary rounded-xl" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-muted', bg: 'bg-surface-400/10' };
  const pkg = PACKAGE_TYPES[order.packageType] ?? { label: 'Package', icon: '📦' };
  const currentStep = STATUS_FLOW.indexOf(order.status);
  const isComplete = order.status === 'DELIVERED' || order.status.startsWith('CANCELLED') || order.status === 'FAILED';
  const nextLabel = NEXT_STATUS_LABELS[order.status];

  return (
    <div className="min-h-[100dvh] bg-page flex flex-col">
      {/* Top bar */}
      <div className="safe-area-top bg-overlay backdrop-blur-2xl border-b border-themed sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/dashboard/jobs')} className="h-9 w-9 rounded-xl glass flex items-center justify-center btn-press">
            <ArrowLeft className="h-5 w-5 text-secondary" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">
              {pkg.icon} {pkg.label} Delivery
            </p>
            <p className={`text-xs font-medium ${sc.color}`}>{sc.label}</p>
          </div>
          <button
            onClick={openExternalNav}
            className="h-9 w-9 rounded-xl glass flex items-center justify-center btn-press"
          >
            <Navigation className="h-4 w-4 text-brand-400" />
          </button>
        </div>
      </div>

      {/* Map */}
      {!isComplete && (
        <div className="relative h-[35dvh] min-h-[200px] px-4 pt-3">
          <NavigationMap
            pickupLat={order.pickupLatitude}
            pickupLng={order.pickupLongitude}
            dropoffLat={order.dropoffLatitude}
            dropoffLng={order.dropoffLongitude}
            riderLat={riderPos?.lat}
            riderLng={riderPos?.lng}
            status={order.status}
            className="w-full h-full"
          />
          <div className="absolute bottom-0 inset-x-4 h-12 bg-gradient-to-t from-page to-transparent pointer-events-none rounded-b-2xl" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
        {/* Premium status progress */}
        <div className="glass-elevated rounded-2xl p-4">
          <div className="flex items-center gap-1 mb-3">
            {STATUS_FLOW.map((s, i) => {
              const isDone = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <div key={s} className="flex items-center flex-1">
                  {/* Dot */}
                  <div className="relative flex items-center justify-center">
                    {isCurrent && (
                      <div className="absolute h-6 w-6 rounded-full bg-brand-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                    )}
                    <div className={`relative h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                      isDone ? 'bg-brand-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-surface-700'
                    }`} />
                  </div>
                  {/* Connector line */}
                  {i < STATUS_FLOW.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-0.5 rounded-full transition-all duration-500 ${
                      i < currentStep ? 'bg-brand-500' : 'bg-surface-700'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            Step {Math.max(currentStep + 1, 1)} of {STATUS_FLOW.length} — <span className={`font-semibold ${sc.color}`}>{sc.label}</span>
          </p>
        </div>

        {/* Route info */}
        <div className="glass-elevated rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 relative">
              <div className="h-6 w-6 rounded-full bg-brand-500/15 flex items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-subtle font-medium uppercase tracking-wider">Pickup</p>
              <p className="text-sm text-primary font-medium">{order.pickupAddress}</p>
              {order.pickupContactPhone && (
                <a href={`tel:${order.pickupContactPhone}`} className="inline-flex items-center gap-1.5 text-xs text-brand-400 mt-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 btn-press">
                  <Phone className="h-3 w-3" /> Call
                </a>
              )}
            </div>
          </div>
          <div className="ml-3 w-px h-4 bg-gradient-to-b from-brand-500/40 to-accent-500/40" />
          <div className="flex items-start gap-3">
            <div className="mt-0.5 relative">
              <div className="h-6 w-6 rounded-full bg-accent-500/15 flex items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-accent-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-subtle font-medium uppercase tracking-wider">Drop-off</p>
              <p className="text-sm text-primary font-medium">{order.dropoffAddress}</p>
              {order.dropoffContactPhone && (
                <a href={`tel:${order.dropoffContactPhone}`} className="inline-flex items-center gap-1.5 text-xs text-brand-400 mt-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 btn-press">
                  <Phone className="h-3 w-3" /> Call
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Expandable details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="glass-elevated rounded-2xl p-4 w-full flex items-center justify-between btn-press"
        >
          <span className="text-sm font-semibold text-primary">Order Details</span>
          {showDetails ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
        </button>

        {showDetails && (
          <div className="glass rounded-2xl p-4 space-y-3 animate-slide-down">
            <div className="flex justify-between text-sm">
              <span className="text-subtle">Package</span>
              <span className="text-primary font-medium">{pkg.icon} {pkg.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-subtle">Earnings</span>
              <span className="text-accent-400 font-bold">{formatCurrency(order.riderEarnings ?? 0)}</span>
            </div>
            {order.packageDescription && (
              <div className="flex justify-between text-sm">
                <span className="text-subtle">Description</span>
                <span className="text-primary text-right max-w-[200px]">{order.packageDescription}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-subtle">Order ID</span>
              <span className="text-muted font-mono text-xs">{order.orderNumber ?? order.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-subtle">Created</span>
              <span className="text-muted">{timeAgo(new Date(order.createdAt))}</span>
            </div>
          </div>
        )}

        {/* Proof of delivery */}
        {showProof && (
          <ProofOfDelivery
            deliveryPin={order.deliveryPinCode ?? undefined}
            paymentMethod={order.paymentMethod ?? undefined}
            riderPaymentConfirmed={paymentConfirmed}
            onConfirmPayment={handleConfirmPayment}
            onSubmit={handleProofSubmit}
          />
        )}

        {/* Completed state */}
        {isComplete && (
          <div className="glass-elevated rounded-2xl p-6 text-center animate-scale-bounce">
            {order.status === 'DELIVERED' ? (
              <>
                <div className="relative inline-flex mb-4">
                  <div className="absolute inset-0 rounded-full bg-accent-500/20 blur-xl scale-[2] animate-pulse" />
                  <div className="relative h-16 w-16 rounded-full bg-accent-500/15 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-accent-400" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-primary mb-1">Delivery Complete!</h3>
                <p className="text-accent-400 text-2xl font-bold animate-number-pop">{formatCurrency(order.riderEarnings ?? 0)}</p>
                <p className="text-muted text-sm mt-1">Added to your wallet</p>
              </>
            ) : (
              <>
                <div className="relative inline-flex mb-4">
                  <div className="absolute inset-0 rounded-full bg-danger-500/20 blur-xl scale-150" />
                  <div className="relative h-16 w-16 rounded-full bg-danger-500/15 flex items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-danger-400" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-primary mb-1">
                  {order.status === 'CANCELLED_BY_CLIENT' ? 'Cancelled by Client' : order.status.startsWith('CANCELLED') ? 'Order Cancelled' : 'Delivery Failed'}
                </h3>
                {order.status === 'CANCELLED_BY_CLIENT' && (
                  <p className="text-muted text-sm mt-1">The client cancelled this order. You&apos;ve been compensated for your time.</p>
                )}
                {(order as any).cancelNote && (
                  <p className="text-subtle text-xs mt-2 italic">&ldquo;{(order as any).cancelNote}&rdquo;</p>
                )}
              </>
            )}
            <Button
              variant="outline"
              className="mt-5 border-themed text-secondary rounded-xl"
              onClick={() => router.push('/dashboard/jobs')}
            >
              Back to Jobs
            </Button>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {!isComplete && !showProof && (
        <div className="sticky bottom-0 z-10 px-4 py-3 bg-nav backdrop-blur-2xl border-t border-themed safe-area-bottom">
          {actionError && (
            <div className="mb-2 px-3 py-2 rounded-xl bg-danger-500/15 border border-danger-500/30 text-danger-400 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{actionError}</span>
              <button onClick={() => setActionError('')} className="text-danger-300 hover:text-danger-200 text-xs font-bold">✕</button>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setShowFailDialog(true)}
              className="h-12 w-12 rounded-xl glass flex items-center justify-center text-danger-400 hover:bg-danger-500/10 transition-colors btn-press shrink-0"
            >
              <AlertTriangle className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowCancelModal(true)}
              className="h-12 px-4 rounded-xl glass flex items-center justify-center gap-2 text-danger-400 hover:bg-danger-500/10 transition-colors btn-press shrink-0 text-sm font-medium"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
            <Button
              size="lg"
              className="flex-1 gradient-brand text-white font-semibold rounded-xl shadow-lg glow-brand btn-press h-12"
              onClick={advanceStatus}
              loading={updating}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {nextLabel ?? 'Next Step'}
            </Button>
          </div>
        </div>
      )}

      {/* Chat */}
      {!isComplete && user && id && <DeliveryChat orderId={id} userId={user.id} />}

      {/* Failed delivery dialog */}
      <Dialog open={showFailDialog} onOpenChange={setShowFailDialog}>
        <DialogContent className="bg-card-strong border-themed-strong rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary">Report Failed Delivery</DialogTitle>
            <DialogDescription className="text-muted">Explain why this delivery could not be completed.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Explain why the delivery couldn't be completed..."
              className="bg-surface-800/50 border-themed-strong text-primary placeholder:text-subtle min-h-[120px] rounded-xl focus:border-brand-500"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-themed text-secondary rounded-xl" onClick={() => setShowFailDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-danger-500 hover:bg-danger-600 text-white rounded-xl" onClick={handleFail} loading={updating} disabled={!failReason.trim()}>
              Report Failed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rider cancel modal */}
      {order && (
        <RiderCancelModal
          open={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleRiderCancel}
          onRequestCancel={handleRequestCancel}
          status={order.status}
          orderNumber={order.orderNumber ?? order.id.slice(0, 8)}
        />
      )}
    </div>
  );
}
