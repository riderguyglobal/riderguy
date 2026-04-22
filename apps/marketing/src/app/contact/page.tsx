'use client';

import type { FormEvent } from 'react';
import React, { useState } from 'react';
import Image from 'next/image';
import { ScrollRevealProvider } from '@/components/scroll-reveal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const SUBJECTS = [
  { value: '', label: 'Select a topic' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'business', label: 'Business Partnership' },
  { value: 'rider', label: 'Rider Support' },
  { value: 'press', label: 'Press & Media' },
  { value: 'careers', label: 'Careers' },
];

export default function ContactPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!firstName || !lastName || !email || !subject || !message) {
      setError('Please fill in all fields.');
      return;
    }

    if (honeypot) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, subject, message }),
      });

      if (!res.ok) {
        const body = await res.json().catch((): null => null);
        throw new Error((body as { message?: string })?.message || 'Failed to send message');
      }

      setSuccess(true);
      setFirstName('');
      setLastName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 outline-none transition-all placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

  return (
    <ScrollRevealProvider>
      <section className="relative overflow-hidden px-4 pb-12 pt-24 sm:px-8 sm:pb-20 sm:pt-36">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="orb orb-green absolute -top-32 right-0 h-[400px] w-[400px] opacity-60" />

        <div className="relative mx-auto max-w-5xl">
          <div className="reveal flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-16">
            {/* Left — Info */}
            <div className="flex flex-col items-center gap-6 lg:w-2/5 lg:items-start">
              <div className="photo-frame aspect-[4/3] w-full max-w-sm">
                <Image
                  src="/images/homepage/Image 3.jpeg"
                  alt="Contact RiderGuy"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
                <div className="photo-badge bottom-4 left-4">
                  <span className="flag-stripe !border-0 !bg-transparent !p-0 text-brand-700">
                    Accra, Ghana
                  </span>
                </div>
              </div>
              <div className="text-center lg:text-left">
                <span className="theme-eyebrow">
                  Contact
                  <span className="sep" />
                  24h Response
                </span>
                <h1 className="theme-display mt-4">
                  Get in <span className="accent">touch.</span>
                </h1>
                <p className="theme-lede mt-4">
                  Have a question, partnership proposal, or just want to say hello?
                  Fill out the form and we&apos;ll <em>get back within 24 hours</em>.
                </p>
              </div>
            </div>

            {/* Right — Form */}
            <div className="w-full flex-1 lg:w-3/5">
              {success ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7 text-green-600">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-surface-900">Message Sent!</h3>
                  <p className="mt-2 text-sm text-surface-500">
                    Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => setSuccess(false)}
                    className="mt-6 inline-flex h-10 items-center rounded-xl border border-surface-200 px-6 text-sm font-semibold text-surface-700 transition-colors hover:bg-surface-50"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {error && (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                  )}

                  {/* Honeypot field — hidden from real users */}
                  <div className="absolute left-[-9999px]" aria-hidden="true">
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-surface-700">First name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={inputClass}
                        placeholder="John"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-surface-700">Last name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={inputClass}
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-surface-700">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      placeholder="john@example.com"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-surface-700">Subject</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className={inputClass}
                      required
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-surface-700">Message</label>
                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className={`${inputClass} resize-none`}
                      placeholder="Tell us how we can help..."
                      maxLength={2000}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-glow h-12 w-full rounded-xl bg-brand-500 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
                  >
                    {submitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Contact info */}
          <div className="reveal mt-14 grid gap-6 text-center sm:mt-20 sm:grid-cols-3">
            <div>
              <h3 className="text-sm font-bold text-surface-900">Email</h3>
              <p className="mt-1 text-sm text-surface-500">hello@myriderguy.com</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-surface-900">Phone</h3>
              <p className="mt-1 text-sm text-surface-500">+233 20 000 0000</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-surface-900">Office</h3>
              <p className="mt-1 text-sm text-surface-500">Accra, Ghana</p>
            </div>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
