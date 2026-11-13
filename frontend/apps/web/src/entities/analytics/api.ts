import {
  analyticsActivitySchema,
  analyticsAttentionSchema,
  analyticsAudienceSchema,
  analyticsCoachSchema,
  analyticsEngagementSchema,
  analyticsOutcomesSchema,
  analyticsPlansSchema,
  analyticsSummarySchema,
  type AnalyticsActivity,
  type AnalyticsAttention,
  type AnalyticsAttentionType,
  type AnalyticsAudience,
  type AnalyticsCoach,
  type AnalyticsEngagement,
  type AnalyticsOutcomes,
  type AnalyticsPeriod,
  type AnalyticsPlans,
  type AnalyticsRange,
  type AnalyticsSummary,
} from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

/** Filters shared by every block of the dashboard. */
export type AnalyticsFilters = {
  period: AnalyticsPeriod;
  timezone: string;
  includeStaff: boolean;
  /** Bumped by "refresh": a non-zero value makes the server recompute instead of serving its cache. */
  refreshToken?: number;
};

function params(filters: AnalyticsFilters): Record<string, string | undefined> {
  return {
    period: filters.period,
    timezone: filters.timezone,
    includeStaff: filters.includeStaff ? "true" : undefined,
    refresh: filters.refreshToken ? "true" : undefined,
  };
}

async function get(
  block: string,
  searchParams: Record<string, string | number | readonly string[] | undefined>,
): Promise<unknown> {
  return apiRequest<unknown>(`/api/admin/analytics/${block}`, {
    searchParams,
  });
}

export async function fetchAnalyticsSummary(
  filters: AnalyticsFilters,
): Promise<AnalyticsSummary> {
  return analyticsSummarySchema.parse(await get("summary", params(filters)));
}

export async function fetchAnalyticsActivity(
  filters: AnalyticsFilters,
  range: AnalyticsRange,
): Promise<AnalyticsActivity> {
  return analyticsActivitySchema.parse(
    await get("activity", { ...params(filters), period: undefined, range }),
  );
}

export async function fetchAnalyticsEngagement(
  filters: AnalyticsFilters,
): Promise<AnalyticsEngagement> {
  return analyticsEngagementSchema.parse(
    await get("engagement", params(filters)),
  );
}

export async function fetchAnalyticsOutcomes(
  filters: AnalyticsFilters,
): Promise<AnalyticsOutcomes> {
  return analyticsOutcomesSchema.parse(await get("outcomes", params(filters)));
}

export async function fetchAnalyticsPlans(
  filters: AnalyticsFilters,
): Promise<AnalyticsPlans> {
  return analyticsPlansSchema.parse(await get("plans", params(filters)));
}

export async function fetchAnalyticsCoach(
  filters: AnalyticsFilters,
): Promise<AnalyticsCoach> {
  return analyticsCoachSchema.parse(await get("coach", params(filters)));
}

export async function fetchAnalyticsAudience(
  filters: AnalyticsFilters,
): Promise<AnalyticsAudience> {
  return analyticsAudienceSchema.parse(await get("audience", params(filters)));
}

export async function fetchAnalyticsAttention(
  filters: AnalyticsFilters,
  query: {
    types: readonly AnalyticsAttentionType[];
    page: number;
    limit: number;
    sortBy: "severity" | "since";
  },
): Promise<AnalyticsAttention> {
  return analyticsAttentionSchema.parse(
    await get("attention-items", {
      ...params(filters),
      type: query.types.length ? query.types : undefined,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
    }),
  );
}
