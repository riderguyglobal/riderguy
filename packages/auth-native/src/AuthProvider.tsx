import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuthStore, type AuthUser } from './auth-store';
import { tokenStorage } from './token-storage';
import { getApiClient } from './api-client';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  api: ReturnType<typeof getApiClient>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  expectedRole?: 'CLIENT' | 'RIDER' | 'PARTNER';
}

function hasExpectedRole(user: AuthUser | null, expectedRole?: AuthProviderProps['expectedRole']) {
  if (!expectedRole || !user) return true;
  const roles = user.roles?.map(String) ?? [];
  return String(user.role) === expectedRole || roles.includes(expectedRole);
}

export function AuthProvider({ children, expectedRole }: AuthProviderProps) {
  const { user, isLoading, isAuthenticated, setUser, setLoading, clearAuth } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const accessToken = await tokenStorage.getAccessToken();
        if (!accessToken) {
          if (mounted) setLoading(false);
          return;
        }

        const api = getApiClient();
        const { data } = await api.get('/auth/me');
        const profile = data.data ?? data;

        if (!hasExpectedRole(profile, expectedRole)) {
          await tokenStorage.clearTokens();
          if (mounted) clearAuth();
          return;
        }

        if (mounted) setUser(profile);
      } catch (error) {
        // Only discard the session when the server explicitly rejects it.
        // A network failure (offline launch, flaky data) must not log the user out.
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          await tokenStorage.clearTokens();
          if (mounted) clearAuth();
          return;
        }
        if (mounted) setLoading(false);
      }
    }

    restoreSession();
    return () => { mounted = false; };
  }, [setUser, setLoading, clearAuth, expectedRole]);

  const logout = async () => {
    try {
      const api = getApiClient();
      await api.post('/auth/logout').catch(() => { });
    } finally {
      await tokenStorage.clearTokens();
      clearAuth();
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated, api: getApiClient(), logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
