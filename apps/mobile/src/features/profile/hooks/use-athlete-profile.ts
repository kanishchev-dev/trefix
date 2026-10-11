import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type AthleteProfile,
  type AthleteProfileUpdate,
} from "@workspace/api-client";

import { getMyAthlete, updateMyAthlete } from "../../../lib/training-api";
import { useRealtimeEvent } from "../../../lib/realtime";
import { queryKeys } from "../../../shared/lib/query-keys";

export const athleteQueryKey = queryKeys.athlete.me();

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
      const previous = queryClient.getQueryData<AthleteProfile | null>(
        athleteQueryKey,
      );
      if (previous) {
        const { resetSources: _ignored, ...fields } = patch;
        queryClient.setQueryData<AthleteProfile>(athleteQueryKey, {
          ...previous,
          ...fields,
        });
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
        void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all });
      }
    },
  });
}

/** Refreshes profile, gear and preferences when they change on another device or by a sync. */
export function useProfileRealtime(): void {
  const queryClient = useQueryClient();
  useRealtimeEvent("athlete.updated", () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.athlete.all });
  });
  useRealtimeEvent("gear.updated", () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.gear.all });
  });
  useRealtimeEvent("preferences.updated", () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.preferences.all });
  });
}
