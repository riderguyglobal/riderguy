'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './use-socket';

/**
 * Foreground Recovery — resynchronizes all state when the client app
 * returns from background.
 *
 * On visibility change to 'visible':
 * 1. Forces socket reconnect if disconnected
 * 2. Invalidates React Query caches for immediate refetch
 *
 * Critical for ensuring the client sees the latest order status
 * (especially "Rider Found") when they return to the app.
 */
export function useForegroundRecovery() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const lastBackgroundedRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastBackgroundedRef.current = Date.now();
        return;
      }

      // Returning to foreground
      const backgroundDuration = lastBackgroundedRef.current
        ? Date.now() - lastBackgroundedRef.current
        : 0;
      lastBackgroundedRef.current = null;

      // 1. Force socket reconnect if disconnected
      if (socket && !socket.connected) {
        socket.connect();
      }

      // 2. Invalidate caches based on how long we were away
      if (backgroundDuration > 5_000) {
        queryClient.invalidateQueries();
      } else {
        queryClient.invalidateQueries({ queryKey: ['order'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [socket, queryClient]);
}
