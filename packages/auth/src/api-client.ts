import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './token-storage';
import { useAuthStore } from './auth-store';

// ============================================================
// API Client — Axios instance with auth interceptors
// ============================================================

let apiClient: AxiosInstance | null = null;

/**
 * Initialise (or reinitialise) the shared Axios API client.
 *
 * Must be called once at app bootstrap with the correct `baseURL`
 * so all subsequent requests hit the right backend.
 *
 * ```ts
 * initApiClient('http://localhost:4000/api/v1');
 * ```
 */
export function initApiClient(baseURL: string): AxiosInstance {
  apiClient = axios.create({
    baseURL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  });

  // ---- Request interceptor — attach access token ----
  apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // ---- Response interceptor — auto-refresh on 401 ----
  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
  }> = [];

  function processQueue(error: unknown, token: string | null) {
    failedQueue.forEach((p) => {
      if (error) {
        p.reject(error);
      } else {
        p.resolve(token!);
      }
    });
    failedQueue = [];
  }

  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // Only attempt refresh for 401 and when we have a refresh token
      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        // Clear both tokens AND Zustand state to stay consistent
        useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue the request and wait for the refresh to finish
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((accessToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return apiClient!.request(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${apiClient!.defaults.baseURL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken: string = data.data.accessToken;
        const newRefreshToken: string = data.data.refreshToken;

        tokenStorage.setTokens(newAccessToken, newRefreshToken);
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient!.request(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Clear both tokens AND Zustand state to stay consistent
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
  );

  return apiClient;
}

/**
 * Returns the shared API client.
 *
 * Throws if `initApiClient` has not been called yet.
 */
export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    throw new Error(
      'API client not initialised. Call initApiClient(baseURL) at app startup.'
    );
  }
  return apiClient;
}
