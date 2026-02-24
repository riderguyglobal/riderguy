'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@riderguy/auth';
import { useSocket } from '@/hooks/use-socket';
import { API_BASE_URL, STATUS_CONFIG, PACKAGE_TYPES } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Textarea } from '@riderguy/ui';
import { DeliveryChat } from '@/components/delivery-chat';
import { ProofOfDelivery } from '@/components/proof-of-delivery';
import {
  ArrowLeft, Navigation, Phone, MapPin, Package, Clock,
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import type { Order } from '@riderguy/types';

const NavigationMap = dynamic(
  () => import('@/components/navigation-map').then((m) => m.NavigationMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-surface-900 animate-shimmer bg-gradient-to-r from-surface-900 via-surface-800 to-surface-900 rounded-2xl" /> }
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
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api, user } = useAuth();
  const { socket, subscribeToOrder, unsubscribeFromOrder, emitLocation } = useSocket();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [showProof, setShowProof] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!api || !id) return;
    try {
      const res = await api.get(`${API_BASE_URL}/orders/${id}`);
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

    const handleStatus = (data: { orderId: string; status: string }) => {
      if (data.orderId === id) {
        setOrder((prev) => prev ? { ...prev, status: data.status as Order['status'] } : prev);
      }
    };

    socket.on('order:status', handleStatus);

    return () => {
      unsubscribeFromOrder(id);
      socket.off('order:status', handleStatus);
    };
  }, [id, socket, subscribeToOrder, unsubscribeFromOrder]);

  // Track GPS
  useEffect(() => {
    if (!order || order.status === 'DELIVERED' || order.status.startsWith('CANCELLED')) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setRiderPos({ lat, lng });
        emitLocation(lat, lng, pos.coords.heading ?? undefined);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [order?.status, emitLocation]);

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
      await api.patch(`${API_BASE_URL}/orders/${id}/status`, { status: nextStatus });
      setOrder((prev) => prev ? { ...prev, status: nextStatus as Order['status'] } : prev);
    } catch {} finally {
      setUpdating(false);
    }
  };

  const handleProofSubmit = async (proof: { type: string; data: string }) => {
    if (!api || !id) return;
    await api.post(`${API_BASE_URL}/orders/${id}/proof`, proof);
    await api.patch(`${API_BASE_URL}/orders/${id}/status`, { status: 'DELIVERED' });
    setOrder((prev) => prev ? { ...prev, status: 'DELIVERED' as Order['status'] } : prev);
    setShowProof(false);
  };

  const handleFail = async () => {
    if (!api || !id || !failReason.trim()) return;
    setUpdating(true);
    try {
      await api.post(`${API_BASE_URL}/orders/${id}/fail`, { reason: failReason.trim() });
      setOrder((prev) => prev ? { ...prev, status: 'FAILED' as Order['status'] } : prev);
      setShowFailDialog(false);
    } catch {} finally {
      setUpdating(false);
    }
  };

  const openExternalNav = () => {
    if (!order) return;
    const isPickup = ['ASSIGNED', 'PICKUP_EN_ROUTE'].includes(order.status);
    const lat = isPickup ? order.pickupLatitude : order.dropoffLatitude;
    const lng = isPickup ? order.pickupLongitude : order.dropoffLongitude;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-surface-950">
        <div className="animate-spin-slow"><Package className="h-8 w-8 text-brand-400" /></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-surface-950 px-6 text-center">
        <p className="text-surface-400 mb-4">Order not found</p>
        <Button variant="outline" className="border-surface-700 text-surface-300" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-surface-400', bg: 'bg-surface-400/10' };
  const pkg = PACKAGE_TYPES[order.packageType] ?? { label: 'Package', icon: '📦' };
  const currentStep = STATUS_FLOW.indexOf(order.status);
  const isComplete = order.status === 'DELIVERED' || order.status.startsWith('CANCELLED') || order.status === 'FAILED';
  const nextLabel = NEXT_STATUS_LABELS[order.status];

  return (
    <div className="min-h-[100dvh] bg-surface-950 flex flex-col">
      {/* Top bar */}
      <div className="safe-area-top bg-surface-950/90 backdrop-blur-xl border-b border-white/5 sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/dashboard/jobs')} className="h-9 w-9 rounded-full bg-surface-800 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-surface-300" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {pkg.icon} {pkg.label} Delivery
            </p>
            <p className={`text-xs ${sc.color}`}>{sc.label}</p>
          </div>
          <button
            onClick={openExternalNav}
            className="h-9 w-9 rounded-full bg-surface-800 flex items-center justify-center"
          >
            <Navigation className="h-4 w-4 text-brand-400" />
          </button>
        </div>
      </div>

      {/* Map */}
      {!isComplete && (
        <div className="h-[35dvh] min-h-[200px] px-4 pt-3">
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
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Status progress */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            {STATUS_FLOW.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= currentStep ? 'bg-brand-500' : 'bg-surface-700'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-surface-400">
            Step {Math.max(currentStep + 1, 1)} of {STATUS_FLOW.length} — <span className={sc.color}>{sc.label}</span>
          </p>
        </div>

        {/* Route info */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-5 w-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-surface-400">Pickup</p>
              <p className="text-sm text-white">{order.pickupAddress}</p>
              {order.pickupContactPhone && (
                <a href={`tel:${order.pickupContactPhone}`} className="flex items-center gap-1 text-xs text-brand-400 mt-1">
                  <Phone className="h-3 w-3" /> {order.pickupContactPhone}
                </a>
              )}
            </div>
          </div>
          <div className="ml-2.5 w-px h-4 bg-surface-700" />
          <div className="flex items-start gap-3">
            <div className="mt-1 h-5 w-5 rounded-full bg-accent-500/20 flex items-center justify-center shrink-0">
              <div className="h-2 w-2 rounded-full bg-accent-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-surface-400">Drop-off</p>
              <p className="text-sm text-white">{order.dropoffAddress}</p>
              {order.dropoffContactPhone && (
                <a href={`tel:${order.dropoffContactPhone}`} className="flex items-center gap-1 text-xs text-brand-400 mt-1">
                  <Phone className="h-3 w-3" /> {order.dropoffContactPhone}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Expandable details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="glass rounded-2xl p-4 w-full flex items-center justify-between"
        >
          <span className="text-sm font-medium text-white">Order Details</span>
          {showDetails ? <ChevronUp className="h-4 w-4 text-surface-400" /> : <ChevronDown className="h-4 w-4 text-surface-400" />}
        </button>

        {showDetails && (
          <div className="glass rounded-2xl p-4 space-y-3 animate-slide-down">
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Package</span>
              <span className="text-white">{pkg.icon} {pkg.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Earnings</span>
              <span className="text-accent-400 font-semibold">{formatCurrency(order.riderEarnings ?? 0)}</span>
            </div>
            {order.packageDescription && (
              <div className="flex justify-between text-sm">
                <span className="text-surface-400">Description</span>
                <span className="text-white text-right max-w-[200px]">{order.packageDescription}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Order ID</span>
              <span className="text-surface-300 font-mono text-xs">{order.orderNumber ?? order.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Created</span>
              <span className="text-surface-300">{timeAgo(new Date(order.createdAt))}</span>
            </div>
          </div>
        )}

        {/* Proof of delivery (when at dropoff) */}
        {showProof && (
          <ProofOfDelivery
            orderId={id}
            deliveryPin={order.deliveryPinCode ?? undefined}
            onSubmit={handleProofSubmit}
          />
        )}

        {/* Completed state */}
        {isComplete && (
          <div className="glass rounded-2xl p-6 text-center">
            {order.status === 'DELIVERED' ? (
              <>
                <CheckCircle className="h-12 w-12 text-accent-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">Delivery Complete!</h3>
                <p className="text-accent-400 text-xl font-bold">{formatCurrency(order.riderEarnings ?? 0)}</p>
                <p className="text-surface-400 text-sm mt-1">Added to your wallet</p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-12 w-12 text-danger-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">
                  {order.status.startsWith('CANCELLED') ? 'Order Cancelled' : 'Delivery Failed'}
                </h3>
              </>
            )}
            <Button
              variant="outline"
              className="mt-4 border-surface-700 text-surface-300"
              onClick={() => router.push('/dashboard/jobs')}
            >
              Back to Jobs
            </Button>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {!isComplete && !showProof && (
        <div className="sticky bottom-0 z-10 px-4 py-3 bg-surface-900/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom">
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="border-danger-500/30 text-danger-400 hover:bg-danger-500/10"
              onClick={() => setShowFailDialog(true)}
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-brand-500 hover:bg-brand-600 text-white"
              onClick={advanceStatus}
              loading={updating}
            >
              {nextLabel ?? 'Next Step'}
            </Button>
          </div>
        </div>
      )}

      {/* Chat */}
      {!isComplete && user && <DeliveryChat orderId={id} userId={user.id} />}

      {/* Failed delivery dialog */}
      <Dialog open={showFailDialog} onOpenChange={setShowFailDialog}>
        <DialogContent className="bg-surface-900 border-surface-700">
          <DialogHeader>
            <DialogTitle className="text-white">Report Failed Delivery</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Explain why the delivery couldn't be completed..."
              className="bg-surface-800 border-surface-700 text-white placeholder:text-surface-500 min-h-[120px]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-surface-700 text-surface-300" onClick={() => setShowFailDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-danger-500 hover:bg-danger-600 text-white" onClick={handleFail} loading={updating} disabled={!failReason.trim()}>
              Report Failed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
