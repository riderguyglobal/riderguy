'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Button } from '@riderguy/ui';
import { Bike } from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-surface-950">
        <div className="animate-spin-slow">
          <Bike className="h-10 w-10 text-brand-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-surface-950">
      {/* Gradient orb background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-accent-500/8 blur-[100px]" />
      </div>

      <div className="relative z-10 text-center max-w-sm animate-page-enter">
        {/* Logo */}
        <div className="mx-auto mb-8 h-20 w-20 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25">
          <Bike className="h-10 w-10 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Riderguy</h1>
        <p className="text-surface-400 mb-10 text-body-lg">Deliver packages, earn on your schedule</p>

        <div className="space-y-3">
          <Link href="/login" className="block">
            <Button size="xl" className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold">
              Sign In
            </Button>
          </Link>
          <Link href="/register" className="block">
            <Button variant="outline" size="xl" className="w-full border-surface-700 text-surface-300 hover:bg-surface-800">
              Create Account
            </Button>
          </Link>
        </div>

        <p className="mt-8 text-caption text-surface-500">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
