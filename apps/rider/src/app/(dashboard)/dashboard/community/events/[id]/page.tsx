'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEvents } from '@/hooks/use-events';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Video,
  Users,
  Clock,
  ExternalLink,
  CheckCircle,
  Loader2,
} from 'lucide-react';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentEvent, loading, fetchEvent, rsvp, cancelRsvp } = useEvents();
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    if (id) fetchEvent(id);
  }, [id, fetchEvent]);

  const handleRsvp = async () => {
    if (!id) return;
    setRsvpLoading(true);
    try {
      if (currentEvent?.hasRsvp) {
        await cancelRsvp(id);
      } else {
        await rsvp(id);
      }
      // Refresh event data
      await fetchEvent(id);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'RSVP failed');
    } finally {
      setRsvpLoading(false);
    }
  };

  if (loading && !currentEvent) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0e17] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0e17] flex flex-col items-center justify-center">
        <p className="text-surface-400">Event not found</p>
        <Link href="/dashboard/community/events" className="text-brand-400 text-sm mt-2">
          Back to Events
        </Link>
      </div>
    );
  }

  const ev = currentEvent;
  const date = new Date(ev.date);
  const endDate = ev.endDate ? new Date(ev.endDate) : null;
  const isFull = ev.capacity ? ev._count.rsvps >= ev.capacity : false;
  const isOver = ev.status === 'COMPLETED' || ev.status === 'CANCELLED';

  return (
    <div className="min-h-[100dvh] bg-[#0a0e17]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <Link href="/dashboard/community/events" className="p-2 -ml-2 text-surface-400 hover:text-surface-200">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold text-white truncate mx-4">{ev.title}</h1>
            <div className="w-9" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Image */}
        {ev.imageUrl && (
          <img src={ev.imageUrl} alt={ev.title} className="w-full h-48 object-cover rounded-2xl" />
        )}

        {/* Status & Type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
            ev.status === 'UPCOMING' ? 'text-brand-400 bg-brand-400/10' :
            ev.status === 'ONGOING' ? 'text-emerald-400 bg-emerald-400/10' :
            ev.status === 'CANCELLED' ? 'text-red-400 bg-red-400/10' :
            'text-surface-500 bg-surface-500/10'
          }`}>
            {ev.status}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-surface-400 bg-white/[0.04]">
            {ev.type === 'IN_PERSON' ? <MapPin className="h-3 w-3" /> :
             ev.type === 'VIRTUAL' ? <Video className="h-3 w-3" /> :
             <Users className="h-3 w-3" />}
            {ev.type.replace('_', ' ')}
          </span>
        </div>

        {/* Description */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-surface-200 text-sm leading-relaxed whitespace-pre-wrap">{ev.description}</p>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-5 w-5 text-brand-400 flex-shrink-0" />
            <div>
              <p className="text-white">
                {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-surface-400 text-xs">
                {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                {endDate && ` — ${endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          </div>

          {ev.location && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-5 w-5 text-brand-400 flex-shrink-0" />
              <p className="text-white">{ev.location}</p>
            </div>
          )}

          {ev.virtualLink && (
            <a
              href={ev.virtualLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm text-brand-400 hover:text-brand-300"
            >
              <ExternalLink className="h-5 w-5 flex-shrink-0" />
              <span>Join Virtual Meeting</span>
            </a>
          )}

          <div className="flex items-center gap-3 text-sm">
            <Users className="h-5 w-5 text-brand-400 flex-shrink-0" />
            <p className="text-white">
              {ev._count.rsvps} attending
              {ev.capacity && ` / ${ev.capacity} max`}
            </p>
          </div>

          {ev.zone && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-5 w-5 text-surface-500 flex-shrink-0" />
              <p className="text-surface-400">{ev.zone.name}</p>
            </div>
          )}
        </div>

        {/* RSVP Button */}
        {!isOver && (
          <button
            onClick={handleRsvp}
            disabled={rsvpLoading || (isFull && !ev.hasRsvp)}
            className={`w-full py-3 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${
              ev.hasRsvp
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                : isFull
                  ? 'bg-white/[0.03] text-surface-500 cursor-not-allowed'
                  : 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
            }`}
          >
            {rsvpLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : ev.hasRsvp ? (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {"You're going — Tap to cancel"}
              </span>
            ) : isFull ? (
              'Event is full'
            ) : (
              'RSVP — I\'m going!'
            )}
          </button>
        )}

        {/* Attendees */}
        {ev.rsvps && ev.rsvps.length > 0 && (
          <div>
            <h3 className="text-white font-semibold text-sm mb-3">Attendees</h3>
            <div className="flex flex-wrap gap-2">
              {ev.rsvps.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]"
                >
                  <div className="h-6 w-6 rounded-full bg-brand-500/20 flex items-center justify-center">
                    {r.user.avatar ? (
                      <img src={r.user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="text-brand-400 text-[10px] font-bold">{r.user.firstName.charAt(0)}</span>
                    )}
                  </div>
                  <span className="text-surface-300 text-xs">{r.user.firstName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organized by */}
        <div className="pt-2 border-t border-white/[0.06]">
          <p className="text-surface-500 text-xs">
            Organized by {ev.createdBy.firstName} {ev.createdBy.lastName}
          </p>
        </div>
      </div>
    </div>
  );
}
