/**
 * `target` of a workout is a free-form object from the training engine; these
 * read its optional text fields without `any`.
 */
export function workoutTargetText(
  target: unknown,
  key: "title" | "description",
): string | undefined {
  if (!target || typeof target !== "object") {
    return undefined;
  }
  const value = (target as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export type OwnWorkoutGoal = {
  goal: "none" | "duration" | "distance";
  /** Distance goal: finish within this many minutes. */
  timeLimitMin: number | null;
};

/** Goal of a workout the athlete added by hand; null for plan workouts and older ones. */
export function workoutGoal(target: unknown): OwnWorkoutGoal | null {
  if (!target || typeof target !== "object") return null;
  const record = target as Record<string, unknown>;
  const goal = record.goal;
  if (goal !== "none" && goal !== "duration" && goal !== "distance")
    return null;
  const limit = record.timeLimitMin;
  return {
    goal,
    timeLimitMin: typeof limit === "number" && limit > 0 ? limit : null,
  };
}
