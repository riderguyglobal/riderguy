'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Button } from '@riderguy/ui';
import { Bike, ChevronRight, Zap, Shield, MapPin } from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0e17]">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-xl animate-pulse" />
          <div className="relative animate-spin-slow">
            <Bike className="h-12 w-12 text-brand-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0a0e17] relative overflow-hidden">
      {/* Ambient glow backgrounds */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/[0.06] blur-[150px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-accent-500/[0.04] blur-[120px]" />
        <div className="absolute top-[60%] left-[5%] w-[300px] h-[300px] rounded-full bg-purple-500/[0.03] blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 safe-area-top px-6 pt-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl gradient-brand flex items-center justify-center shadow-lg glow-brand">
          <Bike className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">Riderguy</span>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 animate-page-enter">
        <div className="text-center max-w-sm">
          {/* Logo mark */}
          <div className="mx-auto mb-10 relative">
            <div className="absolute inset-0 rounded-3xl bg-brand-500/20 blur-2xl scale-150 animate-pulse-glow" />
            <div className="relative h-24 w-24 mx-auto rounded-3xl gradient-brand flex items-center justify-center shadow-2xl">
              <Bike className="h-12 w-12 text-white" />
            </div>
          </div>

          <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
            Deliver & Earn
          </h1>
          <p className="text-surface-400 text-lg leading-relaxed mb-10">
            Join thousands of riders earning on their own schedule
          </p>

          {/* Feature pills */}
          <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
            {[
              { icon: Zap, text: 'Instant Pay' },
              { icon: Shield, text: 'Insured' },
              { icon: MapPin, text: 'Live Tracking' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs text-surface-300">
                <Icon className="h-3 w-3 text-brand-400" />
                {text}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Link href="/login" className="block">
              <Button
                size="xl"
                className="w-full gradient-brand text-white font-semibold text-base py-4 rounded-2xl shadow-lg glow-brand hover:brightness-110 transition-all btn-press"
              >
                Sign In
                <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </Link>
            <Link href="/register" className="block">
              <Button
                variant="outline"
                size="xl"
                className="w-full border-white/10 text-surface-300 hover:bg-white/5 font-medium text-base py-4 rounded-2xl btn-press"
              >
                Create Account
              </Button>
            </Link>
          </div>

          <p className="mt-8 text-xs text-surface-600">
            By continuing, you agree to our Terms of Service & Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
