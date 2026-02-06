import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { KyInstance } from 'ky';
import { createFinanceApi } from '../api/finance';
import type { CreateInvoiceInput } from '../types/finance';

export const financeKeys = {
  all: ['finance'] as const,
  summary: (start?: string, end?: string) => ['finance', 'summary', { start, end }] as const,
  monthly: (year: number, month: number) => ['finance', 'monthly', year, month] as const,
  yearly: (year: number) => ['finance', 'yearly', year] as const,
  projections: (year?: number) => ['finance', 'projections', year] as const,
  taxEstimate: (year: number) => ['finance', 'tax-estimate', year] as const,
  invoices: (params?: { workplace_id?: string; start?: string; end?: string }) =>
    ['finance', 'invoices', params] as const,
  invoice: (id: string) => ['finance', 'invoices', id] as const,
};

export function createFinanceHooks(client: KyInstance) {
  const api = createFinanceApi(client);

  function useFinanceSummary(start?: string, end?: string) {
    return useQuery({
      queryKey: financeKeys.summary(start, end),
      queryFn: async () => {
        const res = await api.getSummary(start, end);
        return res.data!;
      },
      staleTime: 1000 * 60 * 5,
    });
  }

  function useMonthlySummary(year: number, month: number) {
    return useQuery({
      queryKey: financeKeys.monthly(year, month),
      queryFn: async () => {
        const res = await api.getMonthlySummary(year, month);
        return res.data!;
      },
      staleTime: 1000 * 60 * 5,
    });
  }

  function useYearlySummary(year: number) {
    return useQuery({
      queryKey: financeKeys.yearly(year),
      queryFn: async () => {
        const res = await api.getYearlySummary(year);
        return res.data!;
      },
      staleTime: 1000 * 60 * 5,
    });
  }

  function useProjections(year?: number) {
    return useQuery({
      queryKey: financeKeys.projections(year),
      queryFn: async () => {
        const res = await api.getProjections(year);
        return res.data!;
      },
      staleTime: 1000 * 60 * 10,
    });
  }

  function useTaxEstimate(year: number) {
    return useQuery({
      queryKey: financeKeys.taxEstimate(year),
      queryFn: async () => {
        const res = await api.getTaxEstimate(year);
        return res.data!;
      },
      staleTime: 1000 * 60 * 10,
    });
  }

  function useInvoices(params?: { workplace_id?: string; start?: string; end?: string }) {
    return useQuery({
      queryKey: financeKeys.invoices(params),
      queryFn: async () => {
        const res = await api.listInvoices(params);
        return res.data!;
      },
      staleTime: 1000 * 60 * 5,
    });
  }

  function useCreateInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (data: CreateInvoiceInput) => {
        const res = await api.createInvoice(data);
        return res.data!;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
      },
    });
  }

  function useDeleteInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        await api.deleteInvoice(id);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
      },
    });
  }

  return {
    useFinanceSummary,
    useMonthlySummary,
    useYearlySummary,
    useProjections,
    useTaxEstimate,
    useInvoices,
    useCreateInvoice,
    useDeleteInvoice,
  };
}
