import type { PlanGoal } from "@trefix/api-client";
import { formatHoursMinutesSeconds } from "@trefix/utils";

import { formatNumber } from "./plan-format";

/*
 * Plan texts built from codes and numbers sent by the backend. The backend
 * sends no user-facing text of its own: only the user's own plan name and the
 * description of a custom goal come as text.
 */

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** Goal summary: the user's own text, the numeric target, or the goal type. */
export function goalTitle(
  goal: PlanGoal | null | undefined,
  t: Translate,
  locale: string,
): string | null {
  if (!goal) return null;
  if (goal.description) return goal.description;

  const target = goal.target;
  if (target?.distanceMeters) {
    const distance = formatNumber(target.distanceMeters / 1000, locale);
    return target.finishTimeSec
      ? t("userPlans.goal.summary.distanceTime", {
          distance,
          time: formatHoursMinutesSeconds(target.finishTimeSec),
        })
      : t("userPlans.goal.summary.distance", { distance });
  }
  if (target?.runsPerWeek) {
    return t("userPlans.goal.summary.runsPerWeek", {
      count: target.runsPerWeek,
    });
  }
  if (target?.weightKg) {
    return t("userPlans.goal.summary.weight", {
      weight: formatNumber(target.weightKg, locale),
    });
  }
  return goal.type ? t(`userPlans.goal.types.${goal.type}`) : null;
}

/** The name the user gave the plan, otherwise its goal. */
export function planTitle(
  plan: { name: string | null; goal: PlanGoal | null | undefined },
  t: Translate,
  locale: string,
): string {
  return (
    plan.name ?? goalTitle(plan.goal, t, locale) ?? t("userPlans.untitled")
  );
}
