'use client';

import Link from 'next/link';
import { Bike } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-[#0a0e17]">
      {/* Desktop branded panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center p-12">
        {/* Gradient background */}
        <div className="absolute inset-0 gradient-brand" />
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-black/10 translate-y-1/3 -translate-x-1/4 blur-2xl" />
        </div>
        <div className="absolute inset-0 opacity-[0.05]">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        </div>
        <div className="relative z-10 text-center text-white max-w-md">
          <div className="mx-auto mb-8 h-20 w-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-2xl">
            <Bike className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-extrabold mb-4 tracking-tight">Riderguy Rider</h1>
          <p className="text-xl text-white/70 mb-10">Deliver packages and earn on your schedule</p>
          <div className="flex items-center justify-center gap-8 text-sm text-white/50">
            <div><span className="block text-2xl font-bold text-white">1000+</span>Active Riders</div>
            <div className="h-10 w-px bg-white/15" />
            <div><span className="block text-2xl font-bold text-white">50K+</span>Deliveries</div>
            <div className="h-10 w-px bg-white/15" />
            <div><span className="block text-2xl font-bold text-white">4.8★</span>Rating</div>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden px-6 pt-6 pb-4 safe-area-top">
        <Link href="/" className="inline-flex items-center gap-2.5 text-white btn-press">
          <div className="h-9 w-9 rounded-xl gradient-brand flex items-center justify-center shadow-lg glow-brand">
            <Bike className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Riderguy</span>
        </Link>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/[0.04] blur-[120px]" />
        </div>
        <div className="relative w-full max-w-md animate-page-enter">
          {children}
        </div>
      </div>
    </div>
  );
}
