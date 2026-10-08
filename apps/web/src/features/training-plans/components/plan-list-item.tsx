"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { Progress } from "@workspace/ui/components/progress";
import { ChevronRightIcon } from "lucide-react";

import type { PlanListItem as PlanListItemData } from "@workspace/api-client";

import { useI18n } from "@/shared/i18n";

import { formatNumber, formatPlanDate } from "../lib/plan-format";
import { PlanStatusBadge } from "./plan-status-badge";

export function PlanListItem({
  userId,
  plan,
}: {
  userId: string;
  plan: PlanListItemData;
}): ReactElement {
  const { t, locale } = useI18n();

  const goalTitle =
    plan.goal.title ??
    (plan.goal.type ? t(`userPlans.goal.types.${plan.goal.type}`) : null);
  const dates =
    plan.startDate && plan.endDate
      ? `${formatPlanDate(plan.startDate, locale)} — ${formatPlanDate(plan.endDate, locale)}`
      : t("userPlans.list.notStarted");
  const progress =
    plan.progress !== undefined ? Math.round(plan.progress * 100) : null;

  return (
    <li>
      <Link
        href={`/users/${userId}/plans/${plan.id}`}
        className="flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{plan.name}</span>
            <PlanStatusBadge status={plan.status} />
            {plan.metricsStale ? (
              <span className="text-xs text-muted-foreground">
                {t("userPlans.list.metricsStale")}
              </span>
            ) : null}
          </div>
          <span className="text-sm text-muted-foreground">
            {[
              goalTitle,
              t("userPlans.list.weeks", { count: plan.totalWeeks }),
              plan.sessionsPerWeek
                ? t("userPlans.list.sessions", { count: plan.sessionsPerWeek })
                : null,
              dates,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {plan.stats ? (
            <span className="text-xs text-muted-foreground">
              {t("userPlans.list.stats", {
                completed: plan.stats.completedWorkouts,
                planned: plan.stats.plannedWorkouts,
                distance: formatNumber(plan.stats.totalDistanceKm, locale),
              })}
            </span>
          ) : null}
          {plan.status === "active" && progress !== null ? (
            <div className="flex max-w-sm items-center gap-2">
              <Progress
                value={progress}
                className="flex-1"
                aria-label={t("userPlans.list.progress")}
              />
              <span className="text-xs tabular-nums text-muted-foreground">
                {t("userPlans.list.currentWeek", {
                  week: plan.currentWeek ?? 1,
                  total: plan.totalWeeks,
                })}
              </span>
            </div>
          ) : null}
        </div>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
