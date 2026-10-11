import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlanOverview } from "../../../lib/training-api";
import { ApiClientError } from "@workspace/api-client";
import { queryKeys } from "../../../shared/lib/query-keys";

export type PlanDisplayState =
  | "active"
  | "not_started"
  | "completed"
  | "empty"
  | "loading"
  | "error";

export function usePlanOverview() {
  const { data, isLoading, error, isError, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.plan.overview(),
    queryFn: () => getPlanOverview("current"),
    retry: (failureCount, err) => {
      if (err instanceof ApiClientError && err.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const getDisplayState = (): PlanDisplayState => {
    if (isLoading) return "loading";

    if (isError) {
      if (error instanceof ApiClientError && error.status === 404) {
        return "empty";
      }
      return "error";
    }

    if (!data) return "empty";

    const status = data.plan.status;
    if (status === "active") return "active";
    if (status === "not_started") return "not_started";
    if (status === "completed") return "completed";
    // A cancelled plan is history; the tab shows the empty state with its variants.
    if (status === "cancelled") return "empty";

    return "active";
  };

  const displayState = getDisplayState();

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    displayState,
    data: data || null,
    isRefreshing: isRefetching,
    refresh,
  };
}
