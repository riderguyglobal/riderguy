'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import Image from 'next/image';
import { ArrowRight, Zap, Shield, Clock } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="h-10 w-10 rounded-full border-3 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white relative overflow-hidden animate-page-enter">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-500/[0.04] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[30rem] h-[30rem] rounded-full bg-accent-500/[0.04] blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-brand-400/[0.03] blur-2xl animate-float" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Logo */}
        <div className="relative mb-8 animate-bounce-in">
          <div className="absolute inset-0 rounded-3xl bg-brand-500/20 blur-2xl scale-150" />
          <div className="relative h-20 w-20 rounded-3xl brand-gradient-radial flex items-center justify-center shadow-brand overflow-hidden">
            <Image
              src="/images/branding/logo-white.png"
              alt="RiderGuy"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
              priority
            />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-surface-900 mb-2 text-center animate-slide-up stagger-1">
          Rider<span className="text-brand-500">Guy</span>
        </h1>
        <p className="text-surface-500 text-center max-w-xs mb-8 animate-slide-up stagger-2">
          Send packages across the city. Fast, reliable, with real-time tracking.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 animate-fade-in stagger-3">
          {[
            { icon: Zap, text: 'Instant Pickup', color: 'text-brand-500 bg-brand-50' },
            { icon: Shield, text: 'Insured Delivery', color: 'text-accent-500 bg-accent-50' },
            { icon: Clock, text: 'Live Tracking', color: 'text-amber-500 bg-amber-50' },
          ].map(({ icon: Icon, text, color }) => (
            <div key={text} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>
              <Icon className="h-3.5 w-3.5" />
              {text}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="w-full max-w-sm space-y-3 animate-slide-up stagger-4">
          <button
            onClick={() => router.push('/login')}
            className="w-full flex items-center justify-center gap-2 h-13 rounded-2xl brand-gradient text-white font-semibold text-base shadow-brand hover:shadow-lg transition-all btn-press"
          >
            Sign In
            <ArrowRight className="h-4.5 w-4.5" />
          </button>

          <button
            onClick={() => router.push('/register')}
            className="w-full h-13 rounded-2xl border-2 border-surface-200 text-surface-700 font-semibold text-base hover:bg-surface-50 hover:border-surface-300 transition-all btn-press"
          >
            Create Account
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-surface-400 pb-8 safe-area-bottom">
        &copy; {new Date().getFullYear()} RiderGuy Global
      </p>
    </div>
  );
}
