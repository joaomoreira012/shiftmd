import type { KyInstance } from 'ky';
import type { ApiResponse } from '../types/api';
import type { EarningsSummary, TaxEstimate, Projection, Invoice, CreateInvoiceInput } from '../types/finance';

export function createFinanceApi(client: KyInstance) {
  return {
    getSummary: (start?: string, end?: string) => {
      const searchParams: Record<string, string> = {};
      if (start) searchParams.start = start;
      if (end) searchParams.end = end;
      return client.get('api/v1/finance/summary', { searchParams }).json<ApiResponse<EarningsSummary>>();
    },

    getMonthlySummary: (year: number, month: number) =>
      client.get(`api/v1/finance/summary/monthly/${year}/${month}`).json<ApiResponse<EarningsSummary>>(),

    getYearlySummary: (year: number) =>
      client.get(`api/v1/finance/summary/yearly/${year}`).json<ApiResponse<EarningsSummary>>(),

    getMonthlyBreakdown: (year: number) =>
      client.get(`api/v1/finance/monthly-breakdown/${year}`).json<ApiResponse<EarningsSummary[]>>(),

    getProjections: (year?: number) => {
      const searchParams: Record<string, string> = {};
      if (year) searchParams.year = String(year);
      return client.get('api/v1/finance/projections', { searchParams }).json<ApiResponse<Projection[]>>();
    },

    getTaxEstimate: (year: number) =>
      client.get(`api/v1/finance/tax-estimate/${year}`).json<ApiResponse<TaxEstimate>>(),

    // Invoices
    listInvoices: (params?: { workplace_id?: string; start?: string; end?: string }) => {
      const searchParams: Record<string, string> = {};
      if (params?.workplace_id) searchParams.workplace_id = params.workplace_id;
      if (params?.start) searchParams.start = params.start;
      if (params?.end) searchParams.end = params.end;
      return client.get('api/v1/invoices', { searchParams }).json<ApiResponse<Invoice[]>>();
    },

    createInvoice: (data: CreateInvoiceInput) =>
      client.post('api/v1/invoices', { json: data }).json<ApiResponse<Invoice>>(),

    getInvoice: (id: string) =>
      client.get(`api/v1/invoices/${id}`).json<ApiResponse<Invoice>>(),

    deleteInvoice: (id: string) =>
      client.delete(`api/v1/invoices/${id}`),
  };
}
