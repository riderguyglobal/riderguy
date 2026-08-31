'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@riderguy/auth';
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
import { API_BASE_URL } from '@/lib/constants';

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
  }>;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    createdAt: string;
  };
  vehicles: VehicleData[];
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

// ─── Component ──────────────────────────────────────────────

export default function RiderReviewPage() {
  const router = useRouter();
  const params = useParams();
  const riderId = params.id as string;
  const { accessToken } = useAuth();

  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // ── Fetch rider data ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [profileRes, docsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/riders/profile/${riderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${API_BASE_URL}/documents/rider/${riderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        setProfile(profileJson.data);
      }

      if (docsRes.ok) {
        const docsJson = await docsRes.json();
        setDocuments(docsJson.data);
      }
    } catch {
      setError('Failed to load rider data.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, riderId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Review a document ─────────────────────────────────────
  const handleDocReview = useCallback(
    async (docId: string, status: 'APPROVED' | 'REJECTED') => {
      setActionLoading(true);
      try {
        const body: Record<string, string> = { status };
        if (status === 'REJECTED' && rejectionReason.trim()) {
          body.rejectionReason = rejectionReason.trim();
        }

        const res = await fetch(`${API_BASE_URL}/documents/${docId}/review`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error('Review failed');

        setRejectionReason('');
        await fetchData();
      } catch {
        setError('Failed to review document.');
      } finally {
        setActionLoading(false);
      }
    },
    [accessToken, rejectionReason, fetchData],
  );

  // ── Approve / Reject rider application ────────────────────
  const handleApplicationDecision = useCallback(
    async (decision: 'approve' | 'reject') => {
      setActionLoading(true);
      try {
        const body = decision === 'reject' ? { reason: rejectionReason.trim() || undefined } : {};

        const res = await fetch(`${API_BASE_URL}/riders/${riderId}/${decision}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const json = await res.json().catch((_error: unknown): null => null);
          const missing = json?.error?.details?.missing as string[] | undefined;
          throw new Error(missing?.length ? missing.join('; ') : json?.error?.message ?? 'Decision failed');
        }

        await fetchData();
      } catch (decisionError) {
        setError(decisionError instanceof Error ? decisionError.message : `Failed to ${decision} application.`);
      } finally {
        setActionLoading(false);
      }
    },
    [accessToken, riderId, rejectionReason, fetchData],
  );

  const verifyTraining = useCallback(async (moduleKey: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/riders/${riderId}/training/${moduleKey}/verify`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const json = await res.json().catch((_error: unknown): null => null);
        throw new Error(json?.error?.message ?? 'Training verification failed');
      }
      await fetchData();
    } catch (trainingError) {
      setError(trainingError instanceof Error ? trainingError.message : 'Training verification failed');
    } finally {
      setActionLoading(false);
    }
  }, [accessToken, fetchData, riderId]);

  const classifyLegacyChannel = useCallback(async (channel: 'GUEST' | 'IN_HOUSE') => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/riders/${riderId}/channel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) {
        const json = await res.json().catch((_error: unknown): null => null);
        throw new Error(json?.error?.message ?? 'Channel classification failed');
      }
      await fetchData();
    } catch (classificationError) {
      setError(classificationError instanceof Error
        ? classificationError.message
        : 'Channel classification failed');
    } finally {
      setActionLoading(false);
    }
  }, [accessToken, fetchData, riderId]);

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  return (
    <>
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard/riders')}
        className="mb-4 flex items-center gap-1 text-sm text-brand-500 hover:underline"
      >
        ← Back to Applications
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Rider Review
          {profile && ` — ${profile.user.firstName} ${profile.user.lastName}`}
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold">
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
                  <Badge variant="outline">
                    {profile.onboardingStatus.replace(/_/g, ' ')}
                  </Badge>
                </div>
                {!profile.riderChannel ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-2 text-xs text-amber-800">
                      Legacy Rider channel requires an explicit admin classification. This does not create training records.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => void classifyLegacyChannel('GUEST')}
                      >
                        Classify Guest
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => void classifyLegacyChannel('IN_HOUSE')}
                      >
                        Classify In-House
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Rider channel</span>
                  <Badge className={profile.riderChannel === 'IN_HOUSE'
                    ? 'bg-purple-100 text-purple-800 hover:bg-purple-100'
                    : profile.riderChannel === 'GUEST'
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
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

          {/* Vehicles */}
          {profile && profile.vehicles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Vehicles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.vehicles.map((v) => (
                  <div key={v.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {v.make} {v.model}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {v.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      Plate: {v.plateNumber}
                      {v.year && ` • ${v.year}`}
                      {v.color && ` • ${v.color}`}
                    </p>
                    {/* Vehicle photos thumbnails */}
                    <div className="mt-2 flex gap-1">
                      {[v.photoFrontUrl, v.photoBackUrl, v.photoLeftUrl, v.photoRightUrl]
                        .filter(Boolean)
                        .map((url, i) => (
                          <button
                            key={i}
                            onClick={() => setFullscreenImage(url!)}
                            className="relative h-12 w-12 overflow-hidden rounded border"
                          >
                            <Image
                              src={url!}
                              alt="Vehicle photo"
                              fill
                              className="object-cover"
                            />
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {profile?.riderChannel === 'IN_HOUSE' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">In-House Training Verification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {['SAFETY_BASICS', 'SERVICE_STANDARDS', 'DELIVERY_OPERATIONS'].map((moduleKey) => {
                  const completion = profile.trainingCompletions.find((item) => item.moduleKey === moduleKey);
                  return (
                    <div key={moduleKey} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{friendlyDocType(moduleKey)}</p>
                          <p className="text-xs text-gray-500">
                            {!completion ? 'Not completed' : completion.verifiedAt ? 'Admin verified' : 'Completed — verification required'}
                          </p>
                        </div>
                        {completion?.verifiedAt ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Verified</Badge>
                        ) : completion ? (
                          <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => void verifyTraining(moduleKey)}>
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
                  disabled={actionLoading || !profile.approvalReadiness.ready}
                >
                  ✅ Approve Application
                </Button>

                {!profile.approvalReadiness.ready ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">Approval is locked:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {profile.approvalReadiness.missing.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ) : null}

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
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
                        disabled={actionLoading || rejectionReason.trim().length < 5}
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
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-500">
                Documents ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex items-start gap-4">
                        {/* Thumbnail */}
                        {doc.mimeType.startsWith('image/') ? (
                          <button
                            onClick={() => setFullscreenImage(doc.fileUrl)}
                            className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border bg-gray-50"
                          >
                            <Image
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
                            <p className="font-medium text-gray-900">
                              {friendlyDocType(doc.type)}
                            </p>
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
                        </div>

                        {/* Actions */}
                        {doc.status === 'PENDING' && (
                          <div className="flex flex-shrink-0 gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => void handleDocReview(doc.id, 'APPROVED')}
                              disabled={actionLoading}
                            >
                              Approve
                            </Button>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-200"
                                >
                                  Reject
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    Reject {friendlyDocType(doc.type)}
                                  </DialogTitle>
                                  <DialogDescription>
                                    The rider will be notified and asked to re-upload.
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Reason for rejection..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  rows={3}
                                />
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                  </DialogClose>
                                  <Button
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => void handleDocReview(doc.id, 'REJECTED')}
                                    disabled={actionLoading}
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
                          onClick={() => window.open(doc.fileUrl, '_blank')}
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
              <Image
                src={fullscreenImage}
                alt="Document full view"
                fill
                className="object-contain"
              />
            </div>
            <DialogFooter className="p-4 pt-0">
              <Button
                variant="outline"
                onClick={() => window.open(fullscreenImage, '_blank')}
              >
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
