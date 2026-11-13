import { useQuery } from "@tanstack/react-query";

import { getProgressSummary } from "../../../lib/progress-api";
import { queryKeys } from "../../../shared/lib/query-keys";
import { getDeviceTimezone } from "../../plans/lib/plan-dates";
import { toSnapshot } from "../data/progress-mapper";

/** Progress history from the API; days and months are local to the device timezone. */
export function useProgressSnapshot() {
  return useQuery({
    queryKey: queryKeys.progress.summary(),
    queryFn: async () =>
      toSnapshot(await getProgressSummary(getDeviceTimezone())),
    staleTime: 1000 * 60 * 5,
  });
}
