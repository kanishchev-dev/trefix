import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type PlanListGroup } from "@workspace/api-client";

import { getPlanCounts, listPlans } from "../../../lib/training-api";
import { planKeys } from "./plan-query-keys";

const PAGE_SIZE = 20;

/** Paginated plans of one group (drafts, the plan in progress or history). */
export function usePlansList(group: PlanListGroup, enabled = true) {
  return useInfiniteQuery({
    queryKey: planKeys.list(group),
    queryFn: ({ pageParam }) => listPlans(group, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    enabled,
  });
}

export function usePlanCounts() {
  return useQuery({
    queryKey: planKeys.counts(),
    queryFn: getPlanCounts,
  });
}
