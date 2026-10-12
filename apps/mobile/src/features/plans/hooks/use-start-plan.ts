import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CancelPlanResponse,
  type PlanDetails,
  type StartPlanInput,
} from "@trefix/api-client";

import {
  cancelPlan,
  getStartOptions,
  startPlan,
} from "../../../lib/training-api";
import { getDeviceTimezone } from "../lib/plan-dates";
import { invalidatePlanQueries, planKeys } from "./plan-query-keys";

/** Start dates of a draft; never cached, the answer depends on today and on the plan in progress. */
export function useStartOptions(
  planId: string | null | undefined,
  goalTargetDate?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: planKeys.startOptions(planId ?? "", goalTargetDate),
    queryFn: () =>
      getStartOptions(planId as string, getDeviceTimezone(), goalTargetDate),
    enabled: Boolean(planId) && enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useStartPlan() {
  const queryClient = useQueryClient();
  return useMutation<PlanDetails, Error, { planId: string } & StartPlanInput>({
    mutationFn: ({ planId, ...dto }) => startPlan(planId, dto),
    onSuccess: () => invalidatePlanQueries(queryClient, "lifecycle"),
  });
}

export function useCancelPlan() {
  const queryClient = useQueryClient();
  return useMutation<CancelPlanResponse, Error, { planId: string }>({
    mutationFn: ({ planId }) => cancelPlan(planId, getDeviceTimezone()),
    onSuccess: () => invalidatePlanQueries(queryClient, "lifecycle"),
  });
}
