'use client';

import { useEffect, useRef } from 'react';
import { AuthProvider, useAuthStore } from '@riderguy/auth';
import { OfflineBanner, InstallBanner } from '@riderguy/ui';
import { QueryProvider, queryClient } from '@/lib/query-client';
import { ThemeProvider } from '@/lib/theme';
import { API_BASE_URL } from '@/lib/constants';
import { disconnectSocket } from '@/hooks/use-socket';
import type { ReactNode } from 'react';

/** PW-01 + RT-01: Clean up caches, socket, and queries on logout */
function LogoutCleanup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wasAuthenticated = useRef(isAuthenticated);

  useEffect(() => {
    // Detect transition from authenticated → unauthenticated (logout)
    if (wasAuthenticated.current && !isAuthenticated) {
      // RT-01: Destroy the shared socket so the next user gets a fresh connection
      disconnectSocket();

      // PW-01: Tell the service worker to purge cached authenticated API data
      navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_CACHES' });

      // Clear React Query cache so the next user doesn't see stale data
      queryClient.clear();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider apiBaseUrl={API_BASE_URL}>
          <LogoutCleanup />
          {children}
          <OfflineBanner />
          <InstallBanner />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
