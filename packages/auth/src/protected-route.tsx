'use client';

import React, { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import type { UserRole } from '@riderguy/types';

// ============================================================
// ProtectedRoute — guards pages behind authentication.
//
// By default, redirects to /login when the user is not
// authenticated (uses window.location for framework-agnostic
// navigation). Pass onUnauthenticated to override.
// ============================================================

interface ProtectedRouteProps {
  children: ReactNode;
  /** Optional list of roles that are allowed. If omitted, any authenticated user passes. */
  allowedRoles?: UserRole[];
  /** Component to render while checking auth (default: centered spinner) */
  loadingFallback?: ReactNode;
  /** Path to redirect to when not authenticated (default: '/login') */
  loginPath?: string;
  /** Called when the user is not authenticated. If not provided, navigates to loginPath. */
  onUnauthenticated?: () => void;
  /** Called when the user is authenticated but lacks the required role */
  onUnauthorised?: () => void;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  loadingFallback,
  loginPath = '/login',
  onUnauthenticated,
  onUnauthorised,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (isLoading || redirectedRef.current) return;

    if (!isAuthenticated) {
      redirectedRef.current = true;
      if (onUnauthenticated) {
        onUnauthenticated();
      } else {
        window.location.replace(loginPath);
      }
      return;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      redirectedRef.current = true;
      if (onUnauthorised) {
        onUnauthorised();
      } else {
        window.location.replace(loginPath);
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, onUnauthenticated, onUnauthorised, loginPath]);

  // Default spinner while loading / redirecting
  const spinner = (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
    </div>
  );

  if (isLoading) {
    return <>{loadingFallback !== undefined ? loadingFallback : spinner}</>;
  }

  if (!isAuthenticated) {
    // Redirect fires via useEffect — show spinner while navigating
    return spinner;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return spinner;
  }

  return <>{children}</>;
}
