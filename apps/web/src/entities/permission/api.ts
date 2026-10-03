import {
  permissionCatalogSchema,
  permissionGroupSchema,
  type PaginatedResponse,
  type Permission,
  type PermissionGroup,
} from "@workspace/api-client";

import { apiRequest } from "@/lib/api";

export const permissionPaths = {
  catalog: "/api/admin/permissions/catalog",
  groups: "/api/admin/permissions/groups",
  group: (id: string) => `/api/admin/permissions/groups/${id}`,
  groupPermission: (groupId: string, permissionId: string) =>
    `/api/admin/permissions/groups/${groupId}/permissions/${permissionId}`,
  userGroup: (userId: string, groupId: string) =>
    `/api/admin/permissions/users/${userId}/groups/${groupId}`,
  userPermission: (userId: string, permissionId: string) =>
    `/api/admin/permissions/users/${userId}/permissions/${permissionId}`,
  userEffective: (userId: string) => `/api/admin/permissions/users/${userId}/effective`,
} as const;

/**
 * Fetches the whole catalog in one request.
 *
 * Settings screens render a toggle per permission, so they must never be fed a
 * truncated page of the paginated list.
 */
export async function fetchPermissionCatalog(): Promise<Permission[]> {
  const response = await apiRequest<unknown>(permissionPaths.catalog);

  return permissionCatalogSchema.parse(response);
}

export async function fetchGroups(
  page = 1,
  limit = 100,
  search?: string,
): Promise<PaginatedResponse<PermissionGroup>> {
  const response = await apiRequest<unknown>(permissionPaths.groups, {
    searchParams: { page, limit, search: search || undefined },
  });

  const parsed = response as PaginatedResponse<unknown>;
  return {
    data: parsed.data.map((item) => permissionGroupSchema.parse(item)),
    meta: parsed.meta,
  };
}

export async function fetchGroup(id: string): Promise<PermissionGroup> {
  const response = await apiRequest<unknown>(permissionPaths.group(id));
  return permissionGroupSchema.parse(response);
}

export async function createGroup(input: {
  name: string;
  description?: string;
}): Promise<PermissionGroup> {
  const response = await apiRequest<unknown>(permissionPaths.groups, {
    method: "POST",
    body: input,
  });
  return permissionGroupSchema.parse(response);
}

export async function updateGroup(
  id: string,
  input: { name?: string; description?: string },
): Promise<PermissionGroup> {
  const response = await apiRequest<unknown>(permissionPaths.group(id), {
    method: "PATCH",
    body: input,
  });
  return permissionGroupSchema.parse(response);
}

export async function deleteGroup(id: string): Promise<void> {
  await apiRequest<void>(permissionPaths.group(id), { method: "DELETE" });
}

export async function assignPermissionToGroup(
  groupId: string,
  permissionId: string,
): Promise<void> {
  await apiRequest<void>(permissionPaths.groupPermission(groupId, permissionId), {
    method: "POST",
  });
}

export async function revokePermissionFromGroup(
  groupId: string,
  permissionId: string,
): Promise<void> {
  await apiRequest<void>(permissionPaths.groupPermission(groupId, permissionId), {
    method: "DELETE",
  });
}

export async function assignGroupToUser(userId: string, groupId: string): Promise<void> {
  await apiRequest<void>(permissionPaths.userGroup(userId, groupId), {
    method: "POST",
  });
}

export async function revokeGroupFromUser(userId: string, groupId: string): Promise<void> {
  await apiRequest<void>(permissionPaths.userGroup(userId, groupId), {
    method: "DELETE",
  });
}

export async function assignPermissionToUser(
  userId: string,
  permissionId: string,
): Promise<void> {
  await apiRequest<void>(permissionPaths.userPermission(userId, permissionId), {
    method: "POST",
  });
}

export async function revokePermissionFromUser(
  userId: string,
  permissionId: string,
): Promise<void> {
  await apiRequest<void>(permissionPaths.userPermission(userId, permissionId), {
    method: "DELETE",
  });
}
