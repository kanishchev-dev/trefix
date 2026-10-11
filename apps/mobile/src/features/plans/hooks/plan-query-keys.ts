import { type QueryClient } from "@tanstack/react-query";
import { type PlanListGroup } from "@workspace/api-client";

export const planKeys = {
  all: ["plans"] as const,
  lists: () => ["plans", "list"] as const,
  list: (group: PlanListGroup) => ["plans", "list", group] as const,
  counts: () => ["plans", "counts"] as const,
  detail: (planId: string) => ["plans", "detail", planId] as const,
  active: () => ["plans", "active"] as const,
  startOptions: (planId: string, goalTargetDate?: string) =>
    goalTargetDate
      ? (["plans", "start-options", planId, goalTargetDate] as const)
      : (["plans", "start-options", planId] as const),
  rebuildPrefill: (planId: string) =>
    ["plans", "rebuild-prefill", planId] as const,
  currentMetrics: () => ["athlete", "current-metrics"] as const,
  overview: () => ["plan", "overview", "current"] as const,
};

/** Cache groups refreshed after each kind of plan mutation. */
export type PlanMutationKind =
  | "lifecycle"
  | "library"
  | "meta"
  | "draftStructure"
  | "activeChange";

export function invalidatePlanQueries(
  queryClient: QueryClient,
  kind: PlanMutationKind,
  planId?: string,
): void {
  const invalidate = (queryKey: readonly unknown[]) => {
    void queryClient.invalidateQueries({ queryKey });
  };

  switch (kind) {
    // start / cancel / create+start / rebuild+start
    case "lifecycle":
      invalidate(planKeys.all);
      invalidate(["plan"]);
      invalidate(["workouts"]);
      invalidate(["progress"]);
      return;
    // create draft / rebuild draft / delete
    case "library":
      invalidate(planKeys.all);
      return;
    case "meta":
      invalidate(planKeys.all);
      invalidate(["plan"]);
      return;
    case "draftStructure":
      if (planId) invalidate(planKeys.detail(planId));
      invalidate(planKeys.lists());
      return;
    case "activeChange":
      invalidate(["plan"]);
      if (planId) invalidate(planKeys.detail(planId));
      invalidate(["workouts"]);
      invalidate(["progress"]);
      return;
  }
}
