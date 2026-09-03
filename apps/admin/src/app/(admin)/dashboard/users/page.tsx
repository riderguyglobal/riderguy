'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getApiClient, useAuth } from '@riderguy/auth';
import { Card, CardContent, Badge, Button, Input, Spinner } from '@riderguy/ui';

// ─── Types ──────────────────────────────────────────────────

interface UserItem {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: string;
  roles?: string[];
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

interface UserDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  role: string;
  roles?: string[];
  status: string;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  riderProfile: {
    id: string;
    availability: 'OFFLINE' | 'ONLINE' | 'ON_DELIVERY' | 'ON_BREAK';
    onboardingStatus: string;
    lastLocationUpdate?: string | null;
    _count: { ordersAsRider: number };
  } | null;
  clientProfile: { id: string } | null;
  wallet: {
    balance: number;
    totalEarned: number;
    totalWithdrawn: number;
    totalTips: number;
  } | null;
  _count: { ordersAsClient: number; documents: number; notifications: number };
}

// ─── Helpers ────────────────────────────────────────────────

function roleBadge(role: string) {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'bg-[#087B50] text-white hover:bg-[#087B50]',
    ADMIN: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
    DISPATCHER: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100',
    RIDER: 'bg-sky-100 text-sky-800 hover:bg-sky-100',
    CLIENT: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
    PARTNER: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  };
  return <Badge className={map[role] ?? ''}>{role}</Badge>;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800 hover:bg-green-100',
    SUSPENDED: 'bg-red-100 text-red-800 hover:bg-red-100',
    DEACTIVATED: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
    BANNED: 'bg-red-200 text-red-900 hover:bg-red-200',
    PENDING_VERIFICATION: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  };
  return <Badge className={map[status] ?? ''}>{status.replace(/_/g, ' ')}</Badge>;
}

function fmtCurrency(amount: number, currency = 'GHS') {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency }).format(amount);
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as {
    response?: { data?: { error?: { message?: string } | string; message?: string } };
    message?: string;
  };
  const responseError = candidate.response?.data?.error;
  return (
    (typeof responseError === 'object' ? responseError?.message : responseError) ??
    candidate.response?.data?.message ??
    candidate.message ??
    fallback
  );
}

// ─── Component ──────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Detail panel
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Status modal
  const [statusModal, setStatusModal] = useState<{
    userId: string;
    name: string;
    current: string;
  } | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const statusDialogRef = useRef<HTMLDivElement>(null);
  const statusSelectRef = useRef<HTMLSelectElement>(null);

  const closeStatusModal = useCallback(() => {
    setStatusModal(null);
    setNewStatus('');
    setStatusReason('');
  }, []);

  useEffect(() => {
    if (!statusModal) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => statusSelectRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeStatusModal();
        return;
      }

      if (event.key !== 'Tab' || !statusDialogRef.current) return;
      const focusableElements = Array.from(
        statusDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'));
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!statusDialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement)?.focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [closeStatusModal, statusModal]);

  const currentUserIsSuperAdmin =
    String(currentUser?.role) === 'SUPER_ADMIN' ||
    currentUser?.roles?.some((role) => String(role) === 'SUPER_ADMIN') === true;
  const canManageStatus = (candidate: { id: string; role: string; roles?: string[] }) => {
    if (candidate.id === currentUser?.id) return false;
    const roles = candidate.roles?.length ? candidate.roles : [candidate.role];
    const isAdministrator = roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN');
    return !isAdministrator || currentUserIsSuperAdmin;
  };

  // ── Search debounce ──
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Fetch users ──
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const api = getApiClient();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/users?${params}`);
      setUsers(data.data);
      setPagination(data.pagination);
      setError('');
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Fetch user detail ──
  const openDetail = async (userId: string) => {
    setDetailLoading(true);
    setSelectedUser(null);
    try {
      const api = getApiClient();
      const { data } = await api.get(`/admin/users/${userId}`);
      setSelectedUser(data.data);
    } catch {
      setError('Failed to load user details');
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Update status ──
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
      fetchUsers();
      if (selectedUser?.id === statusModal.userId) {
        openDetail(statusModal.userId);
      }
    } catch (statusError: unknown) {
      setError(apiErrorMessage(statusError, 'Failed to update status'));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 2xl:flex-row">
      {/* Left — user list */}
      <div className="min-w-0 flex-1">
        <div className="mb-6">
          <p className="admin-kicker">People directory</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-[#07110D]">
            Platform users
          </h1>
          <p className="mt-2 text-sm text-[#6E7A73]">Search and manage every platform account.</p>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="Search by name, email, phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full sm:w-64"
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All Roles</option>
            <option value="CLIENT">Client</option>
            <option value="RIDER">Rider</option>
            <option value="ADMIN">Admin</option>
            <option value="PARTNER">Partner</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_VERIFICATION">Pending</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
            <option value="BANNED">Banned</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-brand-500 h-8 w-8" />
          </div>
        )}

        {!loading && users.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-lg font-medium text-gray-400">No users found</p>
              <p className="mt-1 text-sm text-gray-300">
                {search ? 'Try a different search term' : 'No users match the current filters'}
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && users.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-gray-50 ${selectedUser?.id === u.id ? 'bg-brand-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-brand-100 text-brand-700 flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold">
                          {u.firstName[0]}
                          {u.lastName[0]}
                        </div>
                        <button
                          type="button"
                          onClick={() => void openDetail(u.id)}
                          className="min-h-11 text-left font-medium text-gray-900 underline-offset-4 hover:text-[#087B50] hover:underline"
                        >
                          {u.firstName} {u.lastName}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{u.phone}</div>
                      {u.email && <div className="text-xs text-gray-400">{u.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(u.roles?.length ? u.roles : [u.role])].map((role) => (
                          <React.Fragment key={role}>{roleBadge(role)}</React.Fragment>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(u.status)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => void openDetail(u.id)}>
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canManageStatus(u)}
                          title={
                            canManageStatus(u)
                              ? 'Update account status'
                              : u.id === currentUser?.id
                                ? 'You cannot restrict your own administrator account'
                                : 'Only a super administrator can modify administrator accounts'
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusModal({
                              userId: u.id,
                              name: `${u.firstName} ${u.lastName}`,
                              current: u.status,
                            });
                          }}
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

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right — detail panel */}
      {(selectedUser || detailLoading) && (
        <aside
          aria-label="Selected user details"
          className="w-full flex-shrink-0 self-start rounded-xl border bg-white p-5 2xl:sticky 2xl:top-4 2xl:w-80"
        >
          {detailLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner className="text-brand-500 h-6 w-6" />
            </div>
          )}
          {selectedUser && !detailLoading && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">User Detail</h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-xl leading-none text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>

              <div className="mb-4 flex items-center gap-3">
                <div className="bg-brand-100 text-brand-700 flex h-12 w-12 items-center justify-center rounded-full font-bold">
                  {selectedUser.firstName[0]}
                  {selectedUser.lastName[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{selectedUser.phone}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Role</span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {[
                      ...new Set(
                        selectedUser.roles?.length ? selectedUser.roles : [selectedUser.role],
                      ),
                    ].map((role) => (
                      <React.Fragment key={role}>{roleBadge(role)}</React.Fragment>
                    ))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  {statusBadge(selectedUser.status)}
                </div>
                {selectedUser.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="ml-2 truncate text-gray-700">{selectedUser.email}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Joined</span>
                  <span className="text-gray-700">
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {selectedUser.lastLoginAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Login</span>
                    <span className="text-gray-700">
                      {new Date(selectedUser.lastLoginAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {selectedUser.wallet && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Wallet</span>
                    <span className="font-medium text-gray-900">
                      {fmtCurrency(selectedUser.wallet.balance)}
                    </span>
                  </div>
                )}

                <div className="mt-3 border-t pt-3">
                  <p className="mb-2 text-xs font-medium uppercase text-gray-400">Activity</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-gray-50 p-2 text-center">
                      <p className="text-lg font-bold text-gray-900">
                        {selectedUser._count.ordersAsClient}
                      </p>
                      <p className="text-xs text-gray-500">As Client</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2 text-center">
                      <p className="text-lg font-bold text-gray-900">
                        {selectedUser.riderProfile?._count.ordersAsRider ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">As Rider</p>
                    </div>
                  </div>
                </div>

                {selectedUser.riderProfile && (
                  <div className="mt-3 border-t pt-3">
                    <p className="mb-2 text-xs font-medium uppercase text-gray-400">
                      Rider Profile
                    </p>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Availability</span>
                      <span
                        className={
                          selectedUser.riderProfile.availability === 'ONLINE' ||
                          selectedUser.riderProfile.availability === 'ON_DELIVERY'
                            ? 'font-semibold text-green-700'
                            : 'text-gray-500'
                        }
                      >
                        {selectedUser.riderProfile.availability.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-gray-500">Onboarding</span>
                      <span className="text-xs text-gray-700">
                        {selectedUser.riderProfile.onboardingStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!canManageStatus(selectedUser)}
                  title={
                    canManageStatus(selectedUser)
                      ? 'Update account status'
                      : selectedUser.id === currentUser?.id
                        ? 'You cannot restrict your own administrator account'
                        : 'Only a super administrator can modify administrator accounts'
                  }
                  onClick={() =>
                    setStatusModal({
                      userId: selectedUser.id,
                      name: `${selectedUser.firstName} ${selectedUser.lastName}`,
                      current: selectedUser.status,
                    })
                  }
                >
                  Change Status
                </Button>
              </div>
            </>
          )}
        </aside>
      )}

      {/* Status Modal */}
      {statusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#075C3D]/50 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <div
            ref={statusDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-status-title"
            aria-describedby="user-status-description"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 id="user-status-title" className="text-lg font-bold text-gray-900">
              Update Status
            </h3>
            <p id="user-status-description" className="mt-1 text-sm text-gray-500">
              Change status for <strong>{statusModal.name}</strong>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Current: {statusModal.current.replace(/_/g, ' ')}
            </p>

            <div className="mt-4 space-y-3">
              <label
                htmlFor="user-status-value"
                className="block text-xs font-semibold text-gray-700"
              >
                New account status
              </label>
              <select
                ref={statusSelectRef}
                id="user-status-value"
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
              <label
                htmlFor="user-status-reason"
                className="block text-xs font-semibold text-gray-700"
              >
                Operational reason
              </label>
              <Input
                id="user-status-reason"
                placeholder={
                  newStatus === 'ACTIVE' ? 'Reason (optional)' : 'Operational reason (required)'
                }
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={closeStatusModal}>
                Cancel
              </Button>
              <Button
                onClick={handleStatusUpdate}
                disabled={
                  !newStatus ||
                  updating ||
                  (newStatus !== 'ACTIVE' && statusReason.trim().length < 5)
                }
              >
                {updating ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
