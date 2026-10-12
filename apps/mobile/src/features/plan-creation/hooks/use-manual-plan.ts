import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createManualPlan, previewManualPlan } from "../../../lib/training-api";
import type {
  CreateManualPlanInput,
  ManualPlanPreview,
  PreviewManualPlanInput,
  TrainingPlan,
} from "@trefix/api-client";
import { invalidatePlanQueries } from "../../plans/hooks/plan-query-keys";

/**
 * Builds a non-persisted preview of the manual plan.
 * Server-side validation is authoritative.
 */
export function useManualPlanPreview() {
  return useMutation<ManualPlanPreview, Error, PreviewManualPlanInput>({
    mutationFn: (input) => previewManualPlan(input),
  });
}

/** Creates a manual plan as a draft or started; refreshes the affected caches. */
export function useCreateManualPlan() {
  const queryClient = useQueryClient();

  return useMutation<TrainingPlan, Error, CreateManualPlanInput>({
    mutationFn: (input) => createManualPlan(input),
    onSuccess: (_plan, input) => {
      invalidatePlanQueries(
        queryClient,
        input.saveAsDraft ? "library" : "lifecycle",
      );
    },
  });
}
