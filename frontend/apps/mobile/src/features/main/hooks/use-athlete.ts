import { useQuery } from "@tanstack/react-query";
import { getMyAthlete } from "../../../lib/training-api";
import { queryKeys } from "../../../shared/lib/query-keys";

export function useAthlete() {
  return useQuery({
    queryKey: queryKeys.athlete.me(),
    queryFn: () => getMyAthlete(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
