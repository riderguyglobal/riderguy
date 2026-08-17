'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// ── Types ──────────────────────────────────────────────
export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** User preference (light | dark | system) */
  theme: Theme;
  /** Actual applied theme after resolving "system" */
  resolvedTheme: ResolvedTheme;
  /** Set theme preference (persists to localStorage) */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
}

// ── Context ────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ── Provider (light-only) ──────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState<Theme>('light');
  const resolvedTheme: ResolvedTheme = 'light';

  // Ensure dark class is never on the root
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#22c55e');
  }, []);

  const setTheme = useCallback((_theme: Theme) => {
    // No-op: light theme only
  }, []);

  const toggleTheme = useCallback(() => {
    // No-op: light theme only
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
