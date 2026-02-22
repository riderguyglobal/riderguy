'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuthStore, type AuthUser } from './auth-store';
import { getApiClient, initApiClient } from './api-client';
import { tokenStorage } from './token-storage';
import type { AxiosInstance } from 'axios';

// ============================================================
// Auth Context
// ============================================================

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  api: AxiosInstance;
  /** Raw JWT access token (for raw fetch calls) */
  accessToken: string | null;

  /** Login with phone & OTP code */
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  /** Login with email & password */
  loginWithPassword: (email: string, password: string) => Promise<void>;
  /** Register a new account */
  register: (data: {
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
    role?: string;
    password?: string;
    otpCode: string;
  }) => Promise<void>;
  /** Request an OTP */
  requestOtp: (phone: string, purpose: string) => Promise<void>;
  /** Verify an OTP (standalone — e.g. password reset) */
  verifyOtp: (phone: string, code: string, purpose: string) => Promise<boolean>;
  /** Log out the current session */
  logout: () => Promise<void>;
  /** Refresh user data from the server */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// AuthProvider
// ============================================================

interface AuthProviderProps {
  /** Base URL for the API, e.g. `http://localhost:4000/api/v1` */
  apiBaseUrl: string;
  children: ReactNode;
}

export function AuthProvider({ apiBaseUrl, children }: AuthProviderProps) {
  const store = useAuthStore();

  // Initialise the API client once
  const api = useMemo(() => initApiClient(apiBaseUrl), [apiBaseUrl]);

  // ---------- Session restore ----------
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      store.setUser(data.data as AuthUser);
    } catch {
      store.clearAuth();
    }
  }, [api, store]);

  useEffect(() => {
    if (tokenStorage.hasTokens()) {
      refreshUser().finally(() => store.setLoading(false));
    } else {
      store.setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Auth actions ----------
  const loginWithOtp = useCallback(
    async (phone: string, otp: string) => {
      store.setLoading(true);
      store.setError(null);
      try {
        const { data } = await api.post('/auth/login', { phone, otp });
        store.login(
          { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken },
          data.data.user
        );
      } catch (err: any) {
        const message =
          err.response?.data?.error?.message ?? 'Login failed. Please try again.';
        store.setError(message);
        throw err;
      } finally {
        store.setLoading(false);
      }
    },
    [api, store]
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      store.setLoading(true);
      store.setError(null);
      try {
        const { data } = await api.post('/auth/login/password', { email, password });
        store.login(
          { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken },
          data.data.user
        );
      } catch (err: any) {
        const message =
          err.response?.data?.error?.message ?? 'Login failed. Please try again.';
        store.setError(message);
        throw err;
      } finally {
        store.setLoading(false);
      }
    },
    [api, store]
  );

  const register = useCallback(
    async (payload: {
      phone: string;
      firstName: string;
      lastName: string;
      email?: string;
      role?: string;
      password?: string;
      otpCode: string;
    }) => {
      store.setLoading(true);
      store.setError(null);
      try {
        const { data } = await api.post('/auth/register', payload);
        store.login(
          { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken },
          data.data.user
        );
      } catch (err: any) {
        const message =
          err.response?.data?.error?.message ?? 'Registration failed. Please try again.';
        store.setError(message);
        throw err;
      } finally {
        store.setLoading(false);
      }
    },
    [api, store]
  );

  const requestOtp = useCallback(
    async (phone: string, purpose: string) => {
      await api.post('/auth/otp/request', { phone, purpose });
    },
    [api]
  );

  const verifyOtp = useCallback(
    async (phone: string, code: string, purpose: string): Promise<boolean> => {
      try {
        await api.post('/auth/otp/verify', { phone, code, purpose });
        return true;
      } catch {
        return false;
      }
    },
    [api]
  );

  const logoutAction = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Server may already have expired the session — still clear locally
    }
    store.logout();
  }, [api, store]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: store.user,
      isLoading: store.isLoading,
      isAuthenticated: store.isAuthenticated,
      error: store.error,
      api,
      accessToken: tokenStorage.getAccessToken(),
      loginWithOtp,
      loginWithPassword,
      register,
      requestOtp,
      verifyOtp,
      logout: logoutAction,
      refreshUser,
    }),
    [
      store.user,
      store.isLoading,
      store.isAuthenticated,
      store.error,
      api,
      loginWithOtp,
      loginWithPassword,
      register,
      requestOtp,
      verifyOtp,
      logoutAction,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// useAuth Hook
// ============================================================

/**
 * Returns the auth context. Must be used inside an `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
