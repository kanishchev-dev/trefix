import { useQuery } from "@tanstack/react-query";

import { getWorkout } from "../../../lib/training-api";

/** A single workout, for sheets opened from a plan. */
export function useWorkout(workoutId: string | null | undefined) {
  return useQuery({
    queryKey: ["workouts", "detail", workoutId ?? ""],
    queryFn: () => getWorkout(workoutId as string),
    enabled: Boolean(workoutId),
  });
}
