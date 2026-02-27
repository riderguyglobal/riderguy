'use client';

import { AuthProvider } from '@riderguy/auth';
import { OfflineBanner, InstallBanner } from '@riderguy/ui';
import { QueryProvider } from '@/lib/query-client';
import { ThemeProvider } from '@/lib/theme';
import { API_BASE_URL } from '@/lib/constants';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider apiBaseUrl={API_BASE_URL}>
          {children}
          <OfflineBanner />
          <InstallBanner />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
