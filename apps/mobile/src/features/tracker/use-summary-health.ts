import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { HeartRateSummary } from "../health-sync/types";
import { healthExportTarget, loadHealthExportEnabled, saveHealthExportEnabled } from "./health-export";

/** A watch or an app often syncs heart rate a little after the run: ask again for a few minutes. */
const HEART_RATE_RETRY_MS = 15_000;
const HEART_RATE_ATTEMPTS = 12;

/** The health store around the finish screen: heart rate worn during the run and the "save to Health" choice. */
export function useSummaryHealth(startedAt: number | null, endedAt: number | null) {
  const target = useQuery({ queryKey: ["tracker", "health-target"], queryFn: healthExportTarget, staleTime: 60_000 });
  const source = target.data ?? null;

  const heartRate = useQuery<HeartRateSummary | null>({
    queryKey: ["tracker", "heart-rate", startedAt, endedAt],
    queryFn: () => source!.readHeartRate!(new Date(startedAt!), new Date(endedAt!)),
    enabled: Boolean(source?.readHeartRate && startedAt && endedAt),
    retry: false,
    refetchInterval: (query) =>
      query.state.data || query.state.dataUpdateCount >= HEART_RATE_ATTEMPTS ? false : HEART_RATE_RETRY_MS,
  });

  const [exportEnabled, setExportEnabled] = useState(true);
  useEffect(() => {
    void loadHealthExportEnabled().then(setExportEnabled);
  }, []);

  return {
    source,
    heartRate: heartRate.data ?? null,
    exportEnabled,
    setExportEnabled: (enabled: boolean) => {
      setExportEnabled(enabled);
      void saveHealthExportEnabled(enabled);
    },
  };
}
