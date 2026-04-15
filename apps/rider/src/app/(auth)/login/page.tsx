'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  function handleLogin() {
    setAnimatingOut(true);
    setTimeout(() => router.push('/login/authenticate'), 200);
  }

  function handleSignup() {
    setAnimatingOut(true);
    setTimeout(() => router.push('/signup'), 200);
  }

  return (
    <div
      className={`flex flex-col items-center transition-all duration-200 ${
        animatingOut ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      {/* Heading */}
      <div className="flex flex-col items-center lg:items-start text-center lg:text-left mb-8 w-full">
        <h1 className="text-3xl font-bold text-primary tracking-tight leading-tight">
          Start earning<br />with every ride
        </h1>
        <p className="text-muted mt-3 text-base">
          Deliver, earn, and grow your income daily.
        </p>
      </div>

      {/* Actions */}
      <div className="w-full max-w-md space-y-3">
        {/* Primary CTA */}
        <button
          onClick={handleSignup}
          className="w-full py-4 gradient-brand text-white font-semibold rounded-2xl active:scale-[0.98] transition-all duration-200 shadow-lg shadow-brand-500/25 text-base btn-press"
        >
          Start Earning Today
        </button>

        {/* Login link */}
        <button
          onClick={handleLogin}
          className="w-full py-4 bg-card text-primary font-semibold rounded-2xl border border-themed-strong active:scale-[0.98] hover:bg-card-alt transition-all duration-200 text-base"
        >
          I already have an account
        </button>

        {/* Recovery */}
        <div className="text-center mt-5">
          <button
            onClick={() => router.push('/recovery')}
            className="text-muted text-sm hover:text-secondary transition-colors"
          >
            Forgot your PIN?
          </button>
        </div>

        {/* Cross-link */}
        <div className="mt-6 pt-5 border-t border-themed">
          <p className="text-muted text-sm text-center">
            Need to send a package?{' '}
            <a
              href="https://app.myriderguy.com"
              className="text-brand-400 font-medium hover:text-brand-300 transition-colors"
            >
              Use as a client
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

