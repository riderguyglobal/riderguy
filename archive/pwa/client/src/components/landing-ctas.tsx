'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function LandingCTAs() {
  return (
    <div className="w-full max-w-sm space-y-3 animate-slide-up stagger-4">
      <Link
        href="/login"
        className="w-full flex items-center justify-center gap-2 h-13 rounded-2xl brand-gradient text-white font-semibold text-base shadow-brand hover:shadow-lg transition-all btn-press"
      >
        Sign In
        <ArrowRight className="h-4.5 w-4.5" />
      </Link>

      <Link
        href="/register"
        className="w-full flex items-center justify-center h-13 rounded-2xl border-2 border-surface-200 text-surface-700 font-semibold text-base hover:bg-surface-50 hover:border-surface-300 transition-all btn-press"
      >
        Create Account
      </Link>
    </div>
  );
}
