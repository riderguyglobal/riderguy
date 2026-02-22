'use client';

import React, { useEffect, type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import type { UserRole } from '@riderguy/types';

// ============================================================
// ProtectedRoute — guards pages behind authentication
// ============================================================

interface ProtectedRouteProps {
  children: ReactNode;
  /** Optional list of roles that are allowed. If omitted, any authenticated user passes. */
  allowedRoles?: UserRole[];
  /** Component to render while checking auth (default: null) */
  loadingFallback?: ReactNode;
  /** Called when the user is not authenticated (e.g. router.push('/login')) */
  onUnauthenticated?: () => void;
  /** Called when the user is authenticated but lacks the required role */
  onUnauthorised?: () => void;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  loadingFallback = null,
  onUnauthenticated,
  onUnauthorised,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      onUnauthenticated?.();
      return;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      onUnauthorised?.();
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, onUnauthenticated, onUnauthorised]);

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
