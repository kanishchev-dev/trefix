import {
  type ManualPlanPreview,
  type ManualPlanPreviewWorkout,
} from "@workspace/api-client";

export type PreviewWeek = ManualPlanPreview["weeks"][number];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export type PreviewWeekView = {
  /** Workouts of the week with the user's edits applied, in day order. */
  workouts: ManualPlanPreviewWorkout[];
  distanceKm: number;
  /** Day for a workout added to this week: a free training day, else any free day. */
  freeDay: number;
};

/** The week as the user sees it: server workouts after edits plus added ones. */
export function buildPreviewWeek(
  week: PreviewWeek,
  resolvedWorkouts: ReadonlyMap<string, ManualPlanPreviewWorkout>,
  additions: readonly ManualPlanPreviewWorkout[],
  trainingDays: readonly number[],
): PreviewWeekView {
  const kept = week.workouts
    .map((workout) => resolvedWorkouts.get(workout.id))
    .filter(
      (workout): workout is ManualPlanPreviewWorkout => workout !== undefined,
    );
  const workouts = [...kept, ...additions].sort(
    (left, right) => left.dayOfWeek - right.dayOfWeek,
  );
  const occupied = new Set(workouts.map((workout) => workout.dayOfWeek));
  const freeDay =
    trainingDays.find((day) => !occupied.has(day)) ??
    ALL_DAYS.find((day) => !occupied.has(day)) ??
    trainingDays[0] ??
    0;
  return {
    workouts,
    distanceKm: workouts.reduce((sum, workout) => sum + workout.distanceKm, 0),
    freeDay,
  };
}
