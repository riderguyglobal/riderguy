'use client';

import React, { type ReactNode } from 'react';
import { AuthProvider } from '@riderguy/auth';
import { OfflineBanner, InstallBanner } from '@riderguy/ui';
import { API_BASE_URL } from '@/lib/constants';

// ============================================================
// Providers — wraps the app with AuthProvider (client component)
// ============================================================

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider apiBaseUrl={API_BASE_URL}>
      {children}
      <OfflineBanner />
      <InstallBanner appName="RiderGuy Rider" description="Install for instant job alerts, offline mode, and one-tap access." />
    </AuthProvider>
  );
}
