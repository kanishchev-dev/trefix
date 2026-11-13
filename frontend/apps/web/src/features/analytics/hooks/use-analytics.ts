"use client";

import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  AnalyticsActivity,
  AnalyticsAttention,
  AnalyticsAttentionType,
  AnalyticsAudience,
  AnalyticsCoach,
  AnalyticsEngagement,
  AnalyticsOutcomes,
  AnalyticsPlans,
  AnalyticsRange,
  AnalyticsSummary,
} from "@trefix/api-client";

import {
  fetchAnalyticsActivity,
  fetchAnalyticsAttention,
  fetchAnalyticsAudience,
  fetchAnalyticsCoach,
  fetchAnalyticsEngagement,
  fetchAnalyticsOutcomes,
  fetchAnalyticsPlans,
  fetchAnalyticsSummary,
  type AnalyticsFilters,
} from "@/entities/analytics/api";

/** The server caches blocks for minutes; refetching sooner gains nothing. */
const STALE_TIME_MS = 5 * 60 * 1000;

export const analyticsKeys = {
  all: ["analytics"] as const,
  block: (block: string, filters: AnalyticsFilters, extra?: unknown) =>
    [
      "analytics",
      block,
      filters.period,
      filters.timezone,
      filters.includeStaff,
      filters.refreshToken ?? 0,
      extra ?? null,
    ] as const,
};

function options<T>(
  block: string,
  filters: AnalyticsFilters,
  fetcher: () => Promise<T>,
  extra?: unknown,
  enabled = true,
) {
  return {
    queryKey: analyticsKeys.block(block, filters, extra),
    queryFn: fetcher,
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
    enabled,
  };
}

export function useAnalyticsSummary(
  filters: AnalyticsFilters,
): UseQueryResult<AnalyticsSummary> {
  return useQuery(
    options("summary", filters, () => fetchAnalyticsSummary(filters)),
  );
}

export function useAnalyticsActivity(
  filters: AnalyticsFilters,
  range: AnalyticsRange,
): UseQueryResult<AnalyticsActivity> {
  return useQuery(
    options(
      "activity",
      filters,
      () => fetchAnalyticsActivity(filters, range),
      range,
    ),
  );
}

export function useAnalyticsEngagement(
  filters: AnalyticsFilters,
  enabled: boolean,
): UseQueryResult<AnalyticsEngagement> {
  return useQuery(
    options(
      "engagement",
      filters,
      () => fetchAnalyticsEngagement(filters),
      null,
      enabled,
    ),
  );
}

export function useAnalyticsOutcomes(
  filters: AnalyticsFilters,
  enabled: boolean,
): UseQueryResult<AnalyticsOutcomes> {
  return useQuery(
    options(
      "outcomes",
      filters,
      () => fetchAnalyticsOutcomes(filters),
      null,
      enabled,
    ),
  );
}

export function useAnalyticsPlans(
  filters: AnalyticsFilters,
  enabled: boolean,
): UseQueryResult<AnalyticsPlans> {
  return useQuery(
    options(
      "plans",
      filters,
      () => fetchAnalyticsPlans(filters),
      null,
      enabled,
    ),
  );
}

export function useAnalyticsCoach(
  filters: AnalyticsFilters,
  enabled: boolean,
): UseQueryResult<AnalyticsCoach> {
  return useQuery(
    options(
      "coach",
      filters,
      () => fetchAnalyticsCoach(filters),
      null,
      enabled,
    ),
  );
}

export function useAnalyticsAudience(
  filters: AnalyticsFilters,
  enabled: boolean,
): UseQueryResult<AnalyticsAudience> {
  return useQuery(
    options(
      "audience",
      filters,
      () => fetchAnalyticsAudience(filters),
      null,
      enabled,
    ),
  );
}

export function useAnalyticsAttention(
  filters: AnalyticsFilters,
  query: {
    types: readonly AnalyticsAttentionType[];
    page: number;
    limit: number;
    sortBy: "severity" | "since";
  },
): UseQueryResult<AnalyticsAttention> {
  return useQuery(
    options(
      "attention",
      filters,
      () => fetchAnalyticsAttention(filters, query),
      query,
    ),
  );
}
