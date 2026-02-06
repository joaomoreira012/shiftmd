import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { KyInstance } from 'ky';
import { createShiftsApi } from '../api/shifts';
import type { CreateShiftInput, UpdateShiftInput } from '../types/shift';

export const shiftKeys = {
  all: ['shifts'] as const,
  byRange: (start: string, end: string) => ['shifts', { start, end }] as const,
  detail: (id: string) => ['shifts', id] as const,
  earnings: (id: string) => ['shifts', id, 'earnings'] as const,
};

export function createShiftHooks(client: KyInstance) {
  const api = createShiftsApi(client);

  function useShiftsInRange(start: string, end: string, workplaceId?: string) {
    return useQuery({
      queryKey: [...shiftKeys.byRange(start, end), workplaceId],
      queryFn: async () => {
        const res = await api.getInRange(start, end, workplaceId);
        return res.data!;
      },
      staleTime: 1000 * 60 * 5,
      enabled: !!start && !!end,
    });
  }

  function useShift(id: string) {
    return useQuery({
      queryKey: shiftKeys.detail(id),
      queryFn: async () => {
        const res = await api.get(id);
        return res.data!;
      },
      enabled: !!id,
    });
  }

  function useCreateShift() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (data: CreateShiftInput) => {
        const res = await api.create(data);
        return res.data!;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: shiftKeys.all });
      },
    });
  }

  function useUpdateShift() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, data }: { id: string; data: UpdateShiftInput }) => {
        const res = await api.update(id, data);
        return res.data!;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: shiftKeys.all });
      },
    });
  }

  function useDeleteShift() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        await api.delete(id);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: shiftKeys.all });
      },
    });
  }

  function useShiftEarnings(id: string) {
    return useQuery({
      queryKey: shiftKeys.earnings(id),
      queryFn: async () => {
        const res = await api.getEarnings(id);
        return res.data!;
      },
      enabled: !!id,
    });
  }

  return { useShiftsInRange, useShift, useCreateShift, useUpdateShift, useDeleteShift, useShiftEarnings };
}
