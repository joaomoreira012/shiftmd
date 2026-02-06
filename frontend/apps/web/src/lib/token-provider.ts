import type { TokenProvider } from '@doctor-tracker/shared/api/client';

const ACCESS_TOKEN_KEY = 'dt_access_token';
const REFRESH_TOKEN_KEY = 'dt_refresh_token';

export const webTokenProvider: TokenProvider = {
  getAccessToken: async () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: async () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: async (accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clearTokens: async () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
