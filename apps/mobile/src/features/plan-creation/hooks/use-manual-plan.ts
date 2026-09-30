import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import {
  createManualPlan,
  previewManualPlan,
} from "../../../lib/training-api";
import type {
  CreateManualPlanInput,
  ManualPlanPreview,
  PreviewManualPlanInput,
} from "@workspace/api-client";

type PreviewVariables = PreviewManualPlanInput;
type CreateVariables = CreateManualPlanInput;

/**
 * Builds a non-persisted preview of the manual plan.
 * Server-side validation is authoritative (PRD section 24).
 */
export function useManualPlanPreview() {
  return useMutation<ManualPlanPreview, Error, PreviewVariables>({
    mutationFn: (input) => previewManualPlan(input),
  });
}

/** Creates the final training plan and refreshes plan cache. */
export function useCreateManualPlan(onCreated?: () => void) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, CreateVariables>({
    mutationFn: (input) => createManualPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan"] });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      onCreated?.();
    },
  });
}
