import { z } from "zod";

import {
  ATHLETE_GOAL_TYPES,
  PLAN_METRIC_RANGES,
  PLAN_NAME_MAX_LENGTH,
  PLAN_NOTES_MAX_LENGTH,
  type PlanStartOption,
} from "@workspace/api-client";

import { parseDateKey } from "@/features/training-calendar/lib/calendar-dates";

import { parseGoal, type GoalFieldValues } from "./goal-fields";
import { parseDuration, parsePace } from "./plan-format";

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

export const planWizardSchema = z
  .object({
    goalType: z.enum(ATHLETE_GOAL_TYPES),
    goalTarget: z.record(z.string(), z.string()),
    goalCurrent: z.record(z.string(), z.string()),
    goalDescription: z.string().max(2000),
    goalTargetDate: z.string(),
    trainingDays: z.array(z.number().int().min(0).max(6)).min(1, ERROR.days),
    preferredLongRunDay: z.number().int().min(0).max(6).nullable(),
    workoutDurationMinutes: z
      .number({ error: ERROR.invalid })
      .int(ERROR.invalid)
      .min(PLAN_WIZARD_LIMITS.workoutDurationMinutes.min, ERROR.invalid)
      .max(PLAN_WIZARD_LIMITS.workoutDurationMinutes.max, ERROR.invalid),
    totalWeeks: z
      .number({ error: ERROR.invalid })
      .int(ERROR.invalid)
      .min(PLAN_WIZARD_LIMITS.weeks.min, ERROR.invalid)
      .max(PLAN_WIZARD_LIMITS.weeks.max, ERROR.invalid),
    sessionsPerWeek: z
      .number({ error: ERROR.invalid })
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
      ctx.addIssue({ code: "custom", path: formPath, message });
    }

    if (
      values.goalTargetDate !== "" &&
      parseDateKey(values.goalTargetDate) === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["goalTargetDate"],
        message: ERROR.invalid,
      });
    }

    if (values.sessionsPerWeek > values.trainingDays.length) {
      ctx.addIssue({
        code: "custom",
        path: ["sessionsPerWeek"],
        message: ERROR.sessions,
      });
    }

    for (const issue of validateMetrics(values.metrics)) {
      ctx.addIssue({
        code: "custom",
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

export function clamp(
  value: number,
  range: { min: number; max: number },
): number {
  return Math.min(range.max, Math.max(range.min, value));
}

export type { GoalFieldValues };
