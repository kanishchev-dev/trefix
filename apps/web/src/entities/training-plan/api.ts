import {
  cancelPlanResponseSchema,
  createManualPlanSchema,
  currentMetricsSchema,
  manualPlanPreviewSchema,
  planChangePreviewSchema,
  planChangeRequestSchema,
  planCountsSchema,
  planDetailsSchema,
  planListResponseSchema,
  planMetaResponseSchema,
  planStartOptionsSchema,
  planVersionResponseSchema,
  previewManualPlanSchema,
  rebuildPrefillSchema,
  rebuildPreviewRequestSchema,
  rebuildPreviewSchema,
  rebuildRequestSchema,
  startPlanSchema,
  updatePlanMetaSchema,
  updatePlanStructureSchema,
  type CancelPlanResponse,
  type CreateManualPlanInput,
  type CurrentMetrics,
  type ManualPlanPreview,
  type PlanChangePreview,
  type PlanChangeRequest,
  type PlanCounts,
  type PlanDetails,
  type PlanListGroup,
  type PlanListResponse,
  type PlanMetaResponse,
  type PlanStartOptions,
  type PreviewManualPlanInput,
  type RebuildInput,
  type RebuildPrefill,
  type RebuildPreview,
  type RebuildPreviewInput,
  type StartPlanInput,
  type UpdatePlanMetaInput,
  type UpdatePlanStructureInput,
} from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

const base = (userId: string) => `/api/admin/users/${userId}/training`;

export const trainingPlanPaths = {
  list: (userId: string) => `${base(userId)}/plans`,
  counts: (userId: string) => `${base(userId)}/plans/counts`,
  currentMetrics: (userId: string) => `${base(userId)}/current-metrics`,
  manualPreview: (userId: string) => `${base(userId)}/plans/manual/preview`,
  manual: (userId: string) => `${base(userId)}/plans/manual`,
  plan: (userId: string, planId: string) => `${base(userId)}/plans/${planId}`,
  structure: (userId: string, planId: string) =>
    `${base(userId)}/plans/${planId}/structure`,
  startOptions: (userId: string, planId: string) =>
    `${base(userId)}/plans/${planId}/start-options`,
  start: (userId: string, planId: string) =>
    `${base(userId)}/plans/${planId}/start`,
  cancel: (userId: string, planId: string) =>
    `${base(userId)}/plans/${planId}/cancel`,
  changesPreview: (userId: string, planId: string) =>
    `${base(userId)}/plans/${planId}/changes/preview`,
  changes: (userId: string, planId: string) =>
    `${base(userId)}/plans/${planId}/changes`,
  rebuildPrefill: (userId: string, planId: string) =>
    `${base(userId)}/plans/${planId}/rebuild/prefill`,
  rebuildPreview: (userId: string, planId: string) =>
    `${base(userId)}/plans/${planId}/rebuild/preview`,
  rebuild: (userId: string, planId: string) =>
    `${base(userId)}/plans/${planId}/rebuild`,
} as const;

// ------------------------------------------------------------------ reads

export async function fetchPlanCounts(userId: string): Promise<PlanCounts> {
  return planCountsSchema.parse(
    await apiRequest<unknown>(trainingPlanPaths.counts(userId)),
  );
}

export async function fetchPlans(
  userId: string,
  query: { group: PlanListGroup; page: number; limit: number },
): Promise<PlanListResponse> {
  const response = await apiRequest<unknown>(trainingPlanPaths.list(userId), {
    searchParams: query,
  });
  return planListResponseSchema.parse(response);
}

export async function fetchPlan(
  userId: string,
  planId: string,
): Promise<PlanDetails> {
  return planDetailsSchema.parse(
    await apiRequest<unknown>(trainingPlanPaths.plan(userId, planId)),
  );
}

export async function fetchCurrentMetrics(
  userId: string,
): Promise<CurrentMetrics> {
  return currentMetricsSchema.parse(
    await apiRequest<unknown>(trainingPlanPaths.currentMetrics(userId)),
  );
}

export async function fetchStartOptions(
  userId: string,
  planId: string,
  query: { timezone: string; goalTargetDate?: string },
): Promise<PlanStartOptions> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.startOptions(userId, planId),
    {
      searchParams: query,
    },
  );
  return planStartOptionsSchema.parse(response);
}

export async function fetchRebuildPrefill(
  userId: string,
  planId: string,
  timezone: string,
): Promise<RebuildPrefill> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.rebuildPrefill(userId, planId),
    {
      searchParams: { timezone },
    },
  );
  return rebuildPrefillSchema.parse(response);
}

// ------------------------------------------------------------------ previews (POST, nothing persisted)

export async function previewManualPlan(
  userId: string,
  input: PreviewManualPlanInput,
): Promise<ManualPlanPreview> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.manualPreview(userId),
    {
      method: "POST",
      body: previewManualPlanSchema.parse(input),
    },
  );
  return manualPlanPreviewSchema.parse(response);
}

export async function previewPlanChanges(
  userId: string,
  planId: string,
  input: PlanChangeRequest,
): Promise<PlanChangePreview> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.changesPreview(userId, planId),
    {
      method: "POST",
      body: planChangeRequestSchema.parse(input),
    },
  );
  return planChangePreviewSchema.parse(response);
}

export async function previewRebuild(
  userId: string,
  planId: string,
  input: RebuildPreviewInput,
): Promise<RebuildPreview> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.rebuildPreview(userId, planId),
    {
      method: "POST",
      body: rebuildPreviewRequestSchema.parse(input),
    },
  );
  return rebuildPreviewSchema.parse(response);
}

// ------------------------------------------------------------------ mutations

export async function createManualPlan(
  userId: string,
  input: CreateManualPlanInput,
): Promise<PlanDetails> {
  const response = await apiRequest<unknown>(trainingPlanPaths.manual(userId), {
    method: "POST",
    body: createManualPlanSchema.parse(input),
  });
  return planDetailsSchema.parse(response);
}

export async function updatePlanMeta(
  userId: string,
  planId: string,
  input: UpdatePlanMetaInput,
): Promise<PlanMetaResponse> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.plan(userId, planId),
    {
      method: "PATCH",
      body: updatePlanMetaSchema.parse(input),
    },
  );
  return planMetaResponseSchema.parse(response);
}

export async function updatePlanStructure(
  userId: string,
  planId: string,
  input: UpdatePlanStructureInput,
): Promise<number> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.structure(userId, planId),
    {
      method: "PUT",
      body: updatePlanStructureSchema.parse(input),
    },
  );
  return planVersionResponseSchema.parse(response).version;
}

export async function deletePlan(
  userId: string,
  planId: string,
): Promise<void> {
  await apiRequest<void>(trainingPlanPaths.plan(userId, planId), {
    method: "DELETE",
  });
}

export async function startPlan(
  userId: string,
  planId: string,
  input: StartPlanInput,
): Promise<PlanDetails> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.start(userId, planId),
    {
      method: "POST",
      body: startPlanSchema.parse(input),
    },
  );
  return planDetailsSchema.parse(response);
}

export async function cancelPlan(
  userId: string,
  planId: string,
  timezone: string,
): Promise<CancelPlanResponse> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.cancel(userId, planId),
    {
      method: "POST",
      body: { timezone },
    },
  );
  return cancelPlanResponseSchema.parse(response);
}

export async function applyPlanChanges(
  userId: string,
  planId: string,
  input: PlanChangeRequest,
): Promise<PlanDetails> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.changes(userId, planId),
    {
      method: "POST",
      body: planChangeRequestSchema.parse(input),
    },
  );
  return planDetailsSchema.parse(response);
}

export async function rebuildPlan(
  userId: string,
  planId: string,
  input: RebuildInput,
): Promise<PlanDetails> {
  const response = await apiRequest<unknown>(
    trainingPlanPaths.rebuild(userId, planId),
    {
      method: "POST",
      body: rebuildRequestSchema.parse(input),
    },
  );
  return planDetailsSchema.parse(response);
}
