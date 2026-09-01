import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const requestUse = vi.fn();
  const responseUse = vi.fn();
  const request = vi.fn();
  const instance = Object.assign(request, {
    interceptors: {
      request: { use: requestUse },
      response: { use: responseUse },
    },
  });

  return {
    axiosCreate: vi.fn(() => instance),
    axiosPost: vi.fn(),
    clearTokens: vi.fn(),
    clearAuth: vi.fn(),
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    instance,
    requestUse,
    responseUse,
    setAccessToken: vi.fn(),
  };
});

vi.mock('axios', () => ({
  default: {
    create: mocks.axiosCreate,
    post: mocks.axiosPost,
  },
}));

vi.mock('./token-storage', () => ({
  tokenStorage: {
    clearTokens: mocks.clearTokens,
    getAccessToken: mocks.getAccessToken,
    getRefreshToken: mocks.getRefreshToken,
    setAccessToken: mocks.setAccessToken,
  },
}));

vi.mock('./auth-store', () => ({
  useAuthStore: {
    getState: () => ({ clearAuth: mocks.clearAuth }),
  },
}));

import { initApiClient, resetApiClient } from './api-client';

type RejectionInterceptor = (error: {
  config: { headers?: Record<string, string>; _retry?: boolean };
  response: { status: number };
}) => Promise<unknown>;

function getRejectionInterceptor(): RejectionInterceptor {
  const lastRegistration = mocks.responseUse.mock.calls.at(-1);
  if (!lastRegistration) throw new Error('Response interceptor was not registered.');
  return lastRegistration[1] as RejectionInterceptor;
}

function unauthorizedError() {
  return {
    config: { headers: {} },
    response: { status: 401 },
  };
}

describe('native API token refresh', () => {
  beforeEach(() => {
    resetApiClient();
    vi.clearAllMocks();
    mocks.getRefreshToken.mockResolvedValue('refresh-token');
    mocks.setAccessToken.mockResolvedValue(undefined);
    mocks.clearTokens.mockResolvedValue(undefined);
    mocks.instance.mockResolvedValue({ data: 'replayed' });
  });

  it('replays every queued request after one successful refresh', async () => {
    let finishRefresh!: (value: unknown) => void;
    mocks.axiosPost.mockImplementation(() => new Promise((resolve) => {
      finishRefresh = resolve;
    }));

    initApiClient('https://api.myriderguy.com/api/v1');
    const rejectResponse = getRejectionInterceptor();
    const first = rejectResponse(unauthorizedError());
    const second = rejectResponse(unauthorizedError());

    await vi.waitFor(() => expect(mocks.axiosPost).toHaveBeenCalledTimes(1));
    finishRefresh({ data: { data: { accessToken: 'new-access-token' } } });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { data: 'replayed' },
      { data: 'replayed' },
    ]);
    expect(mocks.axiosPost).toHaveBeenCalledTimes(1);
    expect(mocks.instance).toHaveBeenCalledTimes(2);
    expect(mocks.clearTokens).not.toHaveBeenCalled();
  });

  it('rejects every queued request when refresh fails', async () => {
    let failRefresh!: (error: unknown) => void;
    mocks.axiosPost.mockImplementation(() => new Promise((_resolve, reject) => {
      failRefresh = reject;
    }));

    initApiClient('https://api.myriderguy.com/api/v1');
    const rejectResponse = getRejectionInterceptor();
    const first = rejectResponse(unauthorizedError());
    const second = rejectResponse(unauthorizedError());
    const refreshError = new Error('refresh rejected');

    await vi.waitFor(() => expect(mocks.axiosPost).toHaveBeenCalledTimes(1));
    failRefresh(refreshError);

    await expect(first).rejects.toBe(refreshError);
    await expect(second).rejects.toBe(refreshError);
    expect(mocks.clearTokens).toHaveBeenCalledTimes(1);
    expect(mocks.clearAuth).toHaveBeenCalledTimes(1);
    expect(mocks.instance).not.toHaveBeenCalled();
  });
});
