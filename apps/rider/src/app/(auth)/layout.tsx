'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Bike, MapPin, Clock } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-page">
      {/* Desktop branded panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center p-12">
        {/* Gradient background */}
        <div className="absolute inset-0 gradient-brand" />
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-black/10 translate-y-1/3 -translate-x-1/4 blur-2xl" />
        </div>
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="relative z-10 text-center text-white max-w-md">
          {/* Logo */}
          <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-2xl ring-1 ring-white/20 overflow-hidden">
            <Image
              src="/images/branding/logo-white.png"
              alt="RiderGuy"
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
              priority
            />
          </div>

          {/* Illustration */}
          <div className="mx-auto mb-6 w-44 h-44 relative">
            <Image
              src="/images/illustrations/talking-rider.svg"
              alt=""
              width={176}
              height={176}
              className="w-full h-full object-contain drop-shadow-lg"
            />
          </div>

          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">RiderGuy Rider</h1>
          <p className="text-lg text-white/70 mb-8">Deliver packages & earn on your schedule</p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-sm text-white/80 font-medium">
              <Bike className="h-3.5 w-3.5" /> Flexible Hours
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-sm text-white/80 font-medium">
              <MapPin className="h-3.5 w-3.5" /> Live Tracking
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-sm text-white/80 font-medium">
              <Clock className="h-3.5 w-3.5" /> Instant Pay
            </span>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden px-6 py-3.5 safe-area-top">
        <Link href="/" className="inline-flex items-center gap-2.5 text-primary btn-press">
          <div className="h-9 w-9 rounded-xl gradient-brand flex items-center justify-center shadow-lg glow-brand overflow-hidden">
            <Image
              src="/images/branding/logo-white.png"
              alt="RiderGuy"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
              priority
            />
          </div>
          <span className="font-bold text-lg tracking-tight">RiderGuy</span>
        </Link>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/[0.04] blur-[120px]" />
        </div>
        <div className="relative w-full max-w-[420px] animate-page-enter">
          {children}
        </div>
      </div>
    </div>
  );
}
