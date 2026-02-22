'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getApiClient } from '@riderguy/auth';
import {
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Spinner,
} from '@riderguy/ui';

// ─── Types ──────────────────────────────────────────────────

interface RiderUser {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  createdAt: string;
}

interface RiderApplication {
  id: string;
  userId: string;
  onboardingStatus: string;
  createdAt: string;
  user: RiderUser;
  vehicles: Array<{
    id: string;
    make: string;
    model: string;
    plateNumber: string;
    type: string;
  }>;
}

interface RiderListItem {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { ordersAsClient: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ────────────────────────────────────────────────

function onboardingBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    DOCUMENTS_SUBMITTED: { label: 'Docs Submitted', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
    DOCUMENTS_UNDER_REVIEW: { label: 'Under Review', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
    ACTIVATED: { label: 'Activated', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
    DOCUMENTS_REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
    REGISTERED: { label: 'Registered', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
    DOCUMENTS_PENDING: { label: 'Docs Pending', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
    DOCUMENTS_APPROVED: { label: 'Docs Approved', className: 'bg-teal-100 text-teal-800 hover:bg-teal-100' },
    TRAINING_PENDING: { label: 'Training', className: 'bg-purple-100 text-purple-800 hover:bg-purple-100' },
    TRAINING_COMPLETE: { label: 'Training Done', className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100' },
  };
  const entry = map[status] ?? { label: status.replace(/_/g, ' '), className: '' };
  return <Badge className={entry.className}>{entry.label}</Badge>;
}

function accountBadge(status: string) {
  const map: Record<string, { className: string }> = {
    ACTIVE: { className: 'bg-green-100 text-green-800 hover:bg-green-100' },
    SUSPENDED: { className: 'bg-red-100 text-red-800 hover:bg-red-100' },
    DEACTIVATED: { className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
    BANNED: { className: 'bg-red-200 text-red-900 hover:bg-red-200' },
    PENDING_VERIFICATION: { className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  };
  const entry = map[status] ?? { className: '' };
  return <Badge className={entry.className}>{status.replace(/_/g, ' ')}</Badge>;
}

// ─── Component ──────────────────────────────────────────────

export default function RiderManagementPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [tab, setTab] = useState<'all' | 'applications'>('all');

  // ── All Riders state ──
  const [riders, setRiders] = useState<RiderListItem[]>([]);
  const [riderPagination, setRiderPagination] = useState<Pagination | null>(null);
  const [riderPage, setRiderPage] = useState(1);
  const [riderSearch, setRiderSearch] = useState('');
  const [riderStatusFilter, setRiderStatusFilter] = useState('');
  const [ridersLoading, setRidersLoading] = useState(false);

  // ── Applications state ──
  const [applications, setApplications] = useState<RiderApplication[]>([]);
  const [appPagination, setAppPagination] = useState<Pagination | null>(null);
  const [appPage, setAppPage] = useState(1);
  const [appsLoading, setAppsLoading] = useState(false);

  const [error, setError] = useState('');
  const [statusModal, setStatusModal] = useState<{ userId: string; name: string; current: string } | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [updating, setUpdating] = useState(false);

  // ── Fetch all riders ──
  const fetchRiders = useCallback(async () => {
    setRidersLoading(true);
    try {
      const api = getApiClient();
      const params = new URLSearchParams({ page: String(riderPage), limit: '20', role: 'RIDER' });
      if (riderSearch) params.set('search', riderSearch);
      if (riderStatusFilter) params.set('status', riderStatusFilter);
      const { data } = await api.get(`/users?${params}`);
      setRiders(data.data);
      setRiderPagination(data.pagination);
      setError('');
    } catch {
      setError('Failed to load riders');
    } finally {
      setRidersLoading(false);
    }
  }, [riderPage, riderSearch, riderStatusFilter]);

  // ── Fetch applications ──
  const fetchApplications = useCallback(async () => {
    setAppsLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/riders/applications?page=${appPage}&limit=20`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setApplications(json.data);
      setAppPagination(json.pagination);
      setError('');
    } catch {
      setError('Failed to load applications');
    } finally {
      setAppsLoading(false);
    }
  }, [accessToken, appPage]);

  useEffect(() => {
    if (tab === 'all') fetchRiders();
  }, [tab, fetchRiders]);

  useEffect(() => {
    if (tab === 'applications') fetchApplications();
  }, [tab, fetchApplications]);

  // ── Update user status ──
  const handleStatusUpdate = async () => {
    if (!statusModal || !newStatus) return;
    setUpdating(true);
    try {
      const api = getApiClient();
      await api.patch(`/admin/users/${statusModal.userId}/status`, {
        status: newStatus,
        reason: statusReason || undefined,
      });
      setStatusModal(null);
      setNewStatus('');
      setStatusReason('');
      fetchRiders();
    } catch {
      setError('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  // ── Search debounce ──
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setRiderSearch(searchInput);
      setRiderPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loading = tab === 'all' ? ridersLoading : appsLoading;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rider Management</h1>
        <p className="text-sm text-gray-500">Manage riders, review applications, and update statuses.</p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setTab('all')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          All Riders
        </button>
        <button
          onClick={() => setTab('applications')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'applications' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Applications
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── All Riders Tab ── */}
      {tab === 'all' && (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              placeholder="Search by name, email, phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-64"
            />
            <select
              value={riderStatusFilter}
              onChange={(e) => { setRiderStatusFilter(e.target.value); setRiderPage(1); }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
              <option value="BANNED">Banned</option>
            </select>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Spinner className="h-8 w-8 text-brand-500" />
            </div>
          )}

          {!loading && riders.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-lg font-medium text-gray-400">No riders found</p>
                <p className="mt-1 text-sm text-gray-300">
                  {riderSearch ? 'Try a different search term' : 'No riders have registered yet'}
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && riders.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Rider</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Last Login</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {riders.map((rider) => (
                    <tr key={rider.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                            {rider.firstName[0]}{rider.lastName[0]}
                          </div>
                          <span className="font-medium text-gray-900">{rider.firstName} {rider.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{rider.phone}</div>
                        {rider.email && <div className="text-xs text-gray-400">{rider.email}</div>}
                      </td>
                      <td className="px-4 py-3">{accountBadge(rider.status)}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(rider.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {rider.lastLoginAt ? new Date(rider.lastLoginAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/dashboard/riders/${rider.id}/review`)}
                          >
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStatusModal({ userId: rider.id, name: `${rider.firstName} ${rider.lastName}`, current: rider.status })}
                          >
                            Status
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {riderPagination && riderPagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {riderPagination.page} of {riderPagination.totalPages} ({riderPagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={riderPage <= 1} onClick={() => setRiderPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={riderPage >= riderPagination.totalPages} onClick={() => setRiderPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Applications Tab ── */}
      {tab === 'applications' && (
        <>
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Spinner className="h-8 w-8 text-brand-500" />
            </div>
          )}

          {!loading && applications.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-lg font-medium text-gray-400">No pending applications</p>
                <p className="mt-1 text-sm text-gray-300">New rider applications will appear here.</p>
              </CardContent>
            </Card>
          )}

          {!loading && applications.length > 0 && (
            <div className="space-y-3">
              {applications.map((app) => (
                <Card
                  key={app.id}
                  className="cursor-pointer transition-all hover:border-brand-300 hover:shadow-sm"
                  onClick={() => router.push(`/dashboard/riders/${app.userId}/review`)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold">
                      {app.user.firstName[0]}{app.user.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{app.user.firstName} {app.user.lastName}</p>
                        {onboardingBadge(app.onboardingStatus)}
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {app.user.phone}{app.user.email && ` • ${app.user.email}`}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                        <span>Applied {new Date(app.createdAt).toLocaleDateString()}</span>
                        {app.vehicles.length > 0 && <span>{app.vehicles.length} vehicle{app.vehicles.length > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 flex-shrink-0 text-gray-300">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {appPagination && appPagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {appPagination.page} of {appPagination.totalPages} ({appPagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={appPage <= 1} onClick={() => setAppPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={appPage >= appPagination.totalPages} onClick={() => setAppPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Status Update Modal ── */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Update Status</h3>
            <p className="mt-1 text-sm text-gray-500">
              Change status for <strong>{statusModal.name}</strong>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Current: {statusModal.current.replace(/_/g, ' ')}
            </p>

            <div className="mt-4 space-y-3">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Select new status</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DEACTIVATED">Deactivated</option>
                <option value="BANNED">Banned</option>
              </select>

              <Input
                placeholder="Reason (optional)"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setStatusModal(null); setNewStatus(''); setStatusReason(''); }}>
                Cancel
              </Button>
              <Button onClick={handleStatusUpdate} disabled={!newStatus || updating}>
                {updating ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
