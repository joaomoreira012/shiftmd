import type { KyInstance } from 'ky';
import type { ApiResponse } from '../types/api';
import type { Workplace, CreateWorkplaceInput, UpdateWorkplaceInput, PricingRule, CreatePricingRuleInput } from '../types/workplace';

export function createWorkplacesApi(client: KyInstance) {
  return {
    list: () =>
      client.get('api/v1/workplaces').json<ApiResponse<Workplace[]>>(),

    get: (id: string) =>
      client.get(`api/v1/workplaces/${id}`).json<ApiResponse<Workplace>>(),

    create: (data: CreateWorkplaceInput) =>
      client.post('api/v1/workplaces', { json: data }).json<ApiResponse<Workplace>>(),

    update: (id: string, data: UpdateWorkplaceInput) =>
      client.put(`api/v1/workplaces/${id}`, { json: data }).json<ApiResponse<Workplace>>(),

    archive: (id: string) =>
      client.delete(`api/v1/workplaces/${id}`),

    // Pricing Rules
    listPricingRules: (workplaceId: string) =>
      client.get(`api/v1/workplaces/${workplaceId}/pricing-rules`).json<ApiResponse<PricingRule[]>>(),

    createPricingRule: (workplaceId: string, data: CreatePricingRuleInput) =>
      client.post(`api/v1/workplaces/${workplaceId}/pricing-rules`, { json: data }).json<ApiResponse<PricingRule>>(),

    updatePricingRule: (workplaceId: string, ruleId: string, data: Partial<CreatePricingRuleInput>) =>
      client.put(`api/v1/workplaces/${workplaceId}/pricing-rules/${ruleId}`, { json: data }).json<ApiResponse<PricingRule>>(),

    deletePricingRule: (workplaceId: string, ruleId: string) =>
      client.delete(`api/v1/workplaces/${workplaceId}/pricing-rules/${ruleId}`),

    reorderPricingRules: (workplaceId: string, ruleIds: string[]) =>
      client.post(`api/v1/workplaces/${workplaceId}/pricing-rules/reorder`, { json: { rule_ids: ruleIds } }),
  };
}
