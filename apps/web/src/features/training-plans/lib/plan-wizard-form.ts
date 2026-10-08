import { z } from "zod";

import {
  ATHLETE_GOAL_TYPES,
  PLAN_METRIC_RANGES,
  PLAN_NAME_MAX_LENGTH,
  PLAN_NOTES_MAX_LENGTH,
  type AthleteGoalType,
  type AthleteMetrics,
  type CreateManualPlanInput,
  type CurrentMetrics,
  type ManualPlanGoalInput,
  type PlanStartOption,
  type PreviewManualPlanInput,
  type RebuildInput,
  type RebuildPrefill,
  type RebuildPreviewInput,
  type RebuildTarget,
} from "@workspace/api-client";

import { parseDateKey } from "@/features/training-calendar/lib/calendar-dates";

import {
  formatGoalFields,
  parseGoal,
  type GoalFieldValues,
} from "./goal-fields";
import {
  formatDuration,
  formatPace,
  parseDuration,
  parsePace,
} from "./plan-format";

/** Mirrors the backend manual plan limits. */
export const PLAN_WIZARD_LIMITS = {
  weeks: { min: 4, max: 16 },
  sessions: { min: 1, max: 7 },
  workoutDurationMinutes: { min: 10, max: 300 },
  thresholdHeartRate: { min: 100, max: 230 },
} as const;

export const PLAN_FOCUS_TYPES = [
  "easy",
  "long_run",
  "tempo",
  "interval",
  "hill",
] as const;
export const RECENT_RESULT_DISTANCES = [
  "5k",
  "10k",
  "half_marathon",
  "marathon",
] as const;
export const PLAN_WIZARD_STEPS = [
  "goal",
  "schedule",
  "metrics",
  "preview",
] as const;

export type PlanFocusType = (typeof PLAN_FOCUS_TYPES)[number];
export type PlanWizardStep = (typeof PLAN_WIZARD_STEPS)[number];

const metricsSchema = z.object({
  thresholdPace: z.string(),
  thresholdHeartRate: z.string(),
  maxHeartRate: z.string(),
  restingHeartRate: z.string(),
  weeklyMileageKm: z.string(),
  longestRunKm: z.string(),
  recentDistance: z.union([z.enum(RECENT_RESULT_DISTANCES), z.literal("")]),
  recentTime: z.string(),
  recentDate: z.string(),
});

export type PlanWizardMetrics = z.infer<typeof metricsSchema>;

const ERROR = {
  invalid: "userPlans.wizard.errors.invalidValue",
  required: "userPlans.wizard.errors.required",
  days: "userPlans.wizard.errors.trainingDays",
  sessions: "userPlans.wizard.errors.sessions",
  startOption: "userPlans.wizard.errors.startOption",
  replaceActive: "userPlans.wizard.errors.replaceActive",
} as const;

// Built with the app's own zod: schemas from the api-client package belong to another zod major.
export const planWizardSchema = z
  .object({
    goalType: z.enum(ATHLETE_GOAL_TYPES),
    goalTarget: z.record(z.string()),
    goalCurrent: z.record(z.string()),
    goalDescription: z.string().max(2000),
    goalTargetDate: z.string(),
    trainingDays: z.array(z.number().int().min(0).max(6)).min(1, ERROR.days),
    preferredLongRunDay: z.number().int().min(0).max(6).nullable(),
    workoutDurationMinutes: z
      .number({ invalid_type_error: ERROR.invalid })
      .int(ERROR.invalid)
      .min(PLAN_WIZARD_LIMITS.workoutDurationMinutes.min, ERROR.invalid)
      .max(PLAN_WIZARD_LIMITS.workoutDurationMinutes.max, ERROR.invalid),
    totalWeeks: z
      .number({ invalid_type_error: ERROR.invalid })
      .int(ERROR.invalid)
      .min(PLAN_WIZARD_LIMITS.weeks.min, ERROR.invalid)
      .max(PLAN_WIZARD_LIMITS.weeks.max, ERROR.invalid),
    sessionsPerWeek: z
      .number({ invalid_type_error: ERROR.invalid })
      .int(ERROR.invalid)
      .min(PLAN_WIZARD_LIMITS.sessions.min, ERROR.invalid)
      .max(PLAN_WIZARD_LIMITS.sessions.max, ERROR.invalid),
    focus: z.array(z.enum(PLAN_FOCUS_TYPES)),
    metrics: metricsSchema,
    name: z.string().max(PLAN_NAME_MAX_LENGTH, ERROR.invalid),
    notes: z.string().max(PLAN_NOTES_MAX_LENGTH, ERROR.invalid),
    saveMode: z.enum(["draft", "start"]),
    startKind: z.string(),
    replaceActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const goal = parseGoal(
      values.goalType,
      values.goalTarget,
      values.goalCurrent,
      values.goalDescription,
    );
    for (const [path, message] of Object.entries(goal.errors)) {
      const [scope, field] = path.split(".");
      const formPath =
        scope === "description"
          ? ["goalDescription"]
          : [scope === "target" ? "goalTarget" : "goalCurrent", field];
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: formPath, message });
    }

    if (
      values.goalTargetDate !== "" &&
      parseDateKey(values.goalTargetDate) === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["goalTargetDate"],
        message: ERROR.invalid,
      });
    }

    if (values.sessionsPerWeek > values.trainingDays.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionsPerWeek"],
        message: ERROR.sessions,
      });
    }

    for (const issue of validateMetrics(values.metrics)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metrics", issue.field],
        message: issue.message,
      });
    }
  });

export type PlanWizardValues = z.infer<typeof planWizardSchema>;

/** Form fields validated before leaving each step. */
export const PLAN_WIZARD_STEP_FIELDS: Record<
  Exclude<PlanWizardStep, "preview">,
  Array<keyof PlanWizardValues>
> = {
  goal: [
    "goalType",
    "goalTarget",
    "goalCurrent",
    "goalDescription",
    "goalTargetDate",
  ],
  schedule: [
    "trainingDays",
    "preferredLongRunDay",
    "workoutDurationMinutes",
    "totalWeeks",
    "sessionsPerWeek",
    "focus",
  ],
  metrics: ["metrics"],
};

const EMPTY_METRICS: PlanWizardMetrics = {
  thresholdPace: "",
  thresholdHeartRate: "",
  maxHeartRate: "",
  restingHeartRate: "",
  weeklyMileageKm: "",
  longestRunKm: "",
  recentDistance: "",
  recentTime: "",
  recentDate: "",
};

/** Starting point of a new plan: the same defaults the app uses. */
export function getDefaultWizardValues(): PlanWizardValues {
  return {
    goalType: "prepare_for_race",
    goalTarget: { distanceMeters: "10" },
    goalCurrent: {},
    goalDescription: "",
    goalTargetDate: "",
    trainingDays: [0, 2, 5],
    preferredLongRunDay: null,
    workoutDurationMinutes: 45,
    totalWeeks: 8,
    sessionsPerWeek: 3,
    focus: ["easy", "long_run", "tempo"],
    metrics: EMPTY_METRICS,
    name: "",
    notes: "",
    saveMode: "draft",
    startKind: "",
    replaceActive: false,
  };
}

/** Fills the metrics step with the athlete's current estimate. */
export function metricsFromCurrent(current: CurrentMetrics): PlanWizardMetrics {
  const text = (value: number | null) =>
    value === null ? "" : String(Math.round(value * 10) / 10);
  const recent = current.recentResult.value;

  return {
    thresholdPace:
      current.thresholdPaceSecondsPerKm.value === null
        ? ""
        : formatPace(current.thresholdPaceSecondsPerKm.value),
    thresholdHeartRate: text(current.thresholdHeartRate.value),
    maxHeartRate: text(current.maxHeartRate.value),
    restingHeartRate: text(current.restingHeartRate.value),
    weeklyMileageKm: text(current.weeklyMileageKm.value),
    longestRunKm: text(current.longestRunKm.value),
    recentDistance: isRecentDistance(recent?.distance) ? recent.distance : "",
    recentTime: recent ? formatDuration(recent.timeSeconds) : "",
    recentDate: recent?.date.slice(0, 10) ?? "",
  };
}

/**
 * "Prepare again" starts from the source plan's parameters, the suggested
 * new goal date and the athlete's current metrics.
 */
export function valuesFromRebuildPrefill(
  prefill: RebuildPrefill,
  planName: string,
): PlanWizardValues {
  const defaults = getDefaultWizardValues();
  const goal = prefill.config.goal as Partial<ManualPlanGoalInput> &
    Record<string, unknown>;
  const goalType = isGoalType(goal.type) ? goal.type : defaults.goalType;
  const { schedule, structure } = prefill.config;

  return {
    ...defaults,
    goalType,
    goalTarget: formatGoalFields(asRecord(goal.target)),
    goalCurrent: formatGoalFields(asRecord(goal.current)),
    goalDescription:
      typeof goal.description === "string" ? goal.description : "",
    goalTargetDate: prefill.goalSuggestion.targetDate ?? "",
    trainingDays: schedule.trainingDays?.length
      ? schedule.trainingDays
      : defaults.trainingDays,
    preferredLongRunDay: schedule.preferredLongRunDay ?? null,
    workoutDurationMinutes:
      schedule.workoutDurationMinutes ?? defaults.workoutDurationMinutes,
    totalWeeks: clamp(
      structure.totalWeeks ?? defaults.totalWeeks,
      PLAN_WIZARD_LIMITS.weeks,
    ),
    sessionsPerWeek: structure.sessionsPerWeek ?? defaults.sessionsPerWeek,
    focus: (structure.focus ?? []).filter(isFocusType),
    metrics: metricsFromCurrent(prefill.metrics.current),
    name: planName,
  };
}

// ------------------------------------------------------------------ payloads

function buildGoal(values: PlanWizardValues): ManualPlanGoalInput {
  const goal = parseGoal(
    values.goalType,
    values.goalTarget,
    values.goalCurrent,
    values.goalDescription,
  );
  const description = values.goalDescription.trim();

  return {
    type: values.goalType,
    target: goal.target,
    current: goal.current,
    description: description.length > 0 ? description : null,
    targetDate: values.goalTargetDate || undefined,
  };
}

function buildConfig(
  values: PlanWizardValues,
): Pick<PreviewManualPlanInput, "schedule" | "structure"> {
  return {
    schedule: {
      trainingDays: [...values.trainingDays].sort((a, b) => a - b),
      preferredLongRunDay: values.preferredLongRunDay ?? undefined,
      workoutDurationMinutes: values.workoutDurationMinutes,
    },
    structure: {
      totalWeeks: values.totalWeeks,
      sessionsPerWeek: values.sessionsPerWeek,
      focus: values.focus,
    },
  };
}

export function buildMetrics(metrics: PlanWizardMetrics): AthleteMetrics {
  const result: AthleteMetrics = {};
  const pace = parsePace(metrics.thresholdPace);
  if (pace !== null) result.thresholdPaceSecondsPerKm = pace;

  const integer = (value: string) =>
    value.trim() === "" ? undefined : Number(value);
  const decimal = (value: string) =>
    value.trim() === "" ? undefined : Number(value.replace(",", "."));
  const assign = <K extends keyof AthleteMetrics>(
    key: K,
    value: AthleteMetrics[K] | undefined,
  ) => {
    if (value !== undefined && !Number.isNaN(value)) result[key] = value;
  };

  assign("thresholdHeartRate", integer(metrics.thresholdHeartRate));
  assign("maxHeartRate", integer(metrics.maxHeartRate));
  assign("restingHeartRate", integer(metrics.restingHeartRate));
  assign("weeklyMileageKm", decimal(metrics.weeklyMileageKm));
  assign("longestRunKm", decimal(metrics.longestRunKm));

  const time = parseDuration(metrics.recentTime);
  if (
    metrics.recentDistance !== "" &&
    time !== null &&
    metrics.recentDate !== ""
  ) {
    result.recentResult = {
      distance: metrics.recentDistance,
      timeSeconds: time,
      date: metrics.recentDate,
    };
  }
  return result;
}

export function toPreviewInput(
  values: PlanWizardValues,
  timezone: string,
): PreviewManualPlanInput {
  return {
    goal: buildGoal(values),
    ...buildConfig(values),
    metrics: buildMetrics(values.metrics),
    timezone,
  };
}

export function toRebuildPreviewInput(
  values: PlanWizardValues,
  target: RebuildTarget,
  timezone: string,
): RebuildPreviewInput {
  return {
    ...toPreviewInput(values, timezone),
    metrics: buildMetrics(values.metrics),
    target,
  };
}

/** Name, notes and save mode shared by creation and rebuild. */
function buildSaveFields(
  values: PlanWizardValues,
  startOption: PlanStartOption | null,
  timezone: string,
) {
  const name = values.name.trim();
  const notes = values.notes.trim();
  const saveFields = {
    name: name.length > 0 ? name : undefined,
    notes: notes.length > 0 ? notes : null,
  };

  if (values.saveMode === "draft" || !startOption) {
    return { ...saveFields, saveAsDraft: true };
  }

  return {
    ...saveFields,
    saveAsDraft: false,
    start: {
      startDate: startOption.startDate,
      goalTargetDate: startOption.goalTargetDate,
      replaceActive: values.replaceActive,
      timezone,
    },
  };
}

export function toCreateInput(
  values: PlanWizardValues,
  startOption: PlanStartOption | null,
  timezone: string,
): CreateManualPlanInput {
  return {
    ...toPreviewInput(values, timezone),
    ...buildSaveFields(values, startOption, timezone),
  };
}

export function toRebuildInput(
  values: PlanWizardValues,
  target: RebuildTarget,
  startOption: PlanStartOption | null,
  timezone: string,
  expectedVersion?: number,
): RebuildInput {
  return {
    ...toRebuildPreviewInput(values, target, timezone),
    ...buildSaveFields(values, startOption, timezone),
    expectedVersion,
  };
}

// ------------------------------------------------------------------ validation

function validateMetrics(
  metrics: PlanWizardMetrics,
): Array<{ field: keyof PlanWizardMetrics; message: string }> {
  const issues: Array<{ field: keyof PlanWizardMetrics; message: string }> = [];
  const check = (field: keyof PlanWizardMetrics, valid: boolean) => {
    if (!valid) issues.push({ field, message: ERROR.invalid });
  };
  const inRange = (
    value: string,
    range: { min: number; max: number },
    integer = false,
  ) => {
    if (value.trim() === "") return true;
    const number = Number(value.replace(",", "."));
    return (
      Number.isFinite(number) &&
      number >= range.min &&
      number <= range.max &&
      (!integer || Number.isInteger(number))
    );
  };

  if (metrics.thresholdPace.trim() !== "") {
    const pace = parsePace(metrics.thresholdPace);
    const range = PLAN_METRIC_RANGES.thresholdPaceSecondsPerKm;
    check(
      "thresholdPace",
      pace !== null && pace >= range.min && pace <= range.max,
    );
  }
  check(
    "thresholdHeartRate",
    inRange(
      metrics.thresholdHeartRate,
      PLAN_WIZARD_LIMITS.thresholdHeartRate,
      true,
    ),
  );
  check(
    "maxHeartRate",
    inRange(metrics.maxHeartRate, PLAN_METRIC_RANGES.maxHeartRate, true),
  );
  check(
    "restingHeartRate",
    inRange(
      metrics.restingHeartRate,
      PLAN_METRIC_RANGES.restingHeartRate,
      true,
    ),
  );
  check(
    "weeklyMileageKm",
    inRange(metrics.weeklyMileageKm, PLAN_METRIC_RANGES.weeklyMileageKm),
  );
  check(
    "longestRunKm",
    inRange(metrics.longestRunKm, PLAN_METRIC_RANGES.longestRunKm),
  );

  if (metrics.recentDistance !== "") {
    const time = parseDuration(metrics.recentTime);
    if (time === null || time < 60) {
      issues.push({
        field: "recentTime",
        message:
          metrics.recentTime.trim() === "" ? ERROR.required : ERROR.invalid,
      });
    }
    if (parseDateKey(metrics.recentDate) === null) {
      issues.push({ field: "recentDate", message: ERROR.required });
    }
  }

  return issues;
}

/** Validates the save options against the start options the preview returned. */
export function validateSaveOptions(
  values: PlanWizardValues,
  startOption: PlanStartOption | null,
  hasActivePlan: boolean,
): string | null {
  if (values.saveMode === "draft") return null;
  if (!startOption) return ERROR.startOption;
  if (hasActivePlan && !values.replaceActive) return ERROR.replaceActive;
  return null;
}

// ------------------------------------------------------------------ guards

function isGoalType(value: unknown): value is AthleteGoalType {
  return (
    typeof value === "string" &&
    (ATHLETE_GOAL_TYPES as readonly string[]).includes(value)
  );
}

function isFocusType(value: string): value is PlanFocusType {
  return (PLAN_FOCUS_TYPES as readonly string[]).includes(value);
}

function isRecentDistance(
  value: unknown,
): value is (typeof RECENT_RESULT_DISTANCES)[number] {
  return (
    typeof value === "string" &&
    (RECENT_RESULT_DISTANCES as readonly string[]).includes(value)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function clamp(value: number, range: { min: number; max: number }): number {
  return Math.min(range.max, Math.max(range.min, value));
}

export type { GoalFieldValues };
