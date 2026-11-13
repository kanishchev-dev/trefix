"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import type { AdminOverview } from "@trefix/api-client";

import { fetchUserOverview } from "@/entities/user-overview/api";
import { getBrowserTimezone } from "@/features/training-calendar/lib/calendar-dates";
import { userCardKeys } from "@/features/users/hooks/use-user-card-query";

export function useUserOverview(userId: string): UseQueryResult<AdminOverview> {
  const timezone = useMemo(() => getBrowserTimezone(), []);
  return useQuery({
    queryKey: userCardKeys.section(userId, "overview"),
    queryFn: () => fetchUserOverview(userId, timezone),
  });
}
