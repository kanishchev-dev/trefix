import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type PlanChangePreview,
  type PlanChangeRequest,
  type PlanDetails,
} from "@trefix/api-client";

import {
  applyPlanChange,
  getPlan,
  previewPlanChange,
} from "../../../lib/training-api";
import { getDeviceTimezone } from "../lib/plan-dates";
import { invalidatePlanQueries, planKeys } from "./plan-query-keys";

/** Change request without the fields this hook fills in (version, timezone). */
export type PlanChangeDraft =
  | {
      kind: "workouts";
      operations: Extract<
        PlanChangeRequest,
        { kind: "workouts" }
      >["operations"];
    }
  | Omit<
      Extract<PlanChangeRequest, { kind: "schedule" }>,
      "expectedVersion" | "timezone"
    >
  | Omit<
      Extract<PlanChangeRequest, { kind: "goal_date" }>,
      "expectedVersion" | "timezone"
    >;

/**
 * Preview → apply protocol for the plan in progress. The preview pins the
 * plan version; the apply sends the same request with that version, so a
 * concurrent change (adaptation, another device) surfaces as a conflict.
 */
export function usePlanChanges(planId: string | null | undefined) {
  const queryClient = useQueryClient();

  const loadVersion = async (forceFresh: boolean): Promise<number> => {
    const id = planId as string;
    const details = await queryClient.fetchQuery({
      queryKey: planKeys.detail(id),
      queryFn: () => getPlan(id),
      staleTime: forceFresh ? 0 : 30_000,
    });
    return details.version;
  };

  const toRequest = (
    draft: PlanChangeDraft,
    expectedVersion: number,
  ): PlanChangeRequest =>
    ({
      ...draft,
      expectedVersion,
      timezone: getDeviceTimezone(),
    }) as PlanChangeRequest;

  const preview = useMutation<
    { preview: PlanChangePreview; request: PlanChangeRequest },
    Error,
    { draft: PlanChangeDraft; forceFresh?: boolean }
  >({
    mutationFn: async ({ draft, forceFresh }) => {
      const version = await loadVersion(Boolean(forceFresh));
      const request = toRequest(draft, version);
      const result = await previewPlanChange(planId as string, request);
      return {
        preview: result,
        request: {
          ...request,
          expectedVersion: result.version,
        } as PlanChangeRequest,
      };
    },
  });

  const apply = useMutation<PlanDetails, Error, PlanChangeRequest>({
    mutationFn: (request) => applyPlanChange(planId as string, request),
    onSuccess: (details) => {
      queryClient.setQueryData(planKeys.detail(details.id), details);
      invalidatePlanQueries(queryClient, "activeChange", details.id);
    },
  });

  return { preview, apply };
}
