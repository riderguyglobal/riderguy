'use client';

import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white px-6 text-center">
      <div className="h-16 w-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
        <WifiOff className="h-8 w-8 text-surface-400" />
      </div>
      <h2 className="text-xl font-bold text-surface-900 mb-2">You&apos;re Offline</h2>
      <p className="text-surface-500 mb-6">Check your internet connection and try again.</p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
