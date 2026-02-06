import type { KyInstance } from 'ky';
import type { ApiResponse, AuthResponse, LoginInput, RegisterInput, User } from '../types';

export function createAuthApi(client: KyInstance) {
  return {
    register: (data: RegisterInput) =>
      client.post('api/v1/auth/register', { json: data }).json<ApiResponse<AuthResponse>>(),

    login: (data: LoginInput) =>
      client.post('api/v1/auth/login', { json: data }).json<ApiResponse<AuthResponse>>(),

    refresh: (refreshToken: string) =>
      client.post('api/v1/auth/refresh', { json: { refresh_token: refreshToken } })
        .json<ApiResponse<{ access_token: string; refresh_token: string; expires_at: number }>>(),

    logout: (refreshToken: string) =>
      client.post('api/v1/auth/logout', { json: { refresh_token: refreshToken } }),

    getMe: () =>
      client.get('api/v1/auth/me').json<ApiResponse<User>>(),
  };
}
