'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Spinner,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@riderguy/ui';

// ============================================================
// Admin Dispatch Dashboard — view orders, assign riders manually
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
  CANCELLED_BY_CLIENT: { label: 'Client Cancel', color: 'bg-gray-100 text-gray-700' },
  CANCELLED_BY_RIDER: { label: 'Rider Cancel', color: 'bg-gray-100 text-gray-700' },
  CANCELLED_BY_ADMIN: { label: 'Admin Cancel', color: 'bg-gray-100 text-gray-700' },
};

type StatusFilter = 'active' | 'all' | 'pending' | 'in_progress' | 'completed';

interface DispatchOrder {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  totalPrice: number;
  distanceKm: number;
  currency: string;
  createdAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  rider?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  zone?: {
    id: string;
    name: string;
  };
}

interface AvailableRider {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  riderProfile?: {
    averageRating: number;
    totalDeliveries: number;
    vehicleType?: string;
    licensePlate?: string;
  };
}

export default function DispatchDashboardPage() {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  // Assign rider dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [availableRiders, setAvailableRiders] = useState<AvailableRider[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    delivered: 0,
    total: 0,
  });

  const fetchOrders = useCallback(async () => {
    try {
      const api = getApiClient();
      const params: Record<string, string> = {};
      if (statusFilter === 'pending') params.status = 'PENDING,SEARCHING_RIDER';
      else if (statusFilter === 'in_progress') params.status = 'ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF';
      else if (statusFilter === 'completed') params.status = 'DELIVERED,FAILED,CANCELLED_BY_CLIENT,CANCELLED_BY_RIDER,CANCELLED_BY_ADMIN';
      else if (statusFilter === 'active') params.status = 'PENDING,SEARCHING_RIDER,ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF';

      const { data } = await api.get('/orders/dispatch', { params });
      setOrders(data.data ?? []);

      // Compute stats from the full set
      const allOrders: DispatchOrder[] = data.data ?? [];
      setStats({
        pending: allOrders.filter((o: DispatchOrder) => ['PENDING', 'SEARCHING_RIDER'].includes(o.status)).length,
        inProgress: allOrders.filter((o: DispatchOrder) => ['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF'].includes(o.status)).length,
        delivered: allOrders.filter((o: DispatchOrder) => o.status === 'DELIVERED').length,
        total: allOrders.length,
      });
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function openAssignDialog(order: DispatchOrder) {
    setSelectedOrder(order);
    setAssignDialogOpen(true);
    setLoadingRiders(true);
    try {
      const api = getApiClient();
      const { data } = await api.get('/orders/dispatch/riders');
      setAvailableRiders(data.data ?? []);
    } catch {
      setAvailableRiders([]);
    } finally {
      setLoadingRiders(false);
    }
  }

  async function handleAssignRider(riderId: string) {
    if (!selectedOrder) return;
    setAssigning(true);
    try {
      const api = getApiClient();
      await api.post(`/orders/${selectedOrder.id}/assign`, { riderId });
      setAssignDialogOpen(false);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error?: string } } }).response?.data?.error
          : 'Failed to assign rider';
      alert(msg || 'Failed to assign rider');
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassignRider(orderId: string) {
    if (!confirm('Unassign rider from this order?')) return;
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/unassign`);
      await fetchOrders();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error?: string } } }).response?.data?.error
          : 'Failed to unassign rider';
      alert(msg || 'Failed to unassign rider');
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm('Cancel this order as admin?')) return;
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/cancel`, { reason: 'Cancelled by admin' });
      await fetchOrders();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error?: string } } }).response?.data?.error
          : 'Failed to cancel';
      alert(msg || 'Failed to cancel');
    }
  }

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dispatch Dashboard</h1>
        <p className="text-sm text-gray-500">Monitor and manage all delivery orders</p>
      </div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-gray-400">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            <p className="text-xs text-gray-400">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
            <p className="text-xs text-gray-400">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-400">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              statusFilter === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Refresh */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-gray-400">{orders.length} orders</p>
        <Button variant="outline" size="sm" onClick={() => fetchOrders()}>
          ↻ Refresh
        </Button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-400">No orders match this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status] || {
              label: order.status,
              color: 'bg-gray-100 text-gray-700',
            };
            const isUnassigned = ['PENDING', 'SEARCHING_RIDER'].includes(order.status);
            const canUnassign = ['ASSIGNED', 'PICKUP_EN_ROUTE'].includes(order.status);
            const isTerminal = ['DELIVERED', 'FAILED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN'].includes(order.status);

            return (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="pt-4 pb-4">
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        #{order.orderNumber}
                      </span>
                      <Badge className={`${statusInfo.color} border-0 text-xs`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      ₦{order.totalPrice.toLocaleString()}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="text-xs text-gray-500 space-y-1 mb-2">
                    <p className="truncate">📍 {order.pickupAddress}</p>
                    <p className="truncate">🏁 {order.dropoffAddress}</p>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-3">
                    <span>{order.distanceKm.toFixed(1)} km</span>
                    <span>·</span>
                    <span>
                      Client: {order.client.firstName} {order.client.lastName}
                    </span>
                    {order.rider && (
                      <>
                        <span>·</span>
                        <span>
                          Rider: {order.rider.firstName} {order.rider.lastName}
                        </span>
                      </>
                    )}
                    {order.zone && (
                      <>
                        <span>·</span>
                        <span>Zone: {order.zone.name}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {new Date(order.createdAt).toLocaleString('en-NG', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <Separator className="mb-3" />

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {isUnassigned && (
                      <Button
                        size="sm"
                        className="bg-brand-500 hover:bg-brand-600"
                        onClick={() => openAssignDialog(order)}
                      >
                        Assign Rider
                      </Button>
                    )}
                    {canUnassign && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnassignRider(order.id)}
                      >
                        Unassign Rider
                      </Button>
                    )}
                    {!isTerminal && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-200 hover:bg-red-50"
                        onClick={() => handleCancelOrder(order.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign Rider Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Rider</DialogTitle>
            <DialogDescription>
              Select from available online riders to assign to order{' '}
              <strong>#{selectedOrder?.orderNumber}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 overflow-y-auto">
            {loadingRiders ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6 text-brand-500" />
              </div>
            ) : availableRiders.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No riders available right now
              </p>
            ) : (
              <div className="space-y-2">
                {availableRiders.map((rider) => (
                  <button
                    key={rider.id}
                    className="w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                    disabled={assigning}
                    onClick={() => handleAssignRider(rider.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {rider.firstName} {rider.lastName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {rider.phone || rider.email}
                        </p>
                      </div>
                      <div className="text-right">
                        {rider.riderProfile && (
                          <>
                            <p className="text-xs text-gray-500">
                              ⭐ {rider.riderProfile.averageRating.toFixed(1)} ·{' '}
                              {rider.riderProfile.totalDeliveries} trips
                            </p>
                            {rider.riderProfile.vehicleType && (
                              <p className="text-xs text-gray-400">
                                {rider.riderProfile.vehicleType}
                                {rider.riderProfile.licensePlate && ` · ${rider.riderProfile.licensePlate}`}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
