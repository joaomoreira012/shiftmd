import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { KyInstance } from 'ky';
import { createAuthApi } from '../api/auth';
import type { LoginInput, RegisterInput } from '../types/user';

export function createAuthHooks(client: KyInstance) {
  const authApi = createAuthApi(client);

  function useCurrentUser() {
    return useQuery({
      queryKey: ['auth', 'me'],
      queryFn: async () => {
        const res = await authApi.getMe();
        return res.data!;
      },
      retry: false,
      staleTime: Infinity,
    });
  }

  function useLogin() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (input: LoginInput) => {
        const res = await authApi.login(input);
        return res.data!;
      },
      onSuccess: (data) => {
        queryClient.setQueryData(['auth', 'me'], data.user);
      },
    });
  }

  function useRegister() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (input: RegisterInput) => {
        const res = await authApi.register(input);
        return res.data!;
      },
      onSuccess: (data) => {
        queryClient.setQueryData(['auth', 'me'], data.user);
      },
    });
  }

  function useLogout() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (refreshToken: string) => {
        await authApi.logout(refreshToken);
      },
      onSuccess: () => {
        queryClient.clear();
      },
    });
  }

  return { useCurrentUser, useLogin, useRegister, useLogout };
}
