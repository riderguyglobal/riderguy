'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@riderguy/ui';

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-[#0a0e17] text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-surface-500/10 blur-2xl scale-150" />
        <div className="relative h-20 w-20 rounded-full glass flex items-center justify-center">
          <WifiOff className="h-9 w-9 text-surface-400" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">You&apos;re Offline</h1>
      <p className="text-surface-400 mb-8 max-w-xs text-sm leading-relaxed">
        Check your internet connection and try again to continue delivering
      </p>
      <Button
        onClick={() => window.location.reload()}
        className="gradient-brand text-white rounded-2xl px-8 py-3 font-medium shadow-lg glow-brand btn-press"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
    </div>
  );
}
