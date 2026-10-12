"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  PaginatedResponse,
  Permission,
  PermissionGroup,
} from "@trefix/api-client";

import {
  assignPermissionToGroup,
  createGroup,
  deleteGroup,
  fetchGroup,
  fetchGroups,
  fetchPermissionCatalog,
  revokePermissionFromGroup,
  updateGroup,
} from "@/entities/permission/api";

const PERMISSION_QUERY_ROOT = ["permissions"] as const;

export const permissionKeys = {
  all: PERMISSION_QUERY_ROOT,
  catalog: [...PERMISSION_QUERY_ROOT, "catalog"] as const,
};

export const groupKeys = {
  all: ["permission-groups"] as const,
  list: (page: number, limit: number, search?: string) =>
    [...groupKeys.all, "list", page, limit, search ?? ""] as const,
  detail: (id: string) => [...groupKeys.all, "detail", id] as const,
};

/**
 * The whole permission catalog.
 *
 * Every permission is rendered as a toggle on the group and user settings
 * screens, so those must read the complete catalog rather than a page of it.
 */
export function usePermissionCatalog(): UseQueryResult<Permission[]> {
  return useQuery({
    queryKey: permissionKeys.catalog,
    queryFn: fetchPermissionCatalog,
  });
}

export function useGroups(
  page = 1,
  limit = 100,
  search?: string,
): UseQueryResult<PaginatedResponse<PermissionGroup>> {
  return useQuery({
    queryKey: groupKeys.list(page, limit, search),
    queryFn: () => fetchGroups(page, limit, search),
  });
}

export function useGroup(id: string): UseQueryResult<PermissionGroup> {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: () => fetchGroup(id),
    enabled: id.length > 0,
  });
}

export function useInvalidateAccessControl(): () => Promise<void> {
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === permissionKeys.all[0] ||
        query.queryKey[0] === groupKeys.all[0],
    });
}

export function useCreateGroup() {
  const invalidate = useInvalidateAccessControl();

  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      createGroup(input),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useUpdateGroup() {
  const invalidate = useInvalidateAccessControl();

  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & { name?: string; description?: string }) =>
      updateGroup(id, input),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useDeleteGroup() {
  const invalidate = useInvalidateAccessControl();

  return useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useAssignPermissionToGroup() {
  const invalidate = useInvalidateAccessControl();

  return useMutation({
    mutationFn: ({
      groupId,
      permissionId,
    }: {
      groupId: string;
      permissionId: string;
    }) => assignPermissionToGroup(groupId, permissionId),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useRevokePermissionFromGroup() {
  const invalidate = useInvalidateAccessControl();

  return useMutation({
    mutationFn: ({
      groupId,
      permissionId,
    }: {
      groupId: string;
      permissionId: string;
    }) => revokePermissionFromGroup(groupId, permissionId),
    onSuccess: () => {
      void invalidate();
    },
  });
}
