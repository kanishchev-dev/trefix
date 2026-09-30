import type {
  CreateManualPlanInput,
  ManualPlanGoalInput,
  ManualPlanPreview,
  ManualPlanScheduleInput,
  ManualPlanStructureInput,
  ManualPlanWorkoutOverride,
} from "@workspace/api-client";

/**
 * Client-side draft for the manual plan creation flow.
 * Mirrors the backend contract but every field stays editable until preview.
 */
export type ManualPlanDraft = {
  goal: ManualPlanGoalInput;
  schedule: ManualPlanScheduleInput;
  structure: ManualPlanStructureInput;
};

export const PLAN_GOAL_OPTIONS = [
  { value: "5k", labelKey: "5K" },
  { value: "10k", labelKey: "10K" },
  { value: "half_marathon", labelKey: "halfMarathon" },
  { value: "marathon", labelKey: "marathon" },
  { value: "just_running", labelKey: "justRunning" },
] as const;

export const PLAN_WEEKDAY_ORDER = [0, 1, 2, 3, 4, 5, 6] as const;

export const PLAN_WORKOUT_DURATION_OPTIONS = [30, 45, 60, 75, 90] as const;

export const PLAN_FOCUS_OPTIONS = ["easy", "long_run", "tempo", "interval", "hill"] as const;

/** Workout types the user can switch to in the preview editor. */
export const PLAN_WORKOUT_TYPE_KEYS = [
  "easy",
  "long_run",
  "tempo",
  "threshold",
  "interval",
  "hill",
  "recovery",
] as const;

/** Draft shape produced by the creation flow and consumed by the preview screen. */
export type PlanCreationDraft = {
  goal: {
    raceDistance: (typeof PLAN_GOAL_OPTIONS)[number]["value"];
    targetTimeText: string;
    targetTimeSeconds?: number;
    targetDate?: string;
  };
  schedule: ManualPlanScheduleInput;
  structure: ManualPlanStructureInput;
};

export const MANUAL_PLAN_MIN_WEEKS = 4;
export const MANUAL_PLAN_MAX_WEEKS = 16;
export const MANUAL_PLAN_MIN_SESSIONS = 1;
export const MANUAL_PLAN_MAX_SESSIONS = 7;

/** Formats seconds into a mm:ss or h:mm:ss string. */
export function formatTargetTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const padded = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${padded(minutes)}:${padded(seconds)}`
    : `${minutes}:${padded(seconds)}`;
}

/** Parses hh:mm:ss / mm:ss into seconds, or null when invalid. */
export function parseTargetTime(value: string): number | null {
  const parts = value.split(":").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }
  if (parts.some((part) => part === "" || !/^\d+$/.test(part))) {
    return null;
  }
  const numbers = parts.map(Number);
  const [first, second, third] = numbers;
  const seconds = parts.length === 3 ? first * 3600 + second * 60 + third : first * 60 + second;
  return seconds > 0 ? seconds : null;
}

/** Returns the goal race distance in kilometres, or null for open-ended goals. */
export function getGoalDistanceKm(raceDistance: string): number | null {
  switch (raceDistance) {
    case "5k":
      return 5;
    case "10k":
      return 10;
    case "half_marathon":
      return 21.0975;
    case "marathon":
      return 42.195;
    default:
      return null;
  }
}

/**
 * Validates the target time against the selected distance.
 * World-record margins keep obviously wrong inputs out without being strict.
 */
export function validateTargetTime(
  raceDistance: string,
  targetTimeSeconds: number | null,
): string | null {
  if (targetTimeSeconds === null) {
    return null;
  }

  const distanceKm = getGoalDistanceKm(raceDistance);
  if (distanceKm === null) {
    return null;
  }

  const minSecondsByDistance: Record<string, number> = {
    "5k": 12 * 60,
    "10k": 25 * 60,
    half_marathon: 55 * 60,
    marathon: 1 * 3600 + 55 * 60,
  };

  const minSeconds = minSecondsByDistance[raceDistance] ?? 0;
  if (targetTimeSeconds < minSeconds) {
    return "invalidTargetTime";
  }
  return null;
}

/** Checks that the target date is in the future relative to the plan start. */
export function validateTargetDate(
  targetDate: string | undefined,
  startDate: string,
): string | null {
  if (!targetDate) {
    return null;
  }
  return new Date(targetDate) > new Date(startDate) ? null : "invalidTargetDate";
}

export type { ManualPlanPreview, ManualPlanWorkoutOverride };
