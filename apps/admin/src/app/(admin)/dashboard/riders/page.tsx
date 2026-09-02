'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@riderguy/auth';
import { Badge, Button, Card, CardContent, Input, Spinner } from '@riderguy/ui';
import {
  AlertTriangle,
  Ban,
  Bike,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  FileCheck2,
  GraduationCap,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TicketCheck,
} from 'lucide-react';

type OperationsTab = 'queue' | 'all' | 'invitations';
type QueueName = 'PENDING' | 'ACTION_REQUIRED' | 'READY' | 'BLOCKED' | 'REJECTED' | 'ACTIVATED';

interface OperationsSummary {
  totalRiders: number;
  pendingCases: number;
  readyForActivation: number;
  rejectedCases: number;
  activatedRiders: number;
  unclassifiedChannels: number;
  evidenceQueues: {
    documents: number;
    vehicles: number;
    incompleteVehicleEvidence: number;
    training: number;
    assetFinancing: number;
  };
  activeInvitations: number;
  staleCases: number;
  generatedAt: string;
}

interface RiderCase {
  id: string;
  userId: string;
  onboardingStatus: string;
  riderChannel: 'GUEST' | 'IN_HOUSE' | null;
  requestedRiderChannel: 'GUEST' | 'IN_HOUSE' | null;
  applicationRejectionReason: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    status: string;
    phoneVerified: boolean;
    emailVerified: boolean;
    createdAt: string;
    lastLoginAt: string | null;
  };
  evidence: {
    requiredDocuments: number;
    approvedDocuments: number;
    pendingDocuments: number;
    registeredVehicles: number;
    approvedVehicles: number;
    reviewableVehicles: number;
    trainingCompleted: number;
    trainingVerified: number;
    trainingAwaitingVerification: number;
  };
  readiness: { ready: boolean; missing: string[] };
  nextAction: string;
  lastActivityAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Invitation {
  id: string;
  targetEmail: string | null;
  targetPhone: string | null;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string; email: string | null };
  consumedBy: { userId: string } | null;
}

interface IssuedInvitation {
  code: string;
  target: string;
  channel: 'email' | 'phone';
  expiresAt: string;
  deliveryStatus: 'SENT' | 'FAILED' | 'NOT_REQUESTED';
}

const queueOptions: Array<{ value: QueueName; label: string }> = [
  { value: 'PENDING', label: 'Open cases' },
  { value: 'ACTION_REQUIRED', label: 'Needs admin action' },
  { value: 'READY', label: 'Ready to activate' },
  { value: 'BLOCKED', label: 'Waiting on Rider' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ACTIVATED', label: 'Activated' },
];

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function ageLabel(value: string) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 1) return 'Updated recently';
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    ACTIVATED: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
    TRAINING_COMPLETE: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
    DOCUMENTS_APPROVED: 'bg-teal-100 text-teal-800 hover:bg-teal-100',
    DOCUMENTS_SUBMITTED: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    DOCUMENTS_UNDER_REVIEW: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    APPLICATION_REJECTED: 'bg-red-100 text-red-800 hover:bg-red-100',
    DOCUMENTS_REJECTED: 'bg-red-100 text-red-800 hover:bg-red-100',
  };
  return <Badge className={colors[status] ?? 'bg-gray-100 text-gray-700 hover:bg-gray-100'}>{formatStatus(status)}</Badge>;
}

function channelBadge(riderCase: RiderCase) {
  if (riderCase.riderChannel === 'IN_HOUSE') {
    return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">In-House</Badge>;
  }
  if (riderCase.riderChannel === 'GUEST') {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Guest</Badge>;
  }
  return (
    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
      {riderCase.requestedRiderChannel === 'IN_HOUSE' ? 'Invite needed' : 'Unclassified'}
    </Badge>
  );
}

function invitationState(invitation: Invitation) {
  if (invitation.usedAt) return { label: 'Used', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' };
  if (invitation.revokedAt) return { label: 'Revoked', className: 'bg-red-100 text-red-800 hover:bg-red-100' };
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    return { label: 'Expired', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' };
  }
  return { label: 'Active', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' };
}

export default function RiderOperationsPage() {
  const router = useRouter();
  const api = useMemo(() => getApiClient(), []);
  const [tab, setTab] = useState<OperationsTab>('queue');
  const [queue, setQueue] = useState<QueueName>('PENDING');
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [cases, setCases] = useState<RiderCase[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteType, setInviteType] = useState<'email' | 'phone'>('email');
  const [inviteTarget, setInviteTarget] = useState('');
  const [issuedInvitation, setIssuedInvitation] = useState<IssuedInvitation | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const [statusTarget, setStatusTarget] = useState<RiderCase | null>(null);
  const [newAccountStatus, setNewAccountStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fetchSummary = useCallback(async () => {
    const response = await api.get('/riders/admin/operations/summary');
    setSummary(response.data.data);
  }, [api]);

  const fetchCases = useCallback(async () => {
    const params = new URLSearchParams({
      queue: tab === 'all' ? 'ALL' : queue,
      page: String(page),
      limit: '20',
    });
    if (search) params.set('search', search);
    if (channel) params.set('channel', channel);
    if (status) params.set('status', status);
    const response = await api.get(`/riders/admin/operations/cases?${params.toString()}`);
    setCases(response.data.data);
    setPagination(response.data.pagination);
  }, [api, channel, page, queue, search, status, tab]);

  const fetchInvitations = useCallback(async () => {
    const response = await api.get('/riders/admin/operations/invitations');
    setInvitations(response.data.data);
  }, [api]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'invitations') await Promise.all([fetchSummary(), fetchInvitations()]);
      else await Promise.all([fetchSummary(), fetchCases()]);
    } catch {
      setError('The Rider Operations workspace could not be loaded. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [fetchCases, fetchInvitations, fetchSummary, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changeTab = (nextTab: OperationsTab) => {
    setTab(nextTab);
    setPage(1);
    setError('');
  };

  const createInvitation = async () => {
    const target = inviteTarget.trim();
    if (!target) return;
    setInviteLoading(true);
    setIssuedInvitation(null);
    setInviteFeedback('');
    setError('');
    try {
      const response = await api.post('/riders/invitations', { [inviteType]: target, expiresInDays: 7 });
      const deliveryKey = inviteType === 'email' ? 'email' : 'sms';
      setIssuedInvitation({
        code: response.data.data.code,
        target,
        channel: inviteType,
        expiresAt: response.data.data.expiresAt,
        deliveryStatus: response.data.data.delivery?.[deliveryKey] ?? 'FAILED',
      });
      setInviteTarget('');
      await Promise.all([fetchInvitations(), fetchSummary()]);
    } catch (invitationError: unknown) {
      const message = (invitationError as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setError(message ?? 'The invitation could not be issued.');
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInvitation = async (messageOnly = false) => {
    if (!issuedInvitation) return;
    const expiry = new Date(issuedInvitation.expiresAt).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' });
    const message = `Your RiderGuy In-House Rider invitation code is ${issuedInvitation.code}. Sign in with ${issuedInvitation.target}, open Rider onboarding, and enter the code. It expires on ${expiry} and can be used once.`;
    try {
      await navigator.clipboard.writeText(messageOnly ? message : issuedInvitation.code);
      setInviteFeedback(messageOnly ? 'Invitation message copied.' : 'Invitation code copied.');
    } catch {
      setInviteFeedback('Copy failed. Select the code below and copy it manually.');
    }
  };

  const revokeInvitation = async () => {
    if (!revokeTarget || revokeReason.trim().length < 5) return;
    setUpdating(true);
    setError('');
    try {
      await api.patch(`/riders/admin/operations/invitations/${revokeTarget.id}/revoke`, { reason: revokeReason.trim() });
      setRevokeTarget(null);
      setRevokeReason('');
      await Promise.all([fetchInvitations(), fetchSummary()]);
    } catch (revokeError: unknown) {
      const message = (revokeError as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setError(message ?? 'The invitation could not be revoked.');
    } finally {
      setUpdating(false);
    }
  };

  const updateAccountStatus = async () => {
    if (!statusTarget || !newAccountStatus) return;
    setUpdating(true);
    setError('');
    try {
      await api.patch(`/admin/users/${statusTarget.userId}/status`, {
        status: newAccountStatus,
        reason: statusReason.trim() || undefined,
      });
      setStatusTarget(null);
      setNewAccountStatus('');
      setStatusReason('');
      await Promise.all([fetchCases(), fetchSummary()]);
    } catch {
      setError('The Rider account status could not be updated.');
    } finally {
      setUpdating(false);
    }
  };

  const summaryCards = summary ? [
    { label: 'Open cases', value: summary.pendingCases, icon: ClipboardCheck, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Ready to activate', value: summary.readyForActivation, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Documents to review', value: summary.evidenceQueues.documents, icon: FileCheck2, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Vehicles to review', value: summary.evidenceQueues.vehicles, icon: Bike, tone: 'bg-purple-50 text-purple-700' },
    { label: 'Training to verify', value: summary.evidenceQueues.training, icon: GraduationCap, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Stale over 48 hours', value: summary.staleCases, icon: Clock3, tone: 'bg-red-50 text-red-700' },
  ] : [];

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.75rem] bg-[#07110D] px-6 py-6 text-white shadow-premium sm:px-7">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#73D2A5]">People &amp; welfare</p>
          <div className="mt-2 flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-[#40BE89]" /><h1 className="text-2xl font-bold tracking-[-0.03em]">Rider operations</h1></div>
          <p className="mt-2 max-w-2xl text-sm text-white/[0.58]">Verify evidence, control access, and activate riders from one auditable workspace.</p>
        </div>
        <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12] hover:text-white" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="rounded-2xl border-[#E3EEE9] shadow-sm"><CardContent className="p-4"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div><p className="text-2xl font-bold tracking-[-0.03em] text-[#07110D]">{value}</p><p className="text-xs text-[#6E7A73]">{label}</p></CardContent></Card>
          ))}
        </div>
      )}

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-[#E3EEE9] bg-white p-1.5 shadow-sm">
        {([
          ['queue', 'Review queue'],
          ['all', `All Riders${summary ? ` (${summary.totalRiders})` : ''}`],
          ['invitations', `In-House invitations${summary ? ` (${summary.activeInvitations})` : ''}`],
        ] as Array<[OperationsTab, string]>).map(([value, label]) => (
          <button key={value} type="button" onClick={() => changeTab(value)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === value ? 'bg-[#07110D] text-white shadow-sm' : 'text-[#69766F] hover:bg-[#F3FBF7] hover:text-[#07110D]'}`}>{label}</button>
        ))}
      </div>

      {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />{error}</div>}

      {tab !== 'invitations' && (
        <>
          {tab === 'queue' && (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {queueOptions.map((option) => <button key={option.value} type="button" onClick={() => { setQueue(option.value); setPage(1); }} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${queue === option.value ? 'border-[#079B61] bg-[#EAF8F1] text-[#067A4D]' : 'border-[#DCE7E1] bg-white text-[#69766F] hover:border-[#40BE89]'}`}>{option.label}</button>)}
            </div>
          )}

          <Card className="mb-4 rounded-2xl border-[#E3EEE9] shadow-sm"><CardContent className="flex flex-wrap gap-3 p-4">
            <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, phone, email, code, or plate" className="pl-9" /></div>
            <select value={channel} onChange={(event) => { setChannel(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">All channels</option><option value="GUEST">Guest</option><option value="IN_HOUSE">In-House</option><option value="UNCLASSIFIED">Unclassified</option></select>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">All onboarding statuses</option>{['REGISTERED', 'DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'DOCUMENTS_UNDER_REVIEW', 'DOCUMENTS_APPROVED', 'DOCUMENTS_REJECTED', 'TRAINING_PENDING', 'TRAINING_COMPLETE', 'APPLICATION_REJECTED', 'ACTIVATED'].map((value) => <option key={value} value={value}>{formatStatus(value)}</option>)}</select>
          </CardContent></Card>

          {loading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-brand-500" /></div> : cases.length === 0 ? (
            <Card><CardContent className="py-16 text-center"><CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-500" /><p className="font-semibold text-gray-800">This queue is clear</p><p className="mt-1 text-sm text-gray-500">No Rider cases match the selected filters.</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {cases.map((riderCase) => {
                const name = `${riderCase.user.firstName} ${riderCase.user.lastName}`;
                return (
                  <Card key={riderCase.id} className="overflow-hidden rounded-2xl border-[#E3EEE9] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9DDFC0] hover:shadow-float"><CardContent className="p-0">
                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(230px,1.1fr)_minmax(280px,1.2fr)_minmax(240px,1fr)_auto] lg:items-center">
                      <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{riderCase.user.firstName[0]}{riderCase.user.lastName[0]}</div><div className="min-w-0"><p className="truncate font-semibold text-gray-950">{name}</p><p className="truncate text-xs text-gray-500">{riderCase.user.phone}{riderCase.user.email ? ` · ${riderCase.user.email}` : ''}</p><div className="mt-1 flex flex-wrap gap-1.5">{channelBadge(riderCase)}{statusBadge(riderCase.onboardingStatus)}</div></div></div>
                      <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Evidence</p><div className="grid grid-cols-3 gap-2 text-xs"><div className="rounded-lg bg-gray-50 p-2"><FileCheck2 className="mb-1 h-4 w-4 text-blue-600" /><span className="font-bold text-gray-900">{riderCase.evidence.approvedDocuments}/{riderCase.evidence.requiredDocuments}</span><p className="text-gray-500">Documents</p></div><div className="rounded-lg bg-gray-50 p-2"><Bike className="mb-1 h-4 w-4 text-purple-600" /><span className="font-bold text-gray-900">{riderCase.evidence.approvedVehicles}/{riderCase.evidence.registeredVehicles}</span><p className="text-gray-500">Vehicles</p></div><div className="rounded-lg bg-gray-50 p-2"><GraduationCap className="mb-1 h-4 w-4 text-indigo-600" /><span className="font-bold text-gray-900">{riderCase.evidence.trainingVerified}/{riderCase.riderChannel === 'IN_HOUSE' ? 3 : 0}</span><p className="text-gray-500">Training</p></div></div></div>
                      <div><p className={`text-sm font-semibold ${riderCase.readiness.ready ? 'text-emerald-700' : 'text-gray-900'}`}>{riderCase.nextAction}</p><p className="mt-1 text-xs text-gray-500">{ageLabel(riderCase.lastActivityAt)}</p>{!riderCase.readiness.ready && riderCase.readiness.missing.length > 0 && <p className="mt-1 line-clamp-2 text-xs text-amber-700">{riderCase.readiness.missing.slice(0, 2).join(' · ')}</p>}</div>
                      <div className="flex gap-2 lg:flex-col"><Button size="sm" onClick={() => router.push(`/dashboard/riders/${riderCase.userId}/review`)}>Open case</Button>{tab === 'all' && <Button size="sm" variant="outline" onClick={() => setStatusTarget(riderCase)}>Account status</Button>}</div>
                    </div>
                  </CardContent></Card>
                );
              })}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && <div className="mt-5 flex items-center justify-between"><p className="text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} cases</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>}
        </>
      )}

      {tab === 'invitations' && (
        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <Card className="rounded-2xl border-[#E3EEE9] shadow-sm"><CardContent className="p-5"><div className="mb-4 flex items-center gap-2"><TicketCheck className="h-5 w-5 text-[#079B61]" /><h2 className="font-bold text-[#07110D]">Issue In-House invitation</h2></div><p className="mb-4 text-sm text-[#6E7A73]">Codes are targeted, single-use, expire after seven days, and are only displayed once.</p><div className="space-y-3"><select value={inviteType} onChange={(event) => setInviteType(event.target.value as 'email' | 'phone')} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="email">Send by email</option><option value="phone">Send by SMS</option></select><Input value={inviteTarget} onChange={(event) => setInviteTarget(event.target.value)} placeholder={inviteType === 'email' ? 'rider@example.com' : '+233...'} /><Button className="w-full" disabled={!inviteTarget.trim() || inviteLoading} onClick={() => void createInvitation()}><Send className="mr-2 h-4 w-4" />{inviteLoading ? 'Issuing…' : 'Issue secure invitation'}</Button></div>
            {issuedInvitation && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-800">{issuedInvitation.deliveryStatus === 'SENT' ? `Sent to ${issuedInvitation.target}.` : `Automatic delivery failed. Send this code securely to ${issuedInvitation.target}.`}</p><code className="my-2 block select-all break-all text-base font-bold tracking-wide text-emerald-950">{issuedInvitation.code}</code><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void copyInvitation(false)}><Copy className="mr-1 h-3.5 w-3.5" />Code</Button><Button size="sm" variant="outline" onClick={() => void copyInvitation(true)}><Copy className="mr-1 h-3.5 w-3.5" />Message</Button></div><p className="mt-2 text-xs text-emerald-800">Store or send it now. Plaintext is never saved.</p>{inviteFeedback && <p className="mt-1 text-xs font-bold text-emerald-900">{inviteFeedback}</p>}</div>}
          </CardContent></Card>
          <Card className="rounded-2xl border-[#E3EEE9] shadow-sm"><CardContent className="p-0"><div className="border-b px-5 py-4"><h2 className="font-bold text-[#07110D]">Invitation register</h2><p className="text-xs text-[#6E7A73]">Latest 100 invitations with issuer and lifecycle state.</p></div>{loading ? <div className="flex justify-center py-16"><Spinner className="h-7 w-7 text-brand-500" /></div> : invitations.length === 0 ? <p className="py-16 text-center text-sm text-gray-500">No invitations have been issued.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#F7FAF8] text-left text-xs font-semibold uppercase tracking-wide text-[#65736B]"><tr><th className="px-4 py-3">Target</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Issued by</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3 text-right">Control</th></tr></thead><tbody className="divide-y">{invitations.map((invitation) => { const state = invitationState(invitation); const canRevoke = state.label === 'Active'; return <tr key={invitation.id} className="hover:bg-[#F7FAF8]"><td className="px-4 py-3"><p className="font-medium text-gray-900">{invitation.targetEmail ?? invitation.targetPhone}</p><p className="text-xs text-gray-400">{new Date(invitation.createdAt).toLocaleString()}</p></td><td className="px-4 py-3"><Badge className={state.className}>{state.label}</Badge>{invitation.consumedBy && <p className="mt-1 text-xs text-gray-400">Linked to Rider</p>}</td><td className="px-4 py-3 text-gray-600">{invitation.createdBy.firstName} {invitation.createdBy.lastName}</td><td className="px-4 py-3 text-gray-600">{new Date(invitation.expiresAt).toLocaleDateString()}</td><td className="px-4 py-3 text-right"><Button size="sm" variant="outline" disabled={!canRevoke} onClick={() => setRevokeTarget(invitation)}><Ban className="mr-1 h-3.5 w-3.5" />Revoke</Button></td></tr>; })}</tbody></table></div>}</CardContent></Card>
        </div>
      )}

      {revokeTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h3 className="text-lg font-bold text-gray-950">Revoke invitation</h3><p className="mt-1 text-sm text-gray-500">This immediately prevents the unused code for {revokeTarget.targetEmail ?? revokeTarget.targetPhone} from being redeemed.</p><textarea value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} rows={3} placeholder="Reason for revocation" className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => { setRevokeTarget(null); setRevokeReason(''); }}>Cancel</Button><Button className="bg-red-600 hover:bg-red-700" disabled={revokeReason.trim().length < 5 || updating} onClick={() => void revokeInvitation()}>{updating ? 'Revoking…' : 'Revoke code'}</Button></div></div></div>}

      {statusTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h3 className="text-lg font-bold text-gray-950">Account access</h3><p className="mt-1 text-sm text-gray-500">Update access for <strong>{statusTarget.user.firstName} {statusTarget.user.lastName}</strong>. Current status: {formatStatus(statusTarget.user.status)}.</p><select value={newAccountStatus} onChange={(event) => setNewAccountStatus(event.target.value)} className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">Choose status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DEACTIVATED">Deactivated</option><option value="BANNED">Banned</option></select><textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} rows={3} placeholder="Operational reason" className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setStatusTarget(null)}>Cancel</Button><Button disabled={!newAccountStatus || updating} onClick={() => void updateAccountStatus()}>{updating ? 'Updating…' : 'Apply status'}</Button></div></div></div>}
    </div>
  );
}
