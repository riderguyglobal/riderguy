'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMounted(true); }, []);

  const isSignup = pathname.startsWith('/signup');
  const heroImage = isSignup ? '/images/auth/rider-twilight.png' : '/images/auth/rider-sunset.png';
  const heroAlt = isSignup
    ? 'Young RiderGuy rider in urban Accra at twilight'
    : 'RiderGuy rider delivering at sunset in Accra';

  return (
    <div className="min-h-[100dvh] bg-page">
      {/* ══════════════════════════════════════════════════
          DESKTOP — Full-bleed cinematic split
          ══════════════════════════════════════════════════ */}
      <div className="hidden lg:flex min-h-[100dvh]">
        {/* ── Left: Image covers the entire panel ── */}
        <div className="w-[50%] xl:w-[48%] relative h-[100dvh] overflow-hidden">
          <Image
            src={heroImage}
            alt={heroAlt}
            fill
            className="object-cover"
            priority
            sizes="50vw"
            quality={90}
          />
          {/* Cinematic gradient: heavy at bottom for text, subtle elsewhere */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/30" />
          {/* Right-edge fade for seamless transition to form */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/25" />

          {/* Content directly on the image */}
          <div className={`absolute inset-0 z-10 flex flex-col justify-between px-10 xl:px-14 py-12 transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            {/* Logo */}
            <div>
              <Image src="/images/branding/logo-wide.png" alt="RiderGuy" width={600} height={150} className="h-10 w-auto brightness-0 invert drop-shadow-lg" priority />
            </div>

            {/* Taglines + live badge */}
            <div>
              <div className="space-y-0 mb-8">
                <p className="text-[2.75rem] xl:text-[3.5rem] font-black text-white tracking-tight leading-[1.02] drop-shadow-lg">
                  Deliver Safely.
                </p>
                <p className="text-[2.75rem] xl:text-[3.5rem] font-black tracking-tight leading-[1.02] text-emerald-400 drop-shadow-lg">
                  Earn More.
                </p>
                <p className="text-[2.75rem] xl:text-[3.5rem] font-black text-white/50 tracking-tight leading-[1.02] drop-shadow-lg">
                  Your Welfare First.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </div>
                <span className="text-white/40 text-[11px] tracking-[0.15em] uppercase font-medium">Rider Network Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Form area ── */}
        <div className="flex-1 flex items-center justify-center px-8 xl:px-16 py-12">
          <div className="w-full max-w-[420px] animate-page-enter">
            {children}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MOBILE — Immersive hero + overlapping form card
          ══════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col min-h-[100dvh]">
        {/* Hero: image fills the top section */}
        <div className="relative h-[44vh] min-h-[260px] max-h-[380px] shrink-0">
          <Image
            src={heroImage}
            alt=""
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
            quality={85}
          />
          {/* Gradient fading to page background */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-page" />

          {/* Top bar: logo + status */}
          <div className="absolute inset-x-0 top-0 z-10 px-5 pt-4 flex items-center justify-between safe-area-top">
            <Link href="/">
              <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-white/20 backdrop-blur-sm bg-black/20">
                <Image src="/images/branding/logo-square.png" alt="RiderGuy" width={192} height={192} className="h-9 w-9 object-cover" priority />
              </div>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm ring-1 ring-white/10">
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </div>
              <span className="text-[10px] text-white/70 font-medium tracking-widest uppercase">Rider</span>
            </div>
          </div>

          {/* Centered tagline on the hero */}
          <div className="absolute inset-x-0 bottom-12 z-10 px-6 text-center">
            <p className="text-white text-xl font-bold drop-shadow-lg">Deliver. Earn. Grow.</p>
            <p className="text-white/50 text-sm mt-1.5">Your next delivery starts here</p>
          </div>
        </div>

        {/* Form card slides up over the hero */}
        <div className="relative z-10 -mt-5 bg-page rounded-t-[28px] flex-1 px-5 pt-8 pb-8">
          <div className="w-full max-w-[420px] mx-auto animate-page-enter">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
