'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Riders', href: '/for-riders' },
  { label: 'Businesses', href: '/for-businesses' },
  { label: 'Careers', href: '/careers' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

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

  const isActive = useCallback((href: string) => {
    const hrefPath = href.replace(/#.*$/, '');
    if (!hrefPath || hrefPath === '/') return false;
    return (pathname ?? '').startsWith(hrefPath);
  }, [pathname]);

  const glassBg = scrolled || open
    ? 'bg-white/92 backdrop-blur-2xl shadow-[0_1px_0_rgba(0,0,0,0.08),0_4px_24px_rgba(0,0,0,0.05)]'
    : 'bg-transparent';

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${glassBg}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:h-[4.5rem] sm:px-8 lg:px-10">

          {/* ── Logo ── */}
          <Link href="/" className="relative z-10 shrink-0">
            <Image
              src="/images/branding/logo-wide.png"
              alt="RiderGuy"
              width={600}
              height={150}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>

          {/* ── Desktop nav ── */}
          <nav className="hidden items-center lg:flex" aria-label="Main navigation">
            {NAV.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`
                    group relative flex flex-col items-center gap-0 px-4 py-2.5
                    text-[0.855rem] tracking-tight rounded-lg
                    transition-all duration-200
                    ${active
                      ? 'text-brand-600 font-semibold'
                      : 'text-surface-500 font-medium hover:text-surface-900'
                    }
                  `}
                >
                  {/* ── Active: green dot at top ── */}
                  <span
                    className={`
                      absolute -top-0 left-1/2 -translate-x-1/2
                      h-[3px] rounded-full bg-brand-500
                      transition-all duration-300 ease-out
                      ${active ? 'w-5 opacity-100' : 'w-0 opacity-0'}
                    `}
                  />

                  {link.label}

                  {/* ── Active: green bottom bar ── */}
                  <span
                    className={`
                      absolute bottom-0.5 left-3 right-3
                      h-[2.5px] rounded-full bg-brand-500/80
                      transition-all duration-300 ease-out origin-center
                      ${active ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'}
                    `}
                  />

                  {/* ── Hover: subtle underline for inactive ── */}
                  <span
                    className={`
                      absolute bottom-0.5 left-3 right-3
                      h-[2px] rounded-full bg-surface-300
                      transition-all duration-200 ease-out origin-center
                      ${active ? 'hidden' : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100'}
                    `}
                  />
                </Link>
              );
            })}
          </nav>

          {/* ── Desktop CTAs ── */}
          <div className="hidden items-center gap-2 lg:flex shrink-0">
            <Link
              href="https://app.myriderguy.com/login"
              className="rounded-lg px-4 py-2 text-[0.855rem] font-medium text-surface-600 transition-all hover:text-surface-950 hover:bg-surface-100/80"
            >
              Sign In
            </Link>
            <Link
              href="https://app.myriderguy.com/register"
              className="inline-flex h-9 items-center rounded-full bg-surface-950 px-5 text-[0.855rem] font-semibold text-white transition-all hover:bg-surface-800 hover:shadow-lg hover:shadow-black/20 active:scale-[0.97]"
            >
              Get Started
            </Link>
          </div>

          {/* ── Mobile burger ── */}
          <button
            className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-xl transition-colors lg:hidden ${
              scrolled || open ? 'hover:bg-surface-100' : 'hover:bg-black/5'
            }`}
            onClick={() => setOpen(v => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <div className="relative h-[14px] w-[20px]">
              <span className={`absolute left-0 block h-[2px] rounded-full bg-surface-900 transition-all duration-300 ${open ? 'top-[6px] w-5 rotate-45' : 'top-0 w-5'}`} />
              <span className={`absolute left-0 top-[6px] block h-[2px] rounded-full bg-surface-900 transition-all duration-300 ${open ? 'w-0 opacity-0' : 'w-4'}`} />
              <span className={`absolute left-0 block h-[2px] rounded-full bg-surface-900 transition-all duration-300 ${open ? 'top-[6px] w-5 -rotate-45' : 'top-[12px] w-5'}`} />
            </div>
          </button>
        </div>
      </header>

      {/* ── Mobile backdrop ── */}
      <div
        className={`fixed inset-0 z-40 bg-surface-950/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile drawer ── */}
      <div
        id="mobile-nav"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[320px] flex-col bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-surface-100 px-5 sm:h-[4.5rem]">
          <Link href="/" onClick={() => setOpen(false)} className="shrink-0">
            <Image
              src="/images/branding/logo-wide.png"
              alt="RiderGuy"
              width={400}
              height={100}
              className="h-7 w-auto"
            />
          </Link>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-100 transition-colors hover:bg-surface-200"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-4 w-4 text-surface-600">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer nav links */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Mobile navigation">
          {NAV.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`
                  group flex items-center gap-3 rounded-xl px-4 py-3
                  text-[0.95rem] transition-all duration-150
                  ${active
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-surface-700 font-medium hover:bg-surface-50 hover:text-surface-950'
                  }
                `}
                onClick={() => setOpen(false)}
              >
                {/* Left accent stripe */}
                <span
                  className={`
                    shrink-0 h-5 w-[3px] rounded-full transition-all duration-200
                    ${active ? 'bg-brand-500' : 'bg-transparent group-hover:bg-surface-300'}
                  `}
                />
                <span className="flex-1">{link.label}</span>
                {active && (
                  <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-600">
                    Current
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Drawer footer CTAs */}
        <div className="shrink-0 border-t border-surface-100 p-4 space-y-2.5">
          <Link
            href="https://app.myriderguy.com/login"
            className="flex h-11 items-center justify-center rounded-2xl border border-surface-200 text-[0.9rem] font-semibold text-surface-700 transition-all hover:bg-surface-50 hover:border-surface-300 active:scale-[0.98]"
            onClick={() => setOpen(false)}
          >
            Sign In
          </Link>
          <Link
            href="https://app.myriderguy.com/register"
            className="flex h-11 items-center justify-center rounded-2xl bg-brand-500 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600 active:scale-[0.98]"
            onClick={() => setOpen(false)}
          >
            Get Started
          </Link>
        </div>
      </div>
    </>
  );
}
