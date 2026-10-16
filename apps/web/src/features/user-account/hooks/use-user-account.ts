"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type {
  AccountSecurity,
  AuthIdentity,
  AuthSession,
  BlockUserInput,
  ConsentsList,
  DataExport,
  UserPreferences,
  UserPreferencesUpdate,
} from "@trefix/api-client";

import {
  blockUser,
  changeUserEmail,
  fetchAccountSecurity,
  fetchUserConsents,
  fetchUserDataExports,
  fetchUserIdentities,
  fetchUserPreferences,
  fetchUserSessions,
  requestUserDataExport,
  requestUserDeletion,
  restoreUser,
  revokeAllUserSessions,
  revokeUserSession,
  sendUserPasswordReset,
  unblockUser,
  unlinkUserIdentity,
  updateUserPreferences,
  verifyUserEmail,
} from "@/entities/user-account/api";
import {
  userCardKeys,
  useUserCardMutation,
} from "@/features/users/hooks/use-user-card-query";
import { useI18n } from "@/shared/i18n";

const SECURITY = "security";
const SESSIONS = "sessions";
const IDENTITIES = "identities";
const PREFERENCES = "preferences";
const CONSENTS = "consents";
const DATA_EXPORTS = "data-exports";

export function useAccountSecurity(
  userId: string,
  enabled = true,
): UseQueryResult<AccountSecurity> {
  return useQuery({
    queryKey: userCardKeys.section(userId, SECURITY),
    queryFn: () => fetchAccountSecurity(userId),
    enabled,
  });
}

export function useUserSessions(userId: string): UseQueryResult<AuthSession[]> {
  return useQuery({
    queryKey: userCardKeys.section(userId, SESSIONS),
    queryFn: () => fetchUserSessions(userId),
  });
}

export function useUserIdentities(
  userId: string,
): UseQueryResult<AuthIdentity[]> {
  return useQuery({
    queryKey: userCardKeys.section(userId, IDENTITIES),
    queryFn: () => fetchUserIdentities(userId),
  });
}

export function useUserPreferences(
  userId: string,
): UseQueryResult<UserPreferences> {
  return useQuery({
    queryKey: userCardKeys.section(userId, PREFERENCES),
    queryFn: () => fetchUserPreferences(userId),
  });
}

export function useUserConsents(userId: string): UseQueryResult<ConsentsList> {
  return useQuery({
    queryKey: userCardKeys.section(userId, CONSENTS),
    queryFn: () => fetchUserConsents(userId),
  });
}

export function useUserDataExports(
  userId: string,
): UseQueryResult<DataExport[]> {
  return useQuery({
    queryKey: userCardKeys.section(userId, DATA_EXPORTS),
    queryFn: () => fetchUserDataExports(userId),
  });
}

/** Account actions of the card; each one refreshes the security block and the history. */
export function useAccountActions(userId: string) {
  const { t } = useI18n();

  return {
    block: useUserCardMutation(userId, {
      mutationFn: (input: BlockUserInput) => blockUser(userId, input),
      sections: [SECURITY, SESSIONS],
      successMessage: t("userCard.account.toasts.blocked"),
    }),
    unblock: useUserCardMutation(userId, {
      mutationFn: () => unblockUser(userId),
      sections: [SECURITY],
      successMessage: t("userCard.account.toasts.unblocked"),
    }),
    requestDeletion: useUserCardMutation(userId, {
      mutationFn: () => requestUserDeletion(userId),
      sections: [SECURITY, SESSIONS],
      successMessage: t("userCard.account.toasts.deletionRequested"),
    }),
    restore: useUserCardMutation(userId, {
      mutationFn: () => restoreUser(userId),
      sections: [SECURITY],
      successMessage: t("userCard.account.toasts.restored"),
    }),
    revokeSession: useUserCardMutation(userId, {
      mutationFn: (sessionId: string) => revokeUserSession(userId, sessionId),
      sections: [SESSIONS],
      successMessage: t("userCard.account.toasts.sessionRevoked"),
    }),
    revokeAllSessions: useUserCardMutation(userId, {
      mutationFn: () => revokeAllUserSessions(userId),
      sections: [SESSIONS],
      successMessage: t("userCard.account.toasts.sessionsRevoked"),
    }),
    unlinkIdentity: useUserCardMutation(userId, {
      mutationFn: (provider: string) => unlinkUserIdentity(userId, provider),
      sections: [IDENTITIES],
      successMessage: t("userCard.account.toasts.identityUnlinked"),
    }),
    sendPasswordReset: useUserCardMutation(userId, {
      mutationFn: () => sendUserPasswordReset(userId),
      sections: [],
      successMessage: t("userCard.account.toasts.passwordResetSent"),
    }),
    verifyEmail: useUserCardMutation(userId, {
      mutationFn: () => verifyUserEmail(userId),
      sections: [SECURITY],
      successMessage: t("userCard.account.toasts.emailVerified"),
    }),
    changeEmail: useUserCardMutation(userId, {
      mutationFn: (email: string) => changeUserEmail(userId, email),
      sections: [SECURITY],
      successMessage: t("userCard.account.toasts.emailChanged"),
    }),
    updatePreferences: useUserCardMutation(userId, {
      mutationFn: (input: UserPreferencesUpdate) =>
        updateUserPreferences(userId, input),
      sections: [PREFERENCES],
      successMessage: t("userCard.account.toasts.preferencesSaved"),
    }),
    requestDataExport: useUserCardMutation(userId, {
      mutationFn: () => requestUserDataExport(userId),
      sections: [DATA_EXPORTS],
      successMessage: t("userCard.account.toasts.exportRequested"),
    }),
  };
}
