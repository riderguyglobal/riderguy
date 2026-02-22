'use client';

import React, { type ReactNode } from 'react';
import { AuthProvider } from '@riderguy/auth';
import { OfflineBanner, InstallBanner } from '@riderguy/ui';
import { API_BASE_URL } from '@/lib/constants';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider apiBaseUrl={API_BASE_URL}>
      {children}
      <OfflineBanner />
      <InstallBanner appName="RiderGuy" description="Install for faster delivery booking, order tracking, and offline access." />
    </AuthProvider>
  );
}
