'use client';

import Link from 'next/link';
import { Bike } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-surface-950">
      {/* Desktop branded panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-cyan-400 items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        </div>
        <div className="relative z-10 text-center text-white max-w-md">
          <div className="mx-auto mb-8 h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Bike className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Riderguy Rider</h1>
          <p className="text-xl text-white/80 mb-8">Deliver packages and earn on your schedule</p>
          <div className="flex items-center justify-center gap-8 text-sm text-white/60">
            <div><span className="block text-2xl font-bold text-white">1000+</span>Active Riders</div>
            <div className="h-10 w-px bg-white/20" />
            <div><span className="block text-2xl font-bold text-white">50K+</span>Deliveries</div>
            <div className="h-10 w-px bg-white/20" />
            <div><span className="block text-2xl font-bold text-white">4.8★</span>Rating</div>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden px-6 pt-6 pb-4 safe-area-top">
        <Link href="/" className="inline-flex items-center gap-2 text-white">
          <div className="h-9 w-9 rounded-lg bg-brand-500 flex items-center justify-center">
            <Bike className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg">Riderguy</span>
        </Link>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md animate-page-enter">
          {children}
        </div>
      </div>
    </div>
  );
}
