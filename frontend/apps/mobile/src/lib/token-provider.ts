import * as SecureStore from 'expo-secure-store';
import type { TokenProvider } from '@doctor-tracker/shared/api/client';

const ACCESS_TOKEN_KEY = 'dt_access_token';
const REFRESH_TOKEN_KEY = 'dt_refresh_token';

export const mobileTokenProvider: TokenProvider = {
  getAccessToken: async () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefreshToken: async () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setTokens: async (accessToken, refreshToken) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },
  clearTokens: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
