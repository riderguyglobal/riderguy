'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@riderguy/ui';

// ============================================================
// Rider Dashboard Home — quick stats + active jobs
// ============================================================

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ASSIGNED: { label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  PICKUP_EN_ROUTE: { label: 'En Route', color: 'bg-blue-100 text-blue-700' },
  AT_PICKUP: { label: 'At Pickup', color: 'bg-indigo-100 text-indigo-700' },
  PICKED_UP: { label: 'Picked Up', color: 'bg-purple-100 text-purple-700' },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-purple-100 text-purple-700' },
  AT_DROPOFF: { label: 'At Dropoff', color: 'bg-teal-100 text-teal-700' },
};

interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalPrice: number;
  serviceFee: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [availableCount, setAvailableCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const api = getApiClient();
        // Fetch rider's own active orders
        const { data: orderData } = await api.get('/orders', { params: { limit: 10 } });
        const active = (orderData.data ?? []).filter((o: ActiveOrder) =>
          ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(o.status)
        );
        setActiveOrders(active);
      } catch {
        // May not have profile yet
      }

      try {
        const api = getApiClient();
        const { data: availData } = await api.get('/orders/available');
        setAvailableCount((availData.data ?? []).length);
      } catch {
        // Silent
      }
    })();
  }, []);

  return (
    <div className="p-4 pb-24">
      <h1 className="mb-4 text-xl font-bold text-gray-900">
        Welcome, {user?.firstName} 👋
      </h1>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-brand-500">{availableCount}</p>
            <p className="text-xs text-gray-400">Available Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{activeOrders.length}</p>
            <p className="text-xs text-gray-400">Active Now</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">₦0</p>
            <p className="text-xs text-gray-400">Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Find Jobs CTA */}
      <Button
        className="w-full mb-6 bg-brand-500 hover:bg-brand-600 py-6 text-base"
        onClick={() => router.push('/dashboard/jobs')}
      >
        🔍 Find Available Jobs ({availableCount})
      </Button>

      {/* Active Jobs */}
      {activeOrders.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Active Deliveries</h2>
          <div className="space-y-2">
            {activeOrders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] || {
                label: order.status,
                color: 'bg-gray-100 text-gray-700',
              };
              const earnings = order.totalPrice - (order.serviceFee ?? 0);
              return (
                <Card
                  key={order.id}
                  className="cursor-pointer border-l-4 border-l-brand-500 transition-shadow hover:shadow-md"
                  onClick={() => router.push(`/dashboard/jobs/${order.id}`)}
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
                    <p className="ml-3 text-sm font-bold text-green-600">
                      ₦{earnings.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Onboarding reminder */}
      {activeOrders.length === 0 && availableCount === 0 && (
        <Card className="mt-4">
          <CardContent className="py-8 text-center">
            <p className="text-4xl mb-2">🛵</p>
            <p className="text-sm font-medium text-gray-900">Ready to ride?</p>
            <p className="mt-1 text-sm text-gray-400">
              Make sure your profile is complete and you&#39;re online to start receiving delivery requests.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/dashboard/onboarding')}
            >
              Check Profile
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
