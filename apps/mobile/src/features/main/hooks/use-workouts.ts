import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type CreateWorkoutInput, type CompleteWorkoutInput } from "@workspace/api-client";
import { getWorkouts, createWorkout, completeWorkout } from "../../../lib/training-api";

export function useWorkouts(from?: string, to?: string) {
  return useQuery({
    queryKey: ["workouts", { from, to }],
    queryFn: () => getWorkouts(from, to),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateWorkoutInput) => createWorkout(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["plan-overview"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}

export function useCompleteWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workoutId, dto }: { workoutId: string; dto: CompleteWorkoutInput }) =>
      completeWorkout(workoutId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["plan-overview"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
