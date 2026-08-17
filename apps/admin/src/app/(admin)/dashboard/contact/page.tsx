'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@riderguy/auth';
import { Button, Spinner } from '@riderguy/ui';

interface ContactSubmission {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const SUBJECT_META: Record<string, { label: string; color: string }> = {
  general:  { label: 'General Inquiry',       color: 'bg-blue-100 text-blue-700' },
  rider:    { label: 'Rider Support',          color: 'bg-green-100 text-green-700' },
  business: { label: 'Business Partnership',   color: 'bg-purple-100 text-purple-700' },
  partner:  { label: 'Partnership',            color: 'bg-orange-100 text-orange-700' },
  support:  { label: 'Support',                color: 'bg-yellow-100 text-yellow-700' },
  other:    { label: 'Other',                  color: 'bg-gray-100 text-gray-600' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ContactInboxPage() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [total,       setTotal]       = useState(0);
  const [selected,    setSelected]    = useState<ContactSubmission | null>(null);
  const [filter,      setFilter]      = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient();
      const res = await api.get('/contact', {
        params: { limit: 50, unread: filter === 'unread' ? 'true' : undefined },
      });
      const d = res.data.data;
      setSubmissions(d.submissions);
      setUnreadCount(d.unreadCount);
      setTotal(d.total);
    } catch {
      setError('Failed to load messages. Make sure you are signed in as admin.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    try {
      const api = getApiClient();
      await api.patch(`/contact/${id}/read`);
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, read: true } : s));
      setUnreadCount(prev => Math.max(0, prev - 1));
      setSelected(prev  => prev?.id === id ? { ...prev, read: true } : prev);
    } catch { /* silent */ }
  }, []);

  const handleSelect = useCallback(async (s: ContactSubmission) => {
    setSelected(s);
    if (!s.read) await markRead(s.id);
  }, [markRead]);

  const sub  = selected ? (SUBJECT_META[selected.subject] ?? { label: selected.subject, color: 'bg-gray-100 text-gray-600' }) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contact Messages</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {total} message{total !== 1 ? 's' : ''}
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter pills */}
          <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm font-medium">
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 capitalize transition-colors ${
                  filter === f ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

          {/* ══ List pane ══ */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-gray-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-500">No messages yet</p>
                </div>
              ) : (
                <ul className="max-h-[72vh] divide-y divide-gray-100 overflow-y-auto">
                  {submissions.map(s => {
                    const meta = SUBJECT_META[s.subject] ?? { label: s.subject, color: 'bg-gray-100 text-gray-600' };
                    const isSelected = selected?.id === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => handleSelect(s)}
                          className={`w-full px-4 py-3.5 text-left transition-colors hover:bg-gray-50 ${
                            isSelected ? 'border-l-[3px] border-brand-500 bg-brand-50/60' : 'border-l-[3px] border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {!s.read && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                              )}
                              <p className={`truncate text-sm ${!s.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                                {s.firstName} {s.lastName}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(s.createdAt)}</span>
                          </div>
                          <p className={`mt-0.5 truncate text-xs ${!s.read ? 'pl-4' : 'pl-0'} text-gray-400`}>
                            {s.email}
                          </p>
                          <div className={`mt-1.5 ${!s.read ? 'pl-4' : 'pl-0'}`}>
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className={`mt-1 line-clamp-1 text-xs text-gray-400 ${!s.read ? 'pl-4' : 'pl-0'}`}>
                            {s.message}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ══ Detail pane ══ */}
          <div className="lg:col-span-3">
            {selected && sub ? (
              <div className="rounded-xl border border-gray-200 bg-white">
                {/* Detail header */}
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
                      {selected.firstName[0]}{selected.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selected.firstName} {selected.lastName}</p>
                      <a
                        href={`mailto:${selected.email}`}
                        className="text-sm text-brand-600 hover:underline"
                      >
                        {selected.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sub.color}`}>
                      {sub.label}
                    </span>
                    <span className="text-xs text-gray-400">{fullDate(selected.createdAt)}</span>
                  </div>
                </div>

                {/* Message body */}
                <div className="px-6 py-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Message</p>
                  <div className="rounded-xl bg-gray-50 px-5 py-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                      {selected.message}
                    </p>
                  </div>
                </div>

                {/* Actions footer */}
                <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
                  {selected.read ? (
                    <span className="flex items-center gap-1.5 text-xs text-gray-400">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                      Read
                    </span>
                  ) : (
                    <button
                      onClick={() => markRead(selected.id)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      Mark as read
                    </button>
                  )}

                  <a
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(sub.label)} — RiderGuy`}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition-all hover:bg-brand-600 active:scale-[0.98]"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                    </svg>
                    Reply via Email
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-24 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-500">Select a message to read it</p>
                <p className="mt-1 text-xs text-gray-400">Click any item from the list on the left</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
