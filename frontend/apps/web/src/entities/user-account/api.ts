import {
  accountSecuritySchema,
  authIdentityListSchema,
  authSessionListSchema,
  consentsListSchema,
  dataExportSchema,
  userPreferencesSchema,
  z,
  type AccountSecurity,
  type AuthIdentity,
  type AuthSession,
  type BlockUserInput,
  type ConsentsList,
  type DataExport,
  type UserPreferences,
  type UserPreferencesUpdate,
} from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

const base = (userId: string) => `/api/admin/users/${userId}`;

export const userAccountPaths = {
  security: (userId: string) => `${base(userId)}/security`,
  block: (userId: string) => `${base(userId)}/block`,
  unblock: (userId: string) => `${base(userId)}/unblock`,
  deletion: (userId: string) => `${base(userId)}/deletion`,
  restore: (userId: string) => `${base(userId)}/restore`,
  sessions: (userId: string) => `${base(userId)}/sessions`,
  session: (userId: string, sessionId: string) =>
    `${base(userId)}/sessions/${sessionId}`,
  revokeAll: (userId: string) => `${base(userId)}/sessions/revoke-all`,
  identities: (userId: string) => `${base(userId)}/identities`,
  identity: (userId: string, provider: string) =>
    `${base(userId)}/identities/${provider}`,
  passwordReset: (userId: string) => `${base(userId)}/password-reset`,
  emailVerify: (userId: string) => `${base(userId)}/email/verify`,
  email: (userId: string) => `${base(userId)}/email`,
  preferences: (userId: string) => `${base(userId)}/preferences`,
  consents: (userId: string) => `${base(userId)}/consents`,
  dataExports: (userId: string) => `${base(userId)}/data-exports`,
  dataExportDownload: (userId: string, exportId: string) =>
    `${base(userId)}/data-exports/${exportId}/download`,
} as const;

export async function fetchAccountSecurity(
  userId: string,
): Promise<AccountSecurity> {
  return accountSecuritySchema.parse(
    await apiRequest<unknown>(userAccountPaths.security(userId)),
  );
}

export function blockUser(
  userId: string,
  input: BlockUserInput,
): Promise<void> {
  return apiRequest<void>(userAccountPaths.block(userId), {
    method: "POST",
    body: input,
  });
}

export function unblockUser(userId: string): Promise<void> {
  return apiRequest<void>(userAccountPaths.unblock(userId), { method: "POST" });
}

export function requestUserDeletion(userId: string): Promise<void> {
  return apiRequest<void>(userAccountPaths.deletion(userId), {
    method: "POST",
  });
}

export function restoreUser(userId: string): Promise<void> {
  return apiRequest<void>(userAccountPaths.restore(userId), { method: "POST" });
}

export async function fetchUserSessions(
  userId: string,
): Promise<AuthSession[]> {
  return authSessionListSchema.parse(
    await apiRequest<unknown>(userAccountPaths.sessions(userId)),
  ).items;
}

export function revokeUserSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  return apiRequest<void>(userAccountPaths.session(userId, sessionId), {
    method: "DELETE",
  });
}

export function revokeAllUserSessions(userId: string): Promise<void> {
  return apiRequest<void>(userAccountPaths.revokeAll(userId), {
    method: "POST",
  });
}

export async function fetchUserIdentities(
  userId: string,
): Promise<AuthIdentity[]> {
  return authIdentityListSchema.parse(
    await apiRequest<unknown>(userAccountPaths.identities(userId)),
  ).items;
}

export function unlinkUserIdentity(
  userId: string,
  provider: string,
): Promise<void> {
  return apiRequest<void>(userAccountPaths.identity(userId, provider), {
    method: "DELETE",
  });
}

export function sendUserPasswordReset(userId: string): Promise<void> {
  return apiRequest<void>(userAccountPaths.passwordReset(userId), {
    method: "POST",
  });
}

export function verifyUserEmail(userId: string): Promise<void> {
  return apiRequest<void>(userAccountPaths.emailVerify(userId), {
    method: "POST",
  });
}

export function changeUserEmail(userId: string, email: string): Promise<void> {
  return apiRequest<void>(userAccountPaths.email(userId), {
    method: "PATCH",
    body: { email },
  });
}

export async function fetchUserPreferences(
  userId: string,
): Promise<UserPreferences> {
  return userPreferencesSchema.parse(
    await apiRequest<unknown>(userAccountPaths.preferences(userId)),
  );
}

export async function updateUserPreferences(
  userId: string,
  input: UserPreferencesUpdate,
): Promise<UserPreferences> {
  return userPreferencesSchema.parse(
    await apiRequest<unknown>(userAccountPaths.preferences(userId), {
      method: "PATCH",
      body: input,
    }),
  );
}

export async function fetchUserConsents(userId: string): Promise<ConsentsList> {
  return consentsListSchema.parse(
    await apiRequest<unknown>(userAccountPaths.consents(userId)),
  );
}

export async function fetchUserDataExports(
  userId: string,
): Promise<DataExport[]> {
  return z
    .array(dataExportSchema)
    .parse(await apiRequest<unknown>(userAccountPaths.dataExports(userId)));
}

export async function requestUserDataExport(
  userId: string,
): Promise<DataExport> {
  return dataExportSchema.parse(
    await apiRequest<unknown>(userAccountPaths.dataExports(userId), {
      method: "POST",
    }),
  );
}
