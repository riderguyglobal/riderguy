'use client';

import React, { type ReactNode } from 'react';
import { AuthProvider } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider apiBaseUrl={API_BASE_URL}>{children}</AuthProvider>;
}
