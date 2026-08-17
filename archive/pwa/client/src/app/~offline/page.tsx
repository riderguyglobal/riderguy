'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white px-6 text-center animate-page-enter">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-surface-200/50 rounded-full blur-2xl scale-150" />
        <div className="relative h-20 w-20 rounded-full bg-surface-100 flex items-center justify-center">
          <WifiOff className="h-9 w-9 text-surface-400" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-surface-900 mb-2">You&apos;re Offline</h2>
      <p className="text-surface-500 text-sm mb-8 max-w-xs">
        Check your internet connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl brand-gradient text-white text-sm font-semibold shadow-brand hover:shadow-lg transition-all btn-press"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  );
}
