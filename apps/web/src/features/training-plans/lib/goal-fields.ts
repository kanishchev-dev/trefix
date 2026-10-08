import {
  GOAL_CHALLENGE_METRICS,
  GOAL_CHALLENGE_PERIODS,
  GOAL_METRIC_BOUNDS,
  GOAL_TYPE_CONFIG,
  validateGoalPayload,
  type AthleteGoalType,
  type GoalMetricKey,
} from "@workspace/api-client";

import {
  formatDuration,
  formatPace,
  parseDuration,
  parsePace,
} from "./plan-format";

/**
 * How a goal metric is entered. The API stores base units (metres, seconds);
 * the form shows what a coach types: kilometres, h:mm:ss, m:ss per km.
 */
export type GoalFieldKind =
  | "km"
  | "duration"
  | "pace"
  | "integer"
  | "decimal"
  | "select";

const FIELD_KINDS: Record<GoalMetricKey, GoalFieldKind> = {
  distanceMeters: "km",
  finishTimeSec: "duration",
  shortDistanceResultSec: "duration",
  paceSecondsPerKm: "pace",
  weightKg: "decimal",
  weeklyDistanceKm: "decimal",
  continuousDistanceKm: "decimal",
  benchmarkValue: "decimal",
  challengeTargetValue: "decimal",
  challengeProgressValue: "decimal",
  runsPerWeek: "integer",
  weeklyDurationMinutes: "integer",
  continuousDurationMinutes: "integer",
  elevationGainMeters: "integer",
  timeOnFeetMinutes: "integer",
  loopsCount: "integer",
  challengeMetric: "select",
  challengePeriod: "select",
};

export const GOAL_SELECT_OPTIONS: Partial<
  Record<GoalMetricKey, readonly string[]>
> = {
  challengeMetric: GOAL_CHALLENGE_METRICS,
  challengePeriod: GOAL_CHALLENGE_PERIODS,
};

/** Goal metric values as typed in the form; an empty string means "not set". */
export type GoalFieldValues = Partial<Record<GoalMetricKey, string>>;

export type GoalFieldErrors = Partial<
  Record<
    `target.${GoalMetricKey}` | `current.${GoalMetricKey}` | "description",
    string
  >
>;

export function goalFieldKind(key: GoalMetricKey): GoalFieldKind {
  return FIELD_KINDS[key];
}

/** Parses one typed value into the API unit; `undefined` when empty, `null` when invalid. */
export function parseGoalField(
  key: GoalMetricKey,
  raw: string | undefined,
): number | string | undefined | null {
  const value = raw?.trim() ?? "";
  if (value === "") {
    return undefined;
  }

  const kind = FIELD_KINDS[key];
  if (kind === "select") {
    return GOAL_SELECT_OPTIONS[key]?.includes(value) ? value : null;
  }

  let parsed: number | null;
  switch (kind) {
    case "km":
      parsed = toNumber(value);
      parsed = parsed === null ? null : Math.round(parsed * 1000);
      break;
    case "duration":
      parsed = parseDuration(value);
      break;
    case "pace":
      parsed = parsePace(value);
      break;
    default:
      parsed = toNumber(value);
  }

  const bounds = GOAL_METRIC_BOUNDS[key];
  if (parsed === null || parsed < bounds.min || parsed > bounds.max) {
    return null;
  }
  if (bounds.integer && !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

/** Formats an API value for the form input. */
export function formatGoalField(key: GoalMetricKey, value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  switch (FIELD_KINDS[key]) {
    case "km":
      return String(Math.round(value / 100) / 10);
    case "duration":
      return formatDuration(value);
    case "pace":
      return formatPace(value);
    default:
      return String(value);
  }
}

export function formatGoalFields(
  values: Record<string, unknown> | null | undefined,
): GoalFieldValues {
  const result: GoalFieldValues = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    if (key in FIELD_KINDS) {
      result[key as GoalMetricKey] = formatGoalField(
        key as GoalMetricKey,
        value,
      );
    }
  }
  return result;
}

export type ParsedGoal = {
  target: Record<string, unknown> | null;
  current: Record<string, unknown> | null;
  errors: GoalFieldErrors;
};

/**
 * Converts the typed goal into the API payload. Only the fields of the
 * selected goal type are sent, so values left over from another type never
 * leak into the plan. Errors are i18n keys.
 */
export function parseGoal(
  type: AthleteGoalType,
  target: GoalFieldValues,
  current: GoalFieldValues,
  description: string,
): ParsedGoal {
  const config = GOAL_TYPE_CONFIG[type];
  const errors: GoalFieldErrors = {};

  const collect = (
    scope: "target" | "current",
    fields: readonly GoalMetricKey[],
    values: GoalFieldValues,
  ) => {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      const parsed = parseGoalField(field, values[field]);
      if (parsed === null) {
        errors[`${scope}.${field}`] = "userPlans.goal.errors.invalidValue";
      } else if (parsed !== undefined) {
        result[field] = parsed;
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  };

  const parsedTarget = collect("target", config.targetFields, target);
  const parsedCurrent = collect("current", config.currentFields, current);

  const validation = validateGoalPayload({
    type,
    target: parsedTarget,
    description,
  });
  if (!validation.valid) {
    if (validation.code === "GOAL_DESCRIPTION_REQUIRED") {
      errors.description = "userPlans.goal.errors.descriptionRequired";
    } else if (
      validation.field &&
      !errors[`target.${validation.field as GoalMetricKey}`]
    ) {
      errors[`target.${validation.field as GoalMetricKey}`] =
        "userPlans.goal.errors.required";
    }
  }

  return { target: parsedTarget, current: parsedCurrent, errors };
}

/** Target fields that satisfy a required group: at least one of each group must be filled. */
export function requiredGoalFields(type: AthleteGoalType): Set<GoalMetricKey> {
  return new Set(GOAL_TYPE_CONFIG[type].requiredTargetGroups.flat());
}

function toNumber(value: string): number | null {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

/** Values a required field gets when a goal type is picked, in API units; the same defaults the app uses. */
const REQUIRED_FIELD_DEFAULTS: Partial<Record<GoalMetricKey, number | string>> =
  {
    distanceMeters: 10_000,
    finishTimeSec: 50 * 60,
    paceSecondsPerKm: 5 * 60 + 30,
    continuousDurationMinutes: 30,
    runsPerWeek: 3,
    weeklyDistanceKm: 30,
    weightKg: 70,
    challengeMetric: "total_distance",
    challengeTargetValue: 100,
  };

/**
 * Fills every required group of the new goal type that has no value yet,
 * keeping whatever the admin already typed for shared fields.
 */
export function withRequiredGoalDefaults(
  type: AthleteGoalType,
  target: GoalFieldValues,
): GoalFieldValues {
  const next: GoalFieldValues = { ...target };
  for (const group of GOAL_TYPE_CONFIG[type].requiredTargetGroups) {
    const filled = group.some((field) => (next[field] ?? "").trim() !== "");
    if (filled) continue;
    for (const field of group) {
      const value = REQUIRED_FIELD_DEFAULTS[field];
      if (value !== undefined) {
        next[field] = formatGoalField(field, value);
      }
    }
  }
  return next;
}
