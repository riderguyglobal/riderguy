'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMentorship } from '@/hooks/use-mentorship';
import type { Mentor, MentorshipRecord } from '@/hooks/use-mentorship';
import {
  ArrowLeft,
  Users,
  Search,
  Star,
  ChevronRight,
  UserPlus,
  Award,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';

type Tab = 'my' | 'find';

export default function MentorshipPage() {
  const [tab, setTab] = useState<Tab>('my');

  return (
    <div className="min-h-[100dvh] bg-[#0a0e17]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <Link href="/dashboard/community" className="p-2 -ml-2 text-surface-400 hover:text-surface-200">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold text-white">Mentorship</h1>
            <div className="w-9" />
          </div>
          <div className="flex gap-1 pb-3">
            {[
              { id: 'my' as Tab, label: 'My Mentorships', icon: <Users className="h-4 w-4" /> },
              { id: 'find' as Tab, label: 'Find Mentor', icon: <Search className="h-4 w-4" /> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-brand-500/20 text-brand-400 shadow-[0_0_12px_rgba(14,165,233,0.15)]'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-white/[0.04]'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {tab === 'my' && <MyMentorshipsTab />}
        {tab === 'find' && <FindMentorTab />}
      </div>
    </div>
  );
}

// ────── My Mentorships ──────

function MyMentorshipsTab() {
  const { myMentorships, loading, fetchMyMentorships } = useMentorship();

  useEffect(() => {
    fetchMyMentorships();
  }, [fetchMyMentorships]);

  if (loading && myMentorships.asMentor.length === 0 && myMentorships.asMentee.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
        <p className="text-surface-400 text-sm mt-3">Loading...</p>
      </div>
    );
  }

  const hasMentorships = myMentorships.asMentor.length > 0 || myMentorships.asMentee.length > 0;

  if (!hasMentorships) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-brand-500" />
        </div>
        <h3 className="text-white font-semibold mb-1">No mentorships yet</h3>
        <p className="text-surface-400 text-sm max-w-[260px]">
          Find an experienced rider to guide you, or mentor newer riders
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {myMentorships.asMentee.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-brand-400" />
            My Mentors
          </h2>
          <div className="space-y-2">
            {myMentorships.asMentee.map((m) => (
              <MentorshipCard key={m.id} record={m} role="mentee" />
            ))}
          </div>
        </div>
      )}

      {myMentorships.asMentor.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-emerald-400" />
            My Mentees
          </h2>
          <div className="space-y-2">
            {myMentorships.asMentor.map((m) => (
              <MentorshipCard key={m.id} record={m} role="mentor" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MentorshipCard({ record, role }: { record: MentorshipRecord; role: 'mentor' | 'mentee' }) {
  const other = role === 'mentee' ? record.mentor : record.mentee;
  const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    PENDING: { icon: <Clock className="h-3.5 w-3.5" />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    ACTIVE: { icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    COMPLETED: { icon: <Star className="h-3.5 w-3.5" />, color: 'text-brand-400', bg: 'bg-brand-400/10' },
    CANCELLED: { icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-surface-500', bg: 'bg-surface-500/10' },
  };
  const s = (statusConfig[record.status] ?? statusConfig.PENDING)!;

  return (
    <Link
      href={`/dashboard/community/mentorship/${record.id}`}
      className="block p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
          {other?.user?.avatar ? (
            <img src={other.user.avatar} alt="" className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            <span className="text-brand-400 text-sm font-bold">
              {other?.user?.firstName?.charAt(0) || '?'}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm truncate">
              {other?.user?.firstName} {other?.user?.lastName}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${s.color} ${s.bg}`}>
              {s.icon}
              {record.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-surface-400">
            <span>Level {other?.currentLevel}</span>
            <span>•</span>
            <span>{other?.totalDeliveries} deliveries</span>
            {record._count && (
              <>
                <span>•</span>
                <span>{record._count.checkIns} check-ins</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
      </div>
    </Link>
  );
}

// ────── Find Mentor ──────

function FindMentorTab() {
  const { mentors, loading, pagination, searchMentors } = useMentorship();
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    searchMentors();
    setSearched(true);
  }, [searchMentors]);

  if (loading && !searched) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
        <p className="text-surface-400 text-sm mt-3">Finding mentors...</p>
      </div>
    );
  }

  if (searched && mentors.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-surface-500/10 flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-surface-500" />
        </div>
        <h3 className="text-white font-semibold mb-1">No mentors available</h3>
        <p className="text-surface-400 text-sm max-w-[260px]">
          Riders at Level 3+ can mentor. Check back later!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-white font-semibold mb-3">Available Mentors</h2>
      {mentors.map((m) => (
        <MentorCard key={m.id} mentor={m} />
      ))}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => searchMentors({ page: p })}
              className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                p === pagination.page
                  ? 'bg-brand-500 text-white'
                  : 'bg-white/[0.04] text-surface-400 hover:bg-white/[0.08]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MentorCard({ mentor }: { mentor: Mentor }) {
  const { requestMentorship } = useMentorship();
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await requestMentorship(mentor.id);
      setRequested(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to request mentorship');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
          {mentor.user.avatar ? (
            <img src={mentor.user.avatar} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <span className="text-brand-400 font-bold text-lg">
              {mentor.user.firstName.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm">
            {mentor.user.firstName} {mentor.user.lastName}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-surface-400">
            <span className="text-brand-400 font-medium">Lvl {mentor.currentLevel}</span>
            <span>•</span>
            <span>{mentor.totalDeliveries} deliveries</span>
            <span>•</span>
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 text-amber-400" />
              {mentor.averageRating.toFixed(1)}
            </span>
          </div>
          {mentor.bio && (
            <p className="text-surface-300 text-xs mt-1 line-clamp-2">{mentor.bio}</p>
          )}
          <div className="flex items-center gap-2 mt-1 text-[10px] text-surface-500">
            {mentor.currentZone && <span>{mentor.currentZone.name}</span>}
            <span>•</span>
            <span>{mentor.activeMenteeCount}/5 mentees</span>
          </div>
        </div>
      </div>
      <button
        onClick={handleRequest}
        disabled={requesting || requested || mentor.activeMenteeCount >= 5}
        className={`w-full mt-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          requested
            ? 'bg-emerald-500/20 text-emerald-400'
            : mentor.activeMenteeCount >= 5
              ? 'bg-white/[0.03] text-surface-500 cursor-not-allowed'
              : 'bg-brand-500 text-white shadow-lg shadow-brand-500/20 active:scale-[0.98]'
        }`}
      >
        {requesting ? (
          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
        ) : requested ? (
          'Request Sent ✓'
        ) : mentor.activeMenteeCount >= 5 ? (
          'Full'
        ) : (
          'Request Mentorship'
        )}
      </button>
    </div>
  );
}
