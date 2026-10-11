import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useRealtimeEvent } from "../../../lib/realtime";
import {
  listPendingAdaptations,
  resolveAdaptation,
} from "../../../lib/training-api";
import { queryKeys } from "../../../shared/lib/query-keys";

const PENDING_KEY = [...queryKeys.plans.active(), "adaptations"] as const;

/** Plan changes waiting for the user; refreshed when the coach proposes a new one. */
export function usePendingAdaptations() {
  const queryClient = useQueryClient();
  useRealtimeEvent("plan.adaptation.proposed", () => {
    void queryClient.invalidateQueries({ queryKey: PENDING_KEY });
  });
  return useQuery({ queryKey: PENDING_KEY, queryFn: listPendingAdaptations });
}

export function useResolveAdaptation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "apply" | "dismiss" }) =>
      resolveAdaptation(id, action),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.plan.all });
    },
  });
}
