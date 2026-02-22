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
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/images/branding/logo-black-on-white.png"
          alt="RiderGuy"
          width={180}
          height={60}
          className="h-14 w-auto"
          priority
        />
        <p className="text-lg text-surface-500">Send a Package</p>
        <Image
          src="/images/illustrations/handing-over.svg"
          alt="Package delivery"
          width={240}
          height={240}
          className="mt-2 h-48 w-auto"
        />
      </div>

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

      <p className="text-sm text-surface-400">Fast. Reliable. Trackable.</p>
    </main>
  );
}
