'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getApiClient } from '@riderguy/auth';
import {
  Activity,
  ArrowRight,
  Banknote,
  Bike,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  GraduationCap,
  MapPinned,
  Navigation,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  HeartHandshake,
  MessageSquareWarning,
} from 'lucide-react';

interface DashboardStats {
  riders: { total: number; active: number; online: number; pendingApplications: number };
  clients: { total: number };
  orders: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
    activeDeliveries: number;
    deliveredToday: number;
  };
  revenue: { today: number; thisMonth: number; total: number };
  pendingWithdrawals: number;
  activeZones: number;
}

interface OperationsSummary {
  pendingCases: number;
  readyForActivation: number;
  staleCases: number;
  evidenceQueues: {
    documents: number;
    vehicles: number;
    training: number;
    assetFinancing: number;
  };
}

interface RiderExperienceSummary {
  community: {
    pendingReports: number;
    pendingMentorships: number;
    activeMentorships: number;
    upcomingEvents: number;
  };
  welfare: { openInvestigations: number; pendingAppeals: number };
  communications: { publishedAnnouncements: number };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(value: Date | null): string {
  if (!value) return 'Not refreshed yet';
  return new Intl.DateTimeFormat('en-GH', { hour: '2-digit', minute: '2-digit' }).format(value);
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [operations, setOperations] = useState<OperationsSummary | null>(null);
  const [riderExperience, setRiderExperience] = useState<RiderExperienceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [partialFailures, setPartialFailures] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    const api = getApiClient();
    const [dashboardResult, operationsResult, riderExperienceResult] = await Promise.allSettled([
      api.get('/admin/dashboard-stats'),
      api.get('/riders/admin/operations/summary'),
      api.get('/admin/rider-experience/summary'),
    ]);

    if (dashboardResult.status === 'fulfilled') {
      setStats(dashboardResult.value.data.data);
      setError('');
      setLastUpdated(new Date());
    } else {
      setError('The command centre could not reach the RiderGuy API. Retry to restore live data.');
    }

    const failedSupportingFeeds: string[] = [];
    if (operationsResult.status === 'fulfilled') {
      setOperations(operationsResult.value.data.data);
    } else {
      failedSupportingFeeds.push('rider operations');
    }
    if (riderExperienceResult.status === 'fulfilled') {
      setRiderExperience(riderExperienceResult.value.data.data);
    } else {
      failedSupportingFeeds.push('rider experience');
    }
    setPartialFailures(failedSupportingFeeds);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchDashboard();
    const interval = window.setInterval((): void => {
      void fetchDashboard(true);
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [fetchDashboard]);

  const priorities = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: 'Rider applications',
        detail: operations
          ? `${operations.readyForActivation} ready to activate · ${operations.staleCases} waiting over 48 hours`
          : 'Application count is live; activation-readiness details are unavailable',
        count: operations?.pendingCases ?? stats.riders.pendingApplications,
        href: '/dashboard/riders',
        icon: ShieldCheck,
        tone: 'bg-amber-50 text-amber-700',
      },
      {
        label: 'Document verification',
        detail: 'Identity and compliance evidence awaiting a decision',
        count: operations ? operations.evidenceQueues.documents : null,
        href: '/dashboard/riders',
        icon: FileCheck2,
        tone: 'bg-sky-50 text-sky-700',
      },
      {
        label: 'Asset financing',
        detail: '12-month bike and EV lease applications to assess',
        count: operations ? operations.evidenceQueues.assetFinancing : null,
        href: '/dashboard/asset-financing',
        icon: Bike,
        tone: 'bg-violet-50 text-violet-700',
      },
      {
        label: 'Rider welfare',
        detail: 'Safety investigations and Rider appeals awaiting a fair decision',
        count: riderExperience
          ? riderExperience.welfare.openInvestigations + riderExperience.welfare.pendingAppeals
          : null,
        href: '/dashboard/rider-experience',
        icon: HeartHandshake,
        tone: 'bg-red-50 text-red-700',
      },
      {
        label: 'Community moderation',
        detail: 'Reported content and mentorship requests needing oversight',
        count: riderExperience
          ? riderExperience.community.pendingReports + riderExperience.community.pendingMentorships
          : null,
        href: '/dashboard/rider-experience',
        icon: MessageSquareWarning,
        tone: 'bg-orange-50 text-orange-700',
      },
      {
        label: 'Withdrawal approvals',
        detail: 'Rider payouts waiting for financial review',
        count: stats.pendingWithdrawals,
        href: '/dashboard/financials',
        icon: Banknote,
        tone: 'bg-emerald-50 text-emerald-700',
      },
    ];
  }, [operations, riderExperience, stats]);

  if (loading) {
    return (
      <div className="grid min-h-[62vh] place-items-center">
        <div className="text-center">
          <div className="shadow-premium mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#40BE89]">
            <RefreshCw className="h-6 w-6 animate-spin text-[#050505]" />
          </div>
          <p className="mt-4 text-sm font-semibold text-[#47564E]">Opening the command centre…</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="admin-panel mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600">
          <Activity className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-[#07110D]">Live operations are unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-[#68766F]">{error}</p>
        <button
          type="button"
          onClick={() => void fetchDashboard()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#087B50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#086342]"
        >
          <RefreshCw className="h-4 w-4" />
          Retry connection
        </button>
      </div>
    );
  }

  const onlineRate =
    stats.riders.active > 0 ? Math.round((stats.riders.online / stats.riders.active) * 100) : 0;

  const kpis = [
    {
      label: 'Riders online',
      value: stats.riders.online.toLocaleString(),
      detail: `${onlineRate}% of activated network`,
      icon: Bike,
      accent: 'bg-[#EAF8F1] text-[#079B61]',
    },
    {
      label: 'Orders today',
      value: stats.orders.today.toLocaleString(),
      detail: `${stats.orders.deliveredToday} delivered today`,
      icon: PackageCheck,
      accent: 'bg-[#EEF4FF] text-[#3569D4]',
    },
    {
      label: 'Revenue today',
      value: formatCurrency(stats.revenue.today),
      detail: `${formatCurrency(stats.revenue.thisMonth)} this month`,
      icon: CircleDollarSign,
      accent: 'bg-[#FFF5DF] text-[#B77912]',
    },
    {
      label: 'Live deliveries',
      value: stats.orders.activeDeliveries.toLocaleString(),
      detail: 'Currently moving across Ghana',
      icon: Navigation,
      accent: 'bg-[#F4EDFF] text-[#7B4CC9]',
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="shadow-premium relative overflow-hidden rounded-[2rem] bg-[#40BE89] px-6 py-7 text-[#050505] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-20 h-32 w-64 rounded-full bg-[#079B61]/20 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#075C3D]/15 bg-white/35 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#075C3D]">
              <Sparkles className="h-3.5 w-3.5" />
              Ghana operations
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              RiderGuy command centre
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#0B3D2B]/75 sm:text-base">
              One live view of rider welfare, delivery movement, approvals, and the decisions that
              keep the network running.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#075C3D]/15 bg-white/35 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#075C3D]/65">
                Last sync
              </p>
              <p className="mt-1 text-sm font-semibold text-[#050505]">{formatTime(lastUpdated)}</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchDashboard(true)}
              disabled={refreshing}
              aria-label="Refresh live dashboard data"
              className="grid h-[58px] w-[58px] place-items-center rounded-2xl bg-white text-[#079B61] shadow-sm transition hover:bg-[#F4FBF7] disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{error} Showing the most recently available figures.</span>
          <button
            type="button"
            onClick={() => void fetchDashboard(true)}
            className="shrink-0 font-bold underline"
          >
            Retry
          </button>
        </div>
      )}

      {partialFailures.length > 0 && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <span>
            Some supporting data could not be refreshed: {partialFailures.join(' and ')}. Previously
            loaded figures may be stale; missing values are marked unavailable.
          </span>
          <button
            type="button"
            onClick={() => void fetchDashboard(true)}
            className="shrink-0 font-bold underline"
          >
            Retry
          </button>
        </div>
      )}

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Key performance indicators"
      >
        {kpis.map(({ label, value, detail, icon: Icon, accent }) => (
          <article
            key={label}
            className="admin-panel hover:shadow-float group p-5 transition duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#52625A]">{label}</p>
                <p className="mt-3 text-2xl font-bold tracking-[-0.03em] text-[#07110D]">{value}</p>
              </div>
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${accent}`}>
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </div>
            </div>
            <p className="mt-4 border-t border-[#E8EFEB] pt-3 text-xs text-[#52625A]">{detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="admin-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E8EFEB] px-5 py-5 sm:px-6">
            <div>
              <p className="admin-kicker">Decision queue</p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#07110D]">
                What needs attention
              </h2>
            </div>
            <Link
              href="/dashboard/riders"
              className="hidden items-center gap-1.5 text-xs font-bold text-[#079B61] sm:inline-flex"
            >
              Open operations <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[#EDF2EF]">
            {priorities.map(({ label, detail, count, href, icon: Icon, tone }) => (
              <Link
                key={label}
                href={href}
                className="group flex items-center gap-4 px-5 py-4 transition hover:bg-[#F7FAF8] sm:px-6"
              >
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-[#142019]">{label}</h3>
                    {count === null ? (
                      <span className="rounded-full bg-[#EEF2F0] px-2 py-0.5 text-[10px] font-bold text-[#68766F]">
                        Unavailable
                      </span>
                    ) : count > 0 ? (
                      <span className="rounded-full bg-[#087B50] px-2 py-0.5 text-[10px] font-bold text-white">
                        {count}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-[#52625A]">{detail}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#A6B0AA] transition group-hover:translate-x-0.5 group-hover:text-[#079B61]" />
              </Link>
            ))}
          </div>
        </div>

        <div className="shadow-premium overflow-hidden rounded-[1.75rem] bg-[#087B50] p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#DDF5E9]">
                Network pulse
              </p>
              <h2 className="mt-2 text-xl font-bold">Ghana at a glance</h2>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-white">
              <MapPinned className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Activated riders online</span>
                <span className="font-bold text-white">{onlineRate}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${Math.min(onlineRate, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PulseStat
                icon={UsersRound}
                label="Clients"
                value={stats.clients.total.toLocaleString()}
              />
              <PulseStat
                icon={MapPinned}
                label="Active zones"
                value={stats.activeZones.toLocaleString()}
              />
              <PulseStat
                icon={CheckCircle2}
                label="Active riders"
                value={stats.riders.active.toLocaleString()}
              />
              <PulseStat
                icon={Clock3}
                label="Orders this week"
                value={stats.orders.thisWeek.toLocaleString()}
              />
            </div>
          </div>

          <Link
            href="/dashboard/analytics"
            className="mt-6 flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/20"
          >
            Explore network analytics
            <ArrowRight className="h-4 w-4 text-white" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickLink
          href="/dashboard/riders"
          icon={GraduationCap}
          title="Training & certification"
          detail={
            operations
              ? `${operations.evidenceQueues.training} completions awaiting verification`
              : 'Training verification count unavailable'
          }
        />
        <QuickLink
          href="/dashboard/orders"
          icon={PackageCheck}
          title="Delivery control"
          detail={`${stats.orders.activeDeliveries} live · ${stats.orders.thisMonth} orders this month`}
        />
        <QuickLink
          href="/dashboard/financials"
          icon={CircleDollarSign}
          title="Financial health"
          detail={`${formatCurrency(stats.revenue.total)} recorded all-time revenue`}
        />
        <QuickLink
          href="/dashboard/rider-experience"
          icon={HeartHandshake}
          title="Rider experience"
          detail={
            riderExperience
              ? `${riderExperience.communications.publishedAnnouncements} broadcasts · ${riderExperience.community.upcomingEvents} upcoming events`
              : 'Broadcast and event counts unavailable'
          }
        />
      </section>
    </div>
  );
}

function PulseStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-3.5">
      <Icon className="h-4 w-4 text-white" />
      <p className="mt-3 text-lg font-bold tracking-[-0.02em]">{value}</p>
      <p className="mt-0.5 text-[11px] text-white/70">{label}</p>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="admin-panel hover:shadow-float group flex items-center gap-4 p-5 transition duration-200 hover:-translate-y-0.5"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EAF8F1] text-[#079B61]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-[#142019]">{title}</h3>
        <p className="mt-1 truncate text-xs text-[#52625A]">{detail}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-[#A6B0AA] transition group-hover:translate-x-0.5 group-hover:text-[#079B61]" />
    </Link>
  );
}
