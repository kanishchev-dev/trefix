import { useEffect, useState } from "react";
import * as Location from "expo-location";

import type { TrainingWorkout } from "@trefix/api-client";

import { useWorkouts } from "../main/hooks/use-workouts";
import { useWorkout } from "../plans/hooks/use-workout";
import { todayIso, workoutLocalDate } from "../plans/lib/plan-dates";

/** Without a ready fix for this long, suggest recording by time. */
const GPS_SLOW_HINT_MS = 20_000;

/** Accuracy at which GPS counts as ready. */
const GPS_READY_M = 15;

/**
 * The planned workout to run: the one the user opened, otherwise today's
 * unfinished workout of the plan (not a rest day).
 */
export function usePlannedWorkout(
  plannedWorkoutId: string | null,
): TrainingWorkout | null {
  const today = todayIso();
  const opened = useWorkout(plannedWorkoutId);
  const todays = useWorkouts(today, today);
  if (plannedWorkoutId) return opened.data ?? null;
  return (
    todays.data?.find(
      (workout) =>
        workoutLocalDate(workout.scheduledAt) === today &&
        workout.status === "planned" &&
        workout.type !== "rest",
    ) ?? null
  );
}

/**
 * Starts the GPS before the run so the first fix is ready at "Start". Only
 * when location access was granted earlier: the permission is asked at start.
 */
export function useGpsWarmup(enabled: boolean): {
  status: "searching" | "weak" | "good";
  slow: boolean;
} {
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    let ready = false;
    const timer = setTimeout(() => {
      if (!ready) setSlow(true);
    }, GPS_SLOW_HINT_MS);
    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync().catch(
        () => null,
      );
      if (!permission?.granted || cancelled) return;
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (location) => {
          const value = location.coords.accuracy ?? null;
          setAccuracy(value);
          if (value !== null && value <= GPS_READY_M) {
            ready = true;
            setSlow(false);
          }
        },
      );
      if (cancelled) subscription.remove();
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription?.remove();
      setSlow(false);
    };
  }, [enabled]);

  const status =
    accuracy === null ? "searching" : accuracy <= GPS_READY_M ? "good" : "weak";
  return { status, slow };
}
