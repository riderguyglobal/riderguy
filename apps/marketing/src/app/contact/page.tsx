'use client';

import type { FormEvent, ChangeEvent } from 'react';
import React, { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const SUBJECTS = [
  { value: '',         label: 'Select a topic…',        icon: null },
  { value: 'general',  label: 'General Inquiry',         icon: '💬' },
  { value: 'business', label: 'Business Partnership',    icon: '🤝' },
  { value: 'rider',    label: 'Rider Support',           icon: '🛵' },
  { value: 'partner',  label: 'Become a Partner',        icon: '🌍' },
  { value: 'support',  label: 'Technical Support',       icon: '🔧' },
  { value: 'other',    label: 'Other',                   icon: '📋' },
];

const CONTACT_CARDS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    label: 'Email us',
    value: 'hello@myriderguy.com',
    href: 'mailto:hello@myriderguy.com',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
    label: 'Call us',
    value: '+233 20 000 0000',
    href: 'tel:+233200000000',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    label: 'Office',
    value: 'Accra, Ghana · West Africa',
    href: null,
  },
];

type Field = 'firstName' | 'lastName' | 'email' | 'subject' | 'message';

export default function ContactPage() {
  const [fields, setFields] = useState({
    firstName: '', lastName: '', email: '', subject: '', message: '',
  });
  const [touched,    setTouched]    = useState<Partial<Record<Field, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [serverErr,  setServerErr]  = useState('');
  const [honeypot,   setHoneypot]   = useState('');

  const set = (field: Field) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields(f => ({ ...f, [field]: e.target.value }));

  const blur = (field: Field) => () => setTouched(t => ({ ...t, [field]: true }));

  const errors: Partial<Record<Field, string>> = {
    firstName: !fields.firstName.trim()              ? 'Required'             : undefined,
    lastName:  !fields.lastName.trim()               ? 'Required'             : undefined,
    email:     !fields.email.trim()                  ? 'Required'
               : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ? 'Invalid email' : undefined,
    subject:   !fields.subject                       ? 'Please choose a topic' : undefined,
    message:   fields.message.trim().length < 10     ? 'At least 10 characters' : undefined,
  };

  const valid = !Object.values(errors).some(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ firstName: true, lastName: true, email: true, subject: true, message: true });
    if (!valid || honeypot) return;

    setSubmitting(true);
    setServerErr('');
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Failed to send message');
      }
      setSuccess(true);
    } catch (err) {
      setServerErr(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setFields({ firstName: '', lastName: '', email: '', subject: '', message: '' });
    setTouched({});
    setSuccess(false);
    setServerErr('');
  };

  /* ── Field helpers ── */
  const fieldBase =
    'w-full rounded-xl border bg-white px-4 py-3 text-sm text-surface-900 outline-none transition-all placeholder:text-surface-400 focus:ring-2';
  const fieldOk   = 'border-surface-200 focus:border-brand-500 focus:ring-brand-500/20';
  const fieldErr  = 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-red-500/20';

  const cls = (f: Field) =>
    `${fieldBase} ${touched[f] && errors[f] ? fieldErr : fieldOk}`;

  /* ── Success screen ── */
  if (success) {
    return (
      <section className="flex min-h-[80vh] flex-col items-center justify-center px-5 py-24">
        <div className="w-full max-w-md text-center">
          {/* Animated check circle */}
          <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-brand-500/10 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-500 shadow-xl shadow-brand-500/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="h-10 w-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-surface-900">Message sent!</h2>
          <p className="mt-3 text-base text-surface-500 leading-relaxed">
            Thanks for reaching out, <strong className="text-surface-800">{fields.firstName || 'there'}</strong>.<br />
            We'll get back to you within 24 hours.
          </p>

          <div className="mt-8 rounded-2xl border border-surface-100 bg-surface-50 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3">Your message summary</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-500">Topic</span>
              <span className="font-medium text-surface-800 capitalize">
                {SUBJECTS.find(s => s.value === fields.subject)?.label ?? fields.subject}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-surface-500">Sent to</span>
              <span className="font-medium text-surface-800">hello@myriderguy.com</span>
            </div>
          </div>

          <button
            onClick={reset}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-surface-200 px-6 text-sm font-semibold text-surface-700 transition-all hover:bg-surface-50 hover:border-surface-300"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/>
            </svg>
            Send another message
          </button>
        </div>
      </section>
    );
  }

  /* ── Main form ── */
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-24 sm:px-6 sm:pt-32">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-brand-500/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-40 h-[400px] w-[400px] rounded-full bg-brand-500/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl">
        {/* Section label */}
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Contact · 24h Response
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-surface-950 sm:text-5xl">
            Get in <span className="text-brand-500">touch.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-surface-500">
            Have a question, partnership proposal, or just want to say hello?
            Fill out the form and we&apos;ll get back within 24 hours.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-12 lg:items-start">

          {/* ── Left: contact info cards ── */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {CONTACT_CARDS.map((card) => (
              <div
                key={card.label}
                className="flex items-center gap-4 rounded-2xl border border-surface-100 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  {card.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">{card.label}</p>
                  {card.href ? (
                    <a href={card.href} className="mt-0.5 text-sm font-medium text-surface-800 hover:text-brand-600 transition-colors">
                      {card.value}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-sm font-medium text-surface-800">{card.value}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Response time badge */}
            <div className="rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500">
                  <svg viewBox="0 0 20 20" fill="white" className="h-4 w-4">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-800">Average reply time</p>
                  <p className="text-xs text-brand-600">Under 24 hours · Mon–Sat</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: form card ── */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-sm sm:p-8">

              {/* Server error */}
              {serverErr && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-red-500">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-sm text-red-700">{serverErr}</p>
                </div>
              )}

              {/* Honeypot */}
              <div className="absolute left-[-9999px]" aria-hidden="true">
                <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} />
              </div>

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

                {/* Name row */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-surface-700">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fields.firstName}
                      onChange={set('firstName')}
                      onBlur={blur('firstName')}
                      placeholder="Kwame"
                      className={cls('firstName')}
                    />
                    {touched.firstName && errors.firstName && (
                      <p className="text-xs text-red-500">{errors.firstName}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-surface-700">
                      Last name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fields.lastName}
                      onChange={set('lastName')}
                      onBlur={blur('lastName')}
                      placeholder="Mensah"
                      className={cls('lastName')}
                    />
                    {touched.lastName && errors.lastName && (
                      <p className="text-xs text-red-500">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-surface-700">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-surface-400">
                        <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z"/>
                        <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z"/>
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={fields.email}
                      onChange={set('email')}
                      onBlur={blur('email')}
                      placeholder="you@example.com"
                      className={`${cls('email')} pl-10`}
                    />
                  </div>
                  {touched.email && errors.email && (
                    <p className="text-xs text-red-500">{errors.email}</p>
                  )}
                </div>

                {/* Subject */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-surface-700">
                    Topic <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={fields.subject}
                      onChange={set('subject')}
                      onBlur={blur('subject')}
                      className={`${cls('subject')} appearance-none pr-10 cursor-pointer`}
                    >
                      {SUBJECTS.map(s => (
                        <option key={s.value} value={s.value} disabled={s.value === ''}>
                          {s.icon ? `${s.icon}  ${s.label}` : s.label}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-surface-400">
                        <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                  {touched.subject && errors.subject && (
                    <p className="text-xs text-red-500">{errors.subject}</p>
                  )}
                </div>

                {/* Message */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-surface-700">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <span className={`text-xs tabular-nums transition-colors ${fields.message.length > 4500 ? 'text-red-500' : 'text-surface-400'}`}>
                      {fields.message.length} / 5000
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={fields.message}
                    onChange={set('message')}
                    onBlur={blur('message')}
                    placeholder="Tell us how we can help…"
                    maxLength={5000}
                    className={`${cls('message')} resize-none`}
                  />
                  {touched.message && errors.message && (
                    <p className="text-xs text-red-500">{errors.message}</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative mt-1 flex h-13 w-full items-center justify-center overflow-hidden rounded-xl bg-brand-500 text-sm font-bold text-white shadow-lg shadow-brand-500/30 transition-all hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/35 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ height: '52px' }}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Sending…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2.5">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
                        <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z"/>
                      </svg>
                      Send Message
                    </span>
                  )}
                </button>

                <p className="text-center text-xs text-surface-400">
                  By submitting, you agree to our{' '}
                  <a href="/privacy" className="underline hover:text-surface-700 transition-colors">privacy policy</a>.
                  We never share your data.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
