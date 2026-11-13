import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import type { NotificationPage } from "@trefix/api-client";

import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationsRead,
} from "../../../lib/notifications-api";
import { useRealtimeEvent } from "../../../lib/realtime";

export const notificationKeys = {
  all: ["notifications"] as const,
  inbox: ["notifications", "inbox"] as const,
  unread: ["notifications", "unread"] as const,
};

type Inbox = InfiniteData<NotificationPage, number>;

export function useNotificationsInbox() {
  return useInfiniteQuery({
    queryKey: notificationKeys.inbox,
    queryFn: ({ pageParam }) => getNotifications(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.hasNextPage ? last.meta.page + 1 : undefined,
  });
}

export function useUnreadNotificationsCount(): number {
  const query = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: getUnreadNotificationsCount,
    staleTime: 60_000,
  });
  return query.data ?? 0;
}

/** Marks entries of the cached inbox as read without refetching every page. */
function patchInbox(
  queryClient: QueryClient,
  isAffected: (id: string) => boolean,
  readAt: string,
): void {
  queryClient.setQueryData<Inbox>(notificationKeys.inbox, (inbox) =>
    inbox
      ? {
          ...inbox,
          pages: inbox.pages.map((page) => ({
            ...page,
            data: page.data.map((item) =>
              !item.readAt && isAffected(item.id) ? { ...item, readAt } : item,
            ),
          })),
        }
      : inbox,
  );
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onMutate: (ids) => {
      const set = new Set(ids);
      patchInbox(queryClient, (id) => set.has(id), new Date().toISOString());
    },
    onSuccess: (count) =>
      queryClient.setQueryData(notificationKeys.unread, count),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () =>
      patchInbox(queryClient, () => true, new Date().toISOString()),
    onSuccess: (count) =>
      queryClient.setQueryData(notificationKeys.unread, count),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onMutate: (id) => {
      queryClient.setQueryData<Inbox>(notificationKeys.inbox, (inbox) =>
        inbox
          ? {
              ...inbox,
              pages: inbox.pages.map((page) => ({
                ...page,
                data: page.data.filter((item) => item.id !== id),
              })),
            }
          : inbox,
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

type CountEvent = { unreadCount?: number };

/** Keeps the badge and the inbox in sync with notifications sent while the app is open. */
export function useNotificationsRealtime(): void {
  const queryClient = useQueryClient();

  useRealtimeEvent<CountEvent>("notifications.created", (event) => {
    if (typeof event?.unreadCount === "number") {
      queryClient.setQueryData(notificationKeys.unread, event.unreadCount);
    }
    void queryClient.invalidateQueries({ queryKey: notificationKeys.inbox });
  });

  useRealtimeEvent<CountEvent>("notifications.updated", (event) => {
    if (typeof event?.unreadCount === "number") {
      queryClient.setQueryData(notificationKeys.unread, event.unreadCount);
    } else {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
    }
  });
}
