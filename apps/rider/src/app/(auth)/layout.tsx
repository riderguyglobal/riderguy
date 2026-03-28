'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';


export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-page">
      {/* ── Desktop branded panel ── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[44%] relative overflow-hidden">
        {/* Deep cinematic gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#022c22] via-[#064e3b] to-[#011f18]" />

        {/* Central radial glow — draws eye to illustration */}
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-emerald-500/[0.12] blur-[150px]" />
        <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[280px] h-[180px] rounded-full bg-teal-400/[0.06] blur-[100px]" />

        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 0.5px, transparent 0)', backgroundSize: '32px 32px' }} />

        {/* Content — centered vertically */}
        <div className={`relative z-10 flex flex-col items-center justify-center w-full h-full px-10 xl:px-14 transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

          {/* Logo */}
          <div className="mb-8">
            <Image src="/images/branding/logo-wide.png" alt="RiderGuy" width={600} height={150} className="h-36 xl:h-44 w-auto object-contain brightness-0 invert" priority />
          </div>

          {/* Illustration with ambient glow */}
          <div className="relative w-72 h-72 xl:w-80 xl:h-80 mb-12">
            <div className="absolute inset-0 scale-[1.6] rounded-full bg-emerald-400/[0.08] blur-3xl" />
            <Image
              src="/images/branding/biker-for-homepage.png"
              alt=""
              width={320}
              height={320}
              className="relative w-full h-full object-contain drop-shadow-2xl animate-float"
              priority
            />
          </div>

          {/* Tagline */}
          <div className="text-center space-y-2" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
            <p className="text-[2.5rem] xl:text-[3.25rem] font-black text-white tracking-tight leading-[1.1]">
              Deliver Safely.
            </p>
            <p className="text-[2.5rem] xl:text-[3.25rem] font-black tracking-tight leading-[1.1] bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-green-200 to-teal-300 drop-shadow-sm">
              Earn More.
            </p>
            <p className="text-[2.5rem] xl:text-[3.25rem] font-black text-white/90 tracking-tight leading-[1.1]">
              Prioritize Your Welfare.
            </p>
            <p className="text-[2.5rem] xl:text-[3.25rem] font-black text-white/30 tracking-tight leading-[1.1]">
              Secure Your Future.
            </p>
          </div>
        </div>
      </div>

      {/* ── Mobile header ── */}
      <div className="lg:hidden safe-area-top">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#022c22] to-[#064e3b]" />
          <div className="relative px-5 pt-4 pb-5 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 btn-press">
              <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-white/10">
                <Image src="/images/branding/logo-square.png" alt="RiderGuy" width={192} height={192} className="h-9 w-9 rounded-xl object-cover" priority />
              </div>
              <span className="font-bold text-lg text-white/90 tracking-tight">RiderGuy</span>
            </Link>
            <span className="text-[11px] text-white/35 font-medium tracking-widest uppercase">Rider</span>
          </div>
        </div>
      </div>

      {/* ── Form area ── */}
      <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-6 lg:py-12 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-brand-500/[0.03] blur-[100px]" />
        </div>
        <div className="relative w-full max-w-[420px] animate-page-enter">
          {children}
        </div>
      </div>
    </div>
  );
}
