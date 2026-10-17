"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import {
  ANALYTICS_PERIODS,
  ANALYTICS_RANGES,
  type AnalyticsPeriod,
  type AnalyticsRange,
} from "@trefix/api-client";

import type { AnalyticsFilters } from "@/entities/analytics/api";
import { getBrowserTimezone } from "@/features/training-calendar/lib/calendar-dates";

export const ANALYTICS_TABS = [
  "outcomes",
  "engagement",
  "plans",
  "coach",
  "audience",
  "attention",
] as const;
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number];

const DEFAULT_PERIOD: AnalyticsPeriod = "30d";
const DEFAULT_RANGE: AnalyticsRange = "90d";
const DEFAULT_TAB: AnalyticsTab = "outcomes";

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Dashboard filters kept in the URL so a view can be shared and survives a
 * reload. `refresh` is one-shot: the next requests skip the server cache.
 */
export function useAnalyticsFilters(): {
  filters: AnalyticsFilters;
  range: AnalyticsRange;
  tab: AnalyticsTab;
  setPeriod: (period: AnalyticsPeriod) => void;
  setIncludeStaff: (value: boolean) => void;
  setRange: (range: AnalyticsRange) => void;
  setTab: (tab: AnalyticsTab) => void;
  refresh: () => void;
  refreshToken: number;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timezone = useMemo(() => getBrowserTimezone(), []);
  const [refreshToken, setRefreshToken] = useState(0);

  const period = pick(
    searchParams.get("period"),
    ANALYTICS_PERIODS,
    DEFAULT_PERIOD,
  );
  const range = pick(
    searchParams.get("range"),
    ANALYTICS_RANGES,
    DEFAULT_RANGE,
  );
  const tab = pick(searchParams.get("tab"), ANALYTICS_TABS, DEFAULT_TAB);
  const includeStaff = searchParams.get("staff") === "1";

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) params.delete(key);
      else params.set(key, value);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const filters = useMemo<AnalyticsFilters>(
    () => ({ period, timezone, includeStaff, refreshToken }),
    [period, timezone, includeStaff, refreshToken],
  );

  return {
    filters,
    range,
    tab,
    setPeriod: (next) =>
      update("period", next === DEFAULT_PERIOD ? null : next),
    setIncludeStaff: (value) => update("staff", value ? "1" : null),
    setRange: (next) => update("range", next === DEFAULT_RANGE ? null : next),
    setTab: (next) => update("tab", next === DEFAULT_TAB ? null : next),
    refresh: () => setRefreshToken((value) => value + 1),
    refreshToken,
  };
}
