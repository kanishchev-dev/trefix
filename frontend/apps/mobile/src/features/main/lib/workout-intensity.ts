/** 1 — easy, 2 — steady hard work, 3 — the hardest sessions. */
export type WorkoutIntensity = 1 | 2 | 3;

/** Workout type → step on the intensity scale shown on cards and the workout screen. */
export function workoutIntensity(type: string): WorkoutIntensity {
  switch (type) {
    case "long_run":
    case "tempo":
    case "threshold":
      return 2;
    case "interval":
    case "hill":
    case "race":
      return 3;
    default:
      return 1;
  }
}
