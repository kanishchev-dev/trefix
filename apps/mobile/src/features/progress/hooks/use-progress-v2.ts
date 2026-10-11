import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type ProgressMetricDetail,
  type ProgressPeriodKey,
  type RaceResultInput,
  type RecordDistance,
} from "@workspace/api-client";

import {
  addResult,
  deleteResult,
  getProgressMetric,
  getProgressOverview,
  getRecordHistory,
  getRecords,
  setWorkoutRecordsExcluded,
} from "../../../lib/progress-api";
import { useRealtimeEvent } from "../../../lib/realtime";
import { queryKeys } from "../../../shared/lib/query-keys";

export function useProgressOverview(period: ProgressPeriodKey) {
  return useQuery({
    queryKey: queryKeys.progress.overview(period),
    queryFn: () => getProgressOverview(period),
    staleTime: 1000 * 60 * 5,
  });
}

export function useProgressMetric(
  metric: ProgressMetricDetail["metric"],
  period: ProgressPeriodKey,
) {
  return useQuery({
    queryKey: queryKeys.progress.metric(metric, period),
    queryFn: () => getProgressMetric(metric, period),
    staleTime: 1000 * 60 * 5,
  });
}

export function useRecords() {
  return useQuery({
    queryKey: queryKeys.progress.records(),
    queryFn: getRecords,
    staleTime: 1000 * 60 * 5,
  });
}

export function useRecordHistory(distance: RecordDistance | null) {
  return useQuery({
    queryKey: queryKeys.progress.record(distance),
    queryFn: () => getRecordHistory(distance as RecordDistance),
    enabled: distance !== null,
  });
}

type ProgressAction =
  | { kind: "add"; input: RaceResultInput }
  | { kind: "delete"; resultId: string }
  | { kind: "exclude"; workoutId: string; excluded: boolean };

export function useProgressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: ProgressAction) => {
      if (action.kind === "add") return addResult(action.input);
      if (action.kind === "delete") return deleteResult(action.resultId);
      return setWorkoutRecordsExcluded(action.workoutId, action.excluded);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
  });
}

/** Computed progress changes after workouts, results, plan and profile updates. */
export function useProgressRealtime(): void {
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
  useRealtimeEvent("progress.updated", invalidate);
  useRealtimeEvent("training.plans.changed", invalidate);
  useRealtimeEvent("athlete.updated", invalidate);
}
