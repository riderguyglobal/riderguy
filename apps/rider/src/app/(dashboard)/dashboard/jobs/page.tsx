'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Spinner,
  Switch,
} from '@riderguy/ui';
import { useRiderAvailability } from '@/hooks/use-rider-availability';

// ============================================================
// Rider Job Feed — shows available delivery jobs in rider's zone
// ============================================================

const PACKAGE_ICONS: Record<string, string> = {
  DOCUMENT: '📄',
  SMALL_PARCEL: '📦',
  MEDIUM_PARCEL: '📦',
  LARGE_PARCEL: '📦',
  FOOD: '🍔',
  FRAGILE: '🥚',
  HIGH_VALUE: '💎',
};

const PACKAGE_LABELS: Record<string, string> = {
  DOCUMENT: 'Document',
  SMALL_PARCEL: 'Small Parcel',
  MEDIUM_PARCEL: 'Medium Parcel',
  LARGE_PARCEL: 'Large Parcel',
  FOOD: 'Food',
  FRAGILE: 'Fragile',
  HIGH_VALUE: 'High Value',
};

interface AvailableJob {
  id: string;
  orderNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  packageDescription?: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  totalPrice: number;
  serviceFee: number;
  currency: string;
  createdAt: string;
}

export default function JobFeedPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<AvailableJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Wired to PATCH /riders/availability + geolocation tracking
  const {
    isOnline,
    toggling: togglingAvailability,
    error: availabilityError,
    toggleAvailability,
    loading: availabilityLoading,
  } = useRiderAvailability();

  const fetchJobs = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const api = getApiClient();
      const { data } = await api.get('/orders/available');
      setJobs(data.data ?? []);
    } catch {
      // Silent fail — may not have zone assigned yet
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + auto-refresh every 15 seconds when online
  useEffect(() => {
    fetchJobs();
    if (!isOnline) return;
    const interval = setInterval(() => fetchJobs(), 15000);
    return () => clearInterval(interval);
  }, [fetchJobs, isOnline]);

  async function handleAcceptJob(orderId: string) {
    setAcceptingId(orderId);
    try {
      const api = getApiClient();
      await api.post(`/orders/${orderId}/accept`);
      // Navigate to the active job page
      router.push(`/dashboard/jobs/${orderId}`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error?: string } } }).response?.data?.error
          : 'Failed to accept job';
      alert(msg || 'Failed to accept job');
    } finally {
      setAcceptingId(null);
    }
  }

  function riderEarnings(job: AvailableJob): number {
    // Rider earns totalPrice minus serviceFee
    return job.totalPrice - (job.serviceFee ?? 0);
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Available Jobs</h1>
          <p className="text-xs text-gray-400">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} near you
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              {togglingAvailability ? 'Updating…' : isOnline ? 'Online' : 'Offline'}
            </span>
            <Switch
              checked={isOnline}
              disabled={togglingAvailability || availabilityLoading}
              onCheckedChange={() => toggleAvailability()}
            />
          </div>
        </div>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="mb-4 rounded-lg bg-yellow-50 p-4 text-center">
          <p className="text-sm font-medium text-yellow-800">
            You&#39;re offline
          </p>
          <p className="mt-1 text-xs text-yellow-600">
            Go online to start seeing delivery requests
          </p>
        </div>
      )}

      {/* Availability error */}
      {availabilityError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-center">
          <p className="text-xs text-red-600">{availabilityError}</p>
        </div>
      )}

      {/* Pull-to-refresh button */}
      {isOnline && (
        <Button
          variant="outline"
          size="sm"
          className="mb-4 w-full"
          onClick={() => fetchJobs(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Refreshing…
            </>
          ) : (
            '↻ Refresh Jobs'
          )}
        </Button>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      ) : !isOnline ? null : jobs.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-4 text-sm font-medium text-gray-900">
            No jobs available right now
          </p>
          <p className="mt-1 text-sm text-gray-500">
            New delivery requests will appear here automatically
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className="overflow-hidden border-l-4 border-l-brand-500"
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {PACKAGE_ICONS[job.packageType] ?? '📦'}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        {PACKAGE_LABELS[job.packageType] ?? job.packageType}
                      </p>
                      <p className="text-xs text-gray-400">#{job.orderNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      ₦{riderEarnings(job).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">your earnings</p>
                  </div>
                </div>

                {/* Route */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                    <p className="text-sm text-gray-700 line-clamp-1">
                      {job.pickupAddress}
                    </p>
                  </div>
                  <div className="ml-[3px] h-4 border-l-2 border-dashed border-gray-300" />
                  <div className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
                    <p className="text-sm text-gray-700 line-clamp-1">
                      {job.dropoffAddress}
                    </p>
                  </div>
                </div>

                {/* Info badges */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    {job.distanceKm.toFixed(1)} km
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    ~{job.estimatedDurationMinutes} min
                  </Badge>
                  {job.packageDescription && (
                    <Badge variant="outline" className="text-xs">
                      {job.packageDescription}
                    </Badge>
                  )}
                </div>

                {/* Accept button */}
                <Button
                  className="mt-4 w-full bg-brand-500 hover:bg-brand-600"
                  onClick={() => handleAcceptJob(job.id)}
                  disabled={acceptingId === job.id}
                >
                  {acceptingId === job.id ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Accepting…
                    </>
                  ) : (
                    'Accept Job'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
