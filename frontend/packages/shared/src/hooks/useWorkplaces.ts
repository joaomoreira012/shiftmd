import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { KyInstance } from 'ky';
import { createWorkplacesApi } from '../api/workplaces';
import type { CreateWorkplaceInput, UpdateWorkplaceInput, CreatePricingRuleInput } from '../types/workplace';

export const workplaceKeys = {
  all: ['workplaces'] as const,
  detail: (id: string) => ['workplaces', id] as const,
  pricingRules: (id: string) => ['workplaces', id, 'pricing-rules'] as const,
};

export function createWorkplaceHooks(client: KyInstance) {
  const api = createWorkplacesApi(client);

  function useWorkplaces() {
    return useQuery({
      queryKey: workplaceKeys.all,
      queryFn: async () => {
        const res = await api.list();
        return res.data!;
      },
      staleTime: 1000 * 60 * 5,
    });
  }

  function useWorkplace(id: string) {
    return useQuery({
      queryKey: workplaceKeys.detail(id),
      queryFn: async () => {
        const res = await api.get(id);
        return res.data!;
      },
      enabled: !!id,
    });
  }

  function useCreateWorkplace() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (data: CreateWorkplaceInput) => {
        const res = await api.create(data);
        return res.data!;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: workplaceKeys.all });
      },
    });
  }

  function useUpdateWorkplace() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, data }: { id: string; data: UpdateWorkplaceInput }) => {
        const res = await api.update(id, data);
        return res.data!;
      },
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: workplaceKeys.all });
        queryClient.invalidateQueries({ queryKey: workplaceKeys.detail(id) });
      },
    });
  }

  function useArchiveWorkplace() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        await api.archive(id);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: workplaceKeys.all });
      },
    });
  }

  function usePricingRules(workplaceId: string) {
    return useQuery({
      queryKey: workplaceKeys.pricingRules(workplaceId),
      queryFn: async () => {
        const res = await api.listPricingRules(workplaceId);
        return res.data!;
      },
      enabled: !!workplaceId,
    });
  }

  function useCreatePricingRule() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ workplaceId, data }: { workplaceId: string; data: CreatePricingRuleInput }) => {
        const res = await api.createPricingRule(workplaceId, data);
        return res.data!;
      },
      onSuccess: (_, { workplaceId }) => {
        queryClient.invalidateQueries({ queryKey: workplaceKeys.pricingRules(workplaceId) });
      },
    });
  }

  function useUpdatePricingRule() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ workplaceId, ruleId, data }: { workplaceId: string; ruleId: string; data: Partial<CreatePricingRuleInput> }) => {
        const res = await api.updatePricingRule(workplaceId, ruleId, data);
        return res.data!;
      },
      onSuccess: (_, { workplaceId }) => {
        queryClient.invalidateQueries({ queryKey: workplaceKeys.pricingRules(workplaceId) });
      },
    });
  }

  function useDeletePricingRule() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ workplaceId, ruleId }: { workplaceId: string; ruleId: string }) => {
        await api.deletePricingRule(workplaceId, ruleId);
      },
      onSuccess: (_, { workplaceId }) => {
        queryClient.invalidateQueries({ queryKey: workplaceKeys.pricingRules(workplaceId) });
      },
    });
  }

  function useReorderPricingRules() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ workplaceId, ruleIds }: { workplaceId: string; ruleIds: string[] }) => {
        await api.reorderPricingRules(workplaceId, ruleIds);
      },
      onSuccess: (_, { workplaceId }) => {
        queryClient.invalidateQueries({ queryKey: workplaceKeys.pricingRules(workplaceId) });
      },
    });
  }

  return {
    useWorkplaces,
    useWorkplace,
    useCreateWorkplace,
    useUpdateWorkplace,
    useArchiveWorkplace,
    usePricingRules,
    useCreatePricingRule,
    useUpdatePricingRule,
    useDeletePricingRule,
    useReorderPricingRules,
  };
}
