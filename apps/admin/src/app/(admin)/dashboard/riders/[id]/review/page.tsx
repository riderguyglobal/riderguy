'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Textarea,
  Separator,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@riderguy/ui';
import { AuthenticatedImage, openAuthenticatedMedia } from '@/components/authenticated-media';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Fingerprint,
  History,
  Landmark,
  MailCheck,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface DocumentData {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewer?: Reviewer | null;
}

interface Reviewer {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

interface VehicleData {
  id: string;
  type: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  plateNumber: string;
  photoFrontUrl: string | null;
  photoBackUrl: string | null;
  photoLeftUrl: string | null;
  photoRightUrl: string | null;
  isApproved: boolean;
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  reviewedById: string | null;
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  } | null;
  reviewedAt: string | null;
}

interface RiderProfile {
  id: string;
  userId: string;
  onboardingStatus: string;
  riderChannel: 'GUEST' | 'IN_HOUSE' | null;
  requestedRiderChannel: 'GUEST' | 'IN_HOUSE' | null;
  channelVerifiedAt: string | null;
  referralCode: string;
  applicationRejectionReason: string | null;
  approvalReadiness: { ready: boolean; missing: string[] };
  trainingCompletions: Array<{
    id: string;
    moduleKey: string;
    completedAt: string;
    verifiedAt: string | null;
    verifiedById?: string | null;
    reviewer?: Reviewer | null;
  }>;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    createdAt: string;
    status: string;
    phoneVerified: boolean;
    emailVerified: boolean;
    lastLoginAt: string | null;
  };
  vehicles: VehicleData[];
  identity: {
    phoneVerified: boolean;
    emailVerified: boolean;
    ghanaCardOnFile: boolean;
  };
  profile: {
    availability: string;
    isVerified: boolean;
    activatedAt: string | null;
    applicationReviewedAt: string | null;
    applicationReviewedBy: Reviewer | null;
    totalDeliveries: number;
    averageRating: number;
    cancellationCount: number;
    suspendedUntil: string | null;
  };
  assetFinancingInterest: {
    id: string;
    assetType: string;
    status: string;
    contactEmail: string;
    notes: string | null;
    reviewNotes: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    reviewedBy: Reviewer | null;
  } | null;
  channelInvitation: {
    id: string;
    targetEmail: string | null;
    targetPhone: string | null;
    expiresAt: string;
    usedAt: string | null;
    revokedAt: string | null;
    createdBy: Reviewer;
  } | null;
  activity: { completedOrders: number; cancellationRecords: number };
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: string;
  actor: Reviewer | null;
}

// ─── Helpers ────────────────────────────────────────────────

function docStatusBadge(status: string) {
  switch (status) {
    case 'APPROVED':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
    case 'REJECTED':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
    case 'PENDING':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function friendlyDocType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

function vehicleStatusBadge(status: VehicleData['reviewStatus']) {
  if (status === 'APPROVED') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
  }
  if (status === 'REJECTED') {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending review</Badge>;
}

function vehiclePhotos(vehicle: VehicleData) {
  return [
    { label: 'Front', url: vehicle.photoFrontUrl },
    { label: 'Back', url: vehicle.photoBackUrl },
    { label: 'Left side', url: vehicle.photoLeftUrl },
    { label: 'Right side', url: vehicle.photoRightUrl },
  ];
}

// ─── Component ──────────────────────────────────────────────

export default function RiderReviewPage() {
  const router = useRouter();
  const params = useParams();
  const riderId = params.id as string;
  const api = useMemo(() => getApiClient(), []);

  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [dataStale, setDataStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [vehicleRejectionReason, setVehicleRejectionReason] = useState('');
  const [vehicleReviewDialogId, setVehicleReviewDialogId] = useState<string | null>(null);
  const [documentReviewDialogId, setDocumentReviewDialogId] = useState<string | null>(null);
  const [documentRejectionReason, setDocumentRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const handleOpenMedia = useCallback(
    async (url: string) => {
      try {
        await openAuthenticatedMedia(api, url);
      } catch {
        setError('Failed to open the protected media file. Please try again.');
      }
    },
    [api],
  );

  // ── Fetch rider data ──────────────────────────────────────
  const fetchData = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      setHistoryError(null);

      const [profileResult, historyResult] = await Promise.allSettled([
        api.get(`/riders/admin/operations/cases/${riderId}`),
        api.get(`/riders/admin/operations/cases/${riderId}/history`, {
          params: { limit: 50 },
        }),
      ]);

      if (profileResult.status === 'rejected') throw profileResult.reason;

      setProfile(profileResult.value.data.data);
      setDocuments(profileResult.value.data.data.documents);
      if (historyResult.status === 'rejected') {
        setHistoryError(
          apiErrorMessage(historyResult.reason, 'Decision history is currently unavailable.'),
        );
        setDataStale(true);
        return false;
      }

      const historyData: unknown = historyResult.value.data.data;
      if (!Array.isArray(historyData)) {
        setHistoryError('Decision history returned an invalid response and is unavailable.');
        setDataStale(true);
        return false;
      }

      setHistory(historyData as AuditEntry[]);
      setDataStale(false);
      return true;
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'Failed to load Rider case.'));
      setHistoryError('Decision history could not be verified because the case refresh failed.');
      setDataStale(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [api, riderId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const refreshAfterMutation = useCallback(
    async (successMessage: string) => {
      const refreshed = await fetchData();
      setActionFeedback(
        refreshed
          ? successMessage
          : `${successMessage} The action was committed, but the case could not be fully refreshed. Do not repeat it. Decision controls remain locked until Retry refresh succeeds.`,
      );
    },
    [fetchData],
  );

  // ── Review a document ─────────────────────────────────────
  const handleDocReview = useCallback(
    async (docId: string, status: 'APPROVED' | 'REJECTED') => {
      setActionLoading(true);
      setActionFeedback(null);
      try {
        const body: Record<string, string> = { status };
        if (status === 'REJECTED' && documentRejectionReason.trim()) {
          body.rejectionReason = documentRejectionReason.trim();
        }

        await api.patch(`/documents/${docId}/review`, body);

        setDocumentRejectionReason('');
        setDocumentReviewDialogId(null);
        await refreshAfterMutation(
          status === 'APPROVED'
            ? 'Document approved successfully.'
            : 'Document rejected and the Rider has been given the correction reason.',
        );
      } catch (documentError) {
        setError(apiErrorMessage(documentError, 'Failed to review document.'));
      } finally {
        setActionLoading(false);
      }
    },
    [api, documentRejectionReason, refreshAfterMutation],
  );

  // Review the registered vehicle evidence used by the Rider activation gate.
  const handleVehicleReview = useCallback(
    async (vehicleId: string, status: 'APPROVED' | 'REJECTED') => {
      setActionLoading(true);
      setError(null);
      setActionFeedback(null);
      try {
        const body =
          status === 'REJECTED'
            ? { status, rejectionReason: vehicleRejectionReason.trim() }
            : { status };
        await api.patch(`/riders/${riderId}/vehicles/${vehicleId}/review`, body);

        setVehicleRejectionReason('');
        setVehicleReviewDialogId(null);
        await refreshAfterMutation(
          status === 'APPROVED'
            ? 'Vehicle evidence approved successfully.'
            : 'Vehicle evidence rejected and the Rider has been notified.',
        );
      } catch (vehicleError) {
        const missingPhotos = (
          vehicleError as {
            response?: { data?: { error?: { details?: { missingPhotos?: string[] } } } };
          }
        ).response?.data?.error?.details?.missingPhotos;
        setError(
          missingPhotos?.length
            ? `Missing vehicle photos: ${missingPhotos.join(', ')}`
            : apiErrorMessage(vehicleError, 'Failed to review vehicle.'),
        );
      } finally {
        setActionLoading(false);
      }
    },
    [api, refreshAfterMutation, riderId, vehicleRejectionReason],
  );

  // ── Approve / Reject rider application ────────────────────
  const handleApplicationDecision = useCallback(
    async (decision: 'approve' | 'reject') => {
      setActionLoading(true);
      setActionFeedback(null);
      try {
        const body = decision === 'reject' ? { reason: rejectionReason.trim() || undefined } : {};

        await api.patch(`/riders/${riderId}/${decision}`, body);

        await refreshAfterMutation(
          decision === 'approve'
            ? 'Rider application approved successfully.'
            : 'Rider application rejected and the Rider has been notified.',
        );
      } catch (decisionError) {
        const missing = (
          decisionError as {
            response?: { data?: { error?: { details?: { missing?: string[] } } } };
          }
        ).response?.data?.error?.details?.missing;
        setError(
          missing?.length
            ? missing.join('; ')
            : apiErrorMessage(decisionError, `Failed to ${decision} application.`),
        );
      } finally {
        setActionLoading(false);
      }
    },
    [api, riderId, rejectionReason, refreshAfterMutation],
  );

  const reviewTraining = useCallback(
    async (moduleKey: string, decision: 'VERIFIED' | 'REVOKED') => {
      const reason =
        decision === 'REVOKED'
          ? window.prompt('Explain why this training verification is being revoked:')?.trim()
          : undefined;
      if (decision === 'REVOKED' && (!reason || reason.length < 5)) return;
      setActionLoading(true);
      setActionFeedback(null);
      try {
        await api.patch(`/riders/${riderId}/training/${moduleKey}/review`, {
          decision,
          ...(reason ? { reason } : {}),
        });
        await refreshAfterMutation(
          decision === 'VERIFIED'
            ? 'Training module verified successfully.'
            : 'Training verification revoked and the Rider has been notified.',
        );
      } catch (trainingError) {
        setError(apiErrorMessage(trainingError, 'Training verification failed'));
      } finally {
        setActionLoading(false);
      }
    },
    [api, refreshAfterMutation, riderId],
  );

  const classifyLegacyChannel = useCallback(
    async (channel: 'GUEST' | 'IN_HOUSE') => {
      setActionLoading(true);
      setActionFeedback(null);
      try {
        await api.patch(`/riders/${riderId}/channel`, { channel });
        await refreshAfterMutation('Rider channel classified successfully.');
      } catch (classificationError) {
        setError(apiErrorMessage(classificationError, 'Channel classification failed'));
      } finally {
        setActionLoading(false);
      }
    },
    [api, refreshAfterMutation, riderId],
  );

  const retryDataRefresh = useCallback(async () => {
    const refreshed = await fetchData();
    if (refreshed) setActionFeedback('Rider case and decision history refreshed successfully.');
  }, [fetchData]);

  const decisionControlsDisabled = actionLoading || dataStale;

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="text-brand-500 h-8 w-8" />
      </div>
    );
  }

  return (
    <>
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard/riders')}
        className="text-brand-500 mb-4 flex items-center gap-1 text-sm hover:underline"
      >
        ← Back to Applications
      </button>

      <div className="mb-6">
        <p className="admin-kicker">Evidence &amp; activation</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-[#07110D]">
          Rider operations case
          {profile && ` — ${profile.user.firstName} ${profile.user.lastName}`}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Evidence, authorization, decisions, and audit history for one Rider.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {actionFeedback && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
        >
          {actionFeedback}
        </div>
      )}
      {dataStale && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p>
            This case is not fully current. Decision controls are locked to prevent a repeated or
            conflicting action.
          </p>
          <Button size="sm" variant="outline" onClick={() => void retryDataRefresh()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Retry refresh
          </Button>
        </div>
      )}

      {profile && (
        <div
          className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${profile.approvalReadiness.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
        >
          <div className="flex items-center gap-3">
            {profile.approvalReadiness.ready ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            <div>
              <p
                className={`text-sm font-bold ${profile.approvalReadiness.ready ? 'text-emerald-900' : 'text-amber-900'}`}
              >
                {profile.approvalReadiness.ready
                  ? 'All activation controls passed'
                  : `${profile.approvalReadiness.missing.length} activation blocker${profile.approvalReadiness.missing.length === 1 ? '' : 's'}`}
              </p>
              <p
                className={`text-xs ${profile.approvalReadiness.ready ? 'text-emerald-700' : 'text-amber-700'}`}
              >
                {profile.approvalReadiness.ready
                  ? 'This Rider can be approved and activated.'
                  : profile.approvalReadiness.missing[0]}
              </p>
            </div>
          </div>
          <Badge variant="outline">{profile.user.status.replace(/_/g, ' ')}</Badge>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: Profile + Vehicles ── */}
        <div className="space-y-4">
          {/* Profile card */}
          {profile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Applicant Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-100 text-brand-700 flex h-12 w-12 items-center justify-center rounded-full font-semibold">
                    {profile.user.firstName[0]}
                    {profile.user.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {profile.user.firstName} {profile.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{profile.user.phone}</p>
                  </div>
                </div>
                {profile.user.email && (
                  <p className="text-sm text-gray-500">📧 {profile.user.email}</p>
                )}
                <p className="text-sm text-gray-500">
                  📅 Joined {new Date(profile.user.createdAt).toLocaleDateString()}
                </p>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <Badge variant="outline">{profile.onboardingStatus.replace(/_/g, ' ')}</Badge>
                </div>
                {!profile.riderChannel ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-2 text-xs text-amber-800">
                      Legacy Rider channel requires an explicit admin classification. This does not
                      create training records.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decisionControlsDisabled}
                        onClick={() => void classifyLegacyChannel('GUEST')}
                      >
                        Classify Guest
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decisionControlsDisabled}
                        onClick={() => void classifyLegacyChannel('IN_HOUSE')}
                      >
                        Classify In-House
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Rider channel</span>
                  <Badge
                    className={
                      profile.riderChannel === 'IN_HOUSE'
                        ? 'bg-purple-100 text-purple-800 hover:bg-purple-100'
                        : profile.riderChannel === 'GUEST'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                    }
                  >
                    {profile.riderChannel === 'IN_HOUSE'
                      ? 'In-House (Authorized)'
                      : profile.riderChannel === 'GUEST'
                        ? 'Guest'
                        : profile.requestedRiderChannel === 'IN_HOUSE'
                          ? 'In-House Invite Needed'
                          : 'Not Selected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-500">Referral code</span>
                  <code className="text-xs font-bold text-gray-800">{profile.referralCode}</code>
                </div>
                {profile.applicationRejectionReason ? (
                  <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                    Previous decision: {profile.applicationRejectionReason}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {profile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-gray-500">
                  <Fingerprint className="h-4 w-4" /> Identity & Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-600">
                    <PhoneCall className="h-4 w-4" />
                    Phone
                  </span>
                  <Badge
                    className={
                      profile.identity.phoneVerified
                        ? 'bg-green-100 text-green-800 hover:bg-green-100'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                    }
                  >
                    {profile.identity.phoneVerified ? 'Verified' : 'Unverified'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-600">
                    <MailCheck className="h-4 w-4" />
                    Email
                  </span>
                  <Badge
                    className={
                      profile.identity.emailVerified
                        ? 'bg-green-100 text-green-800 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                    }
                  >
                    {profile.identity.emailVerified ? 'Verified' : 'Unverified'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-600">
                    <ShieldCheck className="h-4 w-4" />
                    Ghana Card
                  </span>
                  <Badge
                    className={
                      profile.identity.ghanaCardOnFile
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                    }
                  >
                    {profile.identity.ghanaCardOnFile ? 'On file' : 'Not on file'}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">Last sign-in</span>
                  <span className="text-right font-medium text-gray-800">
                    {profile.user.lastLoginAt
                      ? new Date(profile.user.lastLoginAt).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Work state</span>
                  <span className="font-medium text-gray-800">
                    {profile.profile.availability.replace(/_/g, ' ')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vehicles */}
          {profile && profile.vehicles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Vehicles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.vehicles.map((v) => (
                  <div key={v.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {v.make} {v.model}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {v.type}
                        </Badge>
                        {vehicleStatusBadge(v.reviewStatus)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Plate: {v.plateNumber}
                      {v.year && ` • ${v.year}`}
                      {v.color && ` • ${v.color}`}
                    </p>
                    {v.reviewStatus === 'REJECTED' && v.rejectionReason ? (
                      <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
                        <p>
                          <span className="font-semibold">Reason:</span> {v.rejectionReason}
                        </p>
                        {v.reviewedAt ? (
                          <p className="mt-1 text-red-600">
                            Reviewed {new Date(v.reviewedAt).toLocaleString()}
                            {v.reviewedBy
                              ? ` by ${v.reviewedBy.firstName} ${v.reviewedBy.lastName}`
                              : v.reviewedById
                                ? ' by a legacy reviewer'
                                : ''}
                          </p>
                        ) : null}
                      </div>
                    ) : v.reviewStatus === 'APPROVED' && v.reviewedAt ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Approved {new Date(v.reviewedAt).toLocaleString()}
                        {v.reviewedBy
                          ? ` by ${v.reviewedBy.firstName} ${v.reviewedBy.lastName}`
                          : v.reviewedById
                            ? ' by a legacy reviewer'
                            : ''}
                      </p>
                    ) : null}
                    {/* Keep every required angle visible and explicitly labelled. */}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {vehiclePhotos(v).map(({ label, url }) => (
                        <div key={label}>
                          <p className="mb-1 text-xs font-medium text-gray-600">{label}</p>
                          {url ? (
                            <button
                              type="button"
                              aria-label={`Open ${label.toLowerCase()} vehicle photo`}
                              onClick={() => setFullscreenImage(url)}
                              className="relative h-20 w-full overflow-hidden rounded border"
                            >
                              <AuthenticatedImage
                                api={api}
                                src={url}
                                alt={`${label} vehicle photo`}
                                fill
                                className="object-cover"
                              />
                            </button>
                          ) : (
                            <div className="flex h-20 items-center justify-center rounded border border-dashed bg-gray-50 text-xs text-gray-400">
                              Missing
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {!vehiclePhotos(v).every((photo) => Boolean(photo.url)) ? (
                      <p className="mt-2 text-xs text-amber-700">
                        Approval is locked until front, back, left, and right photos are uploaded.
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={
                          decisionControlsDisabled ||
                          v.reviewStatus === 'APPROVED' ||
                          !vehiclePhotos(v).every((photo) => Boolean(photo.url))
                        }
                        onClick={() => void handleVehicleReview(v.id, 'APPROVED')}
                      >
                        Approve vehicle
                      </Button>
                      <Dialog
                        open={vehicleReviewDialogId === v.id}
                        onOpenChange={(open) => {
                          setVehicleReviewDialogId(open ? v.id : null);
                          if (!open) setVehicleRejectionReason('');
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            disabled={decisionControlsDisabled}
                          >
                            {v.reviewStatus === 'APPROVED'
                              ? 'Revoke approval'
                              : v.reviewStatus === 'REJECTED'
                                ? 'Update rejection'
                                : 'Reject vehicle'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {v.reviewStatus === 'APPROVED'
                                ? 'Revoke Vehicle Approval'
                                : v.reviewStatus === 'REJECTED'
                                  ? 'Update Vehicle Rejection'
                                  : 'Reject Vehicle'}
                            </DialogTitle>
                            <DialogDescription>
                              The Rider will be notified and must correct the vehicle details or
                              photos before approval.
                            </DialogDescription>
                          </DialogHeader>
                          <Textarea
                            placeholder="Explain what the Rider needs to correct..."
                            value={vehicleRejectionReason}
                            onChange={(event) => setVehicleRejectionReason(event.target.value)}
                            rows={3}
                          />
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button
                              className="bg-red-600 hover:bg-red-700"
                              disabled={
                                decisionControlsDisabled || vehicleRejectionReason.trim().length < 5
                              }
                              onClick={() => void handleVehicleReview(v.id, 'REJECTED')}
                            >
                              {v.reviewStatus === 'APPROVED'
                                ? 'Revoke approval'
                                : v.reviewStatus === 'REJECTED'
                                  ? 'Update rejection'
                                  : 'Reject vehicle'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {profile?.riderChannel === 'IN_HOUSE' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">
                  In-House Training Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {['SAFETY_BASICS', 'SERVICE_STANDARDS', 'DELIVERY_OPERATIONS'].map((moduleKey) => {
                  const completion = profile.trainingCompletions.find(
                    (item) => item.moduleKey === moduleKey,
                  );
                  return (
                    <div key={moduleKey} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {friendlyDocType(moduleKey)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {!completion
                              ? 'Not completed'
                              : completion.verifiedAt
                                ? 'Admin verified'
                                : 'Completed — verification required'}
                          </p>
                        </div>
                        {completion?.verifiedAt ? (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Verified
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              disabled={decisionControlsDisabled}
                              onClick={() => void reviewTraining(moduleKey, 'REVOKED')}
                            >
                              Revoke
                            </Button>
                          </div>
                        ) : completion ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decisionControlsDisabled}
                            onClick={() => void reviewTraining(moduleKey, 'VERIFIED')}
                          >
                            Verify
                          </Button>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {profile?.assetFinancingInterest && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-gray-500">
                  <Landmark className="h-4 w-4" />
                  Asset Financing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Requested asset</span>
                  <span className="font-medium text-gray-900">
                    {friendlyDocType(profile.assetFinancingInterest.assetType)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge variant="outline">
                    {friendlyDocType(profile.assetFinancingInterest.status)}
                  </Badge>
                </div>
                {profile.assetFinancingInterest.notes && (
                  <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                    {profile.assetFinancingInterest.notes}
                  </div>
                )}
                {profile.assetFinancingInterest.reviewNotes && (
                  <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                    <strong>Admin notes:</strong> {profile.assetFinancingInterest.reviewNotes}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push('/dashboard/asset-financing')}
                >
                  Open financing queue <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          )}

          {profile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-gray-500">
                  <Activity className="h-4 w-4" />
                  Operational Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-lg font-bold text-gray-900">
                    {profile.activity.completedOrders}
                  </p>
                  <p className="text-xs text-gray-500">Orders</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-lg font-bold text-gray-900">
                    {profile.profile.averageRating.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500">Rating</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-lg font-bold text-gray-900">
                    {profile.activity.cancellationRecords}
                  </p>
                  <p className="text-xs text-gray-500">Cancellations</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Application actions */}
          {profile && profile.onboardingStatus !== 'ACTIVATED' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Application Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => void handleApplicationDecision('approve')}
                  disabled={decisionControlsDisabled || !profile.approvalReadiness.ready}
                >
                  ✅ Approve Application
                </Button>

                {!profile.approvalReadiness.ready ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">Approval is locked:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {profile.approvalReadiness.missing.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      disabled={decisionControlsDisabled}
                    >
                      ❌ Reject Application
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reject Application</DialogTitle>
                      <DialogDescription>
                        Please provide a reason for rejecting this rider&apos;s application.
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Enter rejection reason..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                    />
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        variant="default"
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => void handleApplicationDecision('reject')}
                        disabled={decisionControlsDisabled || rejectionReason.trim().length < 5}
                      >
                        Reject
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column: Documents ── */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-500">
                Documents ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="rounded-lg border p-4">
                      <div className="flex items-start gap-4">
                        {/* Thumbnail */}
                        {doc.mimeType.startsWith('image/') ? (
                          <button
                            onClick={() => setFullscreenImage(doc.fileUrl)}
                            className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border bg-gray-50"
                          >
                            <AuthenticatedImage
                              api={api}
                              src={doc.fileUrl}
                              alt={doc.type}
                              fill
                              className="object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border bg-gray-50 text-2xl">
                            📄
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{friendlyDocType(doc.type)}</p>
                            {docStatusBadge(doc.status)}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {doc.fileName} • Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                          {doc.rejectionReason && (
                            <p className="mt-1 text-xs text-red-600">
                              Reason: {doc.rejectionReason}
                            </p>
                          )}
                          {doc.reviewedAt && (
                            <p className="mt-1 text-xs text-gray-500">
                              Reviewed {new Date(doc.reviewedAt).toLocaleString()}
                              {doc.reviewer
                                ? ` by ${doc.reviewer.firstName} ${doc.reviewer.lastName}`
                                : ''}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        {(doc.status === 'PENDING' || doc.status === 'UNDER_REVIEW') && (
                          <div className="flex flex-shrink-0 gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => void handleDocReview(doc.id, 'APPROVED')}
                              disabled={decisionControlsDisabled}
                            >
                              Approve
                            </Button>

                            <Dialog
                              open={documentReviewDialogId === doc.id}
                              onOpenChange={(open) => {
                                setDocumentReviewDialogId(open ? doc.id : null);
                                if (!open) setDocumentRejectionReason('');
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-200 text-red-600"
                                  disabled={decisionControlsDisabled}
                                >
                                  Reject
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reject {friendlyDocType(doc.type)}</DialogTitle>
                                  <DialogDescription>
                                    The rider will be notified and asked to re-upload.
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Reason for rejection..."
                                  value={documentRejectionReason}
                                  onChange={(e) => setDocumentRejectionReason(e.target.value)}
                                  rows={3}
                                />
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                  </DialogClose>
                                  <Button
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => void handleDocReview(doc.id, 'REJECTED')}
                                    disabled={
                                      decisionControlsDisabled ||
                                      documentRejectionReason.trim().length < 5
                                    }
                                  >
                                    Reject Document
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </div>

                      {/* Full-size view button */}
                      <div className="mt-2 flex gap-2">
                        {doc.mimeType.startsWith('image/') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => setFullscreenImage(doc.fileUrl)}
                          >
                            🔍 View Full Size
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => void handleOpenMedia(doc.fileUrl)}
                        >
                          ↗ Open in New Tab
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-gray-500">
                <History className="h-4 w-4" />
                Decision History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <p className="font-semibold">Decision history is unavailable.</p>
                  <p className="mt-1 text-xs">{historyError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => void retryDataRefresh()}
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    Retry history
                  </Button>
                </div>
              ) : history.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  No administrative decisions have been recorded for this Rider yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => {
                    const reason =
                      typeof entry.newData?.reason === 'string'
                        ? entry.newData.reason
                        : typeof entry.newData?.rejectionReason === 'string'
                          ? entry.newData.rejectionReason
                          : null;
                    return (
                      <div
                        key={entry.id}
                        className="flex gap-3 border-b pb-3 last:border-0 last:pb-0"
                      >
                        <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-100">
                          <Clock3 className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {friendlyDocType(entry.action.replace(/\./g, '_'))}
                            </p>
                            <span className="text-xs text-gray-400">
                              {new Date(entry.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {entry.entityType} ·{' '}
                            {entry.actor
                              ? `${entry.actor.firstName} ${entry.actor.lastName}`
                              : 'System or former administrator'}
                          </p>
                          {reason && (
                            <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                              {reason}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Fullscreen image viewer ── */}
      {fullscreenImage && (
        <Dialog open onOpenChange={() => setFullscreenImage(null)}>
          <DialogContent className="max-w-4xl p-0">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>Document Viewer</DialogTitle>
            </DialogHeader>
            <div className="relative aspect-[4/3] w-full">
              <AuthenticatedImage
                api={api}
                src={fullscreenImage}
                alt="Document full view"
                fill
                className="object-contain"
              />
            </div>
            <DialogFooter className="p-4 pt-0">
              <Button variant="outline" onClick={() => void handleOpenMedia(fullscreenImage)}>
                Open in New Tab
              </Button>
              <DialogClose asChild>
                <Button>Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
