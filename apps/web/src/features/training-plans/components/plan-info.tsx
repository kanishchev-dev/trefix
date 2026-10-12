"use client";

import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";

import {
  GOAL_METRIC_KEYS,
  type GoalMetricKey,
  type PlanDetails,
} from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

import { formatGoalField, goalFieldKind } from "../lib/goal-fields";
import {
  formatDuration,
  formatNumber,
  formatPace,
  formatPlanDate,
} from "../lib/plan-format";

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{children}</span>
    </div>
  );
}

/** Goal metric with its unit, e.g. "21.1 km" or "1:45:00". */
export function useGoalValueFormatter(): (
  key: GoalMetricKey,
  value: unknown,
) => string {
  const { t } = useI18n();
  return (key, value) => {
    const text = formatGoalField(key, value);
    if (text === "") return "—";
    const kind = goalFieldKind(key);
    if (kind === "select") return t(`userPlans.goal.options.${key}.${text}`);
    if (kind === "duration") return text;
    if (kind === "pace") return `${text} ${t("userPlans.units.perKm")}`;
    return `${text} ${t(`userPlans.goal.units.${key}`)}`;
  };
}

/** Parameters the plan was built from, the metrics it started with and its lineage. */
export function PlanInfo({
  userId,
  plan,
}: {
  userId: string;
  plan: PlanDetails;
}): ReactElement {
  const { t, locale } = useI18n();
  const formatGoalValue = useGoalValueFormatter();

  const goal = plan.config.goal as Record<string, unknown>;
  const goalType = typeof goal.type === "string" ? goal.type : plan.goal.type;
  const target = (goal.target ?? {}) as Record<string, unknown>;
  const current = (goal.current ?? {}) as Record<string, unknown>;
  const metricValues = (values: Record<string, unknown>) =>
    GOAL_METRIC_KEYS.filter(
      (key) => values[key] !== undefined && values[key] !== null,
    ).map(
      (key) =>
        `${t(`userPlans.goal.fields.${key}`)}: ${formatGoalValue(key, values[key])}`,
    );

  const { schedule, structure } = plan.config;
  const snapshot = plan.metricsSnapshot;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("userPlans.info.goalTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 sm:grid-cols-2">
          <InfoRow label={t("userPlans.info.goalType")}>
            {goalType ? t(`userPlans.goal.types.${goalType}`) : "—"}
          </InfoRow>
          <InfoRow label={t("userPlans.info.targetDate")}>
            {formatPlanDate(plan.goal.targetDate, locale)}
          </InfoRow>
          <InfoRow label={t("userPlans.info.target")}>
            {metricValues(target).join(", ") || "—"}
          </InfoRow>
          <InfoRow label={t("userPlans.info.current")}>
            {metricValues(current).join(", ") || "—"}
          </InfoRow>
          {typeof goal.description === "string" && goal.description ? (
            <div className="sm:col-span-2">
              <InfoRow label={t("userPlans.info.description")}>
                {goal.description}
              </InfoRow>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("userPlans.info.structureTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 sm:grid-cols-2">
          <InfoRow label={t("userPlans.wizard.trainingDays")}>
            {schedule.trainingDays?.length
              ? schedule.trainingDays
                  .map((day) => t(`userPlans.weekdays.short.${day}`))
                  .join(", ")
              : "—"}
          </InfoRow>
          <InfoRow label={t("userPlans.wizard.longRunDay")}>
            {schedule.preferredLongRunDay != null
              ? t(`userPlans.weekdays.long.${schedule.preferredLongRunDay}`)
              : t("userPlans.wizard.longRunAuto")}
          </InfoRow>
          <InfoRow label={t("userPlans.info.weeksSessions")}>
            {t("userPlans.info.weeksSessionsValue", {
              weeks: structure.totalWeeks ?? plan.totalWeeks,
              sessions:
                structure.sessionsPerWeek ?? plan.sessionsPerWeek ?? "—",
            })}
          </InfoRow>
          <InfoRow label={t("userPlans.wizard.workoutDuration")}>
            {schedule.workoutDurationMinutes
              ? t("userPlans.units.minutes", {
                  value: schedule.workoutDurationMinutes,
                })
              : "—"}
          </InfoRow>
          <InfoRow label={t("userPlans.wizard.focus")}>
            {structure.focus?.length
              ? structure.focus
                  .map((item) => t(`trainingCalendar.types.${item}`))
                  .join(", ")
              : "—"}
          </InfoRow>
          <InfoRow label={t("userPlans.info.source")}>
            {t(`userPlans.creationSource.${plan.creationSource}`)}
          </InfoRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("userPlans.info.metricsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 sm:grid-cols-2">
          {snapshot ? (
            <>
              <InfoRow label={t("userPlans.metrics.thresholdPace")}>
                {snapshot.thresholdPaceSecondsPerKm
                  ? `${formatPace(snapshot.thresholdPaceSecondsPerKm)} ${t("userPlans.units.perKm")}`
                  : "—"}
              </InfoRow>
              <InfoRow label={t("userPlans.metrics.weeklyMileage")}>
                {snapshot.weeklyMileageKm != null
                  ? `${formatNumber(snapshot.weeklyMileageKm, locale)} ${t("userPlans.units.km")}`
                  : "—"}
              </InfoRow>
              <InfoRow label={t("userPlans.metrics.longestRun")}>
                {snapshot.longestRunKm != null
                  ? `${formatNumber(snapshot.longestRunKm, locale)} ${t("userPlans.units.km")}`
                  : "—"}
              </InfoRow>
              <InfoRow label={t("userPlans.metrics.heartRate")}>
                {[
                  snapshot.thresholdHeartRate,
                  snapshot.maxHeartRate,
                  snapshot.restingHeartRate,
                ].some((value) => value != null)
                  ? t("userPlans.metrics.heartRateValue", {
                      threshold: snapshot.thresholdHeartRate ?? "—",
                      max: snapshot.maxHeartRate ?? "—",
                      resting: snapshot.restingHeartRate ?? "—",
                    })
                  : "—"}
              </InfoRow>
              <InfoRow label={t("userPlans.metrics.recentResult")}>
                {snapshot.recentResult
                  ? `${t(`userPlans.metrics.distances.${snapshot.recentResult.distance}`)} · ${formatDuration(snapshot.recentResult.timeSeconds)}`
                  : "—"}
              </InfoRow>
              <InfoRow label={t("userPlans.info.capturedAt")}>
                {formatPlanDate(snapshot.capturedAt, locale)}
              </InfoRow>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("userPlans.info.noSnapshot")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("userPlans.info.notesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm whitespace-pre-wrap">
            {plan.notes || t("userPlans.info.noNotes")}
          </p>
          {plan.cancelReason ? (
            <p className="text-sm text-muted-foreground">
              {t("userPlans.info.cancelled", {
                date: formatPlanDate(plan.cancelledAt, locale),
                reason: t(`userPlans.cancelReasons.${plan.cancelReason}`),
              })}
            </p>
          ) : null}
          {plan.sourcePlanId ? (
            <Link
              className="text-sm underline underline-offset-4"
              href={`/users/${userId}/plans/${plan.sourcePlanId}`}
            >
              {t("userPlans.info.sourcePlan")}
            </Link>
          ) : null}
          {plan.replacedByPlanId ? (
            <Link
              className="text-sm underline underline-offset-4"
              href={`/users/${userId}/plans/${plan.replacedByPlanId}`}
            >
              {t("userPlans.info.replacedBy")}
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
