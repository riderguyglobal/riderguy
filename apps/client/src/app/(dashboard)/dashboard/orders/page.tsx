'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Spinner,
} from '@riderguy/ui';

// ============================================================
// Order List / History — Client sees all their orders
// ============================================================

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  SEARCHING_RIDER: { label: 'Searching', color: 'bg-yellow-100 text-yellow-700' },
  ASSIGNED: { label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  PICKUP_EN_ROUTE: { label: 'En Route', color: 'bg-blue-100 text-blue-700' },
  AT_PICKUP: { label: 'At Pickup', color: 'bg-indigo-100 text-indigo-700' },
  PICKED_UP: { label: 'Picked Up', color: 'bg-purple-100 text-purple-700' },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-purple-100 text-purple-700' },
  AT_DROPOFF: { label: 'At Dropoff', color: 'bg-teal-100 text-teal-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  CANCELLED_BY_CLIENT: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
  CANCELLED_BY_RIDER: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
  CANCELLED_BY_ADMIN: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
};

const PACKAGE_ICONS: Record<string, string> = {
  DOCUMENT: '📄',
  SMALL_PARCEL: '📦',
  MEDIUM_PARCEL: '📦',
  LARGE_PARCEL: '📦',
  FOOD: '🍔',
  FRAGILE: '🥚',
  HIGH_VALUE: '💎',
};

type FilterTab = 'all' | 'active' | 'completed';

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  totalPrice: number;
  currency: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  paymentMethod: string;
  createdAt: string;
  deliveredAt?: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const api = getApiClient();
      const { data } = await api.get('/orders', { params: { page, limit: 20 } });
      setOrders(data.data);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (tab === 'active') {
      return !['DELIVERED', 'FAILED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'].includes(o.status);
    }
    if (tab === 'completed') {
      return ['DELIVERED', 'FAILED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'].includes(o.status);
    }
    return true;
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="p-4 pb-24">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
        <Button size="sm" onClick={() => router.push('/dashboard/send')}>
          + New Order
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-4xl">📦</p>
          <p className="mt-4 text-sm font-medium text-gray-900">No orders yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Send your first package to get started!
          </p>
          <Button className="mt-4" onClick={() => router.push('/dashboard/send')}>
            Send a Package
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status] || {
              label: order.status,
              color: 'bg-gray-100 text-gray-700',
            };
            return (
              <Card
                key={order.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/dashboard/orders/${order.id}/confirmation`)}
              >
                <CardContent className="flex items-start gap-3 pt-4 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg">
                    {PACKAGE_ICONS[order.packageType] ?? '📦'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {order.orderNumber}
                      </p>
                      <Badge className={`${statusInfo.color} border-0 text-xs`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 truncate">
                      {order.pickupAddress}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      → {order.dropoffAddress}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString('en-NG', { dateStyle: 'short' })}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        ₦{order.totalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </Button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
