import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { KyInstance } from 'ky';
import { createGCalApi } from '../api/gcal';

export const gcalKeys = {
  all: ['gcal'] as const,
  status: () => ['gcal', 'status'] as const,
};

export function createGCalHooks(client: KyInstance) {
  const api = createGCalApi(client);

  function useGCalStatus() {
    return useQuery({
      queryKey: gcalKeys.status(),
      queryFn: async () => {
        const res = await api.getStatus();
        return res.data!;
      },
      staleTime: 1000 * 60 * 2,
    });
  }

  function useGCalAuthUrl() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async () => {
        const res = await api.getAuthUrl();
        return res.data!;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: gcalKeys.all });
      },
    });
  }

  function useGCalCallback() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (code: string) => {
        const res = await api.handleCallback(code);
        return res.data!;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: gcalKeys.all });
      },
    });
  }

  function useGCalSync() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async () => {
        const res = await api.triggerSync();
        return res.data!;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: gcalKeys.all });
        queryClient.invalidateQueries({ queryKey: ['shifts'] });
      },
    });
  }

  function useGCalDisconnect() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async () => {
        const res = await api.disconnect();
        return res.data!;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: gcalKeys.all });
      },
    });
  }

  return {
    useGCalStatus,
    useGCalAuthUrl,
    useGCalCallback,
    useGCalSync,
    useGCalDisconnect,
  };
}
