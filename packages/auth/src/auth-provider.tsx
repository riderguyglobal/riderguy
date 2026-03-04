'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useAuthStore, type AuthUser } from './auth-store';
import { getApiClient, initApiClient } from './api-client';
import { tokenStorage } from './token-storage';
import {
  authenticateWithBiometric,
  registerBiometric as registerBiometricFn,
  isBiometricSupported,
  hasBiometricForPhone,
} from './biometric';
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
  /** Raw JWT access token (for raw fetch calls). Always reads the latest value. */
  accessToken: string | null;
  /** Get a fresh access token — always reads from storage, never stale */
  getAccessToken: () => string | null;

  /** Login with phone & OTP code */
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  /** Login with phone & 6-digit PIN */
  loginWithPin: (phone: string, pin: string) => Promise<void>;
  /** Login with fingerprint / Face ID (biometric) */
  loginWithBiometric: (phone: string) => Promise<void>;
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
    pin?: string;
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

  // Biometric helpers
  /** Register a biometric credential for the current user */
  setupBiometric: (friendlyName?: string) => Promise<boolean>;
  /** Check if this device supports biometric auth */
  isBiometricSupported: boolean;
  /** Check what auth methods are available for a phone number */
  checkAuthMethods: (phone: string) => Promise<{ otp: boolean; pin: boolean; biometric: boolean }>;
  /** Check if biometric is registered locally for a phone */
  hasBiometricForPhone: (phone: string) => boolean;
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
  // Use individual selectors to avoid re-render loops from object reference changes
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const error = useAuthStore((s) => s.error);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setError = useAuthStore((s) => s.setError);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const storeLogin = useAuthStore((s) => s.login);
  const storeLogout = useAuthStore((s) => s.logout);

  // Initialise the API client once
  const api = useMemo(() => initApiClient(apiBaseUrl), [apiBaseUrl]);

  // ---------- Session restore ----------
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data as AuthUser);
    } catch {
      clearAuth();
    }
  }, [api, setUser, clearAuth]);

  // Guard against React Strict Mode double-fire
  const sessionRestored = useRef(false);

  useEffect(() => {
    if (sessionRestored.current) return;
    sessionRestored.current = true;

    // First attempt to restore tokens from IndexedDB backup
    // (covers cases where mobile browser evicted localStorage)
    tokenStorage.restoreFromBackup().then(() => {
      if (tokenStorage.hasTokens()) {
        refreshUser().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Auth actions ----------
  const loginWithOtp = useCallback(
    async (phone: string, otp: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post('/auth/login', { phone, otp });
        storeLogin(
          { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken },
          data.data.user
        );
      } catch (err: any) {
        const message =
          err.response?.data?.error?.message ?? 'Login failed. Please try again.';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [api, setLoading, setError, storeLogin]
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post('/auth/login/password', { email, password });
        storeLogin(
          { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken },
          data.data.user
        );
      } catch (err: any) {
        const message =
          err.response?.data?.error?.message ?? 'Login failed. Please try again.';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [api, setLoading, setError, storeLogin]
  );

  const loginWithPin = useCallback(
    async (phone: string, pin: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post('/auth/login/pin', { phone, pin });
        storeLogin(
          { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken },
          data.data.user
        );
      } catch (err: any) {
        const message =
          err.response?.data?.error?.message ?? 'Invalid PIN. Please try again.';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [api, setLoading, setError, storeLogin]
  );

  const loginWithBiometric = useCallback(
    async (phone: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await authenticateWithBiometric(api, phone);
        storeLogin(
          { accessToken: result.accessToken, refreshToken: result.refreshToken },
          result.user
        );
      } catch (err: any) {
        const message =
          err.response?.data?.error?.message ?? err.message ?? 'Biometric login failed.';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [api, setLoading, setError, storeLogin]
  );

  const register = useCallback(
    async (payload: {
      phone: string;
      firstName: string;
      lastName: string;
      email?: string;
      role?: string;
      password?: string;
      pin?: string;
      otpCode: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post('/auth/register', payload);
        storeLogin(
          { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken },
          data.data.user
        );
      } catch (err: any) {
        const message =
          err.response?.data?.error?.message ?? 'Registration failed. Please try again.';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [api, setLoading, setError, storeLogin]
  );

  const requestOtp = useCallback(
    async (phone: string, purpose: string) => {
      await api.post('/auth/otp/request', { phone, purpose });
    },
    [api]
  );

  const verifyOtp = useCallback(
    async (phone: string, code: string, purpose: string): Promise<boolean> => {
      const { data } = await api.post('/auth/otp/verify', { phone, otp: code, purpose });
      return data?.data?.verified ?? true;
    },
    [api]
  );

  const logoutAction = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Server may already have expired the session — still clear locally
    }
    storeLogout();
  }, [api, storeLogout]);

  const setupBiometric = useCallback(
    async (friendlyName?: string): Promise<boolean> => {
      if (!user) throw new Error('Must be logged in to register biometric');
      return registerBiometricFn(api, user.phone, friendlyName);
    },
    [api, user]
  );

  const checkAuthMethodsAction = useCallback(
    async (phone: string) => {
      const { data } = await api.post('/auth/methods', { phone });
      return data.data as { otp: boolean; pin: boolean; biometric: boolean };
    },
    [api]
  );

  const biometricSupported = useMemo(() => isBiometricSupported(), []);

  const getAccessToken = useCallback(() => tokenStorage.getAccessToken(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      error,
      api,
      accessToken: tokenStorage.getAccessToken(),
      getAccessToken,
      loginWithOtp,
      loginWithPin,
      loginWithBiometric,
      loginWithPassword,
      register,
      requestOtp,
      verifyOtp,
      logout: logoutAction,
      refreshUser,
      setupBiometric,
      isBiometricSupported: biometricSupported,
      checkAuthMethods: checkAuthMethodsAction,
      hasBiometricForPhone,
    }),
    [
      user,
      isLoading,
      isAuthenticated,
      error,
      api,
      getAccessToken,
      loginWithOtp,
      loginWithPin,
      loginWithBiometric,
      loginWithPassword,
      register,
      requestOtp,
      verifyOtp,
      logoutAction,
      refreshUser,
      setupBiometric,
      biometricSupported,
      checkAuthMethodsAction,
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
