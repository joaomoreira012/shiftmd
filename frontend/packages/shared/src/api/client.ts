import ky, { type KyInstance } from 'ky';

export interface TokenProvider {
  getAccessToken: () => Promise<string | null>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  clearTokens: () => Promise<void>;
  getRefreshToken: () => Promise<string | null>;
}

export function createApiClient(baseUrl: string, tokenProvider: TokenProvider): KyInstance {
  return ky.create({
    prefixUrl: baseUrl,
    hooks: {
      beforeRequest: [
        async (request) => {
          const token = await tokenProvider.getAccessToken();
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
        },
      ],
      afterResponse: [
        async (request, _options, response) => {
          if (response.status === 401) {
            const refreshToken = await tokenProvider.getRefreshToken();
            if (!refreshToken) {
              await tokenProvider.clearTokens();
              throw new Error('No refresh token available');
            }

            try {
              const refreshResponse = await ky.post(`${baseUrl}/api/v1/auth/refresh`, {
                json: { refresh_token: refreshToken },
              }).json<{ data: { access_token: string; refresh_token: string } }>();

              const { access_token, refresh_token } = refreshResponse.data;
              await tokenProvider.setTokens(access_token, refresh_token);

              // Retry the original request with the new token
              request.headers.set('Authorization', `Bearer ${access_token}`);
              return ky(request);
            } catch {
              await tokenProvider.clearTokens();
              throw new Error('Token refresh failed');
            }
          }
          return response;
        },
      ],
    },
    timeout: 30000,
    retry: {
      limit: 2,
      statusCodes: [408, 500, 502, 503, 504],
    },
  });
}
