'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@riderguy/ui';

const NAV_LINKS = [
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'For Riders', href: '/for-riders' },
  { label: 'For Businesses', href: '/for-businesses' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-surface-100'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-18 sm:px-8 lg:px-10">
        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <Image
            src="/images/branding/logo-wide.png"
            alt="RiderGuy"
            width={600}
            height={150}
            className="h-8 w-auto sm:h-10"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative rounded-full px-4 py-2 text-sm font-medium text-surface-700 transition-colors hover:text-brand-600 hover:bg-brand-50/60"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 lg:flex">
          <Button
            variant="ghost"
            size="sm"
            className="text-surface-700 hover:text-surface-900"
            asChild
          >
            <Link href="https://app.myriderguy.com/login">Sign In</Link>
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-surface-900 px-6 text-white hover:bg-surface-800 shadow-sm"
            asChild
          >
            <Link href="https://app.myriderguy.com/register">Get Started</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl text-surface-700 transition-colors hover:bg-surface-100 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          <div className="relative h-5 w-5">
            <span
              className={`absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                mobileOpen ? 'top-2.5 rotate-45' : 'top-1'
              }`}
            />
            <span
              className={`absolute left-0 top-2.5 block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                mobileOpen ? 'opacity-0 scale-0' : 'opacity-100'
              }`}
            />
            <span
              className={`absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                mobileOpen ? 'top-2.5 -rotate-45' : 'top-4'
              }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile menu panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl transition-transform duration-500 ease-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-end px-4 sm:h-18 sm:px-5">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-4 pb-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-4 py-3 text-[0.95rem] font-medium text-surface-800 transition-colors hover:bg-brand-50 hover:text-brand-600"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          <div className="mt-6 flex flex-col gap-3 px-4">
            <Button
              variant="outline"
              className="w-full rounded-xl border-surface-200"
              asChild
            >
              <Link href="https://app.myriderguy.com/login">Sign In</Link>
            </Button>
            <Button
              className="w-full rounded-xl bg-brand-500 text-white hover:bg-brand-600"
              asChild
            >
              <Link href="https://app.myriderguy.com/register">Get Started</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
