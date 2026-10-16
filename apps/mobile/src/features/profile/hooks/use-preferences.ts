import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type UserPreferences,
  type UserPreferencesUpdate,
} from "@trefix/api-client";

import {
  getPreferences,
  updatePreferences,
} from "../../../lib/preferences-api";
import { queryKeys } from "../../../shared/lib/query-keys";

export const preferencesQueryKey = queryKeys.preferences.all;

/** Shown until the server answers; never written to the cache as server data. */
export const DEFAULT_PREFERENCES: UserPreferences = {
  distanceUnit: "km",
  weightUnit: "kg",
  heightUnit: "cm",
  temperatureUnit: "c",
  weekStart: "mon",
  timeFormat: "24h",
  coachEnabled: true,
  coachAdaptationMode: "confirm",
  coachTone: "neutral",
  coachProactive: {
    preWorkout: true,
    workoutReview: true,
    wellbeingCheck: true,
    weeklySummary: true,
    missedSupport: true,
  },
  coachQuietHours: null,
  notifications: {
    workoutReminder: true,
    workoutReminderTime: "morning",
    missedWorkout: true,
    planChanged: true,
    achievements: true,
    workoutSynced: false,
  },
  stravaProfileSync: true,
  stravaActivitiesSync: true,
  stravaGearSync: true,
  timezone: null,
  language: null,
  languageMode: "system",
  updatedAt: new Date(0).toISOString(),
};

/** Nested settings are sent as partial patches; the cache keeps them whole. */
function applyPatch(
  previous: UserPreferences,
  patch: UserPreferencesUpdate,
): UserPreferences {
  const { coachProactive, notifications, coachQuietHours, ...flat } = patch;
  return {
    ...previous,
    ...(flat as Partial<UserPreferences>),
    ...(coachQuietHours !== undefined ? { coachQuietHours } : {}),
    coachProactive: {
      ...previous.coachProactive,
      ...stripUndefined(coachProactive),
    },
    notifications: {
      ...previous.notifications,
      ...stripUndefined(notifications),
    },
  };
}

function stripUndefined<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

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
      if (previous) {
        queryClient.setQueryData<UserPreferences>(
          preferencesQueryKey,
          applyPatch(previous, patch),
        );
      }
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
