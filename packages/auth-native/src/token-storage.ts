import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'riderguy_access_token';
const REFRESH_KEY = 'riderguy_refresh_token';

export const tokenStorage = {
  getAccessToken: (): Promise<string | null> =>
    SecureStore.getItemAsync(ACCESS_KEY),

  setAccessToken: (token: string): Promise<void> =>
    SecureStore.setItemAsync(ACCESS_KEY, token),

  getRefreshToken: (): Promise<string | null> =>
    SecureStore.getItemAsync(REFRESH_KEY),

  setRefreshToken: (token: string): Promise<void> =>
    SecureStore.setItemAsync(REFRESH_KEY, token),

  clearTokens: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
