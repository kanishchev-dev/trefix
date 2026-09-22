import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProgress } from "../../../lib/progress-api";
import type {
  ProgressCapability,
  ProgressDisplayState,
  ProgressMilestone,
  ProgressPeriod,
  ProgressSnapshot,
} from "../types/progress-types";

export function useProgress() {
  const [period, setPeriod] = useState<ProgressPeriod>("6M");
  const [overrideState, setOverrideState] =
    useState<ProgressDisplayState | null>(null);

  const query = useQuery<ProgressSnapshot>({
    queryKey: ["progress", period],
    queryFn: () => fetchProgress(period),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    retry: 1,
  });

  // Calculate actual display state from Query or manual testing override
  const displayState: ProgressDisplayState = useMemo(() => {
    if (overrideState) {
      return overrideState;
    }
    if (query.isLoading) {
      return "loading";
    }
    if (query.isError) {
      return "error";
    }
    if (!query.data) {
      return "empty";
    }
    return "active";
  }, [overrideState, query.isLoading, query.isError, query.data]);

  const switchDisplayState = useCallback((nextState: ProgressDisplayState) => {
    if (nextState === "active") {
      setOverrideState(null);
      void query.refetch();
    } else {
      setOverrideState(nextState);
    }
  }, [query]);

  const data = useMemo<ProgressSnapshot | null>(() => {
    if (displayState === "loading" || displayState === "error" || displayState === "empty") {
      return null;
    }
    return query.data ?? null;
  }, [displayState, query.data]);

  const getAskTrefixPromptForCapability = useCallback(
    (capability: ProgressCapability) => {
      return `Explain my progress in ${capability.name || capability.type} over the last ${period}. What workouts influenced it most?`;
    },
    [period]
  );

  const getAskTrefixPromptForMilestone = useCallback(
    (milestone: ProgressMilestone) => {
      return `Explain my milestone "${milestone.title}" (${milestone.value} on ${milestone.date}). How does it affect my race target?`;
    },
    []
  );

  return {
    period,
    setPeriod,
    displayState,
    switchDisplayState,
    data,
    refetch: query.refetch,
    getAskTrefixPromptForCapability,
    getAskTrefixPromptForMilestone,
  };
}
