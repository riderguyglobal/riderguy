'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, ORDER_STATUS_CONFIG } from '@/lib/constants';
import { formatCurrency } from '@riderguy/utils';
import { connectSocket, subscribeToOrder, unsubscribeFromOrder } from '@/hooks/use-socket';
import { Badge, Avatar, AvatarImage, AvatarFallback, Skeleton } from '@riderguy/ui';
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
  X,
  AlertTriangle,
  Star,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const TrackingMap = dynamic(() => import('@/components/tracking-map'), { ssr: false });
const OrderChat = dynamic(() => import('@/components/order-chat'), { ssr: false });

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Finding Rider', icon: Clock },
  { key: 'ASSIGNED', label: 'Rider Assigned', icon: CheckCircle },
  { key: 'PICKUP_EN_ROUTE', label: 'Rider En Route', icon: Truck },
  { key: 'AT_PICKUP', label: 'At Pickup', icon: Navigation },
  { key: 'PICKED_UP', label: 'Picked Up', icon: Package },
  { key: 'IN_TRANSIT', label: 'On The Way', icon: Truck },
  { key: 'AT_DROPOFF', label: 'Arrived', icon: Navigation },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle },
];

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuth();
  const [riderCoords, setRiderCoords] = useState<[number, number] | null>(null);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api!.get(`${API_BASE_URL}/orders/${id}`);
      return res.data.data;
    },
    enabled: !!api && !!id,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!id) return;
    const socket = connectSocket();
    subscribeToOrder(id);

    socket.on('order:updated', (data: Record<string, unknown>) => {
      if (data.orderId === id) refetch();
    });

    socket.on('rider:location', (data: { lat: number; lng: number }) => {
      setRiderCoords([data.lng, data.lat]);
    });

    return () => {
      unsubscribeFromOrder(id);
      socket.off('order:updated');
      socket.off('rider:location');
    };
  }, [id, refetch]);

  if (isLoading || !order) {
    return (
      <div className="min-h-[100dvh] bg-surface-50 p-5 space-y-4">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-surface-600', bg: 'bg-surface-100', icon: 'clock' };
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const isComplete = order.status === 'DELIVERED';
  const isCancelled = order.status.startsWith('CANCELLED') || order.status === 'FAILED';

  const pickupCoords: [number, number] | null = order.pickupLongitude && order.pickupLatitude ? [order.pickupLongitude, order.pickupLatitude] : null;
  const dropoffCoords: [number, number] | null = order.dropoffLongitude && order.dropoffLatitude ? [order.dropoffLongitude, order.dropoffLatitude] : null;

  const rider = (order as Record<string, unknown>).rider as Record<string, unknown> | undefined;
  const deliveryPin = order.deliveryPinCode;

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white/80 backdrop-blur-xl sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/orders')} className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center btn-press">
              <ArrowLeft className="h-5 w-5 text-surface-600" />
            </button>
            <div>
              <h1 className="text-base font-extrabold text-surface-900">Order #{id?.slice(-6).toUpperCase()}</h1>
              <Badge className={`${statusConfig.bg} ${statusConfig.color} text-[11px] font-semibold`}>{statusConfig.label}</Badge>
            </div>
          </div>
          {isCancelled && (
            <div className="h-9 w-9 rounded-xl bg-danger-50 flex items-center justify-center">
              <X className="h-4 w-4 text-danger-500" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Map */}
        <div className="h-56 rounded-2xl overflow-hidden shadow-elevated">
          <TrackingMap
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            riderCoords={riderCoords}
            status={order.status}
          />
        </div>

        {/* Status stepper */}
        {!isCancelled && (
          <div className="card-elevated p-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {STATUS_STEPS.map((s, i) => {
                const done = i <= currentStepIndex;
                const active = i === currentStepIndex;
                const Icon = s.icon;
                return (
                  <div key={s.key} className="flex items-center gap-1 shrink-0">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
                      done ? 'brand-gradient shadow-brand' : 'bg-surface-100'
                    } ${active ? 'ring-2 ring-brand-200 scale-110' : ''}`}>
                      <Icon className={`h-3.5 w-3.5 ${done ? 'text-white' : 'text-surface-400'}`} />
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`w-4 h-0.5 rounded-full ${done ? 'bg-brand-500' : 'bg-surface-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs font-semibold text-brand-600 mt-3 text-center">
              {STATUS_STEPS[currentStepIndex]?.label || order.status}
            </p>
          </div>
        )}

        {/* Delivery PIN */}
        {deliveryPin && !isComplete && !isCancelled && (
          <div className="card-elevated p-4 bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Delivery PIN</p>
                <p className="text-xs text-amber-500 mt-0.5">Share with rider at delivery</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold tracking-[0.3em] text-amber-700">{deliveryPin}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(deliveryPin)}
                  className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center btn-press"
                >
                  <Copy className="h-3.5 w-3.5 text-amber-600" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rider card */}
        {rider && (
          <div className="card-elevated p-4">
            <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-3">Your Rider</p>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-brand-100">
                {rider.avatarUrl ? <AvatarImage src={rider.avatarUrl as string} alt={String(rider.firstName ?? '')} /> : null}
                <AvatarFallback className="bg-brand-50 text-brand-600 text-sm font-bold">
                  {String(rider.firstName ?? '')[0] || ''}{String(rider.lastName ?? '')[0] || ''}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-bold text-surface-900">{String(rider.firstName ?? '')} {String(rider.lastName ?? '')}</p>
                {rider.vehiclePlate ? <p className="text-xs text-surface-400 font-medium">{String(rider.vehiclePlate)}</p> : null}
              </div>
              {rider.phone ? (
                <a href={`tel:${String(rider.phone)}`} className="h-11 w-11 rounded-xl accent-gradient flex items-center justify-center shadow-accent btn-press">
                  <Phone className="h-4 w-4 text-white" />
                </a>
              ) : null}
            </div>
          </div>
        )}

        {/* Route details */}
        <div className="card-elevated p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-0.5 pt-1.5">
              <div className="h-3.5 w-3.5 rounded-full brand-gradient shadow-brand" />
              <div className="w-0.5 h-6 bg-gradient-to-b from-brand-300 to-accent-300 rounded-full" />
              <div className="h-3.5 w-3.5 rounded-full accent-gradient shadow-accent" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider">Pickup</p>
                <p className="text-sm text-surface-900 font-medium">{order.pickupAddress || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-accent-500 uppercase tracking-wider">Dropoff</p>
                <p className="text-sm text-surface-900 font-medium">{order.dropoffAddress || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Price */}
        {order.totalPrice && (
          <div className="card-elevated p-4 flex items-center justify-between">
            <span className="text-sm text-surface-500 font-medium">Total</span>
            <span className="text-lg font-extrabold text-surface-900">{formatCurrency(order.totalPrice)}</span>
          </div>
        )}

        {/* Actions */}
        {isComplete && (
          <button
            onClick={() => router.push(`/dashboard/orders/${id}/rate`)}
            className="w-full h-13 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand hover:shadow-lg transition-all btn-press flex items-center justify-center gap-2"
          >
            <Star className="h-4 w-4" /> Rate Delivery
          </button>
        )}

        {!isComplete && !isCancelled && order.status === 'PENDING' && (
          <button
            onClick={async () => {
              try {
                await api!.patch(`${API_BASE_URL}/orders/${id}/cancel`);
                refetch();
              } catch { /* ignored */ }
            }}
            className="w-full h-13 rounded-2xl border-2 border-danger-200 text-danger-600 font-semibold text-sm hover:bg-danger-50 transition-all btn-press flex items-center justify-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" /> Cancel Order
          </button>
        )}
      </div>

      {/* Chat */}
      {rider && !isComplete && !isCancelled && <OrderChat orderId={id} />}
    </div>
  );
}
