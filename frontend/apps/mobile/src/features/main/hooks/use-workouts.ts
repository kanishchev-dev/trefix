import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateWorkoutInput,
  type CompleteWorkoutInput,
  type TrainingWorkout,
  type UpdateWorkoutInput,
} from "@trefix/api-client";
import { getWorkoutSources } from "../../../lib/integrations-api";
import {
  getWorkouts,
  createWorkout,
  completeWorkout,
  deleteWorkout,
  updateWorkout,
  getWorkoutExecution,
  getWorkoutRecording,
} from "../../../lib/training-api";
import { queryKeys } from "../../../shared/lib/query-keys";
import { workoutLocalDate } from "../../plans/lib/plan-dates";

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
    onSuccess: (created) => {
      // Show it right away in every loaded range that covers its day; the refetch
      // below then brings the server's view, but the screen must not wait for it.
      const day = workoutLocalDate(created.scheduledAt);
      for (const [key, current] of queryClient.getQueriesData<
        TrainingWorkout[]
      >({ queryKey: queryKeys.workouts.all })) {
        const range =
          typeof key[1] === "object" && key[1] !== null
            ? (key[1] as { from?: string; to?: string })
            : null;
        if (
          !Array.isArray(current) ||
          !range ||
          (range.from && day < range.from) ||
          (range.to && day > range.to) ||
          current.some((workout) => workout.id === created.id)
        ) {
          continue;
        }
        queryClient.setQueryData<TrainingWorkout[]>(key, [...current, created]);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.plan.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
  });
}

/** Change of a workout added by hand; the details screen gets the new version at once. */
export function useUpdateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workoutId,
      dto,
    }: {
      workoutId: string;
      dto: UpdateWorkoutInput;
    }) => updateWorkout(workoutId, dto),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.workouts.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.coach.all });
    },
  });
}

/** Removal of a planned workout added by hand. */
export function useDeleteWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workoutId: string) => deleteWorkout(workoutId),
    onSuccess: (_, workoutId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.workouts.detail(workoutId),
      });
      // Drop it from loaded day lists right away, the refetch confirms.
      for (const [key, current] of queryClient.getQueriesData<
        TrainingWorkout[]
      >({ queryKey: queryKeys.workouts.all })) {
        if (Array.isArray(current)) {
          queryClient.setQueryData<TrainingWorkout[]>(
            key,
            current.filter((workout) => workout.id !== workoutId),
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
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
