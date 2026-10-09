import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type AthleteProfile, type AthleteProfileUpdate } from "@workspace/api-client";

import { getMyAthlete, updateMyAthlete } from "../../../lib/training-api";
import { useRealtimeEvent } from "../../../lib/realtime";

export const athleteQueryKey = ["athlete", "me"] as const;

export function useAthleteProfile() {
  return useQuery({
    queryKey: athleteQueryKey,
    queryFn: () => getMyAthlete(),
    staleTime: 1000 * 60 * 5,
  });
}

const HEART_FIELDS: Array<keyof AthleteProfileUpdate> = [
  "restingHeartRate",
  "maxHeartRate",
  "thresholdHeartRate",
  "hrZonesMethod",
  "hrZonesCustom",
];

/** Optimistic profile update; derived values (zones, completeness) come back from the server. */
export function useUpdateAthleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: AthleteProfileUpdate) => updateMyAthlete(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: athleteQueryKey });
      const previous = queryClient.getQueryData<AthleteProfile | null>(athleteQueryKey);
      if (previous) {
        const { resetSources: _ignored, ...fields } = patch;
        queryClient.setQueryData<AthleteProfile>(athleteQueryKey, { ...previous, ...fields });
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(athleteQueryKey, context.previous);
      }
    },
    onSuccess: (profile, patch) => {
      queryClient.setQueryData(athleteQueryKey, profile);
      if (HEART_FIELDS.some((field) => field in patch)) {
        void queryClient.invalidateQueries({ queryKey: ["plans"] });
      }
    },
  });
}

/** Refreshes profile, gear and preferences when they change on another device or by a sync. */
export function useProfileRealtime(): void {
  const queryClient = useQueryClient();
  useRealtimeEvent("athlete.updated", () => {
    void queryClient.invalidateQueries({ queryKey: ["athlete"] });
  });
  useRealtimeEvent("gear.updated", () => {
    void queryClient.invalidateQueries({ queryKey: ["gear"] });
  });
  useRealtimeEvent("preferences.updated", () => {
    void queryClient.invalidateQueries({ queryKey: ["preferences"] });
  });
}
