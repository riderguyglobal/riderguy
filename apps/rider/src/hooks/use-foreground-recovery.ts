'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './use-socket';

/**
 * Foreground Recovery — resynchronizes all state when the app returns
 * from background (e.g., after a phone call or app switch).
 *
 * On visibility change to 'visible':
 * 1. Forces socket reconnect if disconnected
 * 2. Invalidates all React Query caches for immediate refetch
 * 3. Re-acquires wake lock (handled by useWakeLock separately)
 *
 * This is critical for PWAs where the browser may throttle or kill
 * background processes, causing stale data and missed events.
 */
export function useForegroundRecovery(isOnline: boolean) {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const lastBackgroundedRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Record when we went to background
        lastBackgroundedRef.current = Date.now();
        return;
      }

      // Returning to foreground
      const backgroundDuration = lastBackgroundedRef.current
        ? Date.now() - lastBackgroundedRef.current
        : 0;
      lastBackgroundedRef.current = null;

      console.log(`[ForegroundRecovery] Returning after ${Math.round(backgroundDuration / 1000)}s in background`);

      // 1. Force socket reconnect if disconnected
      if (socket && !socket.connected) {
        console.log('[ForegroundRecovery] Socket disconnected — reconnecting...');
        socket.connect();
      }

      // 2. Invalidate all React Query caches
      // Only do full invalidation if we were backgrounded for more than 5 seconds
      if (backgroundDuration > 5_000) {
        console.log('[ForegroundRecovery] Invalidating all queries after extended background');
        queryClient.invalidateQueries();
      } else {
        // Light invalidation: only critical data
        queryClient.invalidateQueries({ queryKey: ['active-orders'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [socket, connected, queryClient, isOnline]);
}
