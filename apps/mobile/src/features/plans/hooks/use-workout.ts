import { useQuery } from "@tanstack/react-query";

import { getWorkout } from "../../../lib/training-api";
import { queryKeys } from "../../../shared/lib/query-keys";

/** A single workout, for sheets opened from a plan. */
export function useWorkout(workoutId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.workouts.detail(workoutId ?? ""),
    queryFn: () => getWorkout(workoutId as string),
    enabled: Boolean(workoutId),
  });
}
