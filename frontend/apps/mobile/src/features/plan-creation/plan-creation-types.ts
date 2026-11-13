import type {
  AthleteGoalPayloadInput,
  AthleteGoalType,
  ManualPlanGoalInput,
  ManualPlanPreview,
  ManualPlanScheduleInput,
  ManualPlanStructureInput,
  ManualPlanWorkoutOverride,
} from "@trefix/api-client";
import { GOAL_TYPE_CONFIG } from "@trefix/api-client";

import { type MainCopy } from "../../locales";

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

export const PLAN_FOCUS_OPTIONS = [
  "easy",
  "long_run",
  "tempo",
  "interval",
  "hill",
] as const;

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
  goal: AthleteGoalPayloadInput & {
    raceDistance?: (typeof PLAN_GOAL_OPTIONS)[number]["value"];
    targetTimeText?: string;
    targetTimeSeconds?: number;
  };
  schedule: ManualPlanScheduleInput;
  structure: ManualPlanStructureInput;
};

/** Starting point of a new plan in the creation flow. */
export const INITIAL_PLAN_CREATION_DRAFT: PlanCreationDraft = {
  goal: {
    type: "prepare_for_race",
    target: {
      distanceMeters: 10000,
    },
    raceDistance: "10k",
    targetTimeText: "",
    targetTimeSeconds: undefined,
    targetDate: undefined,
  },
  schedule: {
    trainingDays: [0, 2, 5],
    preferredLongRunDay: undefined,
    workoutDurationMinutes: 45,
  },
  structure: {
    totalWeeks: 8,
    sessionsPerWeek: 3,
    focus: ["easy", "long_run", "tempo"],
  },
};

export const MANUAL_PLAN_MIN_WEEKS = 4;
export const MANUAL_PLAN_MAX_WEEKS = 16;
export const MANUAL_PLAN_MIN_SESSIONS = 1;
export const MANUAL_PLAN_MAX_SESSIONS = 7;
/** Mirrors backend MANUAL_PLAN_MIN/MAX_DURATION_MINUTES. */
export const MANUAL_PLAN_MIN_DURATION_MINUTES = 10;
export const MANUAL_PLAN_MAX_DURATION_MINUTES = 300;

/**
 * Ruler scales for finish time per race distance (seconds). Lower bounds match
 * validateTargetTime; steps get coarser with distance so the ruler stays short.
 * At 12px per tick: 5K/10K label every minute (144px), half every 5 min (240px),
 * marathon every 10 min (240px).
 */
export const RACE_TIME_RANGES = {
  "5k": {
    min: 12 * 60,
    max: 60 * 60,
    step: 5,
    majorEvery: 60,
    labelEvery: 60,
    defaultTarget: 25 * 60,
    defaultCurrent: 27 * 60,
  },
  "10k": {
    min: 25 * 60,
    max: 2 * 3600,
    step: 5,
    majorEvery: 60,
    labelEvery: 60,
    defaultTarget: 45 * 60,
    defaultCurrent: 48 * 60 + 30,
  },
  half_marathon: {
    min: 55 * 60,
    max: 4 * 3600,
    step: 15,
    majorEvery: 60,
    labelEvery: 300,
    defaultTarget: 1 * 3600 + 50 * 60,
    defaultCurrent: 2 * 3600,
  },
  marathon: {
    min: 1 * 3600 + 55 * 60,
    max: 7 * 3600 + 30 * 60,
    step: 30,
    majorEvery: 300,
    labelEvery: 600,
    defaultTarget: 4 * 3600,
    defaultCurrent: 4 * 3600 + 20 * 60,
  },
} as const;

export type RaceDistancePreset = keyof typeof RACE_TIME_RANGES;

/** Quick picks shown under the race-distance ruler (metres, official values). */
export const RACE_DISTANCE_PRESETS_METERS = [
  5_000, 10_000, 21_097, 42_195, 50_000, 100_000,
] as const;

export type RaceTimeRange = {
  min: number;
  max: number;
  step: number;
  majorEvery: number;
  labelEvery: number;
  defaultTarget: number;
  defaultCurrent: number;
};

const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;

/**
 * Finish-time ruler scale for any race distance (seconds). Classic distances
 * use the tuned table above; anything else (e.g. 50, 100, 160 km) is derived
 * from pace bounds, with coarser steps as the race gets longer so the ruler
 * stays short.
 */
export function raceTimeRange(distanceMeters: unknown): RaceTimeRange {
  const meters =
    typeof distanceMeters === "number" && distanceMeters > 0
      ? distanceMeters
      : 10_000;
  const classic = (Object.keys(RACE_TIME_RANGES) as RaceDistancePreset[]).find(
    (key) => Math.abs((RACE_PRESET_METERS[key] ?? 0) - meters) < 100,
  );
  if (classic) return RACE_TIME_RANGES[classic];

  const km = meters / 1000;
  const fastPace = 2 * 60 + 45; // faster than any realistic amateur, keeps bad inputs out
  const slowPace = km <= 50 ? 10 * 60 : 15 * 60;
  const rawMax = km * slowPace;
  const step =
    rawMax <= 2 * 3600
      ? 5
      : rawMax <= 6 * 3600
        ? 15
        : rawMax <= 12 * 3600
          ? 30
          : 60;
  // At 12px per tick: label roughly every 150–360px.
  const majorEvery = step <= 15 ? 60 : step === 30 ? 300 : 600;
  const labelEvery =
    step === 5 ? 60 : step === 15 ? 300 : step === 30 ? 600 : 1800;
  const min = Math.max(60, roundTo(km * fastPace, majorEvery));
  // Backend caps finishTimeSec at 260 000 s; 72 h stays under it.
  const max = Math.min(roundTo(rawMax, majorEvery), 72 * 3600);
  const typicalPace = km <= 42.2 ? 6 * 60 : 8 * 60;
  const clamp = (value: number) =>
    Math.min(max, Math.max(min, roundTo(value, step)));

  return {
    min,
    max,
    step,
    majorEvery,
    labelEvery,
    defaultTarget: clamp(km * typicalPace),
    defaultCurrent: clamp(km * typicalPace * 1.08),
  };
}

/** Keeps a time if it still fits the scale of a new distance, otherwise the scale default. */
export function fitTimeToRange(
  seconds: unknown,
  range: RaceTimeRange,
  fallback: number,
): number {
  return typeof seconds === "number" &&
    seconds >= range.min &&
    seconds <= range.max
    ? seconds
    : fallback;
}

const RACE_PRESET_METERS: Record<RaceDistancePreset, number> = {
  "5k": 5_000,
  "10k": 10_000,
  half_marathon: 21_097,
  marathon: 42_195,
};

/**
 * Values a field gets the moment it appears in the draft: on goal-type
 * selection for fields the UI treats as required, or when the user taps
 * "Set" on an optional one. What the user sees is always what is stored.
 */
export const GOAL_FIELD_DEFAULTS = {
  trailDistanceMeters: 30_000,
  ultraDistanceMeters: 50_000,
  trailElevationMeters: 1_500,
  ultraElevationMeters: 2_000,
  longestRunMeters: 15_000,
  weeklyDistanceKm: 30,
  currentWeeklyDistanceKm: 20,
  weeklyDurationMinutes: 150,
  loopsCount: 12,
  timeOnFeetMinutes: 240,
  targetPace: 5 * 60 + 30,
  currentPace: 6 * 60,
  paceDistanceMeters: 10_000,
  enduranceMinutes: 90,
  continuousMinutes: 30,
  enduranceDistanceKm: 15,
  continuousDistanceKm: 5,
  currentContinuousMinutes: 20,
  currentContinuousDistanceKm: 3,
  startRunningTargetMinutes: 30,
  startRunningCurrentMinutes: 5,
  runsPerWeek: 3,
  currentRunsPerWeek: 2,
  targetWeightKg: 70,
  currentWeightKg: 75,
  hillsElevationMeters: 300,
  challengeTargetValue: 100,
} as const;

/** Target fields each goal type needs to be valid, pre-filled on selection. */
export function withRequiredGoalDefaults(
  goal: PlanCreationDraft["goal"],
): PlanCreationDraft["goal"] {
  const target: Record<string, unknown> = { ...(goal.target ?? {}) };
  const fill = (key: string, value: unknown) => {
    if (target[key] === undefined || target[key] === null) target[key] = value;
  };
  const D = GOAL_FIELD_DEFAULTS;

  switch (goal.type) {
    case "prepare_for_race":
    case "run_new_distance":
      fill("distanceMeters", 10_000);
      break;
    case "improve_race_result":
      fill("distanceMeters", 10_000);
      fill("finishTimeSec", raceTimeRange(target.distanceMeters).defaultTarget);
      break;
    case "trail_preparation":
      fill("distanceMeters", D.trailDistanceMeters);
      break;
    case "ultra_preparation":
      fill("distanceMeters", D.ultraDistanceMeters);
      break;
    case "backyard_preparation":
      fill("loopsCount", D.loopsCount);
      break;
    case "improve_speed":
    case "improve_pace":
      fill("paceSecondsPerKm", D.targetPace);
      break;
    case "build_endurance":
      if (target.continuousDistanceKm === undefined)
        fill("continuousDurationMinutes", D.enduranceMinutes);
      break;
    case "run_continuously":
      if (target.continuousDistanceKm === undefined)
        fill("continuousDurationMinutes", D.continuousMinutes);
      break;
    case "build_consistency":
      fill("runsPerWeek", D.runsPerWeek);
      break;
    case "increase_running_volume":
      fill("weeklyDistanceKm", D.weeklyDistanceKm);
      break;
    case "lose_weight":
      fill("weightKg", D.targetWeightKg);
      break;
    case "complete_challenge":
      fill("challengeMetric", "total_distance");
      fill("challengeTargetValue", D.challengeTargetValue);
      fill("challengePeriod", "this_month");
      break;
    default:
      break;
  }

  return {
    ...goal,
    target: Object.keys(target).length > 0 ? target : undefined,
  };
}

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
  if (!value) return null;
  const parts = value.split(":").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }
  if (parts.some((part) => part === "" || !/^\d+$/.test(part))) {
    return null;
  }
  const numbers = parts.map(Number);
  const [first, second, third] = numbers;
  const seconds =
    parts.length === 3
      ? first * 3600 + second * 60 + third
      : first * 60 + second;
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
  return new Date(targetDate) > new Date(startDate)
    ? null
    : "invalidTargetDate";
}

/**
 * Clears metrics in target / current when changing goal type.
 * Fields belonging to another goal type must not leak into the active goal.
 */
export function pruneStaleGoalFields(
  goal: PlanCreationDraft["goal"],
  newType: AthleteGoalType,
): PlanCreationDraft["goal"] {
  const config = GOAL_TYPE_CONFIG[newType];
  if (!config) {
    return { type: newType };
  }

  const target = goal.target ?? {};
  const current = goal.current ?? {};

  const nextTarget: Record<string, unknown> = {};
  const nextCurrent: Record<string, unknown> = {};

  for (const field of config.targetFields) {
    if (target[field] !== undefined) {
      nextTarget[field] = target[field];
    }
  }

  for (const field of config.currentFields) {
    if (current[field] !== undefined) {
      nextCurrent[field] = current[field];
    }
  }

  return {
    type: newType,
    target: Object.keys(nextTarget).length > 0 ? nextTarget : undefined,
    current: Object.keys(nextCurrent).length > 0 ? nextCurrent : undefined,
    description: config.requiresDescription ? goal.description : undefined,
    targetDate: goal.targetDate,
    priority: goal.priority,
  };
}

/**
 * Formats a localized summary for any goal type.
 */
export function formatGoalSummary(
  goal: PlanCreationDraft["goal"],
  copy: MainCopy,
  locale = "ru-RU",
): string {
  const creationCopy = copy.plan.creation;
  const units = creationCopy.units;
  const goalTypesCopy = creationCopy.goalTypes;
  const typeTitle =
    goalTypesCopy[goal.type as keyof typeof goalTypesCopy] ?? goal.type;
  const target = goal.target ?? {};
  const number = (value: number) =>
    value.toLocaleString(locale, { maximumFractionDigits: 1 });
  const dateLabel = goal.targetDate
    ? new Date(`${goal.targetDate}T00:00:00`).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
      })
    : null;

  let detail: string | null = null;
  if (
    goal.type === "prepare_for_race" ||
    goal.type === "improve_race_result" ||
    goal.type === "run_new_distance"
  ) {
    const meters = target.distanceMeters as number | undefined;
    const distance = meters
      ? `${number(Math.round(meters / 100) / 10)} ${units.km}`
      : null;
    const time =
      typeof target.finishTimeSec === "number"
        ? formatTargetTime(target.finishTimeSec)
        : null;
    detail = [distance, time].filter(Boolean).join(" · ") || null;
  } else if (
    goal.type === "lose_weight" &&
    typeof target.weightKg === "number"
  ) {
    detail = `${number(target.weightKg)} ${units.kg}`;
  } else if (
    goal.type === "build_consistency" &&
    typeof target.runsPerWeek === "number"
  ) {
    detail = `${target.runsPerWeek} ${creationCopy.preview.statRuns}`;
  } else if (
    goal.type === "increase_running_volume" &&
    typeof target.weeklyDistanceKm === "number"
  ) {
    detail = `${number(target.weeklyDistanceKm)} ${units.km} · ${creationCopy.goalForm.weeklyDistance.toLowerCase()}`;
  } else if (goal.type === "custom" && goal.description) {
    detail =
      goal.description.length > 40
        ? `${goal.description.slice(0, 40)}…`
        : goal.description;
  }

  return [typeTitle, detail, dateLabel].filter(Boolean).join(" · ");
}

export type { ManualPlanPreview, ManualPlanWorkoutOverride };
