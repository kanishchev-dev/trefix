import {
  planPhaseSchema,
  type PlanDetails,
  type PlanPhase,
  type PlanWeek,
  type PlanWorkoutItem,
} from "@workspace/api-client";

import { fillTemplate, type MainCopy } from "../../../locales";

/** Mode of a plan timeline: the plan in progress, a draft (relative weeks) or history. */
export type PlanTimelineMode = "active" | "relative" | "history";

const KEY_WORKOUT_TYPES = new Set([
  "interval",
  "threshold",
  "tempo",
  "long_run",
  "race",
]);

function toPhase(value: string): PlanPhase {
  const parsed = planPhaseSchema.safeParse(value.toUpperCase());
  return parsed.success ? parsed.data : "BASE";
}

function weekTitle(
  phase: PlanPhase,
  fallback: string | null | undefined,
  copy: MainCopy,
  weekNumber: number,
): string {
  const titles = copy.plan.creation.preview.phaseTitles as Record<
    string,
    string
  >;
  return (
    titles[phase] ??
    fallback ??
    fillTemplate(copy.plan.creation.preview.weekLabel, { number: weekNumber })
  );
}

const round = (value: number) => Math.round(value);

function actualDistance(workout: PlanWorkoutItem): number {
  const value = Number(
    (workout.actual as Record<string, unknown> | null)?.actualDistanceKm ?? 0,
  );
  return Number.isFinite(value) ? value : 0;
}

/** Timeline weeks of a plan from its details: relative for drafts, dated for history. */
export function planWeeksForTimeline(
  details: PlanDetails,
  copy: MainCopy,
  mode: PlanTimelineMode,
): PlanWeek[] {
  const typeLabels = copy.plan.creation.workoutTypes as Record<string, string>;
  const km = copy.plan.creation.units.km;

  return details.weeks.map((week) => {
    const phase = toPhase(week.phase);
    const dated = details.workouts.filter(
      (workout) => workout.weekNumber === week.weekNumber,
    );
    const relative = week.workouts ?? [];
    const sessions = mode === "relative" ? relative : dated;
    const planned = sessions.reduce(
      (sum, workout) => sum + workout.distanceKm,
      0,
    );

    let summaryText = fillTemplate(copy.plans.details.weekWorkouts, {
      count: sessions.length,
      km: round(planned),
    });
    if (mode === "history") {
      const done = dated.filter((workout) => workout.status === "completed");
      const actual = done.reduce(
        (sum, workout) => sum + actualDistance(workout),
        0,
      );
      summaryText = `${fillTemplate(copy.plans.details.workoutsDone, { done: done.length, total: dated.length })} · ${fillTemplate(
        copy.plans.details.plannedActual,
        { planned: round(planned), actual: round(actual) },
      )}`;
    }

    const keySessions = sessions
      .filter((workout) => KEY_WORKOUT_TYPES.has(workout.type))
      .map(
        (workout) =>
          `${typeLabels[workout.type] ?? workout.type} ${round(workout.distanceKm)} ${km}`,
      );

    return {
      id: `week-${details.id}-${week.weekNumber}`,
      weekNumber: week.weekNumber,
      phase,
      title: weekTitle(phase, week.title, copy, week.weekNumber),
      status: mode === "history" ? "completed" : "upcoming",
      plannedWorkoutsCount: sessions.length,
      plannedDistance: round(planned),
      plannedLoad: round(week.weeklyLoadTarget ?? 0),
      summaryText,
      intent: week.intent ?? undefined,
      keySessions,
    };
  });
}

/** Workout row of the week details sheet. */
export type WeekWorkoutRow = {
  id: string;
  dayLabel: string;
  type: string;
  distanceKm: number;
  durationMinutes: number;
  status?: string;
  actualDistanceKm?: number | null;
  /** Dated workouts open the workout sheet; draft workouts are read-only here. */
  selectable: boolean;
};

/** Rows of one week: relative draft workouts or dated workouts of a started plan. */
export function weekWorkoutRows(
  details: PlanDetails,
  weekNumber: number,
  dayNames: readonly string[],
  formatDate: (iso: string) => string,
): WeekWorkoutRow[] {
  const week = details.weeks.find((item) => item.weekNumber === weekNumber);
  if (week?.workouts) {
    return [...week.workouts]
      .sort(
        (left, right) =>
          left.dayOfWeek - right.dayOfWeek ||
          left.orderInWeek - right.orderInWeek,
      )
      .map((workout) => ({
        id: workout.key,
        dayLabel: dayNames[workout.dayOfWeek] ?? "",
        type: workout.type,
        distanceKm: workout.distanceKm,
        durationMinutes: workout.durationMinutes,
        selectable: false,
      }));
  }
  return details.workouts
    .filter((workout) => workout.weekNumber === weekNumber)
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
    .map((workout) => ({
      id: workout.id,
      dayLabel: formatDate(workout.scheduledAt),
      type: workout.type,
      distanceKm: workout.distanceKm,
      durationMinutes: workout.durationMinutes,
      status: workout.status,
      actualDistanceKm:
        workout.status === "completed" ? actualDistance(workout) : null,
      selectable: true,
    }));
}
