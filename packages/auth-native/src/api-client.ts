import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './token-storage';
import { useAuthStore } from './auth-store';

let apiInstance: AxiosInstance | null = null;
let isRefreshing = false;
type RefreshQueueEntry = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let refreshQueue: RefreshQueueEntry[] = [];

function settleRefreshQueue(error?: unknown, token?: string): void {
  const queuedRequests = refreshQueue;
  refreshQueue = [];

  queuedRequests.forEach((entry) => {
    if (error || !token) {
      entry.reject(error ?? new Error('Token refresh did not return an access token.'));
      return;
    }
    entry.resolve(token);
  });
}

function normalizeBaseURL(baseURL: string): string {
  const trimmed = baseURL
    .trim()
    .replace('api.riderguy.com', 'api.myriderguy.com')
    .replace(/\/+$/, '');
  if (!trimmed) throw new Error('API URL is not configured.');

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('API URL must start with http:// or https://.');
    }
    return url.toString().replace(/\/+$/, '');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('API URL')) {
      throw error;
    }
    throw new Error(`Invalid API URL: ${baseURL}`);
  }
}

export function initApiClient(baseURL: string): AxiosInstance {
  if (apiInstance) return apiInstance;
  const normalizedBaseURL = normalizeBaseURL(baseURL);

  apiInstance = axios.create({
    baseURL: normalizedBaseURL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Attach access token to every request
  apiInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await tokenStorage.getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // On 401: refresh token, replay the original request
  apiInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (newToken: string) => {
              originalRequest.headers = originalRequest.headers ?? {};
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(apiInstance!(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${normalizedBaseURL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken: unknown = data.data?.accessToken ?? data.accessToken;
        if (typeof newAccessToken !== 'string' || !newAccessToken) {
          throw new Error('Token refresh did not return an access token.');
        }
        await tokenStorage.setAccessToken(newAccessToken);

        settleRefreshQueue(undefined, newAccessToken);

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiInstance!(originalRequest);
      } catch (refreshError) {
        settleRefreshQueue(refreshError);
        await tokenStorage.clearTokens();
        // A rejected/expired refresh token ends the authenticated session.
        // Clear in-memory identity synchronously so protected screens and
        // user-scoped query providers cannot keep rendering stale account data.
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    },
  );

  return apiInstance;
}

export function getApiClient(): AxiosInstance {
  if (!apiInstance) throw new Error('API client not initialized. Call initApiClient() first.');
  return apiInstance;
}

export function resetApiClient(): void {
  apiInstance = null;
  isRefreshing = false;
  refreshQueue = [];
}
