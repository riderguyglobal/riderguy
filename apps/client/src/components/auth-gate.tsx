'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';

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
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="h-10 w-10 rounded-full border-3 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Already authenticated — don't flash the landing page while navigating away
  if (user) return null;

  return <>{children}</>;
}
