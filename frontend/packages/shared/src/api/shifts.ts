import type { KyInstance } from 'ky';
import type { ApiResponse } from '../types/api';
import type { Shift, CreateShiftInput, UpdateShiftInput, EarningSegment } from '../types/shift';

export function createShiftsApi(client: KyInstance) {
  return {
    getInRange: (start: string, end: string, workplaceId?: string) => {
      const searchParams: Record<string, string> = { start, end };
      if (workplaceId) searchParams.workplace_id = workplaceId;
      return client.get('api/v1/shifts', { searchParams }).json<ApiResponse<Shift[]>>();
    },

    get: (id: string) =>
      client.get(`api/v1/shifts/${id}`).json<ApiResponse<Shift>>(),

    create: (data: CreateShiftInput) =>
      client.post('api/v1/shifts', { json: data }).json<ApiResponse<Shift>>(),

    update: (id: string, data: UpdateShiftInput) =>
      client.put(`api/v1/shifts/${id}`, { json: data }).json<ApiResponse<Shift>>(),

    delete: (id: string) =>
      client.delete(`api/v1/shifts/${id}`),

    bulkCreate: (data: CreateShiftInput[]) =>
      client.post('api/v1/shifts/bulk', { json: data }).json<ApiResponse<Shift[]>>(),

    getEarnings: (id: string) =>
      client.get(`api/v1/shifts/${id}/earnings`).json<ApiResponse<{
        shift_id: string;
        earnings: EarningSegment[];
        total_earnings: number;
      }>>(),
  };
}
