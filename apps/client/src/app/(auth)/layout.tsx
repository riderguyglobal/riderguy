'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname?.startsWith('/register') ?? false;
  const heroImage = isRegister ? '/images/auth/delivery-essentials.png' : '/images/auth/package-exchange.png';
  const heroAlt = isRegister
    ? 'RiderGuy delivery essentials flat lay'
    : 'RiderGuy rider handing a package to a happy customer in Accra';

  return (
    <div className="min-h-[100dvh] bg-white">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/25" />
          {/* Right-edge fade for transition to form */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/20" />

          {/* Content directly on the image */}
          <div className="absolute inset-0 z-10 flex flex-col justify-between px-10 xl:px-14 py-12">
            {/* Logo */}
            <div>
              <Image src="/images/branding/logo-wide.png" alt="RiderGuy" width={600} height={150} className="h-10 w-auto brightness-0 invert drop-shadow-lg" priority />
            </div>

            {/* Taglines + status */}
            <div>
              {/* Status pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20 mb-6">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/80 text-[11px] font-semibold tracking-wide">Delivering across Ghana</span>
              </div>

              <div className="space-y-0 mb-8">
                <p className="text-[2.75rem] xl:text-[3.5rem] font-black text-white tracking-tight leading-[1.02] drop-shadow-lg">
                  Send.
                </p>
                <p className="text-[2.75rem] xl:text-[3.5rem] font-black tracking-tight leading-[1.02] text-emerald-400 drop-shadow-lg">
                  Track.
                </p>
                <p className="text-[2.75rem] xl:text-[3.5rem] font-black text-white/60 tracking-tight leading-[1.02] drop-shadow-lg">
                  Arrive.
                </p>
              </div>

              <p className="text-white/40 text-[15px] leading-relaxed max-w-[300px]">
                Real-time tracking, instant pickup, zero guesswork.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Form area ── */}
        <div className="flex-1 flex items-center justify-center px-10 xl:px-16 bg-white">
          <div className="w-full max-w-[440px] animate-page-enter">{children}</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MOBILE — Immersive hero + overlapping form card
          ══════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col min-h-[100dvh]">
        {/* Hero: image fills the top section */}
        <div className="relative h-[40vh] min-h-[240px] max-h-[340px] shrink-0">
          <Image
            src={heroImage}
            alt=""
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
            quality={85}
          />
          {/* Gradient fading to white for seamless card overlap */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white" />

          {/* Top bar: logo + live status */}
          <div className="absolute inset-x-0 top-0 z-10 px-5 pt-4 flex items-center justify-between safe-area-top">
            <Image src="/images/branding/logo-wide.png" alt="RiderGuy" width={600} height={150} className="h-7 w-auto brightness-0 invert drop-shadow-md" priority />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm ring-1 ring-white/10">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
              </span>
              <span className="text-white/70 text-[9px] tracking-widest uppercase font-medium">Live</span>
            </div>
          </div>
        </div>

        {/* Form card slides up over the hero */}
        <div className="relative z-10 -mt-6 bg-white rounded-t-[28px] flex-1 px-5 pt-8 pb-8 shadow-[0_-4px_30px_rgba(0,0,0,0.05)]">
          <div className="w-full max-w-[440px] mx-auto animate-page-enter">{children}</div>
        </div>
      </div>
    </div>
  );
}
