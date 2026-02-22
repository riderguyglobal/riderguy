import React from 'react';
import Image from 'next/image';

// ============================================================
// Auth Layout — immersive split-screen with branded hero panel
// Mobile: full-screen form with floating logo
// Desktop: 45/55 split — hero left, form right
// ============================================================

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* ─── Left panel: branded hero (hidden on mobile) ─── */}
      <div className="relative hidden lg:flex lg:w-[45%] xl:w-[42%] flex-col items-center justify-between overflow-hidden bg-surface-900">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0 auth-gradient-mesh" />
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 auth-grid-pattern opacity-[0.03]" />
        {/* Glowing orbs */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-500/20 blur-[128px] animate-pulse-soft" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-500/15 blur-[128px] animate-pulse-soft [animation-delay:1s]" />

        {/* Hero content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-12 py-16">
          {/* Logo */}
          <div className="mb-10 auth-float">
            <Image
              src="/images/branding/logo-white.png"
              alt="RiderGuy"
              width={200}
              height={60}
              className="drop-shadow-2xl"
              priority
            />
          </div>

          {/* Illustration */}
          <div className="relative mb-10 w-full max-w-[320px] auth-fade-in">
            <Image
              src="/images/illustrations/handing-over.svg"
              alt="Package delivery illustration"
              width={320}
              height={320}
              className="drop-shadow-xl"
              priority
            />
          </div>

          {/* Tagline */}
          <div className="text-center auth-slide-up">
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-white xl:text-3xl">
              Send. Track. Receive.
            </h2>
            <p className="max-w-[280px] text-body-sm text-surface-400 leading-relaxed">
              Fast, reliable package delivery across Ghana — from your phone.
            </p>
          </div>
        </div>

        {/* Bottom features strip */}
        <div className="relative z-10 w-full border-t border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-8 px-8 py-4">
            <div className="flex items-center gap-2 text-caption text-surface-400">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20">
                <svg className="h-3.5 w-3.5 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
              </div>
              <span>Live tracking</span>
            </div>
            <div className="flex items-center gap-2 text-caption text-surface-400">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500/20">
                <svg className="h-3.5 w-3.5 text-accent-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span>Same-day delivery</span>
            </div>
            <div className="flex items-center gap-2 text-caption text-surface-400">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-warning-500/20">
                <svg className="h-3.5 w-3.5 text-warning-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              </div>
              <span>Insured packages</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right panel: form area ─── */}
      <div className="flex flex-1 flex-col">
        {/* Mobile-only top bar with logo */}
        <div className="flex items-center justify-between px-5 py-4 lg:hidden">
          <Image
            src="/images/branding/logo-black.png"
            alt="RiderGuy"
            width={130}
            height={38}
            priority
          />
          <div className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-caption font-medium text-brand-700">Client</span>
          </div>
        </div>

        {/* Form container — vertically centered */}
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-6 sm:px-8 lg:px-12 xl:px-20">
          <div className="w-full max-w-[420px] auth-slide-up">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 text-center">
          <p className="text-caption text-surface-400">
            &copy; {new Date().getFullYear()} RiderGuy. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
