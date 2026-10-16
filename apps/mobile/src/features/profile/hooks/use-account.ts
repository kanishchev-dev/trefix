import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  confirmEmailChange,
  getLatestDataExport,
  linkIdentity,
  listIdentities,
  listSessions,
  logoutOtherSessions,
  requestDataExport,
  requestEmailChange,
  revokeSession,
  unlinkIdentity,
  type SocialProvider,
} from "../../../lib/account-api";
import { queryKeys } from "../../../shared/lib/query-keys";

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.account.sessions(),
    queryFn: listSessions,
    staleTime: 1000 * 60,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeSession,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.account.sessions() }),
  });
}

export function useLogoutOthers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutOtherSessions,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.account.sessions() }),
  });
}

export function useIdentities() {
  return useQuery({
    queryKey: queryKeys.account.identities(),
    queryFn: listIdentities,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLinkIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: SocialProvider) => linkIdentity(provider),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.identities(),
      }),
  });
}

export function useUnlinkIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: SocialProvider) => unlinkIdentity(provider),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.identities(),
      }),
  });
}

export function useRequestEmailChange() {
  return useMutation({ mutationFn: requestEmailChange });
}

export function useConfirmEmailChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmEmailChange,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all }),
  });
}

export function useDataExport() {
  return useQuery({
    queryKey: queryKeys.account.dataExport(),
    queryFn: getLatestDataExport,
    staleTime: 1000 * 60,
  });
}

export function useRequestDataExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestDataExport,
    onSuccess: (latest) =>
      queryClient.setQueryData(queryKeys.account.dataExport(), latest),
  });
}
