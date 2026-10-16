import type { ExecutionStep, TrainingWorkout } from "@trefix/api-client";

import { workoutGoal } from "../../shared/lib/workout-target";
import { displayToKm, type UnitSystem } from "../../shared/lib/units";
import { goalPace } from "../main/lib/goal-estimate";
import type { RunGoal } from "./storage/tracker-db";

type GoalDraftLike = {
  goal: "none" | "duration" | "distance";
  minutes: number;
  distance: number;
  timeLimitMin: number | null;
};

const QUALITY_TYPES = new Set(["tempo", "threshold", "interval", "hill"]);

/** Goal of a free run set on the setup screen; null without a goal. */
export function goalFromDraft(
  draft: GoalDraftLike,
  units: UnitSystem,
): RunGoal | null {
  if (draft.goal === "duration")
    return {
      kind: "duration",
      durationSec: Math.round(draft.minutes * 60),
      distanceM: null,
      timeLimitSec: null,
    };
  if (draft.goal === "distance")
    return {
      kind: "distance",
      durationSec: null,
      distanceM: Math.round(displayToKm(draft.distance, units) * 1000),
      timeLimitSec: draft.timeLimitMin ? draft.timeLimitMin * 60 : null,
    };
  return null;
}

/** Goal of a workout the athlete added by hand; null for plan workouts and "no goal". */
export function goalFromWorkout(workout: TrainingWorkout): RunGoal | null {
  if (workout.planId) return null;
  const own = workoutGoal(workout.target);
  if (!own) return null;
  if (own.goal === "duration" && workout.durationMinutes > 0)
    return {
      kind: "duration",
      durationSec: Math.round(workout.durationMinutes * 60),
      distanceM: null,
      timeLimitSec: null,
    };
  if (own.goal === "distance" && workout.distanceKm > 0)
    return {
      kind: "distance",
      durationSec: null,
      distanceM: Math.round(workout.distanceKm * 1000),
      timeLimitSec: own.timeLimitMin ? own.timeLimitMin * 60 : null,
    };
  return null;
}

/** The one step a goal is run as; the server builds the same for a workout with a goal. */
export function goalSteps(goal: RunGoal, type: string | null): ExecutionStep[] {
  const corridor =
    goal.kind === "distance" && goal.distanceM && goal.timeLimitSec
      ? goalPace(goal.distanceM / 1000, goal.timeLimitSec / 60)
      : null;
  return [
    {
      index: 0,
      kind: type && QUALITY_TYPES.has(type) ? "work" : "steady",
      durationSec: goal.kind === "duration" ? goal.durationSec : null,
      distanceM: goal.kind === "distance" ? goal.distanceM : null,
      targetPace: corridor
        ? { minSecPerKm: corridor.min, maxSecPerKm: corridor.max }
        : null,
      zone: null,
      repetition: null,
    },
  ];
}
