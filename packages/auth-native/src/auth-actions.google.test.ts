import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
  hasPlayServices: vi.fn(),
  signIn: vi.fn(),
  post: vi.fn(),
  get: vi.fn(),
  setAccessToken: vi.fn(),
  setRefreshToken: vi.fn(),
  clearTokens: vi.fn(),
  setUser: vi.fn(),
  clearAuth: vi.fn(),
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: mocks.configure,
    hasPlayServices: mocks.hasPlayServices,
    signIn: mocks.signIn,
  },
  isSuccessResponse: (response: { type?: string }) => response.type === 'success',
}));

vi.mock('./api-client', () => ({
  getApiClient: () => ({ post: mocks.post, get: mocks.get }),
}));

vi.mock('./token-storage', () => ({
  tokenStorage: {
    setAccessToken: mocks.setAccessToken,
    setRefreshToken: mocks.setRefreshToken,
    clearTokens: mocks.clearTokens,
  },
}));

vi.mock('./auth-store', () => ({
  useAuthStore: {
    getState: () => ({ setUser: mocks.setUser, clearAuth: mocks.clearAuth }),
  },
}));

async function loadAuthActions() {
  return import('./auth-actions');
}

describe('native Google Sign-In bridge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mocks.hasPlayServices.mockResolvedValue(true);
  });

  it('requests an ID token for the configured Web client and sends it with the app role', async () => {
    mocks.signIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-id-token' },
    });
    mocks.post.mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: { id: 'rider-1', role: 'RIDER', roles: ['RIDER'] },
        },
      },
    });
    const { signInWithGoogle } = await loadAuthActions();

    const user = await signInWithGoogle(
      'RIDER',
      '186685649676-web.apps.googleusercontent.com',
    );

    expect(mocks.configure).toHaveBeenCalledWith({
      webClientId: '186685649676-web.apps.googleusercontent.com',
    });
    expect(mocks.hasPlayServices).toHaveBeenCalledWith({
      showPlayServicesUpdateDialog: true,
    });
    expect(mocks.post).toHaveBeenCalledWith('/auth/google', {
      credential: 'google-id-token',
      role: 'RIDER',
    });
    expect(mocks.setAccessToken).toHaveBeenCalledWith('access-token');
    expect(mocks.setRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(user?.id).toBe('rider-1');
  });

  it('treats picker cancellation as a no-op', async () => {
    mocks.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    const { signInWithGoogle } = await loadAuthActions();

    await expect(signInWithGoogle(
      'CLIENT',
      '329566613678-web.apps.googleusercontent.com',
    )).resolves.toBeNull();

    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.setAccessToken).not.toHaveBeenCalled();
  });

  it('fails before API authentication when Google returns no ID token', async () => {
    mocks.signIn.mockResolvedValue({
      type: 'success',
      data: { idToken: null },
    });
    const { signInWithGoogle } = await loadAuthActions();

    await expect(signInWithGoogle(
      'CLIENT',
      '329566613678-web.apps.googleusercontent.com',
    )).rejects.toThrow('Google did not return an ID token');

    expect(mocks.post).not.toHaveBeenCalled();
  });
});
