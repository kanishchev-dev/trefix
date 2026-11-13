"use client";

import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";

import type { ActivityPage } from "@trefix/api-client";

import {
  fetchActivityLog,
  fetchUserActivity,
  type ActivityFilter,
  type ActivityLogFilter,
} from "@/entities/activity/api";
import { userCardKeys } from "@/features/users/hooks/use-user-card-query";

export function useUserActivity(
  userId: string,
  filter: ActivityFilter,
  limit?: number,
): UseInfiniteQueryResult<InfiniteData<ActivityPage>> {
  return useInfiniteQuery({
    queryKey: [...userCardKeys.section(userId, "activity"), filter, limit],
    queryFn: ({ pageParam }) =>
      fetchUserActivity(userId, filter, pageParam, limit),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.hasNext ? (page.nextCursor ?? undefined) : undefined,
  });
}

export function useActivityLog(
  filter: ActivityLogFilter,
): UseInfiniteQueryResult<InfiniteData<ActivityPage>> {
  return useInfiniteQuery({
    queryKey: ["activity-log", filter],
    queryFn: ({ pageParam }) => fetchActivityLog(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.hasNext ? (page.nextCursor ?? undefined) : undefined,
  });
}
