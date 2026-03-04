'use client';

import { create } from 'zustand';
import type { UserRole, AccountStatus } from '@riderguy/types';
import { tokenStorage } from './token-storage';

// ============================================================
// Auth User — subset of User returned by GET /auth/me
// ============================================================

export interface AuthUser {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
  roles: UserRole[];
  status: AccountStatus;
  createdAt: string;
}

// ============================================================
// Auth Store — Zustand state for authentication
// ============================================================

export interface AuthState {
  /** Current authenticated user, or null */
  user: AuthUser | null;
  /** Whether we are currently checking / restoring the session */
  isLoading: boolean;
  /** Whether the user is logged in */
  isAuthenticated: boolean;
  /** Last auth-related error */
  error: string | null;

  // ---- Actions ----
  setUser: (user: AuthUser) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
  /**
   * Login action — stores tokens and user.
   */
  login: (tokens: { accessToken: string; refreshToken: string }, user: AuthUser) => void;
  /**
   * Logout action — clears tokens and user.
   */
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true, // true by default — session restore runs on mount
  isAuthenticated: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: true, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  clearAuth: () => {
    tokenStorage.clear();
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },

  login: (tokens, user) => {
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    set({ user, isAuthenticated: true, isLoading: false, error: null });
  },

  logout: () => {
    tokenStorage.clear();
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },
}));
