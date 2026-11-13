import { useQueryClient } from "@tanstack/react-query";

import { useRealtimeEvent } from "../../../lib/realtime";
import { invalidatePlanQueries } from "./plan-query-keys";

type PlansChangedEvent = {
  reason?: string;
  planId?: string;
};

/**
 * Keeps plan caches in sync with changes made elsewhere (another device,
 * adaptations, the coach). Open start/diff sheets refetch through the same
 * invalidation because their queries live under the `plans` key.
 */
export function usePlansRealtime(): void {
  const queryClient = useQueryClient();

  useRealtimeEvent<PlansChangedEvent>("training.plans.changed", (event) => {
    const planId = event?.planId;
    switch (event?.reason) {
      case "created":
      case "deleted":
        invalidatePlanQueries(queryClient, "library");
        return;
      case "meta":
        invalidatePlanQueries(queryClient, "meta");
        return;
      case "structure":
      case "rebuild":
        invalidatePlanQueries(queryClient, "library");
        if (planId)
          invalidatePlanQueries(queryClient, "draftStructure", planId);
        return;
      case "workouts":
      case "schedule":
      case "goal_date":
        invalidatePlanQueries(queryClient, "activeChange", planId);
        invalidatePlanQueries(queryClient, "library");
        return;
      default:
        // started, cancelled, completed and unknown reasons touch everything.
        invalidatePlanQueries(queryClient, "lifecycle");
    }
  });
}
