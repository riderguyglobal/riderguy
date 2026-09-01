'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { getApiClient } from '@riderguy/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
  Textarea,
} from '@riderguy/ui';

type AssetType = 'MOTORBIKE' | 'ELECTRIC_VEHICLE';
type InterestStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN';

interface AssetFinancingInterest {
  id: string;
  riderId: string;
  assetType: AssetType;
  status: InterestStatus;
  contactEmail: string;
  notes: string | null;
  reviewNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedById: string | null;
  createdAt: string;
  updatedAt: string;
  rider: {
    id: string;
    userId: string;
    onboardingStatus: string;
    riderChannel: 'GUEST' | 'IN_HOUSE' | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email: string | null;
      emailVerified: boolean;
      status: string;
    };
  };
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InterestListResponse {
  success: true;
  data: AssetFinancingInterest[];
  pagination: Pagination;
}

const STATUS_OPTIONS: Array<{ value: InterestStatus; label: string }> = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

const STATUS_STYLES: Record<InterestStatus, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  APPROVED: 'bg-green-100 text-green-800 hover:bg-green-100',
  DECLINED: 'bg-red-100 text-red-800 hover:bg-red-100',
  WITHDRAWN: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
};

const STATUS_TRANSITIONS: Record<InterestStatus, readonly InterestStatus[]> = {
  SUBMITTED: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN'],
  APPROVED: ['APPROVED', 'UNDER_REVIEW', 'DECLINED', 'WITHDRAWN'],
  DECLINED: ['DECLINED', 'SUBMITTED', 'UNDER_REVIEW'],
  WITHDRAWN: ['WITHDRAWN', 'SUBMITTED'],
};

const ASSET_LABELS: Record<AssetType, string> = {
  MOTORBIKE: 'Motorbike',
  ELECTRIC_VEHICLE: 'Electric vehicle',
};

function formatDate(value: string | null): string {
  if (!value) return '\u2014';
  return new Date(value).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: InterestStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback;
  const body = error.response?.data as {
    error?: { message?: string };
    message?: string;
  } | undefined;
  return body?.error?.message ?? body?.message ?? fallback;
}

export default function AssetFinancingQueuePage() {
  const [items, setItems] = useState<AssetFinancingInterest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<AssetFinancingInterest | null>(null);
  const [draftStatus, setDraftStatus] = useState<InterestStatus>('SUBMITTED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const requestSequence = useRef(0);

  const loadInterests = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const api = getApiClient();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (assetTypeFilter) params.set('assetType', assetTypeFilter);
      if (search) params.set('search', search);

      const response = await api.get<InterestListResponse>(
        `/riders/asset-financing/interests/admin?${params.toString()}`,
      );
      if (requestId !== requestSequence.current) return;

      setItems(response.data.data);
      setPagination(response.data.pagination);
    } catch (loadError) {
      if (requestId !== requestSequence.current) return;
      setError(apiErrorMessage(loadError, 'Failed to load asset-financing interests.'));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [assetTypeFilter, page, search, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    void loadInterests();
  }, [loadInterests]);

  const openReview = (interest: AssetFinancingInterest) => {
    setSelected(interest);
    setDraftStatus(interest.status);
    setReviewNotes(interest.reviewNotes ?? '');
    setError('');
    setNotice('');
  };

  const closeReview = () => {
    if (updating) return;
    setSelected(null);
    setReviewNotes('');
  };

  const updateInterest = async () => {
    if (!selected) return;

    const normalizedNotes = reviewNotes.trim();
    if (normalizedNotes.length > 0 && normalizedNotes.length < 3) {
      setError('Review notes must be at least 3 characters when provided.');
      return;
    }
    if (draftStatus === 'DECLINED' && normalizedNotes.length < 3) {
      setError('Add a clear reason before declining an interest.');
      return;
    }

    setUpdating(true);
    setError('');
    setNotice('');

    try {
      const api = getApiClient();
      await api.patch(`/riders/asset-financing/interests/${selected.id}/status`, {
        status: draftStatus,
        ...(normalizedNotes ? { reviewNotes: normalizedNotes } : {}),
        expectedUpdatedAt: selected.updatedAt,
      });
      setSelected(null);
      setReviewNotes('');
      await loadInterests();
      setNotice('Asset-financing interest updated successfully.');
    } catch (updateError) {
      if (isAxiosError(updateError) && updateError.response?.status === 409) {
        setSelected(null);
        setReviewNotes('');
        await loadInterests();
        setError('This interest changed after you opened it. The queue has been refreshed; review the latest state before trying again.');
      } else {
        setError(apiErrorMessage(updateError, 'Failed to update the asset-financing interest.'));
      }
    } finally {
      setUpdating(false);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setAssetTypeFilter('');
    setPage(1);
  };

  const firstVisible = pagination.total === 0
    ? 0
    : ((pagination.page - 1) * pagination.limit) + 1;
  const lastVisible = Math.min(pagination.page * pagination.limit, pagination.total);
  const selectedRider = selected?.rider.user;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Financing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review Rider interest in the 12-month motorbike and EV lease programme.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadInterests()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label htmlFor="asset-interest-search" className="mb-1 block text-xs font-medium text-gray-600">
                Search Riders
              </label>
              <Input
                id="asset-interest-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, email, or phone"
              />
            </div>
            <div>
              <label htmlFor="asset-interest-status" className="mb-1 block text-xs font-medium text-gray-600">
                Status
              </label>
              <select
                id="asset-interest-status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="asset-interest-type" className="mb-1 block text-xs font-medium text-gray-600">
                Preferred asset
              </label>
              <select
                id="asset-interest-type"
                value={assetTypeFilter}
                onChange={(event) => {
                  setAssetTypeFilter(event.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              >
                <option value="">All asset types</option>
                <option value="MOTORBIKE">Motorbike</option>
                <option value="ELECTRIC_VEHICLE">Electric vehicle</option>
              </select>
            </div>
          </div>

          {(search || statusFilter || assetTypeFilter) ? (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <p className="text-base font-semibold text-gray-600">No interests found</p>
            <p className="mt-1 text-sm text-gray-400">
              {search || statusFilter || assetTypeFilter
                ? 'Try clearing or changing the filters.'
                : 'Submitted Rider interests will appear here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[1050px] text-sm">
            <caption className="sr-only">Asset-financing interests awaiting administration</caption>
            <thead className="border-b bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Rider</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Asset</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Submitted</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Last reviewed by</th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((interest) => {
                const rider = interest.rider.user;
                const accountEmailDiffers = Boolean(
                  rider.email
                  && rider.email.trim().toLowerCase() !== interest.contactEmail.trim().toLowerCase(),
                );
                return (
                  <tr key={interest.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/riders/${interest.rider.userId}/review`}
                        className="font-medium text-gray-900 hover:text-brand-600 hover:underline"
                      >
                        {rider.firstName} {rider.lastName}
                      </Link>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {interest.rider.riderChannel === 'IN_HOUSE' ? 'In-House Rider' : 'Rider'}
                        {' \u00b7 '}{interest.rider.onboardingStatus.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <a href={`tel:${rider.phone}`} className="block hover:text-brand-600 hover:underline">
                        {rider.phone}
                      </a>
                      <a href={`mailto:${interest.contactEmail}`} className="block text-xs text-brand-600 hover:underline">
                        {interest.contactEmail}
                      </a>
                      {accountEmailDiffers ? (
                        <p className="mt-0.5 text-[11px] text-gray-400">Current account: {rider.email}</p>
                      ) : null}
                      <span className={`mt-1 inline-block text-[11px] ${rider.emailVerified ? 'text-green-600' : 'text-amber-600'}`}>
                        {rider.emailVerified ? 'Verified email' : 'Email not currently verified'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-700">{ASSET_LABELS[interest.assetType]}</td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_STYLES[interest.status]}>{statusLabel(interest.status)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{formatDate(interest.submittedAt)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {interest.reviewedBy ? (
                        <>
                          <p>{interest.reviewedBy.firstName} {interest.reviewedBy.lastName}</p>
                          <p className="text-xs text-gray-400">{formatDate(interest.reviewedAt)}</p>
                        </>
                      ) : interest.reviewedAt ? (
                        <>
                          <p>Former administrator</p>
                          <p className="text-xs text-gray-400">{formatDate(interest.reviewedAt)}</p>
                        </>
                      ) : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openReview(interest)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && pagination.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            Showing {firstVisible}\u2013{lastVisible} of {pagination.total}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.totalPages === 0 || page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) closeReview(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Asset-Financing Interest</DialogTitle>
            <DialogDescription>
              Review the Rider's request and record the current decision. This does not create a lease agreement.
            </DialogDescription>
          </DialogHeader>

          {selected && error ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {selected && selectedRider ? (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Rider</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedRider.firstName} {selectedRider.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{selectedRider.phone}</p>
                  <p className="break-all text-sm text-gray-500">{selected.contactEmail}</p>
                  {selectedRider.email
                    && selectedRider.email.trim().toLowerCase() !== selected.contactEmail.trim().toLowerCase() ? (
                      <p className="break-all text-xs text-gray-400">
                        Current account email: {selectedRider.email}
                      </p>
                    ) : null}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Request</p>
                  <p className="mt-1 font-semibold text-gray-900">{ASSET_LABELS[selected.assetType]}</p>
                  <p className="text-sm text-gray-500">Submitted {formatDate(selected.submittedAt)}</p>
                  <Badge className={`mt-2 ${STATUS_STYLES[selected.status]}`}>{statusLabel(selected.status)}</Badge>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Rider notes</p>
                <p className="mt-1 whitespace-pre-wrap rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm text-gray-700">
                  {selected.notes || 'No notes supplied.'}
                </p>
              </div>

              <div>
                <label htmlFor="asset-review-status" className="mb-1 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="asset-review-status"
                  value={draftStatus}
                  onChange={(event) => setDraftStatus(event.target.value as InterestStatus)}
                  disabled={updating}
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 disabled:opacity-60"
                >
                  {STATUS_OPTIONS
                    .filter((option) => selected && STATUS_TRANSITIONS[selected.status].includes(option.value))
                    .map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="asset-review-notes" className="mb-1 block text-sm font-medium text-gray-700">
                  Review notes {draftStatus === 'DECLINED' ? '(required)' : '(optional)'}
                </label>
                <Textarea
                  id="asset-review-notes"
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Record eligibility checks, next steps, or the reason for declining..."
                  maxLength={1000}
                  rows={4}
                  disabled={updating || draftStatus === 'SUBMITTED'}
                />
                <div className="mt-1 flex justify-between gap-3 text-xs text-gray-400">
                  <span>{draftStatus === 'SUBMITTED' ? 'Returning to Submitted clears the existing review details.' : 'Visible to RiderGuy administrators.'}</span>
                  <span>{reviewNotes.length}/1000</span>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeReview} disabled={updating}>Cancel</Button>
            <Button
              onClick={() => void updateInterest()}
              disabled={
                updating
                || !selected
                || (draftStatus === 'DECLINED' && reviewNotes.trim().length < 3)
                || (reviewNotes.trim().length > 0 && reviewNotes.trim().length < 3)
              }
            >
              {updating ? 'Saving...' : 'Save decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
