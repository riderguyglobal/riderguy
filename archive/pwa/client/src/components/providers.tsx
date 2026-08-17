'use client';

import { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query-client';
import { AuthProvider } from '@riderguy/auth';
import { OfflineBanner, InstallBanner } from '@riderguy/ui';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/components/toast';
import { API_BASE_URL } from '@/lib/constants';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider apiBaseUrl={API_BASE_URL}>
          <ToastProvider>
            {children}
            <OfflineBanner />
            <InstallBanner />
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
