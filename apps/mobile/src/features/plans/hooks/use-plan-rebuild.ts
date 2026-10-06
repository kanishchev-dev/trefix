import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type PlanDetails, type RebuildInput, type RebuildPreview, type RebuildPreviewInput } from "@workspace/api-client";

import { getCurrentMetrics, getRebuildPrefill, previewRebuild, rebuildPlan } from "../../../lib/training-api";
import { getDeviceTimezone } from "../lib/plan-dates";
import { invalidatePlanQueries, planKeys } from "./plan-query-keys";

/** Previous parameters, result and metrics of a plan the user prepares again from. */
export function useRebuildPrefill(planId: string | null | undefined) {
  return useQuery({
    queryKey: planKeys.rebuildPrefill(planId ?? ""),
    queryFn: () => getRebuildPrefill(planId as string, getDeviceTimezone()),
    enabled: Boolean(planId),
    staleTime: 0,
  });
}

/** Current form estimate for the optional metrics step of a new plan. */
export function useCurrentMetrics(enabled = true) {
  return useQuery({
    queryKey: planKeys.currentMetrics(),
    queryFn: getCurrentMetrics,
    enabled,
    staleTime: 60_000,
  });
}

export function useRebuildPreview() {
  return useMutation<RebuildPreview, Error, { planId: string } & RebuildPreviewInput>({
    mutationFn: ({ planId, ...dto }) => previewRebuild(planId, { ...dto, timezone: dto.timezone ?? getDeviceTimezone() }),
  });
}

export function useRebuildPlan() {
  const queryClient = useQueryClient();
  return useMutation<PlanDetails, Error, { planId: string } & RebuildInput>({
    mutationFn: ({ planId, ...dto }) => rebuildPlan(planId, { ...dto, timezone: dto.timezone ?? getDeviceTimezone() }),
    onSuccess: (details, { planId, start }) => {
      if (start) {
        invalidatePlanQueries(queryClient, "lifecycle");
      } else {
        invalidatePlanQueries(queryClient, "library");
        invalidatePlanQueries(queryClient, "draftStructure", planId);
      }
      queryClient.setQueryData(planKeys.detail(details.id), details);
    },
  });
}
