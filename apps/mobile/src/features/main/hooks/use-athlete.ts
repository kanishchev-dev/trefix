import { useQuery } from "@tanstack/react-query";
import { getMyAthlete } from "../../../lib/training-api";

export function useAthlete() {
  return useQuery({
    queryKey: ["athlete", "me"],
    queryFn: () => getMyAthlete(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
