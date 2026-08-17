'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUS_CONFIG, PACKAGE_TYPES } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@riderguy/utils';
import { StatusBadge } from '@/components/status-badge';
import { OrderProgressBar } from '@/components/order-progress-bar';
import { Skeleton } from '@riderguy/ui';
import {
  ArrowLeft,
  MapPin,
  Package,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  Star,
  Navigation,
  Calendar,
  CheckCircle,
  Send,
  Copy,
} from 'lucide-react';

const PAYMENT_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  CASH:         { label: 'Cash',          icon: Banknote    },
  MOBILE_MONEY: { label: 'Mobile Money',  icon: Smartphone  },
  CARD:         { label: 'Card',          icon: CreditCard  },
  WALLET:       { label: 'Wallet',        icon: Wallet      },
};

export default function OrderDetailPage() {
  const { id }    = useParams<{ id: string }>() ?? {};
  const router    = useRouter();
  const { api }   = useAuth();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api!.get(`/orders/${id}`);
      return res.data.data;
    },
    enabled: !!api && !!id,
  });

  if (isLoading || !order) {
    return (
      <div className="min-h-[100dvh] bg-white animate-page-enter">
        <div className="flex items-center gap-3 px-4 py-4" style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-xl" />
        </div>
        <div className="px-5 space-y-4 mt-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const cfg       = ORDER_STATUS_CONFIG[order.status];
  const isActive  = cfg?.isActive ?? false;
  const isDelivered = order.status === 'DELIVERED';
  const pkgLabel  = PACKAGE_TYPES.find(p => p.value === order.packageType);
  const payment   = PAYMENT_LABELS[order.paymentMethod] ?? { label: order.paymentMethod, icon: CreditCard };
  const PayIcon   = payment.icon;
  const rider     = (order as Record<string, unknown>).rider as Record<string, unknown> | undefined;

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">

      {/* Top bar */}
      <div
        className="bg-white sticky top-0 z-10 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-surface-100 !shadow-none">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <div className="flex-1">
          <p className="text-[17px] font-bold text-surface-900">Order #{id?.slice(-6).toUpperCase()}</p>
          <p className="text-[12px] text-surface-400">{timeAgo(new Date(order.createdAt))}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="px-5 pb-8 space-y-4">

        {/* Progress bar */}
        <OrderProgressBar status={order.status} />

        {/* Route card */}
        <div className="location-card">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: 3 }}>
              <span className="dot-pickup" />
              <div className="route-connector" style={{ height: 28, width: 2, margin: '4px 0' }} />
              <span className="dot-dropoff" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="section-label mb-0.5">Pickup</p>
                <p className="text-[14px] font-semibold text-surface-900 leading-tight">
                  {order.pickupAddress || '—'}
                </p>
                {order.pickupContactName && (
                  <p className="text-[12px] text-surface-400 mt-0.5">{order.pickupContactName}</p>
                )}
              </div>
              <div>
                <p className="section-label mb-0.5">Delivery</p>
                <p className="text-[14px] font-semibold text-surface-900 leading-tight">
                  {order.dropoffAddress || '—'}
                </p>
                {order.dropoffContactName && (
                  <p className="text-[12px] text-surface-400 mt-0.5">{order.dropoffContactName}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Package + pricing */}
        <div className="rounded-2xl bg-surface-50 overflow-hidden">
          {/* Package type */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-100">
            <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shadow-card flex-shrink-0">
              <Package className="h-4 w-4 text-surface-600" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-surface-400 font-medium leading-none mb-0.5">Package type</p>
              <p className="text-[14px] font-semibold text-surface-900">
                {pkgLabel ? `${pkgLabel.emoji} ${pkgLabel.label}` : order.packageType}
              </p>
            </div>
          </div>

          {/* Payment */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-100">
            <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shadow-card flex-shrink-0">
              <PayIcon className="h-4 w-4 text-surface-600" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-surface-400 font-medium leading-none mb-0.5">Payment</p>
              <p className="text-[14px] font-semibold text-surface-900">{payment.label}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[11px] text-surface-400">Status</p>
              <p className={`text-[13px] font-semibold ${order.paymentStatus === 'COMPLETED' ? 'text-brand-600' : 'text-amber-600'}`}>
                {order.paymentStatus === 'COMPLETED' ? 'Paid' : 'Pending'}
              </p>
            </div>
          </div>

          {/* Scheduled */}
          {order.isScheduled && order.scheduledAt && (
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-100">
              <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shadow-card flex-shrink-0">
                <Calendar className="h-4 w-4 text-surface-600" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-surface-400 font-medium leading-none mb-0.5">Scheduled for</p>
                <p className="text-[14px] font-semibold text-surface-900">
                  {new Date(order.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          )}

          {/* Total price */}
          {order.totalPrice && (
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-[14px] font-semibold text-surface-600">Total</p>
              <p className="text-[20px] font-extrabold text-surface-900">{formatCurrency(order.totalPrice)}</p>
            </div>
          )}
        </div>

        {/* Rider info — if assigned */}
        {rider && (
          <div className="rounded-2xl bg-surface-50 px-4 py-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-surface-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {(rider.avatarUrl as string) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rider.avatarUrl as string} alt="Rider" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[14px] font-bold text-surface-600">
                  {String(rider.firstName ?? '')[0] || 'R'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-surface-900">
                {`${String(rider.firstName ?? '')} ${String(rider.lastName ?? '')}`.trim()}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {Boolean(rider.vehiclePlate) && (
                  <span className="text-[11px] font-semibold text-surface-500 px-1.5 py-0.5 bg-white rounded-lg">
                    {String(rider.vehiclePlate)}
                  </span>
                )}
                {Boolean(rider.rating) && (
                  <span className="flex items-center gap-1 text-[12px] text-surface-500">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {Number(rider.rating).toFixed(1)}
                  </span>
                )}
              </div>
            </div>
            {isDelivered && (
              <CheckCircle className="h-5 w-5 text-brand-500 flex-shrink-0" />
            )}
          </div>
        )}

        {/* Delivery PIN (if not delivered yet) */}
        {order.deliveryPinCode && !isDelivered && (
          <div className="rounded-2xl bg-amber-50 px-4 py-3.5 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-amber-700">Delivery PIN</p>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-extrabold tracking-widest text-amber-700">
                {order.deliveryPinCode}
              </span>
              <button
                onClick={() => navigator.clipboard?.writeText(order.deliveryPinCode)}
                className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center btn-press"
              >
                <Copy className="h-3.5 w-3.5 text-amber-600" />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          {isActive && (
            <button
              onClick={() => router.push(`/dashboard/orders/${id}/tracking`)}
              className="btn-primary brand"
            >
              <Navigation className="h-5 w-5" /> Track Order
            </button>
          )}

          {isDelivered && !order.rating && (
            <button
              onClick={() => router.push(`/dashboard/orders/${id}/rate`)}
              className="btn-primary brand"
            >
              <Star className="h-5 w-5" /> Rate Delivery
            </button>
          )}

          {isDelivered && order.paymentMethod !== 'CASH' && order.paymentStatus !== 'COMPLETED' && (
            <button
              onClick={() => router.push(`/dashboard/orders/${id}/payment`)}
              className="btn-primary"
            >
              <CreditCard className="h-5 w-5" /> Pay Now · {formatCurrency(order.totalPrice)}
            </button>
          )}

          <button
            onClick={() => router.push('/dashboard/send')}
            className="w-full h-12 rounded-2xl bg-surface-100 text-surface-700 font-semibold text-[14px] flex items-center justify-center gap-2 btn-press"
          >
            <Send className="h-4 w-4" /> Send Another Package
          </button>
        </div>

      </div>
    </div>
  );
}
