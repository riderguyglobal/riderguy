'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEvents } from '@/hooks/use-events';
import type { CommunityEvent } from '@/hooks/use-events';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Video,
  Users,
  Plus,
  ChevronRight,
  Loader2,
  Clock,
  Filter,
} from 'lucide-react';

type StatusFilter = '' | 'UPCOMING' | 'ONGOING' | 'COMPLETED';

export default function EventsPage() {
  const { events, loading, pagination, fetchEvents } = useEvents();
  const [filter, setFilter] = useState<StatusFilter>('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchEvents({ status: filter || undefined });
  }, [fetchEvents, filter]);

  return (
    <div className="min-h-[100dvh] bg-[#0a0e17]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <Link href="/dashboard/community" className="p-2 -ml-2 text-surface-400 hover:text-surface-200">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold text-white">Events</h1>
            <button
              onClick={() => setShowCreate(true)}
              className="p-2 -mr-2 text-brand-400 hover:text-brand-300"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-1 pb-3 overflow-x-auto scrollbar-hide">
            {(['', 'UPCOMING', 'ONGOING', 'COMPLETED'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-surface-400 hover:bg-white/[0.04]'
                }`}
              >
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
            <p className="text-surface-400 text-sm mt-3">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-brand-500" />
            </div>
            <h3 className="text-white font-semibold mb-1">No events yet</h3>
            <p className="text-surface-400 text-sm max-w-[260px]">
              Be the first to organize a community event!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-4">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => fetchEvents({ status: filter || undefined, page: p })}
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
        )}
      </div>

      {/* Create Event Sheet */}
      {showCreate && <CreateEventSheet onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function EventCard({ event }: { event: CommunityEvent }) {
  const date = new Date(event.date);
  const typeIcons = {
    IN_PERSON: <MapPin className="h-3.5 w-3.5" />,
    VIRTUAL: <Video className="h-3.5 w-3.5" />,
    HYBRID: <Users className="h-3.5 w-3.5" />,
  };

  const statusColors: Record<string, string> = {
    UPCOMING: 'text-brand-400 bg-brand-400/10',
    ONGOING: 'text-emerald-400 bg-emerald-400/10',
    COMPLETED: 'text-surface-500 bg-surface-500/10',
    CANCELLED: 'text-red-400 bg-red-400/10',
  };

  return (
    <Link
      href={`/dashboard/community/events/${event.id}`}
      className="block p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
    >
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-32 object-cover rounded-xl mb-3"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[event.status] || ''}`}>
              {event.status}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-surface-400 bg-white/[0.04]">
              {typeIcons[event.type]}
              {event.type.replace('_', ' ')}
            </span>
          </div>
          <h3 className="text-white font-semibold text-sm truncate">{event.title}</h3>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-surface-400">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' '}at {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 mt-1 text-xs text-surface-400">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 text-[10px] text-surface-500">
            <Users className="h-3 w-3" />
            <span>{event._count.rsvps} attending</span>
            {event.capacity && <span>/ {event.capacity} max</span>}
            {event.zone && (
              <>
                <span>•</span>
                <span>{event.zone.name}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-500 mt-1 flex-shrink-0" />
      </div>
    </Link>
  );
}

function CreateEventSheet({ onClose }: { onClose: () => void }) {
  const { createEvent } = useEvents();
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'IN_PERSON' as 'IN_PERSON' | 'VIRTUAL' | 'HYBRID',
    date: '',
    location: '',
    virtualLink: '',
    capacity: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.date) return;
    setSubmitting(true);
    try {
      await createEvent({
        title: form.title,
        description: form.description,
        type: form.type,
        date: new Date(form.date).toISOString(),
        location: form.location || undefined,
        virtualLink: form.virtualLink || undefined,
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
      });
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
      <div className="w-full max-h-[90dvh] bg-[#0f1420] border-t border-white/[0.06] rounded-t-3xl overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">Create Event</h2>
            <button onClick={onClose} className="text-surface-400 text-sm">Cancel</button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Event title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-surface-500 outline-none focus:border-brand-500/50"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-surface-500 outline-none focus:border-brand-500/50 resize-none"
            />
            <div className="flex gap-2">
              {(['IN_PERSON', 'VIRTUAL', 'HYBRID'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((p) => ({ ...p, type: t }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    form.type === t
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                      : 'bg-white/[0.04] text-surface-400 border border-white/[0.06]'
                  }`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
            <input
              type="datetime-local"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-brand-500/50 [color-scheme:dark]"
            />
            {(form.type === 'IN_PERSON' || form.type === 'HYBRID') && (
              <input
                type="text"
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-surface-500 outline-none focus:border-brand-500/50"
              />
            )}
            {(form.type === 'VIRTUAL' || form.type === 'HYBRID') && (
              <input
                type="url"
                placeholder="Virtual link (Zoom, Meet, etc.)"
                value={form.virtualLink}
                onChange={(e) => setForm((p) => ({ ...p, virtualLink: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-surface-500 outline-none focus:border-brand-500/50"
              />
            )}
            <input
              type="number"
              placeholder="Max capacity (optional)"
              value={form.capacity}
              onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-surface-500 outline-none focus:border-brand-500/50"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.title || !form.description || !form.date}
              className="w-full py-3 rounded-xl bg-brand-500 text-white font-medium text-sm shadow-lg shadow-brand-500/20 disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Create Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
