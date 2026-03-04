'use client';

import { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query-client';
import { AuthProvider } from '@riderguy/auth';
import { OfflineBanner, InstallBanner } from '@riderguy/ui';
import { ThemeProvider } from '@/lib/theme';
import { API_BASE_URL } from '@/lib/constants';

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
