'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { Package, ArrowRight } from 'lucide-react';
import { Button } from '@riderguy/ui';

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
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/5 rounded-full -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-500/5 rounded-full translate-y-1/2 -translate-x-1/3" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Logo */}
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg mb-6 animate-bounce-in">
          <Package className="h-10 w-10 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-surface-900 mb-2 text-center">
          Rider<span className="text-brand-500">Guy</span>
        </h1>
        <p className="text-surface-500 text-center max-w-xs mb-10">
          Send packages across the city. Fast, reliable, with real-time tracking.
        </p>

        <div className="w-full max-w-sm space-y-3">
          <Button
            size="xl"
            className="w-full bg-brand-500 hover:bg-brand-600 text-white"
            onClick={() => router.push('/login')}
          >
            Sign In
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>

          <Button
            size="xl"
            variant="outline"
            className="w-full border-surface-200 text-surface-700 hover:bg-surface-50"
            onClick={() => router.push('/register')}
          >
            Create Account
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-surface-400 pb-8 safe-area-bottom">
        &copy; {new Date().getFullYear()} RiderGuy Global
      </p>
    </div>
  );
}
