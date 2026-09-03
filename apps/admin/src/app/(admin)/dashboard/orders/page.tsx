'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
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
import { AlertCircle, Flag, MapPin, RefreshCw } from 'lucide-react';

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
    user: {
      firstName: string;
      lastName: string;
      phone?: string;
    };
  };
  zone?: {
    id: string;
    name: string;
  };
}

interface AvailableRider {
  id: string;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    phone?: string;
  };
  averageRating: number;
  totalDeliveries: number;
  currentZoneId?: string;
}

interface DispatchPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const responseData = (
    error as {
      response?: { data?: { error?: unknown; message?: unknown } };
    }
  ).response?.data;
  const responseError = responseData?.error;
  if (typeof responseError === 'string') return responseError;
  if (responseError && typeof responseError === 'object') {
    const message = (responseError as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function DispatchDashboardPage() {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [notice, setNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [lastSuccessfulFilter, setLastSuccessfulFilter] = useState<StatusFilter | null>(null);
  const [loadedPages, setLoadedPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<DispatchPagination>({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0,
  });

  // Assign rider dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [availableRiders, setAvailableRiders] = useState<AvailableRider[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [availableRidersError, setAvailableRidersError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    order: DispatchOrder;
    action: 'unassign' | 'cancel';
  } | null>(null);
  const [actioning, setActioning] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

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
      const params: Record<string, string> = { limit: '100' };
      if (statusFilter === 'pending') params.status = 'PENDING,SEARCHING_RIDER';
      else if (statusFilter === 'in_progress')
        params.status = 'ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF';
      else if (statusFilter === 'completed')
        params.status =
          'DELIVERED,FAILED,CANCELLED_BY_CLIENT,CANCELLED_BY_RIDER,CANCELLED_BY_ADMIN';
      else if (statusFilter === 'active')
        params.status =
          'PENDING,SEARCHING_RIDER,ASSIGNED,PICKUP_EN_ROUTE,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROPOFF';

      const pages = await Promise.all(
        Array.from({ length: loadedPages }, (_, index) =>
          api.get('/orders/dispatch', {
            params: { ...params, page: String(index + 1) },
          }),
        ),
      );
      const queueOrders = Array.from(
        new Map<string, DispatchOrder>(
          pages
            .flatMap((response) => response.data.orders ?? [])
            .map((order: DispatchOrder) => [order.id, order] as const),
        ).values(),
      );
      const queuePagination: DispatchPagination = pages[0]?.data.pagination ?? {
        page: 1,
        limit: 100,
        total: queueOrders.length,
        totalPages: queueOrders.length > 0 ? 1 : 0,
      };
      setOrders(queueOrders);
      setPagination(queuePagination);
      setLastSuccessfulFilter(statusFilter);
      setQueueError('');

      // These figures describe the current queue page, not hidden orders.
      const allOrders = queueOrders;
      setStats({
        pending: allOrders.filter((o: DispatchOrder) =>
          ['PENDING', 'SEARCHING_RIDER'].includes(o.status),
        ).length,
        inProgress: allOrders.filter((o: DispatchOrder) =>
          [
            'ASSIGNED',
            'PICKUP_EN_ROUTE',
            'AT_PICKUP',
            'PICKED_UP',
            'IN_TRANSIT',
            'AT_DROPOFF',
          ].includes(o.status),
        ).length,
        delivered: allOrders.filter((o: DispatchOrder) => o.status === 'DELIVERED').length,
        total: queuePagination.total,
      });
    } catch {
      setQueueError(
        'The live dispatch queue could not be loaded. Check the API connection and retry.',
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [loadedPages, statusFilter]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function loadAvailableRiders(order: DispatchOrder) {
    setLoadingRiders(true);
    setAvailableRiders([]);
    setAvailableRidersError('');
    try {
      const api = getApiClient();
      const { data } = await api.get('/orders/dispatch/riders', {
        params: order.zone?.id ? { zoneId: order.zone.id } : undefined,
      });
      setAvailableRiders(data.data ?? []);
    } catch (err: unknown) {
      setAvailableRidersError(
        apiErrorMessage(
          err,
          'Eligible riders could not be loaded. Check the connection and retry.',
        ),
      );
    } finally {
      setLoadingRiders(false);
    }
  }

  async function openAssignDialog(order: DispatchOrder) {
    setSelectedOrder(order);
    setAssignDialogOpen(true);
    await loadAvailableRiders(order);
  }

  async function handleAssignRider(riderId: string) {
    if (!selectedOrder) return;
    setAssigning(true);
    setMutationError('');
    setNotice('');
    try {
      const api = getApiClient();
      await api.post(`/orders/${selectedOrder.id}/assign`, { riderProfileId: riderId });
      setAssignDialogOpen(false);
      setSelectedOrder(null);
      await fetchOrders();
      setNotice('Rider assigned successfully.');
    } catch (err: unknown) {
      setMutationError(apiErrorMessage(err, 'Failed to assign rider'));
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassignRider(orderId: string) {
    setActioning(true);
    setMutationError('');
    setNotice('');
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/unassign`);
      await fetchOrders();
      setNotice('Rider removed from the order.');
      setConfirmAction(null);
    } catch (err: unknown) {
      setMutationError(apiErrorMessage(err, 'Failed to unassign rider'));
    } finally {
      setActioning(false);
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (cancelReason.trim().length < 8) {
      setMutationError('Enter a clear cancellation reason of at least 8 characters.');
      return;
    }
    setActioning(true);
    setMutationError('');
    setNotice('');
    try {
      const api = getApiClient();
      await api.patch(`/orders/${orderId}/status`, {
        status: 'CANCELLED_BY_ADMIN',
        note: cancelReason.trim(),
      });
      await fetchOrders();
      setNotice('Order cancelled by administrator.');
      setConfirmAction(null);
      setCancelReason('');
    } catch (err: unknown) {
      setMutationError(apiErrorMessage(err, 'Failed to cancel'));
    } finally {
      setActioning(false);
    }
  }

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ];
  const hasCurrentQueue = lastSuccessfulFilter === statusFilter;

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <p className="admin-kicker">Live operations</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-[#07110D]">
          Delivery control
        </h1>
        <p className="mt-2 text-sm text-[#6E7A73]">
          Monitor every active route and assign eligible riders with confidence.
        </p>
      </div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pb-4 pt-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {hasCurrentQueue ? stats.pending : '—'}
            </p>
            <p className="text-xs text-gray-400">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-4 pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {hasCurrentQueue ? stats.inProgress : '—'}
            </p>
            <p className="text-xs text-gray-400">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-4 pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {hasCurrentQueue ? stats.delivered : '—'}
            </p>
            <p className="text-xs text-gray-400">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-4 pt-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {hasCurrentQueue ? stats.total : '—'}
            </p>
            <p className="text-xs text-gray-400">Visible</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-[#E3EEE9] bg-white p-1.5 shadow-sm">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              if (t.key === statusFilter) {
                void fetchOrders();
                return;
              }
              setLoading(true);
              setLoadedPages(1);
              setStatusFilter(t.key);
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              statusFilter === t.key
                ? 'bg-[#087B50] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Refresh */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {hasCurrentQueue
            ? `Showing ${orders.length} of ${pagination.total} orders`
            : 'Queue figures unavailable for this filter'}
        </p>
        <Button variant="outline" size="sm" onClick={() => fetchOrders()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {queueError && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {queueError} {hasCurrentQueue ? 'Showing the last successfully loaded queue.' : ''}
          </span>
          <button
            type="button"
            onClick={() => void fetchOrders()}
            className="shrink-0 font-bold underline"
          >
            Retry
          </button>
        </div>
      )}
      {mutationError && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {mutationError}
          </span>
          <button
            type="button"
            onClick={() => setMutationError('')}
            className="shrink-0 font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {notice}
        </div>
      )}

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="text-brand-500 h-8 w-8" />
        </div>
      ) : !hasCurrentQueue ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-gray-500">Live orders are unavailable</p>
          <p className="mt-1 text-xs text-gray-400">Retry to load this dispatch filter.</p>
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
            const isTerminal = [
              'DELIVERED',
              'FAILED',
              'CANCELLED_BY_CLIENT',
              'CANCELLED_BY_RIDER',
              'CANCELLED_BY_ADMIN',
            ].includes(order.status);

            return (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="pb-4 pt-4">
                  {/* Top row */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">#{order.orderNumber}</span>
                      <Badge className={`${statusInfo.color} border-0 text-xs`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Intl.NumberFormat('en-GH', {
                        style: 'currency',
                        currency: order.currency || 'GHS',
                      }).format(order.totalPrice)}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="mb-2 space-y-1 text-xs text-gray-500">
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#079B61]" />{' '}
                      {order.pickupAddress}
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <Flag className="h-3.5 w-3.5 shrink-0 text-[#B77912]" />{' '}
                      {order.dropoffAddress}
                    </p>
                  </div>

                  {/* Meta row */}
                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-400">
                    <span>{order.distanceKm.toFixed(1)} km</span>
                    <span>·</span>
                    <span>
                      Client: {order.client.firstName} {order.client.lastName}
                    </span>
                    {order.rider && (
                      <>
                        <span>·</span>
                        <span>
                          Rider: {order.rider.user.firstName} {order.rider.user.lastName}
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
                      {new Date(order.createdAt).toLocaleString('en-GH', {
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
                        onClick={() => setConfirmAction({ order, action: 'unassign' })}
                      >
                        Unassign Rider
                      </Button>
                    )}
                    {!isTerminal && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-500 hover:bg-red-50"
                        onClick={() => {
                          setCancelReason('');
                          setConfirmAction({ order, action: 'cancel' });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {loadedPages < pagination.totalPages && (
            <div className="flex flex-col items-center gap-2 pt-3">
              <p className="text-xs text-gray-500">
                {pagination.total - orders.length} more orders match this filter
              </p>
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  setLoadedPages((value) => value + 1);
                }}
              >
                {loadingMore ? 'Loading more…' : 'Load up to 100 more'}
              </Button>
            </div>
          )}
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
                <Spinner className="text-brand-500 h-6 w-6" />
              </div>
            ) : availableRidersError ? (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{availableRidersError}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    if (selectedOrder) void loadAvailableRiders(selectedOrder);
                  }}
                >
                  Retry rider search
                </Button>
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
                    className="hover:border-brand-300 hover:bg-brand-50 w-full rounded-lg border border-gray-200 p-3 text-left transition-colors disabled:opacity-50"
                    disabled={assigning}
                    onClick={() => handleAssignRider(rider.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {rider.user.firstName} {rider.user.lastName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {rider.user.phone || 'Phone unavailable'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {rider.averageRating.toFixed(1)} rating · {rider.totalDeliveries} trips
                        </p>
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

      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !actioning) setConfirmAction(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === 'cancel'
                ? 'Cancel delivery order?'
                : 'Remove assigned rider?'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === 'cancel'
                ? `Order #${confirmAction.order.orderNumber} will be cancelled and removed from live dispatch.`
                : `The rider will be released from order #${confirmAction?.order.orderNumber} and the order can be dispatched again.`}
            </DialogDescription>
          </DialogHeader>
          {confirmAction?.action === 'cancel' && (
            <div>
              <label
                htmlFor="admin-cancel-reason"
                className="mb-1.5 block text-xs font-bold text-[#34433B]"
              >
                Cancellation reason
              </label>
              <textarea
                id="admin-cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                minLength={8}
                maxLength={500}
                className="admin-input resize-y"
                placeholder="Explain why RiderGuy operations is cancelling this delivery."
              />
              <p className="mt-1.5 text-xs text-[#748079]">
                This reason is audited and sent to the client and assigned rider.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={actioning} onClick={() => setConfirmAction(null)}>
              Keep order
            </Button>
            <Button
              disabled={
                actioning ||
                !confirmAction ||
                (confirmAction.action === 'cancel' && cancelReason.trim().length < 8)
              }
              className={confirmAction?.action === 'cancel' ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.action === 'cancel')
                  void handleCancelOrder(confirmAction.order.id);
                else void handleUnassignRider(confirmAction.order.id);
              }}
            >
              {actioning
                ? 'Applying…'
                : confirmAction?.action === 'cancel'
                  ? 'Cancel order'
                  : 'Remove rider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
