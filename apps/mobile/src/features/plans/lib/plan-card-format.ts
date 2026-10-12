import { type PlanCounts, type PlanListItem } from "@trefix/api-client";

import {
  fillTemplate,
  formatShortDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";

export type PlansSegment = "draft" | "history";

/** Drafts first when there are any, otherwise history. */
export function defaultSegment(counts: PlanCounts | undefined): PlansSegment {
  return counts && counts.draft === 0 && counts.history > 0
    ? "history"
    : "draft";
}

/** "Marathon 3:30 · 16 wk · 4/wk · race 19.09.27" */
export function planCardSubtitle(
  item: PlanListItem,
  copy: MainCopy,
  language: AppLanguage,
): string {
  const cardCopy = copy.plans.card;
  const parts: string[] = [];
  if (item.goal.title) parts.push(item.goal.title);
  parts.push(fillTemplate(cardCopy.weeks, { count: item.totalWeeks }));
  if (item.sessionsPerWeek)
    parts.push(fillTemplate(cardCopy.perWeek, { count: item.sessionsPerWeek }));
  if (item.goal.targetDate) {
    parts.push(
      fillTemplate(cardCopy.raceOn, {
        date: formatShortDate(item.goal.targetDate, language),
      }),
    );
  }
  return parts.join(" · ");
}

/** Completion rate (0..1 ratio from the API) as a whole percentage. */
export function completionPercent(rate: number | undefined | null): number {
  if (rate === undefined || rate === null || !Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(100, Math.round(rate * 100)));
}

/** Status line of a plan card: draft edit date, or the outcome of a history plan. */
export function planCardStatus(
  item: PlanListItem,
  copy: MainCopy,
  language: AppLanguage,
): string {
  const statusCopy = copy.plans.status;
  if (item.status === "draft") {
    return fillTemplate(statusCopy.draft, {
      date: formatShortDate(item.updatedAt, language),
    });
  }
  const rate = completionPercent(item.stats?.completionRate);
  if (item.status === "cancelled") {
    const date = item.cancelledAt ?? item.updatedAt;
    return fillTemplate(statusCopy.cancelled, {
      date: formatShortDate(date, language),
      rate,
    });
  }
  if (item.status === "completed") {
    const date = item.endDate ?? item.updatedAt;
    return fillTemplate(statusCopy.completed, {
      date: formatShortDate(date, language),
      rate,
    });
  }
  return fillTemplate(copy.plans.card.activeProgress, {
    current: item.currentWeek ?? 0,
    total: item.totalWeeks,
  });
}
