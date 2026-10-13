import type {
  PlanDetails,
  PlanDetailsWeek,
  PlanWorkoutItem,
  RelativeWorkout,
} from "@trefix/api-client";

/** Workout of a draft: addressed by key, placed on a weekday. */
export type DraftWorkoutView = RelativeWorkout & { kind: "relative" };

/** Workout of a started plan: addressed by id, placed on a date. */
export type DatedWorkoutView = PlanWorkoutItem & { kind: "dated" };

export type PlanWeekView = {
  weekNumber: number;
  phase: string;
  workouts: Array<DraftWorkoutView | DatedWorkoutView>;
  distanceKm: number;
};

const sumDistance = (workouts: Array<{ distanceKm: number }>): number =>
  Math.round(
    workouts.reduce((total, workout) => total + workout.distanceKm, 0) * 10,
  ) / 10;

/**
 * Weeks of a plan in display order. Drafts keep relative workouts inside the
 * week records; started plans list dated workouts separately, grouped here by
 * week number. Weeks without a record (e.g. after a resize) are still shown
 * when they hold workouts.
 */
export function buildPlanWeeks(plan: PlanDetails): PlanWeekView[] {
  if (plan.status === "draft") {
    return plan.weeks.map((week) => {
      const workouts = [...(week.workouts ?? [])]
        .sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek || a.orderInWeek - b.orderInWeek,
        )
        .map((workout) => ({ ...workout, kind: "relative" as const }));
      return { ...weekMeta(week), workouts, distanceKm: sumDistance(workouts) };
    });
  }

  const byWeek = new Map<number, DatedWorkoutView[]>();
  for (const workout of plan.workouts) {
    const list = byWeek.get(workout.weekNumber) ?? [];
    list.push({ ...workout, kind: "dated" });
    byWeek.set(workout.weekNumber, list);
  }

  const records = new Map(plan.weeks.map((week) => [week.weekNumber, week]));
  const weekNumbers = Array.from(
    new Set([...records.keys(), ...byWeek.keys()]),
  ).sort((a, b) => a - b);

  return weekNumbers.map((weekNumber) => {
    const workouts = (byWeek.get(weekNumber) ?? []).sort(
      (a, b) =>
        a.scheduledAt.localeCompare(b.scheduledAt) ||
        a.orderInWeek - b.orderInWeek,
    );
    const record = records.get(weekNumber);
    return {
      ...(record ? weekMeta(record) : { weekNumber, phase: "" }),
      workouts,
      distanceKm: sumDistance(workouts),
    };
  });
}

function weekMeta(
  week: PlanDetailsWeek,
): Pick<PlanWeekView, "weekNumber" | "phase"> {
  return {
    weekNumber: week.weekNumber,
    phase: week.phase,
  };
}

/** Plan workouts are stored at UTC midnight of their day: the date part is the calendar day. */
export function workoutDateKey(
  workout: Pick<PlanWorkoutItem, "scheduledAt">,
): string {
  return workout.scheduledAt.slice(0, 10);
}

/** A dated workout can be changed only while it is planned and not in the past. */
export function isDatedWorkoutEditable(
  workout: PlanWorkoutItem,
  todayKey: string,
): boolean {
  return (
    workout.status === "planned" &&
    workout.actual === null &&
    workoutDateKey(workout) >= todayKey
  );
}
