// ============================================================
// Token Storage — localStorage wrapper with SSR safety
// ============================================================

const ACCESS_TOKEN_KEY = 'riderguy_access_token';
const REFRESH_TOKEN_KEY = 'riderguy_refresh_token';

/** Leeway in seconds — treat a token as expired this many seconds early. */
const EXPIRY_LEEWAY_S = 30;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Decode the payload of a JWT without any library.
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const segment = parts[1];
    if (!segment) return null;
    // Base64url → Base64 → decode
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Returns true if the JWT's `exp` claim is in the past (+ leeway). */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false; // can't determine → assume valid
  return Date.now() / 1000 > payload.exp - EXPIRY_LEEWAY_S;
}

export const tokenStorage = {
  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens(accessToken: string, refreshToken: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clear(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Returns true when usable tokens exist.
   *
   * - If the access token is still valid → true (normal path).
   * - If the access token is expired but the refresh token is valid → true
   *   (the interceptor will refresh automatically).
   * - If both are expired → clears storage and returns false so the
   *   auth provider skips the doomed `/auth/me` call entirely.
   */
  hasTokens(): boolean {
    const access = this.getAccessToken();
    const refresh = this.getRefreshToken();
    if (!access || !refresh) return false;

    // Both tokens present and access token still valid
    if (!isTokenExpired(access)) return true;

    // Access expired — check if refresh can still save us
    if (!isTokenExpired(refresh)) return true;

    // Both expired — proactively clear to avoid 401 noise
    this.clear();
    return false;
  },

  /** Check whether the access token is expired (for manual inspection). */
  isAccessExpired(): boolean {
    const token = this.getAccessToken();
    return !token || isTokenExpired(token);
  },
} as const;
