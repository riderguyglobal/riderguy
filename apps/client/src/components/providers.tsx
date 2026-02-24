'use client';

import { ReactNode, useEffect } from 'react';
import { QueryProvider } from '@/lib/query-client';
import { AuthProvider, initApiClient } from '@riderguy/auth';
import { OfflineBanner, InstallBanner } from '@riderguy/ui';
import { API_BASE_URL } from '@/lib/constants';

initApiClient(API_BASE_URL);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider apiBaseUrl={API_BASE_URL}>
        {children}
        <OfflineBanner />
        <InstallBanner />
      </AuthProvider>
    </QueryProvider>
  );
}
