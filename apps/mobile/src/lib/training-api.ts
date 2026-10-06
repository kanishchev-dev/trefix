import {
  activePlanResponseSchema,
  cancelPlanResponseSchema,
  currentMetricsSchema,
  manualPlanPreviewSchema,
  planChangePreviewSchema,
  planCountsSchema,
  planDetailsSchema,
  planListResponseSchema,
  planMetaResponseSchema,
  planOverviewSchema,
  planStartOptionsSchema,
  planVersionResponseSchema,
  rebuildPrefillSchema,
  rebuildPreviewSchema,
  trainingAthleteSchema,
  trainingPlanSchema,
  trainingStateSchema,
  trainingWorkoutSchema,
  z,
  type ActivePlanResponse,
  type CancelPlanResponse,
  type CompleteWorkoutInput,
  type CreateManualPlanInput,
  type CreateWorkoutInput,
  type CurrentMetrics,
  type ManualPlanPreview,
  type PlanChangePreview,
  type PlanChangeRequest,
  type PlanCounts,
  type PlanDetails,
  type PlanListGroup,
  type PlanListResponse,
  type PlanMetaResponse,
  type PlanOverview,
  type PlanStartOptions,
  type PreviewManualPlanInput,
  type RebuildInput,
  type RebuildPrefill,
  type RebuildPreview,
  type RebuildPreviewInput,
  type StartPlanInput,
  type TrainingAthlete,
  type TrainingPlan,
  type TrainingState,
  type TrainingWorkout,
  type UpdatePlanMetaInput,
  type UpdatePlanStructureInput,
} from "@workspace/api-client";
import { request } from "./api-client";

export async function getAthlete(athleteId: string): Promise<TrainingAthlete> {
  const response = await request<unknown>(`/athletes/${athleteId}`, {
    useAuth: true,
  });
  return trainingAthleteSchema.parse(response);
}

export async function getMyAthlete(): Promise<TrainingAthlete | null> {
  try {
    const response = await request<unknown>("/athletes/me", {
      useAuth: true,
    });
    return trainingAthleteSchema.parse(response);
  } catch (error) {
    return null;
  }
}

export async function getAthleteState(
  athleteId: string,
): Promise<TrainingState> {
  const response = await request<unknown>(`/athletes/${athleteId}/state`, {
    useAuth: true,
  });
  return trainingStateSchema.parse(response);
}

export async function getPlanOverview(planId = "current"): Promise<PlanOverview> {
  const response = await request<unknown>(`/plans/${planId}/overview`, {
    useAuth: true,
  });
  return planOverviewSchema.parse(response);
}

export async function getWorkouts(
  from?: string,
  to?: string,
): Promise<TrainingWorkout[]> {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);

  const queryString = params.toString();
  const url = queryString ? `/workouts?${queryString}` : "/workouts";

  const response = await request<unknown>(url, {
    useAuth: true,
  });

  return z.array(trainingWorkoutSchema).parse(response);
}

export async function createWorkout(
  dto: CreateWorkoutInput,
): Promise<TrainingWorkout> {
  const response = await request<unknown>("/workouts", {
    method: "POST",
    body: dto,
    useAuth: true,
  });

  return trainingWorkoutSchema.parse(response);
}

export async function completeWorkout(
  workoutId: string,
  dto: CompleteWorkoutInput,
): Promise<{ workout: TrainingWorkout }> {
  const response = await request<{ workout: unknown }>(
    `/workouts/${workoutId}/complete`,
    {
      method: "POST",
      body: dto,
      useAuth: true,
    },
  );

  return {
    workout: trainingWorkoutSchema.parse(response.workout),
  };
}

/** Builds a non-persisted manual plan preview via the Training Engine. */
export async function previewManualPlan(
  dto: PreviewManualPlanInput,
): Promise<ManualPlanPreview> {
  const response = await request<unknown>("/plans/manual/preview", {
    method: "POST",
    body: dto,
    useAuth: true,
  });

  return manualPlanPreviewSchema.parse(response);
}

/** Creates a manual plan: saved as a draft, started, or both in one request. */
export async function createManualPlan(
  dto: CreateManualPlanInput,
): Promise<TrainingPlan> {
  const response = await request<unknown>("/plans/manual", {
    method: "POST",
    body: dto,
    useAuth: true,
  });

  return trainingPlanSchema.parse(response);
}

export async function getWorkout(workoutId: string): Promise<TrainingWorkout> {
  const response = await request<unknown>(`/workouts/${workoutId}`, { useAuth: true });
  return trainingWorkoutSchema.parse(response);
}

/** Current athlete metrics with per-field provenance (Strava, manual workouts, profile). */
export async function getCurrentMetrics(): Promise<CurrentMetrics> {
  const response = await request<unknown>("/athletes/me/current-metrics", { useAuth: true });
  return currentMetricsSchema.parse(response);
}

// --- Plans library ---

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.append(key, String(value));
  }
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export async function listPlans(group: PlanListGroup, page = 1, limit = 20): Promise<PlanListResponse> {
  const response = await request<unknown>(withQuery("/plans", { group, page, limit }), { useAuth: true });
  return planListResponseSchema.parse(response);
}

export async function getPlanCounts(): Promise<PlanCounts> {
  const response = await request<unknown>("/plans/counts", { useAuth: true });
  return planCountsSchema.parse(response);
}

export async function getActivePlan(timezone?: string): Promise<ActivePlanResponse> {
  const response = await request<unknown>(withQuery("/plans/active", { timezone }), { useAuth: true });
  return activePlanResponseSchema.parse(response);
}

export async function getPlan(planId: string): Promise<PlanDetails> {
  const response = await request<unknown>(`/plans/${planId}`, { useAuth: true });
  return planDetailsSchema.parse(response);
}

export async function patchPlan(planId: string, dto: UpdatePlanMetaInput): Promise<PlanMetaResponse> {
  const response = await request<unknown>(`/plans/${planId}`, { method: "PATCH", body: dto, useAuth: true });
  return planMetaResponseSchema.parse(response);
}

export async function deletePlan(planId: string): Promise<void> {
  await request<void>(`/plans/${planId}`, { method: "DELETE", useAuth: true });
}

export async function updateDraftStructure(
  planId: string,
  dto: UpdatePlanStructureInput,
): Promise<{ version: number }> {
  const response = await request<unknown>(`/plans/${planId}/structure`, {
    method: "PUT",
    body: dto,
    useAuth: true,
  });
  return planVersionResponseSchema.parse(response);
}

export async function getStartOptions(
  planId: string,
  timezone?: string,
  goalTargetDate?: string,
): Promise<PlanStartOptions> {
  const response = await request<unknown>(
    withQuery(`/plans/${planId}/start-options`, { timezone, goalTargetDate }),
    { useAuth: true },
  );
  return planStartOptionsSchema.parse(response);
}

export async function startPlan(planId: string, dto: StartPlanInput): Promise<PlanDetails> {
  const response = await request<unknown>(`/plans/${planId}/start`, { method: "POST", body: dto, useAuth: true });
  return planDetailsSchema.parse(response);
}

export async function cancelPlan(planId: string, timezone?: string): Promise<CancelPlanResponse> {
  const response = await request<unknown>(`/plans/${planId}/cancel`, {
    method: "POST",
    body: { timezone },
    useAuth: true,
  });
  return cancelPlanResponseSchema.parse(response);
}

export async function previewPlanChange(planId: string, dto: PlanChangeRequest): Promise<PlanChangePreview> {
  const response = await request<unknown>(`/plans/${planId}/changes/preview`, {
    method: "POST",
    body: dto,
    useAuth: true,
  });
  return planChangePreviewSchema.parse(response);
}

export async function applyPlanChange(planId: string, dto: PlanChangeRequest): Promise<PlanDetails> {
  const response = await request<unknown>(`/plans/${planId}/changes`, { method: "POST", body: dto, useAuth: true });
  return planDetailsSchema.parse(response);
}

export async function getRebuildPrefill(planId: string, timezone?: string): Promise<RebuildPrefill> {
  const response = await request<unknown>(withQuery(`/plans/${planId}/rebuild/prefill`, { timezone }), {
    useAuth: true,
  });
  return rebuildPrefillSchema.parse(response);
}

export async function previewRebuild(planId: string, dto: RebuildPreviewInput): Promise<RebuildPreview> {
  const response = await request<unknown>(`/plans/${planId}/rebuild/preview`, {
    method: "POST",
    body: dto,
    useAuth: true,
  });
  return rebuildPreviewSchema.parse(response);
}

export async function rebuildPlan(planId: string, dto: RebuildInput): Promise<PlanDetails> {
  const response = await request<unknown>(`/plans/${planId}/rebuild`, { method: "POST", body: dto, useAuth: true });
  return planDetailsSchema.parse(response);
}
