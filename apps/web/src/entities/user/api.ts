import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminUserDetailSchema,
  adminUserSchema,
  authUserSchema,
  type AdminCreateUserInput,
  type AdminUpdateUserInput,
  type AdminUser,
  type AdminUserDetail,
  type AuthUser,
  type PaginatedResponse,
  type UserListQuery,
  userPresenceSchema,
} from "@workspace/api-client";

import { apiRequest } from "@/lib/api";

export const userPaths = {
  list: "/api/admin/users",
  detail: (id: string) => `/api/admin/users/${id}`,
  invitation: (id: string) => `/api/admin/users/${id}/invitations`,
  presence: "/api/admin/users/presence",
} as const;

export async function fetchUsers(
  query: Partial<UserListQuery> = {},
): Promise<PaginatedResponse<AdminUser>> {
  const response = await apiRequest<unknown>(userPaths.list, {
    searchParams: {
      page: query.page,
      limit: query.limit,
      search: query.search || undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    },
  });

  const parsed = response as PaginatedResponse<unknown>;
  return {
    // The list endpoint returns lightweight user rows; aggregated detail
    // (groups, permissions) is only available on the detail endpoint.
    data: parsed.data.map((item) => adminUserSchema.parse(item)),
    meta: parsed.meta,
  };
}

export async function fetchUser(id: string): Promise<AdminUserDetail> {
  const response = await apiRequest<unknown>(userPaths.detail(id));
  return adminUserDetailSchema.parse(response);
}

/**
 * Asks which of `userIds` currently hold a realtime connection.
 *
 * Resolves to an empty set rather than throwing when the backend has no
 * presence store: an indicator that silently shows everyone offline is better
 * than a page that fails to render over a decoration.
 */
export async function fetchUserPresence(userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }

  const response = await apiRequest<unknown>(userPaths.presence, {
    searchParams: { ids: [...userIds] },
  });

  return new Set(userPresenceSchema.parse(response).onlineUserIds);
}

export async function createUser(input: AdminCreateUserInput): Promise<AdminUserDetail> {
  const payload = adminCreateUserSchema.parse(input);
  const response = await apiRequest<unknown>(userPaths.list, {
    method: "POST",
    body: payload,
  });
  return adminUserDetailSchema.parse(response);
}

export async function updateUser(
  id: string,
  input: AdminUpdateUserInput,
): Promise<AdminUserDetail> {
  const payload = adminUpdateUserSchema.parse(input);
  const response = await apiRequest<unknown>(userPaths.detail(id), {
    method: "PATCH",
    body: payload,
  });
  return adminUserDetailSchema.parse(response);
}

export async function deleteUser(id: string): Promise<void> {
  await apiRequest<void>(userPaths.detail(id), { method: "DELETE" });
}

export async function inviteUser(id: string): Promise<void> {
  await apiRequest<void>(userPaths.invitation(id), { method: "POST" });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiRequest<unknown>("/api/auth/me");
  return authUserSchema.parse(response);
}
