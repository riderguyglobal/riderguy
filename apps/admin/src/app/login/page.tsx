'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@riderguy/auth';
import { Button, Input, Label } from '@riderguy/ui';

// ============================================================
// Admin Login — email + password (no OTP for admin portal)
// ============================================================

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginWithPassword, isLoading, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError ?? error;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!email.trim()) {
        setLocalError('Please enter your email address.');
        return;
      }
      if (!password) {
        setLocalError('Please enter your password.');
        return;
      }

      setLocalError(null);
      setSubmitting(true);

      try {
        await loginWithPassword(email.trim(), password);
        router.replace('/dashboard');
      } catch {
        setLocalError('Invalid email or password.');
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, loginWithPassword, router]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image
            src="/images/branding/logo-wide.png"
            alt="RiderGuy"
            width={600}
            height={150}
            className="h-12 w-auto"
            priority
          />
          <p className="text-sm text-gray-400">Operations Portal</p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Sign in</h2>
          <p className="mb-6 text-sm text-gray-500">
            Enter your admin credentials to continue.
          </p>

          {displayError && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@riderguy.com"
                required
                disabled={submitting || isLoading}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={submitting || isLoading}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting || isLoading}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} RiderGuy. All rights reserved.
        </p>
      </div>
    </div>
  );
}
