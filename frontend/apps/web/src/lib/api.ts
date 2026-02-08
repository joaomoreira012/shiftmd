import { createApiClient } from '@doctor-tracker/shared/api/client';
import { createAuthHooks } from '@doctor-tracker/shared/hooks/useAuth';
import { createWorkplaceHooks } from '@doctor-tracker/shared/hooks/useWorkplaces';
import { createShiftHooks } from '@doctor-tracker/shared/hooks/useShifts';
import { createFinanceHooks } from '@doctor-tracker/shared/hooks/useFinance';
import { createGCalHooks } from '@doctor-tracker/shared/hooks/useGCal';
import { webTokenProvider } from './token-provider';

export const apiClient = createApiClient('/', webTokenProvider);

export const { useCurrentUser, useLogin, useRegister, useLogout } =
  createAuthHooks(apiClient);

export const {
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
} = createWorkplaceHooks(apiClient);

export const {
  useShiftsInRange,
  useShift,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  useShiftEarnings,
} = createShiftHooks(apiClient);

export const {
  useFinanceSummary,
  useMonthlySummary,
  useYearlySummary,
  useMonthlyBreakdown,
  useProjections,
  useTaxEstimate,
  useInvoices,
  useCreateInvoice,
  useDeleteInvoice,
} = createFinanceHooks(apiClient);

export const {
  useGCalStatus,
  useGCalAuthUrl,
  useGCalCallback,
  useGCalSync,
  useGCalDisconnect,
} = createGCalHooks(apiClient);
