'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import Image from 'next/image';

/**
 * If the user is already authenticated, redirect to /dashboard.
 * Renders a spinner while checking, then reveals children (the landing UI).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: '#0AB957' }}>
        <Image
          src="/images/branding/logo-wide.png"
          alt="RiderGuy"
          width={200}
          height={60}
          priority
          className="brightness-0 invert"
        />
      </div>
    );
  }

  // Already authenticated — don't flash the landing page while navigating away
  if (user) return null;

  return <>{children}</>;
}
