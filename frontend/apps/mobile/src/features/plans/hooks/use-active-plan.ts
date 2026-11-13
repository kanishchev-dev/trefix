import { useQuery } from "@tanstack/react-query";

import { getActivePlan } from "../../../lib/training-api";
import { getDeviceTimezone } from "../lib/plan-dates";
import { planKeys } from "./plan-query-keys";

/** Summary of the plan in progress; always fresh where a start decision depends on it. */
export function useActivePlan(
  options: { enabled?: boolean; fresh?: boolean } = {},
) {
  return useQuery({
    queryKey: planKeys.active(),
    queryFn: () => getActivePlan(getDeviceTimezone()),
    enabled: options.enabled ?? true,
    staleTime: options.fresh ? 0 : undefined,
    refetchOnMount: options.fresh ? "always" : undefined,
  });
}
