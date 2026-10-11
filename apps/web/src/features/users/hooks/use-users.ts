"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUser,
  AdminUserDetail,
  PaginatedResponse,
  UserListQuery,
} from "@workspace/api-client";

import {
  createUser,
  deleteUser,
  fetchUser,
  fetchUsers,
  inviteUser,
  updateUser,
} from "@/entities/user/api";
import {
  assignGroupToUser,
  assignPermissionToUser,
  revokeGroupFromUser,
  revokePermissionFromUser,
} from "@/entities/permission/api";

export const userKeys = {
  all: ["users"] as const,
  list: (query: Partial<UserListQuery>) =>
    [...userKeys.all, "list", query] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};

export function useUsers(
  query: Partial<UserListQuery> = {},
): UseQueryResult<PaginatedResponse<AdminUser>> {
  return useQuery({
    queryKey: userKeys.list(query),
    queryFn: () => fetchUsers(query),
  });
}

export function useUser(id: string): UseQueryResult<AdminUserDetail> {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => fetchUser(id),
    enabled: id.length > 0,
  });
}

export function useInvalidateUsers(): () => Promise<void> {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: userKeys.all });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();

  return useMutation({
    mutationFn: (input: AdminCreateUserInput) => createUser(input),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useUpdateUser(id: string) {
  const invalidate = useInvalidateUsers();

  return useMutation({
    mutationFn: (input: AdminUpdateUserInput) => updateUser(id, input),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();

  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useInviteUser() {
  return useMutation({
    mutationFn: (id: string) => inviteUser(id),
  });
}

export function useAssignGroupToUser() {
  const invalidate = useInvalidateUsers();

  return useMutation({
    mutationFn: ({ userId, groupId }: { userId: string; groupId: string }) =>
      assignGroupToUser(userId, groupId),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useRevokeGroupFromUser() {
  const invalidate = useInvalidateUsers();

  return useMutation({
    mutationFn: ({ userId, groupId }: { userId: string; groupId: string }) =>
      revokeGroupFromUser(userId, groupId),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useAssignPermissionToUser() {
  const invalidate = useInvalidateUsers();

  return useMutation({
    mutationFn: ({
      userId,
      permissionId,
    }: {
      userId: string;
      permissionId: string;
    }) => assignPermissionToUser(userId, permissionId),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useRevokePermissionFromUser() {
  const invalidate = useInvalidateUsers();

  return useMutation({
    mutationFn: ({
      userId,
      permissionId,
    }: {
      userId: string;
      permissionId: string;
    }) => revokePermissionFromUser(userId, permissionId),
    onSuccess: () => {
      void invalidate();
    },
  });
}
