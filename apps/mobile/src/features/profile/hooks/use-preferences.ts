import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type UserPreferences,
  type UserPreferencesUpdate,
} from "@workspace/api-client";

import {
  getPreferences,
  updatePreferences,
} from "../../../lib/preferences-api";
import { queryKeys } from "../../../shared/lib/query-keys";

export const preferencesQueryKey = queryKeys.preferences.all;

export const DEFAULT_PREFERENCES: UserPreferences = {
  units: "metric",
  weekStart: "mon",
  timeFormat: "24h",
  coachEnabled: true,
  coachAdaptationMode: "confirm",
  coachQuietHours: null,
  stravaProfileSync: true,
  timezone: null,
};

export function usePreferences() {
  const query = useQuery({
    queryKey: preferencesQueryKey,
    queryFn: getPreferences,
    staleTime: 1000 * 60 * 30,
  });
  return { ...query, preferences: query.data ?? DEFAULT_PREFERENCES };
}

/** Optimistic preferences update; also reports the device time zone for quiet hours. */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UserPreferencesUpdate) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return updatePreferences(timezone ? { ...patch, timezone } : patch);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: preferencesQueryKey });
      const previous =
        queryClient.getQueryData<UserPreferences>(preferencesQueryKey);
      queryClient.setQueryData<UserPreferences>(preferencesQueryKey, {
        ...(previous ?? DEFAULT_PREFERENCES),
        ...patch,
      });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      queryClient.setQueryData(preferencesQueryKey, context?.previous);
    },
    onSuccess: (preferences, patch) => {
      queryClient.setQueryData(preferencesQueryKey, preferences);
      if ("coachEnabled" in patch) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all });
      }
    },
  });
}
