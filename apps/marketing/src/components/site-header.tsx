'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const NAV = [
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'For Riders', href: '/for-riders' },
  { label: 'For Businesses', href: '/for-businesses' },
  { label: 'Careers', href: '/careers' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled || open
            ? 'bg-white/80 backdrop-blur-2xl shadow-[0_1px_0_rgba(0,0,0,0.06)]'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:h-[4.5rem] sm:px-8 lg:px-10">
          {/* Logo */}
          <Link href="/" className="relative z-10 flex items-center gap-2.5">
            <Image
              src="/images/branding/logo-wide.png"
              alt="RiderGuy"
              width={600}
              height={150}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="link-underline relative px-4 py-2 text-[0.85rem] font-medium tracking-tight text-surface-600 transition-colors hover:text-surface-950"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="https://app.myriderguy.com/login"
              className="text-[0.85rem] font-medium text-surface-600 transition-colors hover:text-surface-950"
            >
              Sign In
            </Link>
            <Link
              href="https://app.myriderguy.com/register"
              className="inline-flex h-10 items-center rounded-full bg-surface-950 px-6 text-[0.85rem] font-semibold text-white transition-all hover:bg-surface-800 hover:shadow-lg"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <div className="relative h-4 w-5">
              <span
                className={`absolute left-0 block h-[2px] w-5 rounded-full bg-surface-900 transition-all duration-300 ${
                  open ? 'top-[7px] rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`absolute left-0 top-[7px] block h-[2px] w-5 rounded-full bg-surface-900 transition-all duration-300 ${
                  open ? 'scale-x-0 opacity-0' : ''
                }`}
              />
              <span
                className={`absolute left-0 block h-[2px] w-5 rounded-full bg-surface-900 transition-all duration-300 ${
                  open ? 'top-[7px] -rotate-45' : 'top-[14px]'
                }`}
              />
            </div>
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-surface-950/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Mobile panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[340px] flex-col bg-white transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-end px-5 sm:h-[4.5rem]">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-surface-100"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 text-surface-500">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-5 pb-10">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-4 py-3.5 text-[0.95rem] font-medium text-surface-800 transition-colors hover:bg-surface-50 hover:text-brand-600"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          <div className="mt-auto flex flex-col gap-3 pt-8">
            <Link
              href="https://app.myriderguy.com/login"
              className="flex h-12 items-center justify-center rounded-2xl border border-surface-200 text-[0.9rem] font-semibold text-surface-700 transition-colors hover:bg-surface-50"
              onClick={() => setOpen(false)}
            >
              Sign In
            </Link>
            <Link
              href="https://app.myriderguy.com/register"
              className="flex h-12 items-center justify-center rounded-2xl bg-brand-500 text-[0.9rem] font-semibold text-white transition-colors hover:bg-brand-600"
              onClick={() => setOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
