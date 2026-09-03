'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Loader2,
  Megaphone,
  MessageSquareWarning,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { getApiClient } from '@riderguy/auth';

type TabId = 'overview' | 'broadcasts' | 'community' | 'welfare';

interface ExperienceSummary {
  generatedAt: string;
  communications: { publishedAnnouncements: number };
  community: {
    pendingReports: number;
    upcomingEvents: number;
    pendingMentorships: number;
    activeMentorships: number;
  };
  welfare: { openInvestigations: number; pendingAppeals: number };
  development: { trainingReviews: number; financingReviews: number };
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: number;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ContentReport {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  description?: string | null;
  status: string;
  createdAt: string;
  reporter?: { firstName?: string; lastName?: string } | null;
  reportedContent?: {
    author: { id: string; firstName: string; lastName: string };
    text: string;
    title?: string;
    mediaUrl?: string | null;
    isDeleted: boolean;
    createdAt: string;
    context?: { id: string; label: string; type?: string };
  } | null;
}

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  type: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  date: string;
  location?: string | null;
  virtualLink?: string | null;
  _count?: { rsvps: number };
}

interface RiderIdentity {
  user?: { firstName?: string; lastName?: string; email?: string };
  currentLevel?: number;
  totalDeliveries?: number;
}

interface Mentorship {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  mentor: RiderIdentity;
  mentee: RiderIdentity;
  zone?: { name: string } | null;
  _count?: { checkIns: number };
  createdAt: string;
}

interface Investigation {
  id: string;
  category: string;
  reason: string;
  severity: string;
  penaltyAmount: number | string;
  evidenceUrl?: string | null;
  createdAt: string;
  rider?: { user?: { firstName?: string; lastName?: string } };
  order?: { orderNumber?: string };
}

interface Appeal {
  id: string;
  status: string;
  riderStatement: string;
  evidenceUrls?: string[];
  createdAt: string;
  canRefundPenalty?: boolean;
  canLiftSuspension?: boolean;
  cancellation?: Investigation;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type PaginatedFeed = 'announcements' | 'reports' | 'events' | 'mentorships';

const FEED_PAGE_SIZE = 50;
const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  limit: FEED_PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

function mergeUniqueById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}

const tabs: Array<{ id: TabId; label: string; icon: typeof Sparkles }> = [
  { id: 'overview', label: 'Control view', icon: Sparkles },
  { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
  { id: 'community', label: 'Community', icon: UsersRound },
  { id: 'welfare', label: 'Welfare', icon: ShieldCheck },
];

function apiError(error: unknown): string {
  const candidate = error as {
    response?: { data?: { error?: { message?: string } | string; message?: string } };
    message?: string;
  };
  const responseError = candidate.response?.data?.error;
  if (typeof responseError === 'string') return responseError;
  return (
    responseError?.message ??
    candidate.response?.data?.message ??
    candidate.message ??
    'The action could not be completed.'
  );
}

function personName(person?: RiderIdentity | null): string {
  const fullName = [person?.user?.firstName, person?.user?.lastName].filter(Boolean).join(' ');
  return fullName || person?.user?.email || 'Unknown rider';
}

function dateTime(value?: string | null): string {
  if (!value) return 'Not scheduled';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function formatGhs(value?: number | string | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'GHS 0.00';
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(amount);
}

function safeExternalUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function compactName(person?: { firstName?: string; lastName?: string } | null): string {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Unknown rider';
}

function toIso(localValue: string): string {
  // Operations are Ghana-only and Ghana remains UTC year-round. Treat the
  // wall-clock value as Ghana time instead of the administrator device zone.
  const parsed = new Date(`${localValue}:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Choose a valid date and time.');
  return parsed.toISOString();
}

function statusTone(value: string): string {
  const normalized = value.toUpperCase();
  if (['ACTIVE', 'ONGOING', 'PUBLISHED', 'APPROVED', 'COMPLETED'].includes(normalized)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (['PENDING', 'UPCOMING', 'UNDER_REVIEW'].includes(normalized)) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (['CANCELLED', 'DECLINED', 'DENIED', 'ACTION_TAKEN'].includes(normalized)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function RiderExperiencePage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<ExperienceSummary | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [announcementPagination, setAnnouncementPagination] = useState<PaginationMeta>({
    ...EMPTY_PAGINATION,
  });
  const [reportPagination, setReportPagination] = useState<PaginationMeta>({
    ...EMPTY_PAGINATION,
  });
  const [eventPagination, setEventPagination] = useState<PaginationMeta>({ ...EMPTY_PAGINATION });
  const [mentorshipPagination, setMentorshipPagination] = useState<PaginationMeta>({
    ...EMPTY_PAGINATION,
  });
  const [loadingMore, setLoadingMore] = useState<PaginatedFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const busyRef = useRef('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    body: '',
    priority: '0',
    expiresAt: '',
    publishNow: true,
  });
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    type: 'IN_PERSON',
    date: '',
    location: '',
    virtualLink: '',
    capacity: '',
  });
  const [reportDecision, setReportDecision] = useState<ContentReport | null>(null);
  const [moderatorNote, setModeratorNote] = useState('');
  const [moderationAction, setModerationAction] = useState('');
  const [mentorshipDecision, setMentorshipDecision] = useState<Mentorship | null>(null);
  const [mentorshipStatus, setMentorshipStatus] = useState<'ACTIVE' | 'COMPLETED' | 'CANCELLED'>(
    'CANCELLED',
  );
  const [mentorshipNote, setMentorshipNote] = useState('');
  const [investigationDecision, setInvestigationDecision] = useState<Investigation | null>(null);
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [appealDecision, setAppealDecision] = useState<Appeal | null>(null);
  const [appealForm, setAppealForm] = useState({
    decision: 'DENIED',
    notes: '',
    refundPenalty: false,
    liftSuspension: false,
  });
  const [deleteAnnouncement, setDeleteAnnouncement] = useState<Announcement | null>(null);
  const [eventToCancel, setEventToCancel] = useState<CommunityEvent | null>(null);

  const loadData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const api = getApiClient();
      const requests = await Promise.allSettled([
        api.get('/admin/rider-experience/summary'),
        api.get('/community/announcements/admin', { params: { page: 1, limit: FEED_PAGE_SIZE } }),
        api.get('/community/reports/admin', {
          params: { status: 'PENDING', page: 1, limit: FEED_PAGE_SIZE },
        }),
        api.get('/events', {
          params: { scope: 'operational', page: 1, limit: FEED_PAGE_SIZE },
        }),
        api.get('/admin/rider-experience/mentorships', {
          params: { page: 1, limit: FEED_PAGE_SIZE },
        }),
        api.get('/admin/cancellations/investigations'),
        api.get('/admin/cancellations/appeals'),
      ]);

      const [
        summaryResult,
        announcementResult,
        reportResult,
        eventResult,
        mentorshipResult,
        investigationResult,
        appealResult,
      ] = requests;
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value.data.data);
      if (announcementResult.status === 'fulfilled') {
        setAnnouncements(announcementResult.value.data.data?.announcements ?? []);
        setAnnouncementPagination(
          announcementResult.value.data.data?.pagination ?? { ...EMPTY_PAGINATION },
        );
      }
      if (reportResult.status === 'fulfilled') {
        setReports(reportResult.value.data.data?.reports ?? []);
        setReportPagination(reportResult.value.data.data?.pagination ?? { ...EMPTY_PAGINATION });
      }
      if (eventResult.status === 'fulfilled') {
        const eventData = eventResult.value.data.data;
        setEvents(eventData?.events ?? []);
        setEventPagination({
          page: eventData?.page ?? 1,
          limit: FEED_PAGE_SIZE,
          total: eventData?.total ?? 0,
          totalPages: eventData?.totalPages ?? 0,
        });
      }
      if (mentorshipResult.status === 'fulfilled') {
        setMentorships(mentorshipResult.value.data.data ?? []);
        setMentorshipPagination(mentorshipResult.value.data.pagination ?? { ...EMPTY_PAGINATION });
      }
      if (investigationResult.status === 'fulfilled')
        setInvestigations(investigationResult.value.data.data ?? []);
      if (appealResult.status === 'fulfilled') setAppeals(appealResult.value.data.data ?? []);

      const failed = requests.filter((result) => result.status === 'rejected');
      if (failed.length > 0) {
        setError(
          `${failed.length} operational feed${failed.length === 1 ? '' : 's'} could not be refreshed. Available data is still shown.`,
        );
      }
      if (failed.length < requests.length) setLastUpdated(new Date());
    } catch (loadError) {
      setError(apiError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMoreFeed = async (feed: PaginatedFeed) => {
    if (loadingMore) return;

    const pagination = {
      announcements: announcementPagination,
      reports: reportPagination,
      events: eventPagination,
      mentorships: mentorshipPagination,
    }[feed];
    if (pagination.page >= pagination.totalPages) return;

    setLoadingMore(feed);
    setError('');
    try {
      const api = getApiClient();
      const page = pagination.page + 1;

      if (feed === 'announcements') {
        const { data } = await api.get('/community/announcements/admin', {
          params: { page, limit: FEED_PAGE_SIZE },
        });
        setAnnouncements((current) => mergeUniqueById(current, data.data?.announcements ?? []));
        setAnnouncementPagination(data.data?.pagination ?? pagination);
      } else if (feed === 'reports') {
        const { data } = await api.get('/community/reports/admin', {
          params: { status: 'PENDING', page, limit: FEED_PAGE_SIZE },
        });
        setReports((current) => mergeUniqueById(current, data.data?.reports ?? []));
        setReportPagination(data.data?.pagination ?? pagination);
      } else if (feed === 'events') {
        const { data } = await api.get('/events', {
          params: { scope: 'operational', page, limit: FEED_PAGE_SIZE },
        });
        const eventData = data.data;
        setEvents((current) => mergeUniqueById(current, eventData?.events ?? []));
        setEventPagination({
          page: eventData?.page ?? page,
          limit: FEED_PAGE_SIZE,
          total: eventData?.total ?? pagination.total,
          totalPages: eventData?.totalPages ?? pagination.totalPages,
        });
      } else {
        const { data } = await api.get('/admin/rider-experience/mentorships', {
          params: { page, limit: FEED_PAGE_SIZE },
        });
        setMentorships((current) => mergeUniqueById(current, data.data ?? []));
        setMentorshipPagination(data.pagination ?? pagination);
      }
    } catch (loadError) {
      setError(apiError(loadError));
    } finally {
      setLoadingMore(null);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const runMutation = async (key: string, action: () => Promise<unknown>, success: string) => {
    if (busyRef.current) return false;
    busyRef.current = key;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await loadData(true);
      return true;
    } catch (mutationError) {
      setError(apiError(mutationError));
      return false;
    } finally {
      if (busyRef.current === key) {
        busyRef.current = '';
        setBusy('');
      }
    }
  };

  const isBusy = busy.length > 0;
  const reportedSource = reportDecision?.reportedContent;
  const canModerateReportedContent = Boolean(
    reportedSource &&
    !reportedSource.isDeleted &&
    (reportedSource.text.trim() ||
      reportedSource.title?.trim() ||
      safeExternalUrl(reportedSource.mediaUrl)),
  );
  const hasOpenDecision = Boolean(
    deleteAnnouncement ||
    eventToCancel ||
    reportDecision ||
    mentorshipDecision ||
    investigationDecision ||
    appealDecision,
  );

  const totalAttention = useMemo(() => {
    if (!summary) return 0;
    return (
      summary.community.pendingReports +
      summary.community.pendingMentorships +
      summary.welfare.openInvestigations +
      summary.welfare.pendingAppeals +
      summary.development.trainingReviews +
      summary.development.financingReviews
    );
  }, [summary]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentTab: TabId) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex].id;
    setActiveTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`tab-${nextTab}`)?.focus());
  };

  const createAnnouncement = async () => {
    if (announcementForm.title.trim().length < 3 || announcementForm.body.trim().length < 10) {
      setError('Add a clear title and at least 10 characters of message text.');
      return;
    }
    if (
      announcementForm.expiresAt &&
      new Date(announcementForm.expiresAt).getTime() <= Date.now()
    ) {
      setError('Choose a broadcast expiry time in the future.');
      return;
    }
    const api = getApiClient();
    const completed = await runMutation(
      'announcement-create',
      () =>
        api.post('/community/announcements/admin', {
          title: announcementForm.title.trim(),
          body: announcementForm.body.trim(),
          priority: Number(announcementForm.priority),
          targetRoles: ['RIDER'],
          targetZones: [],
          isPublished: announcementForm.publishNow,
          ...(announcementForm.expiresAt ? { expiresAt: toIso(announcementForm.expiresAt) } : {}),
        }),
      announcementForm.publishNow
        ? 'Broadcast published to the Rider app.'
        : 'Broadcast saved as a draft.',
    );
    if (completed)
      setAnnouncementForm({ title: '', body: '', priority: '0', expiresAt: '', publishNow: true });
  };

  const toggleAnnouncement = async (announcement: Announcement) => {
    const api = getApiClient();
    await runMutation(
      `announcement-${announcement.id}`,
      () =>
        api.put(`/community/announcements/admin/${announcement.id}`, {
          isPublished: !announcement.isPublished,
        }),
      announcement.isPublished
        ? 'Broadcast unpublished.'
        : 'Broadcast is now live in the Rider app.',
    );
  };

  const confirmDeleteAnnouncement = async () => {
    if (!deleteAnnouncement) return;
    const api = getApiClient();
    const completed = await runMutation(
      `announcement-delete-${deleteAnnouncement.id}`,
      () => api.delete(`/community/announcements/admin/${deleteAnnouncement.id}`),
      'Broadcast deleted.',
    );
    if (completed) setDeleteAnnouncement(null);
  };

  const createEvent = async () => {
    if (
      eventForm.title.trim().length < 3 ||
      eventForm.description.trim().length < 10 ||
      !eventForm.date
    ) {
      setError('Add an event title, description, and future date.');
      return;
    }
    if (new Date(eventForm.date).getTime() <= Date.now()) {
      setError('Choose an event start time in the future.');
      return;
    }
    if (eventForm.type !== 'VIRTUAL' && !eventForm.location.trim()) {
      setError('Add the physical location for an in-person or hybrid event.');
      return;
    }
    if (eventForm.type !== 'IN_PERSON' && !eventForm.virtualLink.trim()) {
      setError('Add the joining link for a virtual or hybrid event.');
      return;
    }
    if (eventForm.capacity) {
      const capacity = Number(eventForm.capacity);
      if (!Number.isInteger(capacity) || capacity < 1) {
        setError('Capacity must be a whole number greater than zero.');
        return;
      }
    }
    const api = getApiClient();
    const completed = await runMutation(
      'event-create',
      () =>
        api.post('/events', {
          title: eventForm.title.trim(),
          description: eventForm.description.trim(),
          type: eventForm.type,
          date: toIso(eventForm.date),
          ...(eventForm.location.trim() ? { location: eventForm.location.trim() } : {}),
          ...(eventForm.virtualLink.trim() ? { virtualLink: eventForm.virtualLink.trim() } : {}),
          ...(eventForm.capacity ? { capacity: Number(eventForm.capacity) } : {}),
        }),
      'Community event created and visible to riders.',
    );
    if (completed)
      setEventForm({
        title: '',
        description: '',
        type: 'IN_PERSON',
        date: '',
        location: '',
        virtualLink: '',
        capacity: '',
      });
  };

  const changeEventStatus = async (event: CommunityEvent, status: CommunityEvent['status']) => {
    const api = getApiClient();
    return runMutation(
      `event-${event.id}`,
      () => api.patch(`/events/${event.id}`, { status }),
      `Event marked ${status.toLowerCase()}.`,
    );
  };

  const confirmEventCancellation = async () => {
    if (!eventToCancel) return;
    const completed = await changeEventStatus(eventToCancel, 'CANCELLED');
    if (completed) setEventToCancel(null);
  };

  const resolveReport = async (status: 'DISMISSED' | 'ACTION_TAKEN') => {
    if (!reportDecision) return;
    if (status === 'ACTION_TAKEN' && !moderationAction) {
      setError('Choose a moderation action before applying it.');
      return;
    }
    const api = getApiClient();
    const completed = await runMutation(
      `report-${reportDecision.id}-${status}`,
      () =>
        api.put(`/community/reports/admin/${reportDecision.id}`, {
          status,
          ...(moderatorNote.trim() ? { moderatorNote: moderatorNote.trim() } : {}),
          ...(status === 'ACTION_TAKEN' ? { actionTaken: moderationAction } : {}),
        }),
      status === 'DISMISSED'
        ? 'Report dismissed with a review record.'
        : 'Moderation action applied.',
    );
    if (completed) {
      setReportDecision(null);
      setModeratorNote('');
      setModerationAction('');
    }
  };

  const updateMentorship = async () => {
    if (!mentorshipDecision || mentorshipNote.trim().length < 5) {
      setError('Add a clear administrator note before changing this mentorship.');
      return;
    }
    const api = getApiClient();
    const completed = await runMutation(
      `mentorship-${mentorshipDecision?.id}`,
      () =>
        api.patch(`/admin/rider-experience/mentorships/${mentorshipDecision.id}/status`, {
          status: mentorshipStatus,
          note: mentorshipNote.trim(),
        }),
      'Mentorship updated and both riders notified.',
    );
    if (completed) {
      setMentorshipDecision(null);
      setMentorshipNote('');
    }
  };

  const closeInvestigation = async () => {
    if (!investigationDecision || investigationNotes.trim().length < 5) {
      setError('Record the investigation outcome before closing the case.');
      return;
    }
    const api = getApiClient();
    const completed = await runMutation(
      `investigation-${investigationDecision.id}`,
      () =>
        api.patch(`/admin/cancellations/${investigationDecision.id}/investigate`, {
          notes: investigationNotes.trim(),
        }),
      'Investigation closed with an audit note.',
    );
    if (completed) {
      setInvestigationDecision(null);
      setInvestigationNotes('');
    }
  };

  const reviewAppeal = async () => {
    if (!appealDecision || appealForm.notes.trim().length < 5) {
      setError('Add a clear rationale for the appeal decision.');
      return;
    }
    if (
      appealForm.decision === 'DENIED' &&
      (appealForm.refundPenalty || appealForm.liftSuspension)
    ) {
      setError('A denied appeal cannot refund a penalty or lift a suspension.');
      return;
    }
    const api = getApiClient();
    const completed = await runMutation(
      `appeal-${appealDecision.id}`,
      () => api.post(`/admin/cancellations/appeals/${appealDecision.id}/review`, appealForm),
      'Appeal decision recorded and applied.',
    );
    if (completed) {
      setAppealDecision(null);
      setAppealForm({ decision: 'DENIED', notes: '', refundPenalty: false, liftSuspension: false });
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[65vh] place-items-center" role="status">
        <div className="text-center">
          <div className="shadow-premium mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#40BE89] text-black">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <p className="mt-4 text-sm font-semibold text-[#47564E]">
            Connecting the Rider experience workbench…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="shadow-premium relative overflow-hidden rounded-[2rem] border border-[#CBEBDD] bg-white px-6 py-7 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-[#40BE89]" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#40BE89]/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#DDF5E9] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#075C3D]">
              <Radio className="h-3.5 w-3.5" />
              Rider app control layer
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-black sm:text-4xl">
              Rider experience
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#56645D] sm:text-base">
              Publish what riders see, protect their welfare, govern the community, and verify that
              every administrator decision reaches the mobile app.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-[#D7E8DF] bg-[#F7FAF8] px-4 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#47564E]">
                Attention queue
              </p>
              <p className="mt-1 text-xl font-extrabold text-black">{totalAttention}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing || isBusy}
              aria-busy={refreshing}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#087B50] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#076943] disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {lastUpdated ? `Synced ${dateTime(lastUpdated.toISOString())}` : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {(error || notice) && !hasOpenDecision && (
        <div
          role={error ? 'alert' : 'status'}
          aria-live={error ? 'assertive' : 'polite'}
          className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
        >
          <div className="flex items-start gap-2">
            {error ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{error || notice}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError('');
              setNotice('');
            }}
            aria-label="Dismiss message"
            className="grid min-h-9 min-w-9 place-items-center rounded-lg hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div
          className="inline-flex min-w-full gap-1 rounded-2xl border border-[#DCE9E2] bg-white p-1.5 shadow-sm sm:min-w-0"
          role="tablist"
          aria-label="Rider experience workspaces"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(event) => handleTabKeyDown(event, id)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition ${activeTab === id ? 'bg-[#40BE89] text-black shadow-sm' : 'text-[#65736C] hover:bg-[#F0F7F3] hover:text-black'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <section
          id="panel-overview"
          role="tabpanel"
          aria-labelledby="tab-overview"
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={Megaphone}
              label="Live broadcasts"
              value={
                summary?.communications.publishedAnnouncements ??
                announcements.filter((item) => item.isPublished).length
              }
              detail="Visible on Rider home"
              tone="mint"
            />
            <Metric
              icon={MessageSquareWarning}
              label="Moderation queue"
              value={summary?.community.pendingReports ?? reports.length}
              detail="Reports awaiting review"
              tone="amber"
            />
            <Metric
              icon={HeartHandshake}
              label="Welfare cases"
              value={
                (summary?.welfare.openInvestigations ?? investigations.length) +
                (summary?.welfare.pendingAppeals ?? appeals.length)
              }
              detail="Investigations and appeals"
              tone="red"
            />
            <Metric
              icon={Handshake}
              label="Active mentorships"
              value={
                summary?.community.activeMentorships ??
                mentorships.filter((item) => item.status === 'ACTIVE').length
              }
              detail={`${summary?.community.pendingMentorships ?? mentorships.filter((item) => item.status === 'PENDING').length} pending`}
              tone="blue"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
            <section className="admin-panel overflow-hidden">
              <div className="border-b border-[#E7EFEB] px-5 py-5 sm:px-6">
                <p className="admin-kicker">Cross-app operating model</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.025em] text-black">
                  One decision, one Rider outcome
                </h2>
              </div>
              <div className="grid gap-px bg-[#E7EFEB] md:grid-cols-2">
                <FlowItem
                  icon={Megaphone}
                  title="Broadcast control"
                  admin="Compose and publish"
                  rider="Home feed receives it"
                  onClick={() => setActiveTab('broadcasts')}
                />
                <FlowItem
                  icon={MessageSquareWarning}
                  title="Community trust"
                  admin="Review reports and events"
                  rider="Safer rider network"
                  onClick={() => setActiveTab('community')}
                />
                <FlowItem
                  icon={ShieldCheck}
                  title="Welfare decisions"
                  admin="Investigate and review"
                  rider="Outcome and protection"
                  onClick={() => setActiveTab('welfare')}
                />
                <FlowItem
                  icon={GraduationCap}
                  title="Development"
                  admin="Verify training and finance"
                  rider="Career and asset access"
                  href="/dashboard/riders"
                />
              </div>
            </section>

            <section className="shadow-premium rounded-[1.75rem] bg-[#087B50] p-6 text-white">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#D9F5E8]">
                Live operating promise
              </p>
              <h2 className="mt-2 text-xl font-extrabold">No orphaned admin actions</h2>
              <p className="mt-3 text-sm leading-6 text-white">
                Every control in this workspace uses an authenticated API and refreshes its
                Rider-facing state after completion.
              </p>
              <div className="mt-6 space-y-3">
                <PromiseRow label="Published notices" value="Rider home" />
                <PromiseRow label="Mentorship decisions" value="Inbox + push" />
                <PromiseRow label="Events" value="Community feed" />
                <PromiseRow label="Appeals" value="Penalty state" />
              </div>
            </section>
          </div>
        </section>
      )}

      {activeTab === 'broadcasts' && (
        <section
          id="panel-broadcasts"
          role="tabpanel"
          aria-labelledby="tab-broadcasts"
          className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"
        >
          <section className="admin-panel p-5 sm:p-6">
            <p className="admin-kicker">Rider communication</p>
            <h2 className="mt-1 text-xl font-extrabold text-black">Create a mobile broadcast</h2>
            <p className="mt-2 text-sm leading-6 text-[#47564E]">
              Published messages appear on the Rider dashboard. Use urgent only for immediate safety
              or service disruption.
            </p>
            <div className="mt-6 space-y-4">
              <Field label="Title" htmlFor="announcement-title">
                <input
                  id="announcement-title"
                  value={announcementForm.title}
                  onChange={(event) =>
                    setAnnouncementForm((current) => ({ ...current, title: event.target.value }))
                  }
                  maxLength={200}
                  className="admin-input"
                  placeholder="Rain safety advisory"
                />
              </Field>
              <Field label="Message" htmlFor="announcement-body">
                <textarea
                  id="announcement-body"
                  value={announcementForm.body}
                  onChange={(event) =>
                    setAnnouncementForm((current) => ({ ...current, body: event.target.value }))
                  }
                  maxLength={10000}
                  rows={5}
                  className="admin-input resize-y"
                  placeholder="Tell riders exactly what has changed and what to do next."
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Priority" htmlFor="announcement-priority">
                  <select
                    id="announcement-priority"
                    value={announcementForm.priority}
                    onChange={(event) =>
                      setAnnouncementForm((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                    className="admin-input"
                  >
                    <option value="0">Normal</option>
                    <option value="1">Important</option>
                    <option value="2">Urgent</option>
                  </select>
                </Field>
                <Field label="Expires (optional)" htmlFor="announcement-expiry">
                  <input
                    id="announcement-expiry"
                    type="datetime-local"
                    value={announcementForm.expiresAt}
                    onChange={(event) =>
                      setAnnouncementForm((current) => ({
                        ...current,
                        expiresAt: event.target.value,
                      }))
                    }
                    className="admin-input"
                  />
                </Field>
              </div>
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#DCE9E2] bg-[#F7FAF8] px-4 py-3">
                <span>
                  <span className="block text-sm font-bold text-black">Publish immediately</span>
                  <span className="mt-0.5 block text-xs text-[#47564E]">
                    Turn off to save a private draft.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={announcementForm.publishNow}
                  onChange={(event) =>
                    setAnnouncementForm((current) => ({
                      ...current,
                      publishNow: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-[#087B50]"
                />
              </label>
              <button
                type="button"
                onClick={() => void createAnnouncement()}
                disabled={isBusy}
                aria-busy={busy === 'announcement-create'}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087B50] px-5 text-sm font-extrabold text-white transition hover:bg-[#076943] disabled:cursor-wait disabled:opacity-60"
              >
                {busy === 'announcement-create' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {announcementForm.publishNow ? 'Publish to Rider app' : 'Save draft'}
              </button>
            </div>
          </section>

          <section className="admin-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E7EFEB] px-5 py-5 sm:px-6">
              <div>
                <p className="admin-kicker">Delivery history</p>
                <h2 className="mt-1 text-xl font-extrabold text-black">Broadcasts</h2>
              </div>
              <span className="rounded-full bg-[#DDF5E9] px-3 py-1 text-xs font-extrabold text-[#075C3D]">
                {Math.max(announcementPagination.total, announcements.length)}
              </span>
            </div>
            <div className="max-h-[720px] divide-y divide-[#EDF2EF] overflow-y-auto">
              {announcements.length === 0 ? (
                <EmptyState
                  icon={Megaphone}
                  title="No broadcasts yet"
                  detail="Create the first Rider update from the composer."
                />
              ) : (
                <>
                  {announcements.map((announcement) => (
                    <article key={announcement.id} className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusChip value={announcement.isPublished ? 'Published' : 'Draft'} />
                            {announcement.priority > 0 && (
                              <StatusChip
                                value={announcement.priority === 2 ? 'Urgent' : 'Important'}
                              />
                            )}
                          </div>
                          <h3 className="mt-3 text-base font-extrabold text-black">
                            {announcement.title}
                          </h3>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#66736D]">
                            {announcement.body}
                          </p>
                          <p className="mt-3 text-xs text-[#47564E]">
                            Created {dateTime(announcement.createdAt)}
                            {announcement.expiresAt
                              ? ` · expires ${dateTime(announcement.expiresAt)}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleAnnouncement(announcement)}
                          disabled={isBusy}
                          aria-busy={busy === `announcement-${announcement.id}`}
                          className="admin-secondary-button"
                        >
                          {busy === `announcement-${announcement.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : announcement.isPublished ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Radio className="h-4 w-4" />
                          )}
                          {announcement.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError('');
                            setNotice('');
                            setDeleteAnnouncement(announcement);
                          }}
                          disabled={isBusy}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-3.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </article>
                  ))}
                  <FeedPaginationFooter
                    loaded={announcements.length}
                    pagination={announcementPagination}
                    loading={loadingMore === 'announcements'}
                    onLoadMore={() => void loadMoreFeed('announcements')}
                  />
                </>
              )}
            </div>
          </section>
        </section>
      )}

      {activeTab === 'community' && (
        <section
          id="panel-community"
          role="tabpanel"
          aria-labelledby="tab-community"
          className="space-y-6"
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="admin-panel p-5 sm:p-6">
              <p className="admin-kicker">Community programming</p>
              <h2 className="mt-1 text-xl font-extrabold text-black">Create an event</h2>
              <div className="mt-5 space-y-4">
                <Field label="Event title" htmlFor="event-title">
                  <input
                    id="event-title"
                    value={eventForm.title}
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, title: event.target.value }))
                    }
                    className="admin-input"
                  />
                </Field>
                <Field label="Description" htmlFor="event-description">
                  <textarea
                    id="event-description"
                    value={eventForm.description}
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, description: event.target.value }))
                    }
                    rows={4}
                    className="admin-input resize-y"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Format" htmlFor="event-type">
                    <select
                      id="event-type"
                      value={eventForm.type}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, type: event.target.value }))
                      }
                      className="admin-input"
                    >
                      <option value="IN_PERSON">In person</option>
                      <option value="VIRTUAL">Virtual</option>
                      <option value="HYBRID">Hybrid</option>
                    </select>
                  </Field>
                  <Field label="Starts" htmlFor="event-date">
                    <input
                      id="event-date"
                      type="datetime-local"
                      value={eventForm.date}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, date: event.target.value }))
                      }
                      className="admin-input"
                    />
                  </Field>
                  <Field label="Location" htmlFor="event-location">
                    <input
                      id="event-location"
                      value={eventForm.location}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, location: event.target.value }))
                      }
                      className="admin-input"
                      placeholder="Takoradi Training Hub"
                    />
                  </Field>
                  <Field label="Virtual link" htmlFor="event-link">
                    <input
                      id="event-link"
                      type="url"
                      value={eventForm.virtualLink}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, virtualLink: event.target.value }))
                      }
                      className="admin-input"
                      placeholder="https://…"
                    />
                  </Field>
                </div>
                <Field label="Capacity (optional)" htmlFor="event-capacity">
                  <input
                    id="event-capacity"
                    type="number"
                    min="1"
                    value={eventForm.capacity}
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, capacity: event.target.value }))
                    }
                    className="admin-input"
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => void createEvent()}
                  disabled={isBusy}
                  aria-busy={busy === 'event-create'}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087B50] px-5 text-sm font-extrabold text-white hover:bg-[#076943] disabled:cursor-wait disabled:opacity-60"
                >
                  {busy === 'event-create' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarDays className="h-4 w-4" />
                  )}
                  Create Rider event
                </button>
              </div>
            </section>

            <section className="admin-panel overflow-hidden">
              <SectionHeader
                kicker="Mobile calendar"
                title="Active & upcoming events"
                count={Math.max(eventPagination.total, events.length)}
              />
              <div className="max-h-[660px] divide-y divide-[#EDF2EF] overflow-y-auto">
                {events.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="No active events scheduled"
                    detail="Create an upcoming event for the Rider community."
                  />
                ) : (
                  <>
                    {events.map((event) => (
                      <article key={event.id} className="p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusChip value={event.status} />
                          <StatusChip value={event.type.replace('_', ' ')} />
                        </div>
                        <h3 className="mt-3 font-extrabold text-black">{event.title}</h3>
                        <p className="mt-1 text-sm text-[#66736D]">
                          {dateTime(event.date)}
                          {event.location ? ` · ${event.location}` : ''}
                        </p>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#47564E]">
                          {event.description}
                        </p>
                        <p className="mt-3 text-xs font-bold text-[#087B50]">
                          {event._count?.rsvps ?? 0} Rider RSVPs
                        </p>
                        {event.status === 'UPCOMING' && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void changeEventStatus(event, 'ONGOING')}
                              disabled={isBusy}
                              aria-busy={busy === `event-${event.id}`}
                              className="admin-secondary-button"
                            >
                              {busy === `event-${event.id}` && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              Start event
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setError('');
                                setNotice('');
                                setEventToCancel(event);
                              }}
                              disabled={isBusy}
                              className="admin-danger-button"
                            >
                              Cancel event
                            </button>
                          </div>
                        )}
                        {event.status === 'ONGOING' && (
                          <button
                            type="button"
                            onClick={() => void changeEventStatus(event, 'COMPLETED')}
                            disabled={isBusy}
                            aria-busy={busy === `event-${event.id}`}
                            className="admin-secondary-button mt-4"
                          >
                            {busy === `event-${event.id}` && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            Mark completed
                          </button>
                        )}
                      </article>
                    ))}
                    <FeedPaginationFooter
                      loaded={events.length}
                      pagination={eventPagination}
                      loading={loadingMore === 'events'}
                      onLoadMore={() => void loadMoreFeed('events')}
                    />
                  </>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="admin-panel overflow-hidden">
              <SectionHeader
                kicker="Trust and safety"
                title="Reported content"
                count={Math.max(reportPagination.total, reports.length)}
              />
              <div className="divide-y divide-[#EDF2EF]">
                {reports.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Moderation queue is clear"
                    detail="New Rider reports will appear here."
                  />
                ) : (
                  <>
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => {
                          setError('');
                          setNotice('');
                          setReportDecision(report);
                        }}
                        disabled={isBusy}
                        className="flex min-h-24 w-full items-center gap-4 p-5 text-left transition hover:bg-[#F7FAF8] disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                          <MessageSquareWarning className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-extrabold text-black">
                              {report.reason.replaceAll('_', ' ')}
                            </p>
                            <StatusChip value={report.entityType.replace('_', ' ')} />
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#47564E]">
                            {report.reportedContent?.title ||
                              report.reportedContent?.text ||
                              'Source content is no longer available'}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[#47564E]">
                            Content by {compactName(report.reportedContent?.author)} · reported by{' '}
                            {compactName(report.reporter)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#526159]" />
                      </button>
                    ))}
                    <FeedPaginationFooter
                      loaded={reports.length}
                      pagination={reportPagination}
                      loading={loadingMore === 'reports'}
                      onLoadMore={() => void loadMoreFeed('reports')}
                    />
                  </>
                )}
              </div>
            </section>

            <section className="admin-panel overflow-hidden">
              <SectionHeader
                kicker="Career network"
                title="Mentorships"
                count={Math.max(mentorshipPagination.total, mentorships.length)}
              />
              <div className="max-h-[620px] divide-y divide-[#EDF2EF] overflow-y-auto">
                {mentorships.length === 0 ? (
                  <EmptyState
                    icon={Handshake}
                    title="No mentorships yet"
                    detail="Rider pairings will appear here."
                  />
                ) : (
                  <>
                    {mentorships.map((mentorship) => (
                      <button
                        key={mentorship.id}
                        type="button"
                        disabled={isBusy || ['COMPLETED', 'CANCELLED'].includes(mentorship.status)}
                        onClick={() => {
                          setError('');
                          setNotice('');
                          setMentorshipDecision(mentorship);
                          setMentorshipStatus(
                            mentorship.status === 'PENDING' ? 'ACTIVE' : 'COMPLETED',
                          );
                        }}
                        className="flex min-h-24 w-full items-center gap-4 p-5 text-left transition enabled:hover:bg-[#F7FAF8] disabled:cursor-default disabled:opacity-60 sm:px-6"
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#DDF5E9] text-[#087B50]">
                          <Handshake className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-extrabold text-black">
                              {personName(mentorship.mentor)} → {personName(mentorship.mentee)}
                            </p>
                            <StatusChip value={mentorship.status} />
                          </div>
                          <p className="mt-1 text-xs text-[#47564E]">
                            {mentorship.zone?.name || 'Network-wide'} ·{' '}
                            {mentorship._count?.checkIns ?? 0} check-ins
                          </p>
                        </div>
                        {!['COMPLETED', 'CANCELLED'].includes(mentorship.status) && (
                          <ChevronRight className="h-4 w-4 shrink-0 text-[#526159]" />
                        )}
                      </button>
                    ))}
                    <FeedPaginationFooter
                      loaded={mentorships.length}
                      pagination={mentorshipPagination}
                      loading={loadingMore === 'mentorships'}
                      onLoadMore={() => void loadMoreFeed('mentorships')}
                    />
                  </>
                )}
              </div>
            </section>
          </div>
        </section>
      )}

      {activeTab === 'welfare' && (
        <section
          id="panel-welfare"
          role="tabpanel"
          aria-labelledby="tab-welfare"
          className="grid gap-6 xl:grid-cols-2"
        >
          <section className="admin-panel overflow-hidden">
            <SectionHeader
              kicker="Safety operations"
              title="Cancellation investigations"
              count={investigations.length}
            />
            <div className="divide-y divide-[#EDF2EF]">
              {investigations.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No open investigations"
                  detail="Serious cancellation cases will appear here."
                />
              ) : (
                investigations.map((caseItem) => (
                  <button
                    key={caseItem.id}
                    type="button"
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setInvestigationDecision(caseItem);
                    }}
                    disabled={isBusy}
                    className="flex min-h-28 w-full items-center gap-4 p-5 text-left transition hover:bg-[#F7FAF8] disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-700">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold text-black">
                          Order #{caseItem.order?.orderNumber || 'Unknown'}
                        </p>
                        <StatusChip value={caseItem.severity} />
                      </div>
                      <p className="mt-1 text-xs text-[#47564E]">
                        {[caseItem.rider?.user?.firstName, caseItem.rider?.user?.lastName]
                          .filter(Boolean)
                          .join(' ') || 'Unknown rider'}{' '}
                        · {caseItem.category.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#66736D]">
                        {caseItem.reason}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#526159]" />
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="admin-panel overflow-hidden">
            <SectionHeader kicker="Fair review" title="Rider appeals" count={appeals.length} />
            <div className="divide-y divide-[#EDF2EF]">
              {appeals.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No pending appeals"
                  detail="Submitted Rider appeals will appear here."
                />
              ) : (
                appeals.map((appeal) => (
                  <button
                    key={appeal.id}
                    type="button"
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setAppealDecision(appeal);
                    }}
                    disabled={isBusy}
                    className="flex min-h-28 w-full items-center gap-4 p-5 text-left transition hover:bg-[#F7FAF8] disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold text-black">
                          Order #{appeal.cancellation?.order?.orderNumber || 'Unknown'}
                        </p>
                        <StatusChip value={appeal.status} />
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#66736D]">
                        {appeal.riderStatement}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#526159]" />
                  </button>
                ))
              )}
            </div>
          </section>
        </section>
      )}

      {eventToCancel && (
        <DecisionDialog
          title="Cancel this Rider event?"
          description="Riders will see this event as cancelled. This status change cannot be undone from this workspace."
          onClose={() => setEventToCancel(null)}
          busy={busy === `event-${eventToCancel.id}`}
          error={error}
        >
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-extrabold text-red-950">{eventToCancel.title}</p>
            <p className="mt-1 text-xs leading-5 text-red-800">
              {dateTime(eventToCancel.date)}
              {eventToCancel._count?.rsvps
                ? ` · ${eventToCancel._count.rsvps} confirmed Rider RSVPs`
                : ''}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setEventToCancel(null)}
              disabled={isBusy}
              data-dialog-initial-focus
              className="admin-secondary-button justify-center"
            >
              Keep event
            </button>
            <button
              type="button"
              onClick={() => void confirmEventCancellation()}
              disabled={isBusy}
              aria-busy={busy === `event-${eventToCancel.id}`}
              className="admin-danger-solid-button justify-center"
            >
              {busy === `event-${eventToCancel.id}` && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel event
            </button>
          </div>
        </DecisionDialog>
      )}

      {deleteAnnouncement && (
        <DecisionDialog
          title="Delete this broadcast?"
          description="This permanently removes the message from the administrator history and Rider app. This action cannot be undone."
          onClose={() => setDeleteAnnouncement(null)}
          busy={busy === `announcement-delete-${deleteAnnouncement.id}`}
          error={error}
        >
          <div className="rounded-xl bg-[#F7FAF8] p-4">
            <p className="text-sm font-extrabold text-black">{deleteAnnouncement.title}</p>
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#47564E]">
              {deleteAnnouncement.body}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDeleteAnnouncement(null)}
              disabled={isBusy}
              data-dialog-initial-focus
              className="admin-secondary-button justify-center"
            >
              Keep broadcast
            </button>
            <button
              type="button"
              onClick={() => void confirmDeleteAnnouncement()}
              disabled={isBusy}
              aria-busy={busy === `announcement-delete-${deleteAnnouncement.id}`}
              className="admin-danger-solid-button justify-center"
            >
              {busy === `announcement-delete-${deleteAnnouncement.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete permanently
            </button>
          </div>
        </DecisionDialog>
      )}

      {reportDecision && (
        <DecisionDialog
          title="Review reported content"
          description={`${reportDecision.reason.replaceAll('_', ' ')} · ${reportDecision.entityType.replace('_', ' ')}`}
          onClose={() => {
            setReportDecision(null);
            setModeratorNote('');
            setModerationAction('');
          }}
          busy={busy.startsWith(`report-${reportDecision.id}-`)}
          error={error}
        >
          {reportDecision.reportedContent ? (
            <div className="rounded-xl border border-[#CFE7DB] bg-[#F7FAF8] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#075C3D]">
                    Reported source content
                  </p>
                  <p className="mt-1 text-sm font-bold text-black">
                    Content by {compactName(reportDecision.reportedContent.author)}
                  </p>
                </div>
                <StatusChip
                  value={reportDecision.reportedContent.isDeleted ? 'ALREADY REMOVED' : 'AVAILABLE'}
                />
              </div>
              {reportDecision.reportedContent.context && (
                <p className="mt-3 text-xs font-semibold text-[#47564E]">
                  {reportDecision.reportedContent.context.type?.replaceAll('_', ' ') || 'Context'}:{' '}
                  {reportDecision.reportedContent.context.label}
                </p>
              )}
              {reportDecision.reportedContent.title && (
                <h3 className="mt-3 text-sm font-extrabold text-black">
                  {reportDecision.reportedContent.title}
                </h3>
              )}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#34433B]">
                {reportDecision.reportedContent.text || 'No text was attached to this content.'}
              </p>
              <p className="mt-3 text-xs font-semibold text-[#47564E]">
                Posted {dateTime(reportDecision.reportedContent.createdAt)}
              </p>
              {reportDecision.reportedContent.mediaUrl && (
                <EvidenceLinks
                  label="Content attachment"
                  urls={[reportDecision.reportedContent.mediaUrl]}
                />
              )}
            </div>
          ) : (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"
            >
              <p className="font-extrabold">Source content unavailable</p>
              <p className="mt-1">
                No moderation action can be applied from reporter prose alone. Dismiss this report
                or investigate the source outside this queue.
              </p>
            </div>
          )}
          <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p className="font-extrabold">Reporter statement</p>
            <p className="mt-1 text-xs font-semibold text-amber-900">
              Submitted by {compactName(reportDecision.reporter)}
            </p>
            <p className="mt-1">
              {reportDecision.description || 'The reporter did not add a description.'}
            </p>
          </div>
          <Field label="Moderator note" htmlFor="moderator-note">
            <textarea
              id="moderator-note"
              rows={4}
              value={moderatorNote}
              onChange={(event) => setModeratorNote(event.target.value)}
              className="admin-input resize-y"
            />
          </Field>
          <Field label="Action (required only when taking action)" htmlFor="moderation-action">
            <select
              id="moderation-action"
              value={moderationAction}
              disabled={!canModerateReportedContent}
              onChange={(event) => setModerationAction(event.target.value)}
              className="admin-input"
            >
              <option value="">Choose action</option>
              <option value="WARNING">Remove content + formal warning</option>
              {reportDecision.entityType === 'chat_message' && (
                <>
                  <option value="MUTE_1H">Remove + mute room for 1 hour</option>
                  <option value="MUTE_24H">Remove + mute room for 24 hours</option>
                  <option value="MUTE_7D">Remove + mute room for 7 days</option>
                </>
              )}
            </select>
          </Field>
          {canModerateReportedContent ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-950">
              Taking action removes the reported content. A warning is sent to its author; chat
              reports may also apply the selected room mute.
            </p>
          ) : (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-900">
              Applying an action is disabled because the source is missing or already removed.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void resolveReport('DISMISSED')}
              disabled={isBusy}
              data-dialog-initial-focus
              className="admin-secondary-button justify-center"
            >
              {busy === `report-${reportDecision.id}-DISMISSED` && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Dismiss report
            </button>
            <button
              type="button"
              onClick={() => void resolveReport('ACTION_TAKEN')}
              disabled={isBusy || !canModerateReportedContent}
              className="admin-primary-button justify-center"
            >
              {busy === `report-${reportDecision.id}-ACTION_TAKEN` && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Apply action
            </button>
          </div>
        </DecisionDialog>
      )}

      {mentorshipDecision && (
        <DecisionDialog
          title="Manage mentorship"
          description={`${personName(mentorshipDecision.mentor)} and ${personName(mentorshipDecision.mentee)}`}
          onClose={() => {
            setMentorshipDecision(null);
            setMentorshipNote('');
          }}
          busy={busy === `mentorship-${mentorshipDecision.id}`}
          error={error}
        >
          <Field label="New status" htmlFor="mentorship-status">
            <select
              id="mentorship-status"
              value={mentorshipStatus}
              onChange={(event) =>
                setMentorshipStatus(event.target.value as typeof mentorshipStatus)
              }
              className="admin-input"
            >
              {mentorshipDecision.status === 'PENDING' && <option value="ACTIVE">Activate</option>}
              {mentorshipDecision.status === 'ACTIVE' && (
                <option value="COMPLETED">Complete</option>
              )}
              <option value="CANCELLED">Cancel pairing</option>
            </select>
          </Field>
          <Field label="Administrator note" htmlFor="mentorship-note">
            <textarea
              id="mentorship-note"
              rows={4}
              value={mentorshipNote}
              onChange={(event) => setMentorshipNote(event.target.value)}
              className="admin-input resize-y"
              placeholder="Explain why this status is changing."
            />
          </Field>
          {mentorshipStatus === 'CANCELLED' && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-800">
              Cancelling ends this pairing and notifies both riders. It cannot be reactivated from
              this workspace.
            </p>
          )}
          <button
            type="button"
            onClick={() => void updateMentorship()}
            disabled={isBusy}
            aria-busy={busy === `mentorship-${mentorshipDecision.id}`}
            className={`${mentorshipStatus === 'CANCELLED' ? 'admin-danger-solid-button' : 'admin-primary-button'} w-full justify-center`}
          >
            {busy === `mentorship-${mentorshipDecision.id}` && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Save and notify riders
          </button>
        </DecisionDialog>
      )}

      {investigationDecision && (
        <DecisionDialog
          title="Close welfare investigation"
          description={`Order #${investigationDecision.order?.orderNumber || 'Unknown'} · ${investigationDecision.severity}`}
          onClose={() => {
            setInvestigationDecision(null);
            setInvestigationNotes('');
          }}
          busy={busy === `investigation-${investigationDecision.id}`}
          error={error}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <DecisionFact
              label="Severity"
              value={investigationDecision.severity.replaceAll('_', ' ')}
            />
            <DecisionFact label="Penalty" value={formatGhs(investigationDecision.penaltyAmount)} />
            <DecisionFact
              label="Category"
              value={investigationDecision.category.replaceAll('_', ' ')}
            />
          </div>
          <div className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-900">
            <p className="font-extrabold">Rider explanation</p>
            <p className="mt-1">{investigationDecision.reason}</p>
          </div>
          <EvidenceLinks
            label="Cancellation evidence"
            urls={investigationDecision.evidenceUrl ? [investigationDecision.evidenceUrl] : []}
          />
          <Field label="Investigation findings" htmlFor="investigation-notes">
            <textarea
              id="investigation-notes"
              rows={5}
              value={investigationNotes}
              onChange={(event) => setInvestigationNotes(event.target.value)}
              className="admin-input resize-y"
              placeholder="Evidence reviewed, finding, and follow-up required."
            />
          </Field>
          <button
            type="button"
            onClick={() => void closeInvestigation()}
            disabled={isBusy}
            aria-busy={busy === `investigation-${investigationDecision.id}`}
            className="admin-primary-button w-full justify-center"
          >
            {busy === `investigation-${investigationDecision.id}` && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Record findings and close
          </button>
        </DecisionDialog>
      )}

      {appealDecision && (
        <DecisionDialog
          title="Decide Rider appeal"
          description={`Order #${appealDecision.cancellation?.order?.orderNumber || 'Unknown'}`}
          onClose={() => {
            setAppealDecision(null);
            setAppealForm({
              decision: 'DENIED',
              notes: '',
              refundPenalty: false,
              liftSuspension: false,
            });
          }}
          busy={busy === `appeal-${appealDecision.id}`}
          error={error}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DecisionFact
              label="Cancellation severity"
              value={appealDecision.cancellation?.severity?.replaceAll('_', ' ') || 'Not recorded'}
            />
            <DecisionFact
              label="Cancellation penalty"
              value={formatGhs(appealDecision.cancellation?.penaltyAmount)}
            />
          </div>
          <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <p className="font-extrabold">Rider statement</p>
            <p className="mt-1">{appealDecision.riderStatement}</p>
          </div>
          <EvidenceLinks
            label="Appeal and cancellation evidence"
            urls={[
              ...(appealDecision.evidenceUrls ?? []),
              ...(appealDecision.cancellation?.evidenceUrl
                ? [appealDecision.cancellation.evidenceUrl]
                : []),
            ]}
          />
          <Field label="Decision" htmlFor="appeal-decision">
            <select
              id="appeal-decision"
              value={appealForm.decision}
              onChange={(event) =>
                setAppealForm((current) => ({
                  ...current,
                  decision: event.target.value,
                  ...(event.target.value === 'DENIED'
                    ? { refundPenalty: false, liftSuspension: false }
                    : {}),
                }))
              }
              className="admin-input"
            >
              <option value="DENIED">Deny</option>
              <option value="PARTIALLY_APPROVED">Partially approve</option>
              <option value="APPROVED">Approve</option>
            </select>
          </Field>
          <Field label="Decision rationale" htmlFor="appeal-notes">
            <textarea
              id="appeal-notes"
              rows={4}
              value={appealForm.notes}
              onChange={(event) =>
                setAppealForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="admin-input resize-y"
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle
              label={appealDecision.canRefundPenalty ? 'Refund penalty' : 'No penalty to refund'}
              checked={appealForm.refundPenalty}
              disabled={appealForm.decision === 'DENIED' || !appealDecision.canRefundPenalty}
              onChange={(checked) =>
                setAppealForm((current) => ({ ...current, refundPenalty: checked }))
              }
            />
            <Toggle
              label={appealDecision.canLiftSuspension ? 'Lift suspension' : 'No active suspension'}
              checked={appealForm.liftSuspension}
              disabled={appealForm.decision === 'DENIED' || !appealDecision.canLiftSuspension}
              onChange={(checked) =>
                setAppealForm((current) => ({ ...current, liftSuspension: checked }))
              }
            />
          </div>
          {appealForm.decision === 'DENIED' && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
              Denying keeps the current penalty and suspension state. The rider will be notified of
              this rationale.
            </p>
          )}
          <button
            type="button"
            onClick={() => void reviewAppeal()}
            disabled={isBusy}
            aria-busy={busy === `appeal-${appealDecision.id}`}
            className={`${appealForm.decision === 'DENIED' ? 'admin-danger-solid-button' : 'admin-primary-button'} w-full justify-center`}
          >
            {busy === `appeal-${appealDecision.id}` && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply appeal decision
          </button>
        </DecisionDialog>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  detail: string;
  tone: 'mint' | 'amber' | 'red' | 'blue';
}) {
  const tones = {
    mint: 'bg-[#DDF5E9] text-[#087B50]',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <article className="admin-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[#47564E]">{label}</p>
          <p className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-black">{value}</p>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-2xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 border-t border-[#E8EFEB] pt-3 text-xs text-[#47564E]">{detail}</p>
    </article>
  );
}

function FlowItem({
  icon: Icon,
  title,
  admin,
  rider,
  onClick,
  href,
}: {
  icon: typeof Sparkles;
  title: string;
  admin: string;
  rider: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#DDF5E9] text-[#087B50]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-extrabold text-black">{title}</h3>
        <p className="mt-2 flex items-center gap-2 text-xs text-[#47564E]">
          <span>{admin}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-[#087B50]" />
          <span>{rider}</span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-[#526159]" />
    </>
  );
  const className =
    'flex min-h-32 items-center gap-4 bg-white p-5 text-left transition hover:bg-[#F7FAF8] sm:p-6';
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function PromiseRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/15 bg-white/10 px-3.5 py-3">
      <span className="text-xs text-white">{label}</span>
      <span className="text-xs font-extrabold text-white">{value}</span>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-extrabold text-[#34433B]">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusChip({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${statusTone(value)}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}

function FeedPaginationFooter({
  loaded,
  pagination,
  loading,
  onLoadMore,
}: {
  loaded: number;
  pagination: PaginationMeta;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const total = Math.max(pagination.total, loaded);
  const hasMore = pagination.page < pagination.totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F8FBF9] px-5 py-4 sm:px-6">
      <p className="text-xs font-semibold text-[#47564E]">
        Showing {loaded.toLocaleString()} of {total.toLocaleString()}
      </p>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          aria-busy={loading}
          className="admin-secondary-button"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}

function SectionHeader({ kicker, title, count }: { kicker: string; title: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b border-[#E7EFEB] px-5 py-5 sm:px-6">
      <div>
        <p className="admin-kicker">{kicker}</p>
        <h2 className="mt-1 text-xl font-extrabold text-black">{title}</h2>
      </div>
      <span className="rounded-full bg-[#DDF5E9] px-3 py-1 text-xs font-extrabold text-[#075C3D]">
        {count}
      </span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Sparkles;
  title: string;
  detail: string;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#EEF7F2] text-[#087B50]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-extrabold text-black">{title}</h3>
      <p className="mt-1 text-xs text-[#47564E]">{detail}</p>
    </div>
  );
}

function DecisionFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#DCE9E2] bg-[#F7FAF8] p-3">
      <p className="text-xs font-bold text-[#47564E]">{label}</p>
      <p className="mt-1 text-sm font-extrabold capitalize text-black">{value}</p>
    </div>
  );
}

function EvidenceLinks({ label, urls }: { label: string; urls: string[] }) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  return (
    <section className="rounded-xl border border-[#DCE9E2] bg-white p-4" aria-label={label}>
      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#34433B]">{label}</p>
      {uniqueUrls.length === 0 ? (
        <p className="mt-2 text-sm text-[#47564E]">No evidence link was submitted.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {uniqueUrls.map((url, index) => {
            const safeUrl = safeExternalUrl(url);
            return safeUrl ? (
              <a
                key={`${url}-${index}`}
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-[#CFE7DB] bg-[#F0F8F4] px-3 py-2 text-sm font-bold text-[#075C3D] underline decoration-[#40BE89] underline-offset-4 hover:bg-[#E5F5ED]"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="break-all">{url}</span>
              </a>
            ) : (
              <div
                key={`${url}-${index}`}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              >
                This evidence URL uses an unsupported or invalid link format and was not made
                clickable.
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DecisionDialog({
  title,
  description,
  onClose,
  busy = false,
  error,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  busy?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyStateRef = useRef(busy);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    busyStateRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusableElements = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(
        (element) =>
          element.getAttribute('aria-hidden') !== 'true' && element.offsetParent !== null,
      );

    const animationFrame = requestAnimationFrame(() => {
      const preferred = dialogRef.current?.querySelector<HTMLElement>(
        '[data-dialog-initial-focus]',
      );
      (preferred ?? focusableElements()[0] ?? dialogRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!busyStateRef.current) {
          event.preventDefault();
          closeRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (
        event.shiftKey &&
        (activeElement === first || !dialogRef.current?.contains(activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      } else {
        document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-end bg-black/30 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-[#DCE9E2] bg-white p-5 shadow-2xl outline-none sm:max-w-lg sm:rounded-[1.75rem] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="admin-kicker">Administrator decision</p>
            <h2 id={titleId} className="mt-1 text-xl font-extrabold text-black">
              {title}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-[#47564E]">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={busy ? 'Decision is being saved' : 'Close decision dialog'}
            className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[#DCE9E2] text-[#526159] hover:bg-[#F2F7F4] disabled:cursor-wait disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-800"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {busy ? 'Saving this administrator decision. Please wait.' : ''}
        </span>
        <fieldset disabled={busy} className="mt-6 min-w-0 space-y-4 border-0 p-0">
          {children}
        </fieldset>
      </section>
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#DCE9E2] px-4 text-sm font-bold text-black ${disabled ? 'cursor-not-allowed bg-[#F3F5F4] opacity-50' : 'cursor-pointer bg-white'}`}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-[#087B50]"
      />
    </label>
  );
}
