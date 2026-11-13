"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  BroadcastAudienceInput,
  BroadcastStatus,
  CreateBroadcastInput,
} from "@trefix/api-client";

import {
  createBroadcast,
  fetchBroadcast,
  fetchBroadcastRecipients,
  fetchBroadcasts,
  fetchUserNotifications,
  fetchUserPushDevices,
  previewAudience,
} from "@/entities/notification/api";
import { userCardKeys } from "@/features/users/hooks/use-user-card-query";

export const NOTIFICATIONS_SECTION = "notifications";

export const notificationKeys = {
  all: ["notifications"] as const,
  broadcasts: (page: number, status: BroadcastStatus | "all") =>
    [...notificationKeys.all, "broadcasts", page, status] as const,
  broadcast: (id: string) =>
    [...notificationKeys.all, "broadcast", id] as const,
  recipients: (id: string, page: number, unread: boolean) =>
    [...notificationKeys.broadcast(id), "recipients", page, unread] as const,
  preview: (audience: BroadcastAudienceInput) =>
    [...notificationKeys.all, "preview", audience] as const,
  userInbox: (userId: string, page: number) =>
    [
      ...userCardKeys.section(userId, NOTIFICATIONS_SECTION),
      "inbox",
      page,
    ] as const,
  userDevices: (userId: string) =>
    [
      ...userCardKeys.section(userId, NOTIFICATIONS_SECTION),
      "devices",
    ] as const,
};

/** Broadcasts that are still being expanded refresh until they finish. */
const IN_PROGRESS: readonly BroadcastStatus[] = ["queued", "sending"];

export function useBroadcasts(page: number, status: BroadcastStatus | "all") {
  return useQuery({
    queryKey: notificationKeys.broadcasts(page, status),
    queryFn: () =>
      fetchBroadcasts({
        page,
        limit: 20,
        status: status === "all" ? undefined : status,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.data.some((item) => IN_PROGRESS.includes(item.status))
        ? 3000
        : false,
  });
}

export function useBroadcast(id: string) {
  return useQuery({
    queryKey: notificationKeys.broadcast(id),
    queryFn: () => fetchBroadcast(id),
    refetchInterval: (query) =>
      query.state.data && IN_PROGRESS.includes(query.state.data.status)
        ? 3000
        : false,
  });
}

export function useBroadcastRecipients(
  id: string,
  page: number,
  unread: boolean,
) {
  return useQuery({
    queryKey: notificationKeys.recipients(id, page, unread),
    queryFn: () => fetchBroadcastRecipients(id, { page, limit: 20, unread }),
    placeholderData: keepPreviousData,
  });
}

export function useAudiencePreview(audience: BroadcastAudienceInput | null) {
  return useQuery({
    queryKey: notificationKeys.preview(audience ?? { type: "all" }),
    queryFn: () => previewAudience(audience ?? { type: "all" }),
    enabled: audience !== null,
    placeholderData: keepPreviousData,
  });
}

export function useCreateBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBroadcastInput) => createBroadcast(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      await queryClient.invalidateQueries({ queryKey: userCardKeys.all });
    },
  });
}

export function useUserNotifications(userId: string, page: number) {
  return useQuery({
    queryKey: notificationKeys.userInbox(userId, page),
    queryFn: () => fetchUserNotifications(userId, { page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
}

export function useUserPushDevices(userId: string) {
  return useQuery({
    queryKey: notificationKeys.userDevices(userId),
    queryFn: () => fetchUserPushDevices(userId),
  });
}
