import { create } from 'zustand';
import type { UserRole, AccountStatus } from '@riderguy/types';

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  roles?: UserRole[];
  status: AccountStatus;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false, error: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  clearAuth: () =>
    set({ user: null, isAuthenticated: false, isLoading: false, error: null }),
}));
