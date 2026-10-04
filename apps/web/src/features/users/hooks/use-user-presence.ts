"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import { fetchUserPresence } from "@/entities/user/api";
import { useRealtimeClient } from "@/shared/api/realtime-provider";
import { realtimeEventPresence } from "@/shared/api/realtime-events";

/**
 * Keyed by the requested ids so a page of ten rows and a single card do not
 * share (or overwrite) one another's answer.
 */
export const userPresenceKeys = {
  all: ["user-presence"] as const,
  list: (userIds: readonly string[]) =>
    [...userPresenceKeys.all, [...userIds].sort()] as const,
};

export function useUserPresence(userIds: readonly string[]) {
  const queryClient = useQueryClient();
  const client = useRealtimeClient();

  // Derived from the values rather than the array identity: callers pass a
  // freshly built array on every render, and keying off that identity would
  // refetch on every render of the whole table.
  const idsKey = useMemo(() => [...new Set(userIds)].sort().join(","), [userIds]);
  const uniqueUserIds = useMemo(
    () => (idsKey ? idsKey.split(",") : []),
    [idsKey],
  );

  const query = useQuery({
    // Keyed by the sorted ids, so an unstable array identity cannot refetch.
    queryKey: userPresenceKeys.list(uniqueUserIds),
    queryFn: () => fetchUserPresence(uniqueUserIds),
    enabled: uniqueUserIds.length > 0,
    // Presence is a live signal, not history: a cached answer that outlives
    // the connection would keep showing stale dots.
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const onlineUserIds = useMemo(() => query.data ?? new Set<string>(), [query.data]);

  // The backend only announces transitions, so the cached set is patched in
  // place instead of refetching: the event already carries the new state, and
  // a full round trip per join/leave would be wasted bandwidth.
  useEffect(() => {
    if (!client) {
      return;
    }

    const unsubscribe = client.on("user.presence.updated", (payload) => {
      const presence = realtimeEventPresence(payload);

      if (!presence) {
        return;
      }

      queryClient.setQueriesData<Set<string>>(
        { queryKey: userPresenceKeys.all },
        (cached) => {
          if (!cached) {
            return cached;
          }

          const alreadyCorrect = presence.online
            ? cached.has(presence.userId)
            : !cached.has(presence.userId);

          if (alreadyCorrect) {
            return cached;
          }

          const next = new Set(cached);

          if (presence.online) {
            next.add(presence.userId);
          } else {
            next.delete(presence.userId);
          }

          return next;
        },
      );
    });

    return unsubscribe;
  }, [client, queryClient]);

  const isOnline = useCallback(
    (userId: string) => onlineUserIds.has(userId),
    [onlineUserIds],
  );

  return { isOnline, onlineUserIds, isLoading: query.isLoading };
}