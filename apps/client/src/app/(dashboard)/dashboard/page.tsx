'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@riderguy/ui';

// ============================================================
// Client Dashboard Home — quick send + recent orders
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

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalPrice: number;
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const api = getApiClient();
        const { data } = await api.get('/orders', { params: { limit: 5 } });
        setRecentOrders(data.data ?? []);
      } catch {
        // Silent fail
      }
    })();
  }, []);

  return (
    <div className="p-4 pb-24">
      <h1 className="mb-4 text-xl font-bold text-gray-900">
        Hi, {user?.firstName} 👋
      </h1>

      {/* Quick Send CTA */}
      <Card className="mb-4 border-brand-200 bg-gradient-to-br from-brand-50 to-white">
        <CardContent className="flex flex-col gap-3 pt-6 pb-6">
          <p className="text-lg font-bold text-gray-900">Send a Package 📦</p>
          <p className="text-sm text-gray-500">
            Fast, reliable delivery to anywhere in the city. Your package is in safe hands with our verified riders.
          </p>
          <Button
            className="w-full bg-brand-500 hover:bg-brand-600"
            onClick={() => router.push('/dashboard/send')}
          >
            Send Now →
          </Button>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Recent Orders</h2>
        {recentOrders.length > 0 && (
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="text-xs text-brand-500 hover:underline"
          >
            View All →
          </button>
        )}
      </div>

      {recentOrders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-gray-400">
              No orders yet. Send your first package to get started!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {recentOrders.map((order) => {
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
                <CardContent className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{order.orderNumber}</p>
                      <Badge className={`${statusInfo.color} border-0 text-xs`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400 truncate">
                      {order.pickupAddress} → {order.dropoffAddress}
                    </p>
                  </div>
                  <p className="ml-3 text-sm font-semibold text-gray-900">
                    GH₵{order.totalPrice.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
