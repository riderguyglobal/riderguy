'use client';

import React, { useState, type FormEvent } from 'react';
import { Button } from '@riderguy/ui';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const subjects = [
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!firstName || !lastName || !email || !subject || !message) {
      setError('Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, subject, message }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Failed to send message');
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

  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-16">
          {/* Left — illustration + info */}
          <div className="flex flex-col items-center gap-6 lg:items-start lg:w-2/5">
            <Image
              src="/images/illustrations/biker-talk.svg"
              alt="Contact us"
              width={320}
              height={320}
              className="h-56 w-auto lg:h-64"
            />
            <div className="text-center lg:text-left">
              <h1 className="text-4xl font-bold tracking-tight">
                Get in <span className="text-brand-500">Touch</span>
              </h1>
              <p className="mt-4 text-lg text-surface-500">
                Have a question, partnership proposal, or just want to say hello?
                Fill out the form and we&#39;ll get back to you within 24 hours.
              </p>
            </div>
          </div>

          {/* Right — form */}
          <div className="flex-1 w-full lg:w-3/5">
            {success ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7 text-green-600">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Message Sent!</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                </p>
                <Button variant="outline" className="mt-6" onClick={() => setSuccess(false)}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {error && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                    required
                  >
                    {subjects.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Message</label>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 resize-none"
                    placeholder="Tell us how we can help..."
                    required
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-16 grid gap-6 sm:grid-cols-3 text-center">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Email</h3>
            <p className="mt-1 text-sm text-surface-500">hello@riderguy.com</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Phone</h3>
            <p className="mt-1 text-sm text-surface-500">+233 20 000 0000</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Office</h3>
            <p className="mt-1 text-sm text-surface-500">Accra, Ghana</p>
          </div>
        </div>
      </div>
    </section>
  );
}
