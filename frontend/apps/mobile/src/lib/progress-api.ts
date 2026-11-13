import {
  progressMetricSchema,
  progressOverviewSchema,
  progressRecordsSchema,
  progressSummarySchema,
  raceResultInputSchema,
  recordHistorySchema,
  type ProgressMetricDetail,
  type ProgressOverview,
  type ProgressPeriodKey,
  type ProgressRecord,
  type ProgressSummary,
  type RaceResultInput,
  type RecordDistance,
  type RecordHistory,
} from "@trefix/api-client";
import { request } from "./api-client";

export async function getProgressOverview(
  period: ProgressPeriodKey,
): Promise<ProgressOverview> {
  const response = await request<unknown>(
    `/progress/overview?period=${period}`,
    { useAuth: true },
  );
  return progressOverviewSchema.parse(response);
}

/** History on facts for the Progress tab; days and months are local to `timezone`. */
export async function getProgressSummary(
  timezone?: string,
): Promise<ProgressSummary> {
  const query = timezone ? `?timezone=${encodeURIComponent(timezone)}` : "";
  const response = await request<unknown>(`/progress/summary${query}`, {
    useAuth: true,
  });
  return progressSummarySchema.parse(response);
}

export async function getProgressMetric(
  metric: ProgressMetricDetail["metric"],
  period: ProgressPeriodKey,
): Promise<ProgressMetricDetail> {
  const response = await request<unknown>(
    `/progress/metrics/${metric}?period=${period}`,
    { useAuth: true },
  );
  return progressMetricSchema.parse(response);
}

export async function getRecords(): Promise<ProgressRecord[]> {
  const response = await request<unknown>("/progress/records", {
    useAuth: true,
  });
  return progressRecordsSchema.parse(response).items;
}

export async function getRecordHistory(
  distance: RecordDistance,
): Promise<RecordHistory> {
  const response = await request<unknown>(`/progress/records/${distance}`, {
    useAuth: true,
  });
  return recordHistorySchema.parse(response);
}

export async function addResult(input: RaceResultInput): Promise<void> {
  await request<unknown>("/progress/results", {
    method: "POST",
    body: raceResultInputSchema.parse(input),
    useAuth: true,
  });
}

export async function deleteResult(resultId: string): Promise<void> {
  await request<void>(`/progress/results/${resultId}`, {
    method: "DELETE",
    useAuth: true,
  });
}

export async function setWorkoutRecordsExcluded(
  workoutId: string,
  excluded: boolean,
): Promise<void> {
  await request<unknown>(`/workouts/${workoutId}/records`, {
    method: "PATCH",
    body: { excluded },
    useAuth: true,
  });
}
