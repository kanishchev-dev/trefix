import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateWorkoutInput,
  type CompleteWorkoutInput,
} from "@workspace/api-client";
import { getWorkoutSources } from "../../../lib/integrations-api";
import {
  getWorkouts,
  createWorkout,
  completeWorkout,
  getWorkoutExecution,
  getWorkoutRecording,
} from "../../../lib/training-api";
import { queryKeys } from "../../../shared/lib/query-keys";

export function useWorkouts(from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.workouts.range({ from, to }),
    queryFn: () => getWorkouts(from, to),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateWorkoutInput) => createWorkout(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.plan.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
  });
}

export function useCompleteWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workoutId,
      dto,
    }: {
      workoutId: string;
      dto: CompleteWorkoutInput;
    }) => completeWorkout(workoutId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.plan.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
  });
}

/** Where a workout came from (Strava, Health, the tracker). */
export function useWorkoutSources(workoutId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workouts.sources(workoutId),
    queryFn: () => getWorkoutSources(workoutId),
    staleTime: 60_000,
    enabled,
  });
}

/** GPS track of a workout recorded by the tracker. */
export function useWorkoutRecording(workoutId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workouts.recording(workoutId),
    queryFn: () => getWorkoutRecording(workoutId),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Execution plan (steps and targets) for running a planned workout. */
export function useWorkoutExecution(
  workoutId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.workouts.execution(workoutId ?? ""),
    queryFn: () => getWorkoutExecution(workoutId!),
    enabled: Boolean(workoutId) && enabled,
    retry: false,
    staleTime: 60_000,
  });
}
