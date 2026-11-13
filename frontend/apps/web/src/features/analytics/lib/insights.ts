import type {
  AnalyticsActivity,
  AnalyticsEngagement,
  AnalyticsKpi,
  AnalyticsOutcomes,
  AnalyticsPlans,
  AnalyticsSummary,
} from "@trefix/api-client";

import { sum, trendOf } from "./format";

/**
 * One-line conclusions under chart titles. Each returns a translation key
 * under `analytics.insights` with its parameters, or null when the data
 * says nothing yet; numbers are formatted by the caller.
 */
export type Insight = { key: string; params?: Record<string, number> };

/** Share of done workouts that counts as following the plan well. */
export const GOOD_ADHERENCE = 80;
/** Share of overloaded athletes worth a warning. */
export const OVERLOAD_WARNING = 10;

export function runnersInsight(
  kpi: AnalyticsSummary["weeklyActiveRunners"],
): Insight {
  if (kpi.growthWeeks >= 2)
    return { key: "growingWeeks", params: { weeks: kpi.growthWeeks } };
  const trend = trendOf(kpi.deltaPct);
  return {
    key:
      trend === "up" ? "aboveLast" : trend === "down" ? "belowLast" : "stable",
  };
}

export function adherenceInsight(kpi: AnalyticsKpi): Insight {
  if (kpi.value >= GOOD_ADHERENCE) return { key: "adherenceHigh" };
  return trendOf(kpi.deltaPct) === "down"
    ? { key: "adherenceFalling" }
    : { key: "adherenceLow" };
}

export function activityInsight(activity: AnalyticsActivity): Insight | null {
  if (!activity.points.length || !activity.averageActiveUsers) return null;
  return {
    key: "activityAverage",
    params: {
      runners: activity.averageRunners,
      share: Math.round(
        (activity.averageRunners / activity.averageActiveUsers) * 100,
      ),
    },
  };
}

export function goalsInsight(
  goals: AnalyticsOutcomes["goals"],
): Insight | null {
  const open = goals.active.onTrack + goals.active.atRisk;
  if (!open) return null;
  return {
    key: "goalsOnTrack",
    params: { share: Math.round((goals.active.onTrack / open) * 100) },
  };
}

export function goalFunnelInsight(
  steps: AnalyticsOutcomes["goalFunnel"],
): Insight | null {
  const first = steps[0]?.count ?? 0;
  const last = steps[steps.length - 1]?.count ?? 0;
  if (!first) return null;
  return {
    key: "goalFunnel",
    params: { share: Math.round((last / first) * 100) },
  };
}

export function fitnessInsight(
  fitness: AnalyticsOutcomes["fitness"],
): Insight | null {
  const change = fitness.thresholdPaceChangeMedianSec;
  if (change === null || !fitness.athletes) return null;
  if (change <= -1)
    return { key: "fitnessFaster", params: { seconds: Math.abs(change) } };
  if (change >= 1) return { key: "fitnessSlower", params: { seconds: change } };
  return { key: "fitnessStable" };
}

export function recordsInsight(
  records: AnalyticsOutcomes["records"],
): Insight | null {
  if (!records.improvements && !records.firsts) return null;
  return {
    key: "records",
    params: { improvements: records.improvements, firsts: records.firsts },
  };
}

export function racesInsight(
  races: AnalyticsOutcomes["raceResults"],
): Insight | null {
  const total = sum(races.map((row) => row.count));
  if (!total) return null;
  const good = sum(
    races
      .filter(
        (row) => row.bucket === "faster_3plus" || row.bucket === "within_3",
      )
      .map((row) => row.count),
  );
  return { key: "races", params: { share: Math.round((good / total) * 100) } };
}

export function safetyInsight(
  safety: AnalyticsOutcomes["safety"],
): Insight | null {
  if (safety.currentShare === null) return null;
  return {
    key:
      safety.currentShare > OVERLOAD_WARNING
        ? "overloadHigh"
        : "overloadNormal",
    params: { share: safety.currentShare },
  };
}

export function volumeInsight(
  volume: AnalyticsOutcomes["volume"],
): Insight | null {
  const known = volume.filter((week) => week.medianKm !== null);
  if (known.length < 2) return null;
  return {
    key: "volume",
    params: {
      from: known[0].medianKm ?? 0,
      to: known[known.length - 1].medianKm ?? 0,
    },
  };
}

export function regularityInsight(
  regularity: AnalyticsEngagement["regularity"],
): Insight | null {
  const total = sum(regularity.map((row) => row.users));
  if (!total) return null;
  const steady = sum(
    regularity.filter((row) => row.weeks >= 6).map((row) => row.users),
  );
  return {
    key: "regularity",
    params: { share: Math.round((steady / total) * 100) },
  };
}

export function whenTheyRunInsight(
  cells: AnalyticsEngagement["whenTheyRun"],
): Insight | null {
  if (!cells.length) return null;
  const peak = cells.reduce((best, cell) =>
    cell.workouts > best.workouts ? cell : best,
  );
  return {
    key: "peakHour",
    params: { weekday: peak.weekday, hour: peak.hour },
  };
}

export function planDropInsight(
  weeks: AnalyticsPlans["adherenceByPlanWeek"],
): Insight | null {
  const known = weeks.filter(
    (week) => week.adherencePct !== null && week.workouts >= 10,
  );
  if (known.length < 3) return null;
  const lowest = known.reduce((low, week) =>
    (week.adherencePct ?? 100) < (low.adherencePct ?? 100) ? week : low,
  );
  return {
    key: "planDrop",
    params: { week: lowest.planWeek, share: lowest.adherencePct ?? 0 },
  };
}

export function planOutcomesInsight(
  outcomes: AnalyticsPlans["outcomes"],
): Insight | null {
  const total = outcomes.completed + outcomes.cancelled;
  if (!total) return null;
  return {
    key: "plansCompleted",
    params: { share: Math.round((outcomes.completed / total) * 100) },
  };
}
