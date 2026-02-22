'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@riderguy/auth';
import { Button, Spinner } from '@riderguy/ui';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      {/* Logo / Hero */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-500">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-brand-500">RiderGuy</h1>
        <p className="text-lg text-surface-500">Rider App</p>
      </div>

      {/* CTA Buttons */}
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" className="w-full" onClick={() => router.push('/register')}>
          Get Started
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push('/login')}
        >
          Sign In
        </Button>
      </div>

      <p className="text-sm text-surface-400">
        Deliver with confidence. Earn with pride.
      </p>
    </main>
  );
}
