import { createApiClient } from '@doctor-tracker/shared/api/client';
import { createAuthHooks } from '@doctor-tracker/shared/hooks/useAuth';
import { createWorkplaceHooks } from '@doctor-tracker/shared/hooks/useWorkplaces';
import { mobileTokenProvider } from './token-provider';
import { API_BASE_URL } from './config';

export const apiClient = createApiClient(API_BASE_URL, mobileTokenProvider);

export const { useCurrentUser, useLogin, useRegister, useLogout } =
  createAuthHooks(apiClient);

export const { useWorkplaces, useWorkplace } =
  createWorkplaceHooks(apiClient);

export { mobileTokenProvider };
