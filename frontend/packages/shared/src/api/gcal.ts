import type { KyInstance } from 'ky';
import type { ApiResponse } from '../types/api';
import type { GCalSyncStatus, GCalAuthUrl, GCalSyncResult } from '../types/gcal';

export function createGCalApi(client: KyInstance) {
  return {
    getAuthUrl: () =>
      client.get('api/v1/gcal/auth-url').json<ApiResponse<GCalAuthUrl>>(),

    handleCallback: (code: string) =>
      client.post('api/v1/gcal/callback', { json: { code } }).json<ApiResponse<{ message: string }>>(),

    getStatus: () =>
      client.get('api/v1/gcal/status').json<ApiResponse<GCalSyncStatus>>(),

    triggerSync: () =>
      client.post('api/v1/gcal/sync').json<ApiResponse<GCalSyncResult>>(),

    disconnect: () =>
      client.delete('api/v1/gcal/disconnect').json<ApiResponse<{ message: string }>>(),
  };
}
