import {
  planPhaseSchema,
  type PlanGoal,
  type PlanKeySession,
  type PlanPhase,
} from "@trefix/api-client";
import { formatHoursMinutesSeconds } from "@trefix/utils";

import {
  fillTemplate,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";

/*
 * Plan texts built from codes and numbers sent by the backend: week phases,
 * goals, adaptations. The backend sends no user-facing text of its own.
 */

export function toPlanPhase(value: string): PlanPhase {
  const parsed = planPhaseSchema.safeParse(value.toUpperCase());
  return parsed.success ? parsed.data : "BASE";
}

export function phaseTitle(phase: string, copy: MainCopy): string {
  const titles = copy.plan.creation.preview.phaseTitles as Record<
    string,
    string
  >;
  return titles[toPlanPhase(phase)] ?? titles.BASE;
}

export function phaseIntent(phase: string, copy: MainCopy): string {
  const intents = copy.plan.creation.preview.phaseIntents as Record<
    string,
    string
  >;
  return intents[toPlanPhase(phase)] ?? intents.BASE;
}

export function workoutTypeLabel(type: string, copy: MainCopy): string {
  const labels = copy.plan.creation.workoutTypes as Record<string, string>;
  return labels[type] ?? type;
}

/** "Темповая 8 км" */
export function keySessionLabel(
  session: PlanKeySession,
  copy: MainCopy,
): string {
  return `${workoutTypeLabel(session.type, copy)} ${Math.round(session.distanceKm)} ${copy.plan.creation.units.km}`;
}

function formatNumber(value: number, language: AppLanguage): string {
  const text = String(Math.round(value * 10) / 10);
  return language === "ru" ? text.replace(".", ",") : text;
}

/** Goal summary: the user's own text, the numeric target, or the goal type. */
export function goalTitle(
  goal: PlanGoal | null | undefined,
  copy: MainCopy,
  language: AppLanguage,
): string | null {
  if (!goal) return null;
  if (goal.description) return goal.description;

  const titles = copy.plans.goalTitle;
  const target = goal.target;
  if (target?.distanceMeters) {
    const distance = formatNumber(target.distanceMeters / 1000, language);
    return target.finishTimeSec
      ? fillTemplate(titles.distanceTime, {
          distance,
          time: formatHoursMinutesSeconds(target.finishTimeSec),
        })
      : fillTemplate(titles.distance, { distance });
  }
  if (target?.runsPerWeek) {
    return pluralize(titles.runsPerWeek, target.runsPerWeek, language);
  }
  if (target?.weightKg) {
    return fillTemplate(titles.weight, {
      weight: formatNumber(target.weightKg, language),
    });
  }

  const types = copy.plan.creation.goalTypes as Record<string, string>;
  return goal.type ? (types[goal.type] ?? null) : null;
}

/** The name the user gave the plan, otherwise its goal. */
export function planTitle(
  plan: { name: string | null; goal: PlanGoal | null | undefined },
  copy: MainCopy,
  language: AppLanguage,
): string {
  return (
    plan.name ?? goalTitle(plan.goal, copy, language) ?? copy.plans.untitled
  );
}

export function adaptationTitle(type: string, copy: MainCopy): string {
  const types = copy.plan.adaptations.types as Record<string, string>;
  return types[type] ?? types.default;
}

/** Engine reasons are codes; a reason written by the coach is shown as is. */
export function adaptationReason(
  reason: string | null | undefined,
  copy: MainCopy,
): string | null {
  if (!reason) return null;
  const reasons = copy.plan.adaptations.reasons as Record<string, string>;
  if (reasons[reason]) return reasons[reason];
  return /^[a-z0-9_]+$/.test(reason) ? null : reason;
}
