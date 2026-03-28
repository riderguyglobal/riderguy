'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Button } from '@riderguy/ui';
import Image from 'next/image';
import { ArrowRight, Zap, Shield, MapPin, Star } from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-page">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-3xl bg-brand-500/20 blur-2xl animate-pulse" />
          <Image src="/images/branding/logo-square.png" alt="RiderGuy" width={192} height={192} className="relative h-20 w-20 rounded-3xl object-contain" priority />
          <div className="absolute -inset-2 rounded-[28px] border-2 border-brand-500/30 animate-pulse-ring" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-page relative overflow-hidden">
      {/* Single ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/[0.04] blur-[160px]" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 safe-area-top px-6 pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl overflow-hidden shadow-lg ring-1 ring-brand-500/10">
            <Image src="/images/branding/logo-square.png" alt="RiderGuy" width={192} height={192} className="h-9 w-9 object-cover" priority />
          </div>
          <span className="text-lg font-extrabold text-primary tracking-tight">RiderGuy</span>
        </div>
        <Link href="/login" className="text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors px-4 py-2 rounded-xl hover:bg-brand-500/5">
          Sign In
        </Link>
      </header>

      {/* ── Hero ── */}
      <div className={`relative z-10 flex-1 flex flex-col items-center justify-center px-6 transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center max-w-lg w-full">

          {/* Illustration */}
          <div className="relative w-52 h-52 sm:w-60 sm:h-60 mb-8">
            <div className="absolute inset-0 scale-[1.4] rounded-full bg-brand-500/[0.06] blur-3xl" />
            <Image
              src="/images/illustrations/maps-bike.svg"
              alt="Rider on delivery"
              width={240}
              height={240}
              className="relative w-full h-full object-contain drop-shadow-lg animate-page-enter"
              priority
            />
          </div>

          {/* Tagline — 4 powerful phrases */}
          <div className="text-center space-y-0.5 mb-4 animate-slide-up stagger-1">
            <h1 className="text-[2rem] sm:text-4xl font-extrabold text-primary tracking-tight leading-[1.15]">
              <span className="block">Deliver Safely.</span>
              <span className="block text-gradient-brand">Earn More.</span>
              <span className="block">Prioritize Your Welfare.</span>
              <span className="block text-muted">Secure Your Future.</span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className="text-muted text-base text-center mb-8 max-w-xs animate-slide-up stagger-2">
            Join Ghana&apos;s fastest-growing delivery network.
          </p>

          {/* CTAs */}
          <div className="space-y-3 w-full max-w-sm animate-slide-up stagger-3">
            <Link href="/register" className="block">
              <Button size="xl" className="w-full gradient-brand text-white font-bold text-base h-14 rounded-2xl shadow-lg glow-brand hover:brightness-110 transition-all btn-press group">
                Start Earning Today
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <Link href="/login" className="block">
              <Button variant="outline" size="xl" className="w-full glass border-themed-strong text-secondary hover:bg-hover-themed font-semibold text-base h-14 rounded-2xl btn-press">
                I already have an account
              </Button>
            </Link>
          </div>

          {/* Trust indicators — minimal icon + text */}
          <div className="flex items-center justify-center gap-5 flex-wrap mt-8 animate-slide-up stagger-4">
            {[
              { icon: Zap, text: 'Instant Pay' },
              { icon: Shield, text: 'Fully Insured' },
              { icon: MapPin, text: 'GPS Tracked' },
              { icon: Star, text: '4.9★ Rated' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-subtle text-xs">
                <Icon className="h-3.5 w-3.5" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center mt-6 mb-4 text-[11px] text-subtle leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="https://myriderguy.com/terms" target="_blank" rel="noopener noreferrer" className="text-muted underline underline-offset-2">Terms</a>
            {' & '}
            <a href="https://myriderguy.com/privacy" target="_blank" rel="noopener noreferrer" className="text-muted underline underline-offset-2">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
