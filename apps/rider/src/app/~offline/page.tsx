'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@riderguy/ui';

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-surface-950 text-center">
      <div className="h-16 w-16 rounded-full bg-surface-800 flex items-center justify-center mb-6">
        <WifiOff className="h-8 w-8 text-surface-400" />
      </div>
      <h1 className="text-xl font-semibold text-white mb-2">You&apos;re Offline</h1>
      <p className="text-surface-400 mb-8 max-w-xs">Check your internet connection and try again</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="border-surface-700 text-surface-300">
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
    </div>
  );
}
